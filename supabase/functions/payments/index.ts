// OCO payments — Stripe, server side only.
//
// The browser never sees a secret key and never sends a card number anywhere but
// Stripe. This function does five things:
//
//   POST /payments/setup-intent     signed-in customer saves a card for later
//   POST /payments/collect          staff charge the rental and place the deposit hold
//   POST /payments/settle-deposit   staff release or capture the deposit at return
//   POST /payments/webhook          Stripe tells us what really happened
//   POST /payments/status           staff check how payments are configured
//
// Nothing is treated as paid because the browser said so. The three action routes
// create intents; the webhook, whose signature is verified, is what writes a
// payment to `paid`. That ordering is deliberate — a client that lies, retries or
// dies halfway cannot manufacture a settled payment.
//
// Fails closed: with no STRIPE_SECRET_KEY the whole function answers 503.

import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

// Live and test deliveries arrive at this same URL but are signed with different
// secrets. Holding both means switching the account between modes is a matter of
// swapping the secret key, with no webhook to remember. Whichever secret verifies
// the signature is the one that sent it.
const WEBHOOK_SECRETS = [
  Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "",
  Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "",
].filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = SECRET
  ? new Stripe(SECRET, { apiVersion: "2024-12-18.acacia", httpClient: Stripe.createFetchHttpClient() })
  : null;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const cents = (n: number) => Math.round(Number(n) * 100);

/** The signed-in caller, established from their own JWT — never from the body. */
async function callerFromRequest(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin
    .from("oco_profiles").select("id, role, location_id, full_name, email")
    .eq("id", data.user.id).maybeSingle();
  return profile ?? null;
}

const isStaff = (p: { role?: string } | null) =>
  !!p && ["manager", "admin", "owner"].includes(String(p.role));
const isAdmin = (p: { role?: string } | null) =>
  !!p && ["admin", "owner"].includes(String(p.role));

/** Staff may only act on a reservation at a yard they run. */
function staffMayTouch(profile: any, reservation: any) {
  if (isAdmin(profile)) return true;
  if (!isStaff(profile)) return false;
  return profile.location_id === reservation.pickup_location_id
      || profile.location_id === reservation.return_location_id;
}

async function stripeCustomerFor(profile: any) {
  const { data: existing } = await admin
    .from("oco_customer_billing").select("*").eq("profile_id", profile.id).maybeSingle();
  if (existing?.stripe_customer_id) return existing;

  const customer = await stripe!.customers.create({
    email: profile.email ?? undefined,
    name: profile.full_name ?? undefined,
    metadata: { oco_profile_id: profile.id },
  });
  const { data: created } = await admin
    .from("oco_customer_billing")
    .upsert({ profile_id: profile.id, stripe_customer_id: customer.id }, { onConflict: "profile_id" })
    .select().maybeSingle();
  return created;
}

async function recordPayment(row: Record<string, unknown>) {
  await admin.from("oco_payments").insert(row);
}

// --------------------------------------------------------------------- routes

/**
 * How payments are configured, for staff only. No secret is returned — only
 * whether each one is present, and which mode the key is for. Without this the
 * only way to find out that a webhook secret is missing is to take a real
 * payment and watch it never confirm.
 */
async function status(req: Request) {
  const profile = await callerFromRequest(req);
  if (!isStaff(profile)) return json({ error: "Staff only." }, 403);

  const mode = SECRET.startsWith("sk_live_") ? "live"
             : SECRET.startsWith("sk_test_") ? "test"
             : SECRET ? "unrecognised" : "missing";

  let account: string | null = null;
  let accountError: string | null = null;
  try {
    const acct = await stripe!.accounts.retrieve();
    account = acct.id;
  } catch (err) {
    accountError = (err as Error).message;
  }

  return json({
    secret_key: SECRET ? `present (${mode})` : "missing",
    webhook_secrets: WEBHOOK_SECRETS.length,
    webhook_ready: WEBHOOK_SECRETS.length > 0,
    stripe_account: account,
    stripe_error: accountError,
    note: WEBHOOK_SECRETS.length === 0
      ? "No webhook signing secret. Cards can be entered but nothing will ever be recorded as saved or paid."
      : "Configured. A live charge is still only proven by a real walkthrough.",
  });
}

/** The customer adds a card. Nothing is charged — this only stores it for later. */
async function setupIntent(req: Request) {
  const profile = await callerFromRequest(req);
  if (!profile) return json({ error: "Sign in first." }, 401);

  // Saving a card is pointless while the webhook cannot be verified: the card
  // details are written by the webhook, so it would look saved and then vanish.
  // Better to say so than to let a customer type a card number for nothing.
  if (WEBHOOK_SECRETS.length === 0) {
    return json({ error: "Card payments are not finished being set up. Please choose cash for now." }, 503);
  }

  const billing = await stripeCustomerFor(profile);
  const intent = await stripe!.setupIntents.create({
    customer: billing!.stripe_customer_id,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { oco_profile_id: profile.id },
  });
  return json({ client_secret: intent.client_secret });
}

