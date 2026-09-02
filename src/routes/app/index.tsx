import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, CalendarPlus, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatMoney, localDateString } from '@/lib/booking'
import { isFinished, statusClass, statusInfo, timingNote } from '@/lib/reservation-status'
import { supabase } from '@/lib/supabase'

const getErrorMessage = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'Please try again in a moment.'

export const Route = createFileRoute('/app/')({
  head: () => ({ meta: [{ title: 'My account · OCO Trailer Rentals' }] }),
  component: DashboardHome,
})

// `role` is deliberately not selected. A customer must never be shown their own
// account type, and the surest way to keep it off the page is to not fetch it.
type Profile = { full_name: string | null; phone: string | null }
type DashboardReservation = {
  id: string
  reservation_number: string
  start_date: string
  end_date: string
  total: number
  reservation_status: string
  payment_status: string
}
type DashboardData = { email: string; profile: Profile | null; reservations: DashboardReservation[] }

function DashboardHome() {
  const queryClient = useQueryClient()
  const dashboardQuery = useQuery({ queryKey: ['customer-dashboard'], queryFn: loadDashboard })
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user)
        throw new Error('Your session has expired. Please sign in again.')
      const { data, error: updateError } = await supabase
        .from('oco_profiles')
        .update({ full_name: fullName.trim(), phone: phone.trim() })
        .eq('id', authData.user.id)
        .select('full_name, phone')
        .single()
      if (updateError) throw updateError
      return data as unknown as Profile
    },
    onSuccess: data => {
      queryClient.setQueryData<DashboardData>(['customer-dashboard'], current =>
        current ? { ...current, profile: data } : current
      )
      setMessage('Profile saved.')
    },
    onError: value => setError(getErrorMessage(value)),
  })

  const data = dashboardQuery.data
  // Fill the form from the stored profile ONCE, keyed on the account id.
  //
  // This used to depend on the profile object itself. Every background refetch —
  // and the query refetches whenever the window regains focus — produced a new
  // object, re-ran the effect, and overwrote whatever the customer was halfway
  // through typing. Switch to another tab to copy your new phone number across,
  // come back, and your typing was gone with no message.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (data?.profile && loadedFor !== data.profile.id) {
    setLoadedFor(data.profile.id)
    setFullName(data.profile.full_name ?? '')
    setPhone(data.profile.phone ?? '')
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }
  if (dashboardQuery.error || !data) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        {getErrorMessage(dashboardQuery.error)}
      </div>
    )
  }

  const today = localDateString(new Date())
  const reservations = data.reservations

  // Counted against the seven statuses the database actually allows. The previous
  // version filtered on names like `ready_for_pickup` and `overdue` that no
  // reservation can hold, and counted cancelled and declined rentals in none of
  // the three cards — so a customer whose only booking was cancelled saw 0, 0, 0.
  const waiting = reservations.filter(item =>
    ['draft', 'pending'].includes(item.reservation_status.toLowerCase())
  ).length
  const live = reservations.filter(item =>
    ['confirmed', 'active'].includes(item.reservation_status.toLowerCase())
  ).length
  const past = reservations.filter(item => isFinished(item.reservation_status)).length

  const upcoming = reservations
    .filter(item => !isFinished(item.reservation_status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const nextRental = upcoming[0]
  const displayName = fullName.split(' ')[0] || 'there'

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Customer account
          </p>
          <h1 className="mt-2 font-serif text-4xl">Welcome, {displayName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your OCO profile and rental home base.
          </p>
        </div>
        <div className="flex w-full gap-3 sm:w-auto">
          <Link to="/app/book" className="flex-1 sm:flex-none">
            <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <CalendarPlus className="h-4 w-4" /> Book a trailer
            </Button>
          </Link>
          <Button variant="outline" onClick={signOut} className="gap-2 bg-transparent">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      {(error || message) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-primary/30 bg-primary/10 text-foreground'
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting confirmation" value={waiting} />
        <StatCard label="Confirmed or out" value={live} />
        <StatCard label="Past rentals" value={past} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-2xl">
              <UserRound className="h-5 w-5 text-primary" /> Profile details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email address</Label>
              <Input id="profile-email" value={data.email} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <Button
                onClick={() => {
                  setError('')
                  setMessage('')
                  saveMutation.mutate()
                }}
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {nextRental ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                    Next rental
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(
                      nextRental.reservation_status
                    )}`}
                  >
                    {statusInfo(nextRental.reservation_status).label}
                  </span>
                </div>
                <h2 className="mt-3 font-serif text-2xl">{nextRental.reservation_number}</h2>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(nextRental.start_date)} – {formatDate(nextRental.end_date)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {timingNote(
                    nextRental.reservation_status,
                    nextRental.start_date,
                    nextRental.end_date,
                    today
                  )}
                  {' · '}
                  {formatMoney(nextRental.total)}
                </p>
                <Link
                  to="/app/reservations/$reservationId"
                  params={{ reservationId: nextRental.id }}
                  className="mt-5 inline-flex items-center text-sm font-semibold text-primary hover:underline"
                >
                  View reservation <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6">
                <h2 className="font-serif text-2xl">Nothing booked</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  When you reserve a trailer it will show up here with its dates and status.
                </p>
                <a
                  href="/app/book"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Find a trailer <ArrowRight className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          )}

          {upcoming.length > 1 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="font-serif text-2xl">Also coming up</h2>
                <ul className="mt-4 space-y-3">
                  {upcoming.slice(1, 4).map(item => (
                    <li key={item.id}>
                      <Link
                        to="/app/reservations/$reservationId"
                        params={{ reservationId: item.id }}
                        className="flex items-baseline justify-between gap-4 text-sm hover:underline"
                      >
                        <span className="font-medium">{formatDate(item.start_date)}</span>
                        <span className="text-muted-foreground">{item.reservation_number}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Link
            to="/app/reservations"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            View all rentals <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 font-serif text-3xl tabular-nums text-primary">{value}</p>
      </CardContent>
    </Card>
  )
}

async function loadDashboard(): Promise<DashboardData> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user)
    throw new Error('Your session has expired. Please sign in again.')

  const [profileResult, reservationsResult] = await Promise.all([
    supabase.from('oco_profiles').select('full_name, phone').eq('id', authData.user.id).maybeSingle(),
    supabase
      .from('oco_reservations')
      .select('id,reservation_number,start_date,end_date,total,reservation_status,payment_status')
      .eq('customer_id', authData.user.id)
      .order('start_date', { ascending: true }),
  ])
  if (profileResult.error) throw profileResult.error
  if (reservationsResult.error) throw reservationsResult.error

  return {
    email: authData.user.email ?? '',
    profile: (profileResult.data as unknown as Profile | null) ?? null,
    reservations: (reservationsResult.data ?? []) as unknown as DashboardReservation[],
  }
}

function signOut() {
  return supabase.auth.signOut()
}
