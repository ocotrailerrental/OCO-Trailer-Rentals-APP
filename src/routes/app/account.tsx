import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CircleAlert, LogOut, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/app/account')({
  head: () => ({ meta: [{ title: 'Account · OCO Trailer Rentals' }] }),
  component: AccountPage,
})

const CONFIRM_WORD = 'DELETE'

/**
 * The signed-in person's account: who they are signed in as, sign out, and
 * delete the account.
 *
 * Deletion is required by both app stores to be reachable inside the app. It is
 * done by the `account` edge function, which removes the login and personal
 * details and keeps the rental records OCO is entitled to keep. It refuses while
 * a rental is still open, and refuses staff accounts.
 */
function AccountPage() {
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [openRentals, setOpenRentals] = useState<string[]>([])

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  async function deleteAccount() {
    setError('')
    setOpenRentals([])
    setBusy(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Your session has expired. Sign in again.')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/account/delete`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{}' },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (Array.isArray(payload?.open_reservations)) setOpenRentals(payload.open_reservations)
        throw new Error(payload?.error ?? 'Your account could not be deleted. Please contact us.')
      }
      await supabase.auth.signOut().catch(() => undefined)
      window.location.assign('/?account=deleted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your account could not be deleted.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-5 lg:p-8">
      <h1 className="font-serif text-3xl">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl">
            <UserRound className="h-5 w-5 text-primary" /> Signed in
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{email || '…'}</p>
          <Button variant="outline" onClick={() => { void supabase.auth.signOut().then(() => window.location.assign('/')) }}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-xl text-destructive">
            <Trash2 className="h-5 w-5" /> Delete account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6">
          <p>
            This permanently deletes your login, your profile, your saved address and tow vehicle,
            your licence and insurance details and uploads, and your saved card. It cannot be undone.
          </p>
          <p className="text-muted-foreground">
            We keep the records of rentals you have already taken — the signed rental agreement,
            payments and inspection reports — because the law and our insurer require them. They are
            no longer linked to a login.
          </p>
          <p className="text-muted-foreground">
            If you have a rental that is pending, confirmed or out, cancel it or return the trailer
            first.
          </p>

          <div className="space-y-2">
            <Label htmlFor="confirm-delete">Type {CONFIRM_WORD} to confirm</Label>
            <Input
              id="confirm-delete"
              value={confirm}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={event => setConfirm(event.target.value)}
              className="max-w-xs"
            />
          </div>

          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {error}
                {openRentals.length > 0 && (
                  <p className="mt-1">
                    Open: {openRentals.join(', ')}. <a href="/app/reservations" className="underline">Go to My Rentals</a>
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            variant="destructive"
            disabled={busy || confirm.trim().toUpperCase() !== CONFIRM_WORD}
            onClick={() => { void deleteAccount() }}
          >
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
