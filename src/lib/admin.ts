import { supabase } from '@/lib/supabase'

/**
 * Data for the admin console.
 *
 * Everything here is readable only because the signed-in account is staff — the
 * row-level policies on each table do the enforcing. Hiding the Admin link in the
 * sidebar is a courtesy, not a control: if a customer types the URL they reach the
 * page and every query comes back empty.
 */

export type AdminLocation = {
  id: string
  name: string
  slug: string
  city: string
  state: string
  address: string | null
  timezone: string
  contact_name: string | null
  contact_phone: string | null
  is_active: boolean
}

export type AdminTrailer = {
  id: string
  location_id: string
  name: string
  slug: string
  length_feet: number
  image_url: string | null
  gvwr_lbs: number | null
  payload_lbs: number | null
  axle_config: string | null
  daily_rate: number
  weekly_rate: number
  monthly_rate: number
  security_deposit: number
  status: string
  is_active: boolean
}

/** Staff-only identity data. Never exposed to the public pages. */
export type AdminRegistration = {
  trailer_id: string
  asset_number: string | null
  vin: string | null
  license_plate: string | null
  model_year: number | null
}

export type AdminProfile = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string
  location_id: string | null
  created_at: string
}

export type AdminReservation = {
  id: string
  reservation_number: string
  customer_id: string
  customer_name: string
  customer_email: string
  trailer_id: string
  pickup_location_id: string
  start_date: string
  end_date: string
  rental_subtotal: number
  delivery_fee: number
  security_deposit: number
  taxes: number
  total: number
  payment_method: string
  payment_status: string
  reservation_status: string
  created_at: string
}

export type AdminPayment = {
  id: string
  reservation_id: string
  customer_id: string
  amount: number
  method: string
  status: string
  provider: string | null
  paid_at: string | null
  created_at: string
}

export type AdminData = {
  locations: AdminLocation[]
  trailers: AdminTrailer[]
  registrations: AdminRegistration[]
  profiles: AdminProfile[]
  reservations: AdminReservation[]
  payments: AdminPayment[]
  isStaff: boolean
  isAdmin: boolean
  selfId: string
}

export const STAFF_ROLES = ['manager', 'admin', 'owner']
export const ALL_ROLES = ['customer', 'manager', 'admin', 'owner']

const num = (value: unknown) => Number(value) || 0

export async function loadAdminData(): Promise<AdminData> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.')
  const selfId = authData.user.id

  const { data: self, error: selfError } = await supabase
    .from('oco_profiles')
    .select('role')
    .eq('id', selfId)
    .maybeSingle()
  if (selfError) throw selfError
  const role = ((self as unknown as { role?: string } | null)?.role ?? 'customer').toLowerCase()
  const isStaff = STAFF_ROLES.includes(role)
  const isAdmin = role === 'admin' || role === 'owner'

  if (!isStaff) {
    return {
      locations: [], trailers: [], registrations: [], profiles: [],
      reservations: [], payments: [], isStaff: false, isAdmin: false, selfId,
    }
  }

  const [locations, trailers, registrations, profiles, reservations, payments] = await Promise.all([
    supabase
      .from('oco_locations')
      .select('id,name,slug,city,state,address,timezone,contact_name,contact_phone,is_active')
      .order('name'),
    supabase
      .from('oco_trailers')
      .select(
        'id,location_id,name,slug,length_feet,image_url,gvwr_lbs,payload_lbs,axle_config,' +
          'daily_rate,weekly_rate,monthly_rate,security_deposit,status,is_active'
      )
      .order('length_feet'),
    supabase
      .from('oco_trailer_registration')
      .select('trailer_id,asset_number,vin,license_plate,model_year'),
    supabase
      .from('oco_profiles')
      .select('id,full_name,email,phone,role,location_id,created_at')
      .order('created_at'),
    supabase
      .from('oco_reservations')
      .select(
        'id,reservation_number,customer_id,customer_name,customer_email,trailer_id,' +
          'pickup_location_id,start_date,end_date,rental_subtotal,delivery_fee,security_deposit,' +
          'taxes,total,payment_method,payment_status,reservation_status,created_at'
      )
      .order('start_date', { ascending: false }),
    supabase
      .from('oco_payments')
      .select('id,reservation_id,customer_id,amount,method,status,provider,paid_at,created_at')
      .order('created_at', { ascending: false }),
  ])

  if (locations.error) throw locations.error
  if (trailers.error) throw trailers.error
  if (registrations.error) throw registrations.error
  if (profiles.error) throw profiles.error
  if (reservations.error) throw reservations.error
  if (payments.error) throw payments.error

  return {
    locations: (locations.data ?? []) as unknown as AdminLocation[],
    trailers: (trailers.data ?? []) as unknown as AdminTrailer[],
    registrations: (registrations.data ?? []) as unknown as AdminRegistration[],
    profiles: (profiles.data ?? []) as unknown as AdminProfile[],
    reservations: (reservations.data ?? []) as unknown as AdminReservation[],
    payments: (payments.data ?? []) as unknown as AdminPayment[],
    isStaff, isAdmin, selfId,
  }
}