/**
 * Collection. Charges the rental against the saved card and places a separate
 * authorisation for the deposit that is captured only if the return inspection
 * finds damage.
 */
async function collect(req: Request) {
  const profile = await callerFromRequest(req);
  if (!isStaff(profile)) return json({ error: "Staff only." }, 403);

  const { reservation_id } = await req.json().catch(() => ({}));
  if (!reservation_id) return json({ error: "reservation_id is required." }, 400);

  const { data: r } = await admin
    .from("oco_reservations").select("*").eq("id", reservation_id).maybeSingle();
  if (!r) return json({ error: "Reservation not found." }, 404);
  if (!staffMayTouch(profile, r)) return json({ error: "Not your location." }, 403);
  if (r.payment_method !== "card") return json({ error: "This rental is being paid in cash." }, 400);
  if (r.rental_charge_status === "succeeded") return json({ error: "Already charged." }, 409);

  const { data: billing } = await admin
    .from("oco_customer_billing").select("*").eq("profile_id", r.customer_id).maybeSingle();
  if (!billing?.payment_method_id) {
    return json({ error: "No card on file for this customer. Take payment another way." }, 409);
  }

  const dueNow = Number(r.total) - Number(r.security_deposit);
  const shared = {
    customer: billing.stripe_customer_id,
    payment_method: billing.payment_method_id,
    off_session: true,
    confirm: true,
    currency: "usd",
  } as const;

  let rental: Stripe.PaymentIntent | null = null;
  if (dueNow > 0) {
    rental = await stripe!.paymentIntents.create({
      ...shared,
      amount: cents(dueNow),
      description: `OCO rental ${r.reservation_number}`,
      metadata: { oco_reservation_id: r.id, oco_purpose: "rental" },
    });
    await recordPayment({
      reservation_id: r.id, customer_id: r.customer_id, amount: dueNow,
      method: "card", status: "processing", provider: "stripe",
      provider_payment_id: rental.id, purpose: "rental",
    });
  }

  // Manual capture: the money is held on the card, not taken. Card networks let
  // an authorisation stand for about seven days; a rental longer than that needs
  // the deposit taking another way, which is why the length is worth watching.
  let hold: Stripe.PaymentIntent | null = null;
  const deposit = Number(r.security_deposit);
  if (deposit > 0 && !r.deposit_hold_id) {
    hold = await stripe!.paymentIntents.create({
      ...shared,
      amount: cents(deposit),
      capture_method: "manual",
      description: `OCO security deposit ${r.reservation_number}`,
      metadata: { oco_reservation_id: r.id, oco_purpose: "deposit_hold" },
    });
    await recordPayment({
      reservation_id: r.id, customer_id: r.customer_id, amount: deposit,
      method: "card", status: "pending", provider: "stripe",
      provider_payment_id: hold.id, purpose: "deposit_hold",
    });
  }

  await admin.from("oco_reservations").update({
    rental_charge_id: rental?.id ?? r.rental_charge_id,
    rental_charge_status: rental ? "pending" : r.rental_charge_status,
    deposit_hold_id: hold?.id ?? r.deposit_hold_id,
    deposit_hold_status: hold ? "requires_capture" : r.deposit_hold_status,
  }).eq("id", r.id);

  return json({
    rental_intent: rental?.id ?? null,
    rental_status: rental?.status ?? null,
    deposit_intent: hold?.id ?? null,
    note: "Payment is confirmed by Stripe's webhook, not by this response.",
  });
}

