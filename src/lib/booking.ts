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

export function rentalDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

export function rentalEstimate(days: number, trailer: Pick<Trailer, 'daily_rate' | 'weekly_rate' | 'monthly_rate' | 'security_deposit'>, deliveryMiles = 0) {
  const months = Math.floor(days / 30)
  const weeks = Math.floor((days - months * 30) / 7)
  const remainingDays = days - months * 30 - weeks * 7
  const rentalSubtotal = months * Number(trailer.monthly_rate) + weeks * Number(trailer.weekly_rate) + remainingDays * Number(trailer.daily_rate)
  const deliveryFee = Math.max(0, deliveryMiles) * 0.5
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