/* ------------------------------------------------------------------ finance */

export type Finance = {
  collectedCash: number
  collectedCard: number
  collectedTotal: number
  pendingCash: number
  pendingCard: number
  expectedRevenue: number
  outstanding: number
  depositsOnFile: number
  liveReservations: number
  byLocation: { locationId: string; collected: number; outstanding: number; rentals: number }[]
}

/** Reservations that no longer represent money owed. */
const DEAD = new Set(['cancelled', 'declined', 'draft'])

/**
 * Money, split by how it arrives.
 *
 * Two deliberate choices:
 *
 * 1. **The deposit is not revenue.** `oco_reservations.total` bundles the security
 *    deposit in with the rental, but the deposit is only ever charged if a return
 *    inspection finds damage. Counting it as expected income would overstate every
 *    figure on this page, so revenue here is total minus deposit, and deposits are
 *    reported separately as an amount held rather than taken.
 *
 * 2. **Collected means collected.** Only payments with status 'paid' count. Pending
 *    and processing are shown apart, because a card that has not settled and cash
 *    that has not been handed over are not in the business's hands.
 */
export function summariseFinance(data: AdminData): Finance {
  let collectedCash = 0
  let collectedCard = 0
  let pendingCash = 0
  let pendingCard = 0

  const paidByReservation = new Map<string, number>()

  for (const payment of data.payments) {
    const amount = num(payment.amount)
    const status = payment.status.toLowerCase()
    const isCash = payment.method.toLowerCase() === 'cash'
    if (status === 'paid') {
      if (isCash) collectedCash += amount
      else collectedCard += amount
      paidByReservation.set(
        payment.reservation_id,
        (paidByReservation.get(payment.reservation_id) ?? 0) + amount
      )
    } else if (status === 'pending' || status === 'processing') {
      if (isCash) pendingCash += amount
      else pendingCard += amount
    }
  }

  let expectedRevenue = 0
  let outstanding = 0
  let depositsOnFile = 0
  let liveReservations = 0

  const byLocation = new Map<string, { collected: number; outstanding: number; rentals: number }>()
  const bucket = (id: string) => {
    if (!byLocation.has(id)) byLocation.set(id, { collected: 0, outstanding: 0, rentals: 0 })
    return byLocation.get(id)!
  }

  for (const reservation of data.reservations) {
    const status = reservation.reservation_status.toLowerCase()
    if (DEAD.has(status)) continue

    const revenue = num(reservation.total) - num(reservation.security_deposit)
    const paid = paidByReservation.get(reservation.id) ?? 0
    const owed = Math.max(0, revenue - paid)

    expectedRevenue += revenue
    outstanding += owed
    liveReservations += 1
    if (status === 'confirmed' || status === 'active') {
      depositsOnFile += num(reservation.security_deposit)
    }

    const slot = bucket(reservation.pickup_location_id)
    slot.collected += paid
    slot.outstanding += owed
    slot.rentals += 1
  }

  return {
    collectedCash,
    collectedCard,
    collectedTotal: collectedCash + collectedCard,
    pendingCash,
    pendingCard,
    expectedRevenue,
    outstanding,
    depositsOnFile,
    liveReservations,
    byLocation: [...byLocation.entries()].map(([locationId, value]) => ({ locationId, ...value })),
  }
}

/** What each reservation still owes, largest first. Drives the outstanding table. */
export function outstandingRows(data: AdminData) {
  const paid = new Map<string, number>()
  for (const payment of data.payments) {
    if (payment.status.toLowerCase() !== 'paid') continue
    paid.set(payment.reservation_id, (paid.get(payment.reservation_id) ?? 0) + num(payment.amount))
  }
  return data.reservations
    .filter(item => !DEAD.has(item.reservation_status.toLowerCase()))
    .map(item => {
      const revenue = num(item.total) - num(item.security_deposit)
      return { reservation: item, revenue, paid: paid.get(item.id) ?? 0, owed: Math.max(0, revenue - (paid.get(item.id) ?? 0)) }
    })
    .filter(row => row.owed > 0)
    .sort((a, b) => b.owed - a.owed)
}
