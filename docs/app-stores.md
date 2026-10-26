# Publishing OCO Trailer Rentals to the App Store and Google Play

The iOS and Android apps are the same React app as the website, bundled on the
device with Capacitor and built in the cloud by Codemagic. One codebase: a change
merged to `main` goes to the website through Vercel, and to the apps the next time
a Codemagic build is run.

| | |
|---|---|
| App name | OCO Trailer Rentals |
| Bundle ID / package | `com.ocotrailerrentals.app` — permanent once uploaded |
| iOS | iPhone only, iOS 15+ (Capacitor 8 default) |
| Builds | `codemagic.yaml` — `ios-testflight`, `android-play-internal` |
| Support URL | https://ocotrailerrentals.com/support |
| Privacy URL | https://ocotrailerrentals.com/privacy |
| Account deletion | In app: Account → Delete account (`account` edge function) |

---

## 1. Enroll (Robert — about an hour, then waiting)

Enroll as the **organization** OCO Trailer Rentals LLC on both, using the D-U-N-S
number and an `@ocotrailerrentals.com` address. Enrolling as an individual puts
your personal name on the store listing.

**Apple Developer Program** — developer.apple.com/programs/enroll — $99/year.
Apple phones to verify you are authorized to sign for the LLC. Typically a few days.

**Google Play Console** — play.google.com/console/signup — $25 once. Choose
"Organization". Google verifies the business and a contact phone. Organization
accounts are not subject to the closed-testing rule that applies to new personal
accounts.

## 2. Create the app records

**App Store Connect** → Apps → + New App: iOS, name "OCO Trailer Rentals",
bundle ID `com.ocotrailerrentals.app` (register it first under Certificates,
Identifiers & Profiles → Identifiers), SKU `oco-trailer-rentals`. Copy the numeric
**Apple ID** from App Information into `APP_STORE_APPLE_ID` in `codemagic.yaml`.

Then Users and Access → Integrations → App Store Connect API → generate a key with
**App Manager** access. Download the `.p8` once — Apple will not show it again.

**Play Console** → Create app: "OCO Trailer Rentals", App, Free. Then in Google
Cloud, create a service account, give it access in Play Console → Users and
permissions (Release manager), and download its JSON key.

## 3. Connect Codemagic (one time)

1. codemagic.io → sign in with GitHub → add `ocotrailerrental/OCO-Trailer-Rentals-APP`.
2. Team settings → Integrations → Developer Portal → add the App Store Connect API
   key; name it exactly **`OCO App Store Connect`**.
3. Code signing → iOS: let Codemagic fetch/create the distribution certificate and
   App Store profile for `com.ocotrailerrentals.app`.
4. Code signing → Android: generate a new upload keystore, reference name
   **`oco_upload`**. Codemagic keeps it; download a backup and store it safely —
   with Play App Signing a lost upload key can be reset, but it is a support ticket.
5. Environment variables → group **`oco_web`**: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` — the same values
   as Vercel. Group **`google_play`**: `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` = the
   service-account JSON, marked secure.

## 4. Build

Run **iOS → TestFlight** and **Android → Play internal testing** from the
Codemagic dashboard.

Google requires the **first** Android bundle to be uploaded by hand: download the
`.aab` from the Codemagic build's artifacts and upload it in Play Console →
Testing → Internal testing. Every later build uploads itself.

## 5. Test before submitting

TestFlight (iOS) and internal testing (Android): install on your phone and on
James's. Walk through: sign up → confirm email → book → card on file → draw a
signature → submit → yard approves → cancel → Account → Delete account (on a
throwaway account). Check the Android back button and that phone/email links open
the dialer and mail app.

## 6. Store listing content

**Name:** OCO Trailer Rentals
**Subtitle (iOS, 30):** Car hauler rentals, AK and NE
**Short description (Play, 80):** Reserve a car hauler trailer in Anchorage or Omaha. Sign and pay in the app.
**Category:** Travel (iOS) · Auto & Vehicles (Play)
**Keywords (iOS, 100):** trailer rental,car hauler,car trailer,Anchorage,Omaha,tow,haul,flatbed,vehicle transport
**Promotional text (iOS):** Book a car hauler in minutes. Transparent daily, weekly and monthly rates.

**Description:**

> Rent a car hauler trailer from OCO Trailer Rentals in Anchorage, Alaska or
> Omaha, Nebraska.
>
> • See which trailers are free for your dates and the full price before you book
> • Daily, weekly and monthly rates, applied automatically
> • Read and sign the rental agreement on your phone
> • Keep your licence and insurance on file so the next booking is faster
> • Get an email when your yard approves the booking, with pickup details
> • Cancel free up to 24 hours before pickup
>
> Our 20-foot (Omaha) and 24-foot (Anchorage) tandem-axle car haulers have their
> weight ratings, coupler size and wiring listed on every trailer page, so you can
> check them against your tow vehicle before you reserve.

**Screenshots:** iPhone 6.9" (1320 × 2868) — at least 3; Android phone — at least
2, plus a 1024 × 500 feature graphic. Suggested screens: trailer list with prices,
trailer detail with specs, booking summary, agreement with signature block, My
Rentals.

**Age rating:** 4+ / Everyone (no objectionable content). Renting requires 18+,
which the agreement enforces; that is a business rule, not a content rating.

## 7. Privacy answers

Both stores ask what the app collects. None of it is used for tracking or
advertising, and none is sold.

| Data | Collected | Linked to user | Purpose |
|---|---|---|---|
| Name, email, phone, mailing address | Yes | Yes | App functionality (bookings, contract) |
| Driver's licence state/last 4/expiry, date of birth, licence image | Yes | Yes | App functionality (eligibility) |
| Insurance details and document | Yes | Yes | App functionality |
| Payment info (card held by Stripe; OCO stores brand + last 4) | Yes | Yes | App functionality (payments) |
| Signature (drawn image + typed name) | Yes — "Other user content" | Yes | App functionality (contract) |
| Purchase history (reservations) | Yes | Yes | App functionality |
| Location, contacts, browsing, identifiers for ads | No | — | — |

Apple: "Data Used to Track You" — **None**. Play Data safety: data is encrypted in
transit; users can request deletion (in app); data is not shared with third
parties except service providers (Supabase, Stripe).

## 8. Review notes

**Apple — App Review Information:**
- Sign-in required: yes. Provide a demo customer account (create one, e.g.
  `appreview@ocotrailerrentals.com`, with its own password — do not reuse yours).
- Notes:

> OCO Trailer Rentals rents physical car-hauler trailers collected in person in
> Anchorage, AK and Omaha, NE. Payments are for this physical rental service and
> are taken by Stripe, so In-App Purchase does not apply (guideline 3.1.3(e)).
> Bookings are requests; staff approve them. Please book any future date — the
> request will be declined by staff and no card is charged until pickup.
> Account deletion: Account → Delete account.

**Before submitting:** tell both yards that a reviewer may place a booking request,
so they decline it rather than call the reviewer.

## 9. Submit

iOS: in App Store Connect pick the TestFlight build, complete the listing, choose
**Manually release this version**, and submit. Android: promote the internal build
to Production in Play Console, complete Data safety and Content rating, and send
for review.
