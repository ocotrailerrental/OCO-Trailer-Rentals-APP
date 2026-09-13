import { supabase } from '@/lib/supabase'

/**
 * Read the signed-in account's own row from oco_profiles, rebuilding it first if
 * it has gone missing.
 *
 * A profile row is created by a trigger when the account signs up, and it is
 * what carries the name, phone, role and yard. If that row is ever removed
 * while the account itself survives — a stray delete in the table editor, a
 * botched cleanup — the account can still sign in but lands with no name and no
 * role, looking to the app exactly like a brand-new customer, and there is no
 * screen that can put it back. That happened once; it should not be able to
 * strand anyone again.
 *
 * oco_ensure_own_profile() rebuilds the row from what auth already knows about
 * the account, at the default role. It cannot be used to grant a role: the
 * insert does not take one.
 */
export async function fetchOwnProfile<T>(userId: string, columns: string) {
  const first = await supabase
    .from('oco_profiles')
    .select(columns)
    .eq('id', userId)
    .maybeSingle()

  // A real error (offline, policy) is the caller's to handle; only a clean
  // "no such row" is worth a repair attempt.
  if (first.error || first.data) return first as unknown as { data: T | null; error: typeof first.error }

  const { error: repairError } = await supabase.rpc('oco_ensure_own_profile')
  if (repairError) return { data: null as T | null, error: repairError }

  const second = await supabase
    .from('oco_profiles')
    .select(columns)
    .eq('id', userId)
    .maybeSingle()
  return second as unknown as { data: T | null; error: typeof second.error }
}
