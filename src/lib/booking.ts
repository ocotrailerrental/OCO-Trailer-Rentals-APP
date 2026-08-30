export type Location = {
  id: string
  name: string
  city: string
  state: string
  timezone: string
}

export type Trailer = {
  id: string
  location_id: string
  name: string
  slug: string
  trailer_type: string
  length_feet: number
  description: string | null
  image_url: string | null
  gvwr_lbs: number | null
  payload_lbs: number | null
  hitch_type: string | null
  brake_connector: string | null
  daily_rate: number
  weekly_rate: number
  monthly_rate: number
  security_deposit: number
  status: string
  // Specification fields. Optional because `oco_search_available_trailers` does
  // not return them — the availability list does not need them, and typing them
  // as required would make every cast of an RPC row a quiet lie.
  axle_config?: string | null
  axle_rating_lbs?: number | null
  empty_weight_lbs?: number | null
  tongue_weight_lbs?: number | null
  deck_length_ft?: number | null
  deck_width_in?: number | null
  deck_surface?: string | null
  ramp_type?: string | null
  tire_size?: string | null
  brake_type?: string | null
  min_tow_vehicle?: string | null
  features?: string[] | null
}

/**
 * Every trailer column the public pages read. Kept as one constant so the
 * homepage, the availability list and the trailer detail page cannot drift apart
 * — a column added here reaches all three at once.
 *
 * VIN, licence plate and asset number are deliberately absent. They live in
 * `oco_trailer_registration`, which is staff-only at the database level.
 */
export const TRAILER_COLUMNS =
  'id,location_id,name,slug,trailer_type,length_feet,description,image_url,' +
  'gvwr_lbs,payload_lbs,hitch_type,brake_connector,daily_rate,weekly_rate,' +
  'monthly_rate,security_deposit,status,axle_config,axle_rating_lbs,' +
  'empty_weight_lbs,tongue_weight_lbs,deck_length_ft,deck_width_in,' +
  'deck_surface,ramp_type,tire_size,brake_type,min_tow_vehicle,features'

export type Spec = { label: string; value: string; note?: string }

const pounds = (value: number | null | undefined) =>
  value == null ? null : `${Number(value).toLocaleString('en-US')} lb`

/**
 * Turns a trailer row into the specification rows the detail page lists.
 *
 * A spec with no value in the database is omitted entirely rather than shown as
 * "—" or filled with a plausible default. These numbers tell a customer what
 * they can safely tow, so a blank is honest and a guess is not.
 */
export function trailerSpecs(trailer: Trailer): Spec[] {
  const rows: (Spec | null)[] = [
    { label: 'Length', value: `${trailer.length_feet} ft` },
    trailer.deck_length_ft ? { label: 'Deck length', value: `${trailer.deck_length_ft} ft` } : null,
    trailer.deck_width_in ? { label: 'Deck width', value: `${trailer.deck_width_in} in` } : null,
    trailer.deck_surface ? { label: 'Deck surface', value: trailer.deck_surface } : null,
    trailer.gvwr_lbs
      ? { label: 'GVWR', value: pounds(trailer.gvwr_lbs)!, note: 'Trailer plus cargo, fully loaded' }
      : null,
    trailer.payload_lbs
      ? { label: 'Payload capacity', value: pounds(trailer.payload_lbs)!, note: 'The most you can put on the deck' }
      : null,
    trailer.empty_weight_lbs ? { label: 'Empty weight', value: pounds(trailer.empty_weight_lbs)! } : null,
    trailer.tongue_weight_lbs ? { label: 'Tongue weight', value: pounds(trailer.tongue_weight_lbs)! } : null,
    trailer.axle_config ? { label: 'Axles', value: trailer.axle_config } : null,
    trailer.axle_rating_lbs ? { label: 'Axle rating', value: `${pounds(trailer.axle_rating_lbs)} each` } : null,
    trailer.brake_type ? { label: 'Brakes', value: trailer.brake_type } : null,
    trailer.hitch_type ? { label: 'Coupler', value: `${trailer.hitch_type} ball` } : null,
    trailer.brake_connector ? { label: 'Wiring', value: `${trailer.brake_connector} connector` } : null,
    trailer.tire_size ? { label: 'Tires', value: trailer.tire_size } : null,
    trailer.ramp_type ? { label: 'Ramps', value: trailer.ramp_type } : null,
    trailer.min_tow_vehicle ? { label: 'Tow vehicle', value: trailer.min_tow_vehicle } : null,
  ]
  return rows.filter((row): row is Spec => row !== null)
}

