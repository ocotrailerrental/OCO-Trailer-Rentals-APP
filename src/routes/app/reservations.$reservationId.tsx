import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  CreditCard,
  MapPin,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrailerImage } from '@/components/TrailerImage'
import { Payment, Reservation, formatDate, formatMoney, localDateString } from '@/lib/booking'
import { paymentLabel, statusClass, statusInfo, timingNote } from '@/lib/reservation-status'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/app/reservations/$reservationId')({
  head: () => ({ meta: [{ title: 'Reservation details · OCO Trailer Rentals' }] }),
  component: ReservationDetailPage,
})

type TrailerRef = {
  name: string
  slug: string
  image_url: string | null
  length_feet: number
  description: string | null
}
type LocationRef = { id: string; name: string; city: string; timezone: string }
type DetailData = {
  reservation: Reservation
  trailer: TrailerRef | null
  pickup: LocationRef | null
  dropoff: LocationRef | null
  payments: Payment[]
}

function ReservationDetailPage() {
  const { reservationId } = Route.useParams()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['customer-reservation', reservationId],
    queryFn: () => loadReservation(reservationId),
  })

  // Whether this customer has supplied licence and insurance yet. Kept separate
  // from the reservation load so a permission hiccup here cannot blank the page.
  const documentsQuery = useQuery({
    queryKey: ['my-documents-status'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      const profileId = authData.user?.id
      if (!profileId) return { ready: false }
      const { data } = await supabase
        .from('oco_customer_verification')
        .select('license_expiry,insurance_type')
        .eq('profile_id', profileId)
        .maybeSingle()
      const row = data as { license_expiry?: string | null; insurance_type?: string | null } | null
      return { ready: Boolean(row?.license_expiry && row?.insurance_type) }
    },
  })

  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState('')

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('oco_cancel_reservation', {
        p_reservation_id: reservationId,
        p_reason: cancelReason.trim() || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setShowCancel(false)
      void queryClient.invalidateQueries({ queryKey: ['customer-reservation', reservationId] })
      void queryClient.invalidateQueries({ queryKey: ['customer-reservations'] })
    },
    onError: e =>
      setCancelError(e instanceof Error ? e.message : 'The reservation was not cancelled.'),
  })

  if (query.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <CircleAlert className="mx-auto h-9 w-9 text-destructive" />
        <h1 className="mt-4 font-serif text-3xl">Reservation not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This reservation may not exist, or it may belong to a different account.
        </p>
        <Link
          to="/app/reservations"
          className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          Back to My Rentals
        </Link>
      </div>
    )
  }

  const { reservation, trailer, pickup, dropoff, payments } = query.data
  const status = statusInfo(reservation.reservation_status)
  const timing = timingNote(
    reservation.reservation_status,
    reservation.start_date,
    reservation.end_date,
    localDateString(new Date())
  )

  const deposit = Number(reservation.security_deposit) || 0
  const dueAtPickup = (Number(reservation.total) || 0) - deposit
  const recorded = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)

  return (
    <div className="space-y-6">
      <Link
        to="/app/reservations"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> My rentals
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            {reservation.reservation_number}
          </p>
          <h1 className="mt-2 font-serif text-4xl">Reservation details</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted {formatDate(reservation.created_at.slice(0, 10))}
            {timing && ` · ${timing}`}
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${statusClass(
            reservation.reservation_status
          )}`}
        >
          {status.label}
        </span>
      </div>

      {status.hint && (
        <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          {status.hint}
        </p>
      )}

      {documentsQuery.data && !documentsQuery.data.ready &&
        ['pending', 'confirmed'].includes(reservation.reservation_status.toLowerCase()) && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <p className="text-sm">
              <strong className="font-semibold">One thing left.</strong> We still need your driving
              licence and insurance before you can collect.
            </p>
            <Link
              to="/app/documents"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Add them now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

      {['pending', 'confirmed'].includes(reservation.reservation_status.toLowerCase()) && (
        <Card>
          <CardContent className="space-y-3 p-5">
            {!showCancel ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Need to cancel?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cancel free of charge up to 24 hours before your pickup time. Inside 24 hours
                    it needs OCO&rsquo;s approval &mdash; call 253-264-0083 or email
                    Robert@OCOTrailerRentals.com. Not collecting the trailer without cancelling is
                    a no-show and carries a $50 fee.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCancelError('')
                    setShowCancel(true)
                  }}
                  className="border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
                >
                  Cancel this rental
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Cancel {reservation.reservation_number}? The record is kept, marked cancelled — it
                  is not deleted. If your pickup is less than 24 hours away this will be refused and
                  you will need to contact OCO.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Reason (optional)</Label>
                  <Input
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={event => setCancelReason(event.target.value)}
                    placeholder="Plans changed"
                  />
                </div>
                {cancelError && (
                  <p role="alert" className="text-sm text-destructive">
                    {cancelError}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={cancel.isPending}
                    onClick={() => {
                      setCancelError('')
                      cancel.mutate()
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {cancel.isPending ? 'Cancelling…' : 'Yes, cancel it'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCancel(false)}
                    className="bg-transparent"
                  >
                    Keep the rental
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <Truck className="h-5 w-5 text-primary" /> Rental
              </CardTitle>
            </CardHeader>
            {trailer && (
              <div className="h-44 w-full bg-sidebar">
                <TrailerImage src={trailer.image_url} alt={trailer.name} className="h-full w-full" />
              </div>
            )}
            <CardContent className="space-y-4 pt-6 text-sm">
              <Detail label="Trailer" value={trailer?.name ?? 'Trailer'} />
              <Detail
                label="Dates"
                value={`${formatDate(reservation.start_date)} – ${formatDate(reservation.end_date)}`}
                icon={<CalendarDays className="h-4 w-4 text-primary" />}
              />
              <Detail
                label="Route"
                value={`${pickup?.name ?? 'Pickup location'} → ${dropoff?.name ?? 'Return location'}`}
                icon={<MapPin className="h-4 w-4 text-primary" />}
              />
              <Detail
                label="Pickup method"
                value={
                  reservation.pickup_method === 'delivery'
                    ? `Delivery${reservation.delivery_address ? ` · ${reservation.delivery_address}` : ''}`
                    : 'You collect it'
                }
              />
              {trailer && (
                <a
                  href={`/trailers/${trailer.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  Specifications for this trailer <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <MoneyRow label="Rental subtotal" value={reservation.rental_subtotal} />
              {Number(reservation.delivery_fee) > 0 && (
                <MoneyRow
                  label={`Delivery · ${reservation.delivery_miles || 0} miles`}
                  value={reservation.delivery_fee}
                />
              )}
              {Number(reservation.taxes) > 0 && <MoneyRow label="Taxes" value={reservation.taxes} />}
              <MoneyRow label="Due at pickup" value={dueAtPickup} strong />

              {deposit > 0 && (
                <div className="mt-4 rounded-lg bg-secondary/50 p-4">
                  <div className="flex justify-between gap-4 font-medium">
                    <span>Security deposit</span>
                    <span className="tabular-nums">{formatMoney(deposit)}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    Held against your card. It is only charged if the return inspection finds
                    damage — it is not taken at booking and it is not part of what you owe at
                    pickup.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif text-2xl">
                <CreditCard className="h-5 w-5 text-primary" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Detail
                label="Method"
                value={reservation.payment_method === 'cash' ? 'Cash at pickup' : 'Card'}
              />
              <Detail
                label="Status"
                value={paymentLabel(reservation.payment_method, reservation.payment_status)}
              />
              <MoneyRow label="Charged so far" value={recorded} />
              {payments.length === 0 && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Nothing has been charged yet. The rental is paid at pickup, not at booking.
                </p>
              )}
            </CardContent>
          </Card>

          {reservation.customer_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Your note</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-muted-foreground">
                {reservation.customer_notes}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium">
        {icon}
        {value}
      </span>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        strong ? 'border-t border-border pt-4 text-base font-semibold' : ''
      }`}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{formatMoney(value)}</span>
    </div>
  )
}

const RESERVATION_COLUMNS =
  'id,reservation_number,customer_id,trailer_id,pickup_location_id,return_location_id,' +
  'customer_name,customer_email,customer_phone,start_date,end_date,pickup_method,' +
  'delivery_address,delivery_miles,delivery_fee,rental_subtotal,security_deposit,taxes,' +
  'total,payment_method,payment_status,reservation_status,customer_notes,created_at'

async function loadReservation(id: string): Promise<DetailData | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.')

  const reservationResult = await supabase
    .from('oco_reservations')
    .select(RESERVATION_COLUMNS)
    .eq('id', id)
    .eq('customer_id', authData.user.id)
    .maybeSingle()
  if (reservationResult.error) throw reservationResult.error
  if (!reservationResult.data) return null
  const reservation = reservationResult.data as unknown as Reservation

  const [trailerResult, locationsResult, paymentsResult] = await Promise.all([
    supabase
      .from('oco_trailers')
      .select('name,slug,image_url,length_feet,description')
      .eq('id', reservation.trailer_id)
      .maybeSingle(),
    supabase
      .from('oco_locations')
      .select('id,name,city,timezone')
      .in('id', [reservation.pickup_location_id, reservation.return_location_id]),
    supabase
      .from('oco_payments')
      .select('id,amount,method,status,provider,paid_at,created_at')
      .eq('reservation_id', reservation.id)
      .order('created_at', { ascending: true }),
  ])
  if (trailerResult.error) throw trailerResult.error
  if (locationsResult.error) throw locationsResult.error
  if (paymentsResult.error) throw paymentsResult.error

  const locations = (locationsResult.data ?? []) as unknown as LocationRef[]
  return {
    reservation,
    trailer: (trailerResult.data as unknown as TrailerRef | null) ?? null,
    pickup: locations.find(item => item.id === reservation.pickup_location_id) ?? null,
    dropoff: locations.find(item => item.id === reservation.return_location_id) ?? null,
    payments: (paymentsResult.data ?? []) as unknown as Payment[],
  }
}
