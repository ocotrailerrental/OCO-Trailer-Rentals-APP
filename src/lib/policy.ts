import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * The policy numbers, read from the database rather than written into the page.
 *
 * Delivery rate, minimum age, the late fee, the grace period, the cancellation
 * notice and the no-show fee all used to appear as prose in the interface AND as
 * values in SQL. Change one in the database and the site kept quoting the old
 * figure at customers — which is the same drift that once had checkout promising
 * $620 while the database charged $661.60.
 */
export type Policy = {
  location_id: string
  city: string
  min_renter_age: number
  delivery_rate_per_mile: number
  late_fee_per_hour: number
  late_grace_minutes: number
  cancellation_notice_hours: number
  no_show_fee: number
  tax_rate: number
  legal_entity_name: string
}

/** Used only until the real values arrive, and only for wording, never for money. */
export const POLICY_FALLBACK: Omit<Policy, 'location_id' | 'city'> = {
  min_renter_age: 18,
  delivery_rate_per_mile: 0.5,
  late_fee_per_hour: 40,
  late_grace_minutes: 60,
  cancellation_notice_hours: 24,
  no_show_fee: 50,
  tax_rate: 0.08,
  legal_entity_name: 'OCO Trailer Rentals',
}

export function usePolicy(locationId?: string) {
  const query = useQuery({
    queryKey: ['public-policy'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('oco_public_policy').select('*')
      if (error) throw error
      return (data ?? []) as unknown as Policy[]
    },
  })
  const rows = query.data ?? []
  const forLocation = locationId ? rows.find(row => row.location_id === locationId) : undefined
  const chosen = forLocation ?? rows[0]
  return { ...POLICY_FALLBACK, ...(chosen ?? {}) }
}

/** "$0.50" — money as it should read in a sentence, not "$0.5". */
export const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
