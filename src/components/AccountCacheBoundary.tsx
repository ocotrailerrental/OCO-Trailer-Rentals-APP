import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Throws away every cached query when the signed-in account changes.
 *
 * React Query caches by key, and the account-scoped keys in this app — the
 * dashboard, the admin console, reservations, documents, the card on file — do
 * not carry the account id. Signing out and signing in as somebody else in the
 * same tab therefore rendered the PREVIOUS account's name and reservations from
 * cache, for as long as it took a background refetch to land. That is how an
 * owner signing in landed on a manager's dashboard.
 *
 * Keying every query by account id would work too, but it has to be remembered
 * at every call site forever. Clearing the cache on the change itself is one
 * rule that cannot be forgotten by the next query someone adds.
 *
 * The first event only records who is signed in: `onAuthStateChange` fires
 * INITIAL_SESSION on subscribe, and clearing there would throw away the fetches
 * the page has already started. A token refresh keeps the same id and is
 * ignored; only a genuinely different account — or a sign-out — clears.
 */
export function AccountCacheBoundary({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const signedInAs = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user?.id ?? null
      if (signedInAs.current === undefined) {
        signedInAs.current = next
        return
      }
      if (next === signedInAs.current) return
      signedInAs.current = next
      queryClient.clear()
    })
    return () => listener.subscription.unsubscribe()
  }, [queryClient])

  return <>{children}</>
}