/** Return inspection done: give the deposit back, or take some of it. */
async function settleDeposit(req: Request) {
  const profile = await callerFromRequest(req);
  if (!isStaff(profile)) return json({ error: "Staff only." }, 403);

  const body = await req.json().catch(() => ({}));
  const { reservation_id, action } = body;
  const amount = body.amount == null ? null : Number(body.amount);
  if (!reservation_id || !["release", "capture"].includes(action)) {
    return json({ error: "reservation_id and action (release|capture) are required." }, 400);
  }

  const { data: r } = await admin
    .from("oco_reservations").select("*").eq("id", reservation_id).maybeSingle();
  if (!r) return json({ error: "Reservation not found." }, 404);
  if (!staffMayTouch(profile, r)) return json({ error: "Not your location." }, 403);
  if (!r.deposit_hold_id) return json({ error: "There is no deposit hold on this rental." }, 409);
  if (r.deposit_hold_status !== "requires_capture") {
    return json({ error: `The deposit hold is already ${r.deposit_hold_status}.` }, 409);
  }
  // Charging a deposit is taking someone's money over a damage claim. A manager
  // may release it; only an administrator or owner may capture it.
  if (action === "capture" && !isAdmin(profile)) {
    return json({ error: "Only an administrator or owner can charge a deposit." }, 403);
  }

  if (action === "release") {
    await stripe!.paymentIntents.cancel(r.deposit_hold_id);
    await admin.from("oco_reservations")
      .update({ deposit_hold_status: "released" }).eq("id", r.id);
    await admin.from("oco_payments").update({ status: "cancelled" })
      .eq("provider_payment_id", r.deposit_hold_id);
    return json({ deposit: "released" });
  }

  const held = Number(r.security_deposit);
  const take = amount == null ? held : Math.min(Math.max(amount, 0), held);
  if (take <= 0) return json({ error: "Nothing to charge — release it instead." }, 400);

  const captured = await stripe!.paymentIntents.capture(r.deposit_hold_id, {
    amount_to_capture: cents(take),
  });
  await admin.from("oco_reservations")
    .update({ deposit_hold_status: "captured" }).eq("id", r.id);
  await recordPayment({
    reservation_id: r.id, customer_id: r.customer_id, amount: take,
    method: "card", status: "processing", provider: "stripe",
    provider_payment_id: captured.id, purpose: "deposit_charge",
  });
  return json({ deposit: "charged", amount: take });
}

/**
 * Stripe's account of what happened. The signature is verified before anything is
 * believed, and this is the only path that marks money as received.
 */
async function webhook(req: Request) {
  if (WEBHOOK_SECRETS.length === 0) {
    return json({ error: "No webhook signing secret is configured." }, 503);
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing signature." }, 400);

  const raw = await req.text();
  let event: Stripe.Event | null = null;
  let lastError = "";
  for (const secret of WEBHOOK_SECRETS) {
    try {
      event = await stripe!.webhooks.constructEventAsync(raw, signature, secret);
      break;
    } catch (err) {
      lastError = (err as Error).message;
    }
  }
  if (!event) return json({ error: `Signature check failed: ${lastError}` }, 400);

  const intent = event.data.object as Stripe.PaymentIntent;
  const reservationId = intent?.metadata?.oco_reservation_id ?? null;
  const purpose = intent?.metadata?.oco_purpose ?? null;

  switch (event.type) {
    case "payment_intent.succeeded": {
      await admin.from("oco_payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("provider_payment_id", intent.id);
      if (reservationId && purpose === "rental") {
        await admin.from("oco_reservations").update({
          rental_charge_status: "succeeded",
          payment_status: "paid",
        }).eq("id", reservationId);
      }
      break;
    }
    case "payment_intent.amount_capturable_updated": {
      if (reservationId && purpose === "deposit_hold") {
        await admin.from("oco_reservations")
          .update({ deposit_hold_status: "requires_capture" }).eq("id", reservationId);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      await admin.from("oco_payments").update({ status: "failed" })
        .eq("provider_payment_id", intent.id);
      if (reservationId) {
        const patch = purpose === "deposit_hold"
          ? { deposit_hold_status: "failed" }
          : { rental_charge_status: "failed", payment_status: "failed" };
        await admin.from("oco_reservations").update(patch).eq("id", reservationId);
      }
      break;
    }
    case "payment_intent.canceled": {
      await admin.from("oco_payments").update({ status: "cancelled" })
        .eq("provider_payment_id", intent.id);
      break;
    }
    case "setup_intent.succeeded": {
      // The customer's card is saved. Keep the brand and last four so staff can
      // recognise it; the number itself stays at Stripe.
      const setup = event.data.object as Stripe.SetupIntent;
      const profileId = setup.metadata?.oco_profile_id;
      if (profileId && setup.payment_method) {
        const pm = await stripe!.paymentMethods.retrieve(String(setup.payment_method));
        await admin.from("oco_customer_billing").update({
          payment_method_id: pm.id,
          card_brand: pm.card?.brand ?? null,
          card_last4: pm.card?.last4 ?? null,
          card_exp_month: pm.card?.exp_month ?? null,
          card_exp_year: pm.card?.exp_year ?? null,
        }).eq("profile_id", profileId);
      }
      break;
    }
  }

  // Always 200 once the signature checks out, so Stripe does not retry-storm over
  // a problem on our side. Anything unusual is visible in the payment rows.
  return json({ received: true });
}

Deno.serve(async (req) => {
  if (!stripe) return json({ error: "Payments are not configured yet." }, 503);
  const path = new URL(req.url).pathname.replace(/^\/payments/, "") || "/";
  if (req.method !== "POST") return json({ error: "POST only." }, 405);

  try {
    if (path === "/setup-intent") return await setupIntent(req);
    if (path === "/collect") return await collect(req);
    if (path === "/settle-deposit") return await settleDeposit(req);
    if (path === "/webhook") return await webhook(req);
    if (path === "/status") return await status(req);
    return json({ error: "Unknown route." }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
