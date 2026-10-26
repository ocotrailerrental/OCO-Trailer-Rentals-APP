// OCO account — customer self-service account deletion.
//
//   POST /account/delete   the signed-in customer deletes their own account
//
// Apple (guideline 5.1.1(v)) and Google Play both require that an app which lets
// people create an account also lets them delete it from inside the app.
//
// What is deleted: the login, the profile, saved addresses and tow vehicle, the
// licence and insurance details and their uploaded images, and the saved card
// (the Stripe customer is deleted, which detaches the card).
//
// What is kept: reservations, signed rental agreements, payments and inspection
// records. They are business records OCO is entitled to keep, and they carry
// their own copy of the renter's name and contact. Only the link to the deleted
// login is cleared (customer_id becomes null; see migration
// account_deletion_keeps_rental_records).
//
// Refused while the customer has a pending, confirmed or active rental — those
// have to be cancelled or completed first, or a trailer could be out with no
// account behind it. Refused for staff, so an owner cannot lock themselves out.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const BUCKET = "oco-inspection-photos";
const OPEN_STATUSES = ["draft", "pending", "confirmed", "active"];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if (route !== "delete") return json({ error: "Not found." }, 404);

  // Who is asking comes from their own token, never from the body.
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return json({ error: "Sign in first." }, 401);
  const { data: who, error: whoError } = await admin.auth.getUser(token);
  if (whoError || !who.user) return json({ error: "Your session has expired. Sign in again." }, 401);
  const userId = who.user.id;

  const { data: profile } = await admin
    .from("oco_profiles").select("id, role").eq("id", userId).maybeSingle();
  if (profile && profile.role !== "customer") {
    return json({
      error: "Staff accounts cannot be deleted from the app. Ask an owner to change your role to customer first.",
    }, 403);
  }

  const { data: open, error: openError } = await admin
    .from("oco_reservations").select("reservation_number, reservation_status")
    .eq("customer_id", userId).in("reservation_status", OPEN_STATUSES);
  if (openError) return json({ error: "Could not check your rentals. Nothing was deleted." }, 500);
  if (open && open.length) {
    return json({
      error: "You have a rental that is still open. Cancel it, or wait until it has been returned, then delete your account.",
      open_reservations: open.map((r) => r.reservation_number),
    }, 409);
  }

  const problems: string[] = [];

  // Licence and insurance uploads live under <user id>/documents/. Inspection
  // photos are filed against reservations and are kept with the rental record.
  const folder = `${userId}/documents`;
  const { data: files } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (files && files.length) {
    const { error } = await admin.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`));
    if (error) problems.push(`documents: ${error.message}`);
  }

  // Saved card: deleting the Stripe customer detaches its payment methods.
  const { data: billing } = await admin
    .from("oco_customer_billing").select("stripe_customer_id").eq("profile_id", userId).maybeSingle();
  if (billing?.stripe_customer_id && STRIPE_SECRET) {
    const res = await fetch(`https://api.stripe.com/v1/customers/${billing.stripe_customer_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    });
    if (!res.ok && res.status !== 404) problems.push(`stripe: ${res.status}`);
  }

  const { error: markError } = await admin.rpc("oco_mark_customer_deleted", { p_customer_id: userId });
  if (markError) problems.push(`mark: ${markError.message}`);

  // Cascades to oco_profiles, oco_customer_verification and oco_customer_billing;
  // rental records keep their row with customer_id set to null.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: "Your account could not be deleted. Nothing about your login has changed. Please contact us." }, 500);
  }

  if (problems.length) console.error("account delete: partial cleanup", userId, problems);
  return json({ deleted: true });
});
