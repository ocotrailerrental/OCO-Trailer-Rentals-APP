# OCO Trailer Rentals

Customer-facing trailer rental platform for OCO Trailer Rentals LLC — Omaha, Nebraska
and Anchorage, Alaska.

## Stack

- **React 19 + TypeScript**
- **TanStack Start** (server-rendered / prerendered) with file-based routing under `src/routes/`
- **TanStack Query** for data fetching
- **Tailwind CSS v4** — every design token lives in `src/index.css` and nowhere else
- **Supabase** — Postgres, Auth, Storage, and row-level security

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the two values
npm run dev               # http://localhost:3000
```

### Environment

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API keys |

Anything prefixed `VITE_` is compiled into the JavaScript sent to every visitor.
The service-role key, the Stripe secret key, and the Stripe webhook signing secret
must never appear here — they belong in Supabase Edge Function secrets.

If either value is missing, the app renders a plain configuration notice explaining
what to set rather than a blank page.

## Scripts

```bash
npm run dev           # dev server
npm run build         # type check, then production build into dist/
npm run lint          # types, then ESLint, then Stylelint
npm run lint:types    # tsc --noEmit
```

`npm run build` runs `tsc --noEmit` first on purpose: a type error should fail the
deploy rather than ship. `npm run build:nocheck` skips it for local experiments.

## Deployment

Deployed on Vercel. Build command `npm run build`, output directory `dist`.
Set both environment variables under Project Settings → Environment Variables.

## Database

The schema lives in Supabase and is the authority on business rules. Tables are
prefixed `oco_`:

`oco_profiles` · `oco_locations` · `oco_trailers` · `oco_reservations` ·
`oco_payments` · `oco_inspections` · `oco_inspection_photos`

Three things worth knowing before changing anything:

- **Double-booking is prevented by the database**, not by application code — a GiST
  exclusion constraint on `oco_reservations` rejects any overlapping date range for
  the same trailer while a reservation is pending, confirmed or active.
- **Pricing is calculated server-side** in `oco_create_reservation`. The estimate in
  `src/lib/booking.ts` mirrors that function so the customer sees the amount they
  will actually be charged. Change one and you must change the other in the same commit.
- **Rental days are counted inclusively** — the pickup day and the return day are both
  billed. 25 Aug → 1 Sep is 8 days.

## Roles

`customer` · `manager` · `admin` · `owner`, stored on `oco_profiles.role`.

Customers cannot set their own role: a trigger on `oco_profiles` rejects any role
change attempted by a non-staff account. Authorization is enforced by row-level
security policies in Postgres — hiding a button in the interface is not access control.
