import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, CircleAlert, LockKeyhole, MapPin, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientOnlyBoundary } from '@/components/ClientOnlyBoundary'
import { AuthLoading } from '@/components/CustomerAuthLayout'
import { BookingSearch, Location, ReserveSearch, TRAILER_COLUMNS, Trailer, formatDate, formatMoney, parseReserveSearch, rentalEstimate, rentalDays, safeInternalRedirect } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/reserve')({
  validateSearch: (search: Record<string, unknown>) => parseReserveSearch(search),
  head: () => ({ meta: [{ title: 'Reserve a trailer · OCO Trailer Rentals' }] }),
  component: ReserveRoute,
})

function ReserveRoute() { return <ClientOnlyBoundary fallback={<AuthLoading label="Loading reservation details…" />}><ReservationForm /></ClientOnlyBoundary> }

type Profile = { full_name: string | null; phone: string | null }
type FormValues = { name: string; email: string; phone: string; pickupMethod: 'self_pickup' | 'delivery'; deliveryAddress: string; deliveryMiles: string; paymentMethod: 'card' | 'cash'; notes: string; agreement: boolean }

function ReservationForm() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/reserve' }) as ReserveSearch
  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState('')
  const [authError, setAuthError] = useState('')
  const [values, setValues] = useState<FormValues>({ name: '', email: '', phone: '', pickupMethod: search.delivery ? 'delivery' : 'self_pickup', deliveryAddress: '', deliveryMiles: '', paymentMethod: 'card', notes: '', agreement: false })
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!mounted) return
      if (error || !data.user) {
        const redirect = safeInternalRedirect(`${window.location.pathname}${window.location.search}`)
        await navigate({ to: '/login', search: { redirect }, replace: true })
        return
      }
      setUserId(data.user.id)
      setValues(current => ({ ...current, email: data.user.email ?? '' }))
      setAuthChecking(false)
    }).catch(error => { if (mounted) { setAuthError(error instanceof Error ? error.message : 'Unable to verify your account.'); setAuthChecking(false) } })
    return () => { mounted = false }
  }, [navigate])

  const dataQuery = useQuery({
    queryKey: ['reservation-form', search.trailerId, search.pickupLocationId, search.returnLocationId, userId],
    enabled: Boolean(userId && search.trailerId && search.pickupLocationId && search.returnLocationId),
    queryFn: async () => {
      const [trailerResult, locationResult, profileResult] = await Promise.all([
        supabase.from('oco_trailers').select(TRAILER_COLUMNS).eq('id', search.trailerId).maybeSingle(),
        supabase.from('oco_locations').select('id,name,city,state,timezone').in('id', [search.pickupLocationId, search.returnLocationId]).eq('is_active', true),
        supabase.from('oco_profiles').select('full_name,phone').eq('id', userId).maybeSingle(),
      ])
      if (trailerResult.error) throw trailerResult.error
      if (locationResult.error) throw locationResult.error
      if (!trailerResult.data) throw new Error('This trailer is no longer available.')
      return { trailer: trailerResult.data as unknown as Trailer, locations: (locationResult.data ?? []) as unknown as Location[], profile: profileResult.data as unknown as Profile | null }
    },
  })

  const loadedProfile = dataQuery.data?.profile ?? null
  useEffect(() => {
    if (!loadedProfile) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize form defaults once the profile query resolves
    setValues(current => ({
      ...current,
      name: current.name || loadedProfile.full_name || '',
      phone: current.phone || loadedProfile.phone || '',
    }))
  }, [loadedProfile])

  if (authChecking) return <AuthLoading label="Checking your OCO account…" />
  if (authError) return <MessagePage title="We could not verify your account" copy={authError} />
  if (!search.trailerId || !search.startDate || !search.endDate || search.endDate <= search.startDate) return <MessagePage title="Reservation details are incomplete" copy="Return to availability and choose valid dates and a trailer." />
  if (dataQuery.isLoading) return <AuthLoading label="Preparing your reservation…" />
  if (dataQuery.error || !dataQuery.data) return <MessagePage title="This trailer cannot be reserved right now" copy={getErrorMessage(dataQuery.error)} />

  const { trailer, locations } = dataQuery.data
  const pickup = locations.find(location => location.id === search.pickupLocationId)
  const dropoff = locations.find(location => location.id === search.returnLocationId)
  const days = rentalDays(search.startDate, search.endDate)
  const estimate = rentalEstimate(days, trailer, Number(values.deliveryMiles) || 0)
  const update = (patch: Partial<FormValues>) => setValues(current => ({ ...current, ...patch }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    if (!values.name.trim() || !values.email.trim() || !values.phone.trim()) return setSubmitError('Enter your name, email, and phone number.')
    if (values.pickupMethod === 'delivery' && (!values.deliveryAddress.trim() || Number(values.deliveryMiles) < 0)) return setSubmitError('Enter a delivery address and a valid estimated mileage.')
    if (!values.agreement) return setSubmitError('Confirm that your rental information is accurate before submitting.')
    setIsSubmitting(true)
    const { data, error } = await supabase.rpc('oco_create_reservation', {
      p_trailer_id: trailer.id, p_pickup_location_id: search.pickupLocationId, p_return_location_id: search.returnLocationId, p_start_date: search.startDate, p_end_date: search.endDate,
      p_customer_name: values.name.trim(), p_customer_email: values.email.trim(), p_customer_phone: values.phone.trim(), p_pickup_method: values.pickupMethod, p_payment_method: values.paymentMethod,
      p_delivery_address: values.pickupMethod === 'delivery' ? values.deliveryAddress.trim() : null, p_delivery_miles: values.pickupMethod === 'delivery' ? Number(values.deliveryMiles) || 0 : 0, p_customer_notes: values.notes.trim() || null,
    })
    if (error) { setSubmitError(isAvailabilityError(error.message) ? 'Availability changed while you were deciding. Search again to choose a current trailer.' : error.message); setIsSubmitting(false); return }
    const created = (Array.isArray(data) ? data[0] : data) as { id?: string } | null
    if (!created?.id) { setSubmitError('The reservation was not returned by Supabase. Please try again.'); setIsSubmitting(false); return }
    await navigate({ to: '/app/reservations/$reservationId', params: { reservationId: created.id } })
  }

  return <main className="min-h-dvh bg-background"><div className="border-b border-border bg-sidebar text-sidebar-foreground"><div className="mx-auto max-w-6xl px-5 py-7 lg:px-8"><button onClick={() => navigate({ to: '/book', search })} className="mb-6 flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"><ArrowLeft className="h-4 w-4" /> Back to availability</button><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Complete your reservation</p><h1 className="mt-3 font-serif text-4xl">Reserve {trailer.name}.</h1><p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-sidebar-foreground/70"><MapPin className="h-4 w-4 text-primary" /> {pickup?.name ?? 'Pickup location'} → {dropoff?.name ?? 'Return location'} · {formatDate(search.startDate)} – {formatDate(search.endDate)} · {days} billable day{days === 1 ? '' : 's'}</p></div></div><div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_0.75fr] lg:px-8"><form onSubmit={submit} className="space-y-6"><Card><CardHeader><CardTitle className="font-serif text-2xl">Customer details</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="customer-name">Full name</Label><Input id="customer-name" required value={values.name} onChange={event => update({ name: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" required value={values.email} onChange={event => update({ email: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="customer-phone">Phone</Label><Input id="customer-phone" type="tel" required value={values.phone} onChange={event => update({ phone: event.target.value })} /></div></CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">Pickup and payment</CardTitle></CardHeader><CardContent className="space-y-5"><fieldset><legend className="mb-3 text-sm font-medium">Pickup method</legend><div className="grid gap-3 sm:grid-cols-2"><Choice checked={values.pickupMethod === 'self_pickup'} label="Customer pickup" onClick={() => update({ pickupMethod: 'self_pickup' })} /><Choice checked={values.pickupMethod === 'delivery'} label="Paid delivery" onClick={() => update({ pickupMethod: 'delivery' })} /></div></fieldset>{values.pickupMethod === 'delivery' && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label htmlFor="delivery-address">Delivery address</Label><Input id="delivery-address" required value={values.deliveryAddress} onChange={event => update({ deliveryAddress: event.target.value })} placeholder="Enter the delivery address" /></div><div className="space-y-2"><Label htmlFor="delivery-miles">Estimated delivery miles</Label><Input id="delivery-miles" type="number" min="0" step="0.1" required value={values.deliveryMiles} onChange={event => update({ deliveryMiles: event.target.value })} placeholder="0" /></div><p className="self-end text-xs leading-5 text-muted-foreground">Delivery is estimated at $0.50 per mile. The final amount is calculated by the database.</p></div>}<fieldset><legend className="mb-3 text-sm font-medium">Payment method</legend><div className="grid gap-3 sm:grid-cols-2"><Choice checked={values.paymentMethod === 'card'} label="Card (online checkout coming soon)" onClick={() => update({ paymentMethod: 'card' })} /><Choice checked={values.paymentMethod === 'cash'} label="Cash at pickup" onClick={() => update({ paymentMethod: 'cash' })} /></div></fieldset><div className="space-y-2"><Label htmlFor="customer-notes">Notes (optional)</Label><Input id="customer-notes" value={values.notes} onChange={event => update({ notes: event.target.value })} placeholder="Anything the local team should know?" /></div></CardContent></Card><Card><CardContent className="space-y-4 p-6"><label className="flex cursor-pointer gap-3 text-sm leading-6"><input type="checkbox" checked={values.agreement} onChange={event => update({ agreement: event.target.checked })} className="mt-1 h-4 w-4 accent-primary" /> I confirm that my rental information is accurate and understand this is a reservation request, not a confirmed rental agreement.</label>{submitError && <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><CircleAlert className="h-4 w-4 shrink-0" />{submitError}</div>}<Button type="submit" disabled={isSubmitting} className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90">{isSubmitting ? 'Submitting request…' : 'Submit reservation request'}</Button><p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> No card numbers are collected or stored.</p></CardContent></Card></form><aside className="space-y-6"><QuoteCard trailer={trailer} search={search} estimate={estimate} deliveryMiles={Number(values.deliveryMiles) || 0} /><Card className="border-primary/20 bg-primary/5"><CardContent className="p-5 text-sm leading-6"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>This is what you will be charged.</strong> Supabase recalculates the total when you submit, using the same rules shown here. {values.paymentMethod === 'cash' ? 'Cash remains due until an authorized OCO team member records collection.' : 'Card payment is collected at pickup once card checkout is enabled.'}</p></div></CardContent></Card></aside></div></main>
}

function QuoteCard({ trailer, search, estimate, deliveryMiles }: { trailer: Trailer; search: BookingSearch; estimate: ReturnType<typeof rentalEstimate>; deliveryMiles: number }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-2xl"><Truck className="h-5 w-5 text-primary" /> Estimated quote</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Rental · {rentalDays(search.startDate, search.endDate)} days</span><span>{formatMoney(estimate.rentalSubtotal)}</span></div>{estimate.months > 0 && <p className="text-xs text-muted-foreground">{estimate.months} × 30-day period at {formatMoney(trailer.monthly_rate)}</p>}{estimate.weeks > 0 && <p className="text-xs text-muted-foreground">{estimate.weeks} × complete week at {formatMoney(trailer.weekly_rate)}</p>}{estimate.days > 0 && <p className="text-xs text-muted-foreground">{estimate.days} × day at {formatMoney(trailer.daily_rate)}</p>}<div className="flex justify-between"><span className="text-muted-foreground">Delivery · {deliveryMiles || 0} miles</span><span>{formatMoney(estimate.deliveryFee)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Security deposit</span><span>{formatMoney(estimate.deposit)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Taxes</span><span>{formatMoney(estimate.taxes)}</span></div><div className="flex justify-between border-t border-border pt-4 text-base font-semibold"><span>Estimated total</span><span className="text-primary">{formatMoney(estimate.total)}</span></div><p className="pt-2 text-xs leading-5 text-muted-foreground">Both the pickup day and the return day are charged. Whole 30-day periods are applied first, then whole weeks, then individual days. This total is calculated the same way Supabase calculates it, so the amount you are charged matches the amount shown here.</p></CardContent></Card> }
function Choice({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`flex min-h-12 items-center gap-3 rounded-lg border px-3 text-left text-sm transition-colors ${checked ? 'border-primary bg-primary/10' : 'border-input bg-background hover:bg-secondary'}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{checked && <Check className="h-3 w-3" />}</span>{label}</button> }
function MessagePage({ title, copy }: { title: string; copy: string }) { return <main className="flex min-h-dvh items-center justify-center bg-background px-5"><div className="max-w-md text-center"><CircleAlert className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-5 font-serif text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p><Button onClick={() => window.location.assign('/')} className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">Return home</Button></div></main> }
function getErrorMessage(error: unknown) { return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again in a moment.' }
function isAvailabilityError(message: string) { const value = message.toLowerCase(); return value.includes('available') || value.includes('overlap') || value.includes('conflict') || value.includes('reservation') }