export type BookingSearch = {
  pickupLocationId: string
  returnLocationId: string
  startDate: string
  endDate: string
  delivery: boolean
}

export type ReserveSearch = BookingSearch & { trailerId: string }

export type Reservation = {
  id: string
  reservation_number: string
  customer_id: string
  trailer_id: string
  pickup_location_id: string
  return_location_id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  start_date: string
  end_date: string
  pickup_method: string
  delivery_address: string | null
  delivery_miles: number
  delivery_fee: number
  rental_subtotal: number
  security_deposit: number
  taxes: number
  total: number
  payment_method: string
  payment_status: string
  reservation_status: string
  customer_notes: string | null
  created_at: string
}

export type Payment = {
  id: string
  amount: number
  method: string
  status: string
  provider: string | null
  paid_at: string | null
  created_at: string
}

export function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localDateString(value)
}

/**
 * Billable rental days, counted INCLUSIVELY — the pickup day and the return day
 * are both charged. 25 Aug → 1 Sep is 8 days, not 7.
 *
 * This MUST agree with `oco_create_reservation` in Supabase, which computes
 * `(p_end_date - p_start_date) + 1`. The database decides what the customer is
 * actually charged; this function exists only so the on-screen quote matches it.
 * Change one without the other and the app quotes a price it does not charge.
 */
export function rentalDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  return Math.round((end - start) / 86_400_000) + 1
}

/**
 * Mirrors the rate ladder in `oco_create_reservation`: whole 30-day periods at the
 * monthly rate first, then whole 7-day periods at the weekly rate, then the
 * remaining days at the daily rate. Delivery is $0.50/mile — still hard-coded here
 * and in SQL; Phase 2 moves it into the locations table.
 */
export function rentalEstimate(days: number, trailer: Pick<Trailer, 'daily_rate' | 'weekly_rate' | 'monthly_rate' | 'security_deposit'>, deliveryMiles = 0) {
  const billableDays = Math.max(0, days)
  const months = Math.floor(billableDays / 30)
  const weeks = Math.floor((billableDays - months * 30) / 7)
  const remainingDays = billableDays - months * 30 - weeks * 7
  const rentalSubtotal = months * Number(trailer.monthly_rate) + weeks * Number(trailer.weekly_rate) + remainingDays * Number(trailer.daily_rate)
  const deliveryFee = Math.round(Math.max(0, deliveryMiles) * 0.5 * 100) / 100
  return {
    months,
    weeks,
    days: remainingDays,
    rentalSubtotal,
    deliveryFee,
    deposit: Number(trailer.security_deposit) || 0,
    taxes: 0,
    total: rentalSubtotal + deliveryFee + (Number(trailer.security_deposit) || 0),
  }
}

export function parseBookingSearch(search: Record<string, unknown>): BookingSearch {
  return {
    pickupLocationId: typeof search.pickupLocationId === 'string' ? search.pickupLocationId : '',
    returnLocationId: typeof search.returnLocationId === 'string' ? search.returnLocationId : '',
    startDate: typeof search.startDate === 'string' ? search.startDate : '',
    endDate: typeof search.endDate === 'string' ? search.endDate : '',
    delivery: search.delivery === true || search.delivery === 'true',
  }
}

export function parseReserveSearch(search: Record<string, unknown>): ReserveSearch {
  return { ...parseBookingSearch(search), trailerId: typeof search.trailerId === 'string' ? search.trailerId : '' }
}

export function safeInternalRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) return undefined
  return value
}

export function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

export function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}
