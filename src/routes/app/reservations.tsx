import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, CircleAlert, MapPin, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TrailerImage } from '@/components/TrailerImage'
import { Reservation, formatDate, formatMoney, localDateString } from '@/lib/booking'
import { isFinished, paymentLabel, statusClass, statusInfo, timingNote } from '@/lib/reservation-status'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/app/reservations')({
  head: () => ({ meta: [{ title: 'My rentals · OCO Trailer Rentals' }] }),
  component: ReservationsPage,
})

type TrailerLookup = { id: string; name: string; slug: string; image_url: string | null }
type LocationLookup = { id: string; name: string; city: string }
type RentalRow = Reservation & {
  trailer?: TrailerLookup
  pickup?: LocationLookup
  dropoff?: LocationLookup
}

function ReservationsPage() {
  const query = useQuery({ queryKey: ['customer-reservations'], queryFn: loadReservations })

  if (query.isLoading) return <LoadingState />
  if (query.error) {
    return (
      <ErrorState
        title="We could not load your rentals"
        copy={query.error instanceof Error ? query.error.message : 'Please try again in a moment.'}
      />
    )
  }

  const rentals = query.data ?? []
  const today = localDateString(new Date())

  // Soonest pickup first while a rental is still live; most recent first once it
  // is history. Both lists answer a different question, so they sort differently.
  const current = rentals
    .filter(rental => !isFinished(rental.reservation_status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  const past = rentals
    .filter(rental => isFinished(rental.reservation_status))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Customer account
        </p>
        <h1 className="mt-2 font-serif text-4xl">My rentals</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you have booked with OCO, current and past.
        </p>
      </div>

      <RentalSection
        title="Current"
        rentals={current}
        today={today}
        empty="Nothing booked at the moment."
        emptyAction
      />
      <RentalSection
        title="Past rentals"
        rentals={past}
        today={today}
        empty="Once a rental is returned or cancelled it moves here."
      />
    </div>
  )
}

function RentalSection({
  title,
  rentals,
  today,
  empty,
  emptyAction = false,
}: {
  title: string
  rentals: RentalRow[]
  today: string
  empty: string
  emptyAction?: boolean
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{rentals.length}</span>
      </div>

      {rentals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
            {emptyAction && (
              <a
                href="/#book"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Find a trailer <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rentals.map(rental => (
            <RentalCard key={rental.id} rental={rental} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

function RentalCard({ rental, today }: { rental: RentalRow; today: string }) {
  const status = statusInfo(rental.reservation_status)
  const timing = timingNote(rental.reservation_status, rental.start_date, rental.end_date, today)

  return (
    <Link
      to="/app/reservations/$reservationId"
      params={{ reservationId: rental.id }}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex flex-col gap-0 p-0 sm:flex-row">
          <div className="h-36 w-full shrink-0 bg-sidebar sm:h-auto sm:w-44">
            <TrailerImage
              src={rental.trailer?.image_url}
              alt={rental.trailer?.name ?? 'OCO trailer'}
              className="h-full w-full"
            />
          </div>

          <div className="flex flex-1 flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(
                    rental.reservation_status
                  )}`}
                >
                  {status.label}
                </span>
                {timing && <span className="text-xs text-muted-foreground">{timing}</span>}
              </div>

              <h3 className="mt-2.5 font-serif text-2xl">
                {rental.trailer?.name ?? 'Trailer reservation'}
              </h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {rental.reservation_number}
              </p>

              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {formatDate(rental.start_date)} – {formatDate(rental.end_date)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {rental.pickup?.city ?? 'Pickup'}
                {rental.pickup_method === 'delivery' ? ' · delivered' : ''}
                {rental.pickup?.id !== rental.dropoff?.id && ` → ${rental.dropoff?.city ?? 'Return'}`}
              </p>
            </div>

            <div className="flex items-end justify-between gap-5 sm:flex-col sm:items-end sm:justify-start">
              <div className="text-left sm:text-right">
                <p className="text-lg font-semibold tabular-nums">{formatMoney(rental.total)}</p>
                <p className="text-xs text-muted-foreground">
                  {paymentLabel(rental.payment_method, rental.payment_status)}
                </p>
              </div>
              <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-primary group-hover:underline">
                View details <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

const RESERVATION_COLUMNS =
  'id,reservation_number,customer_id,trailer_id,pickup_location_id,return_location_id,' +
  'customer_name,customer_email,customer_phone,start_date,end_date,pickup_method,' +
  'delivery_address,delivery_miles,delivery_fee,rental_subtotal,security_deposit,taxes,' +
  'total,payment_method,payment_status,reservation_status,customer_notes,created_at'

async function loadReservations(): Promise<RentalRow[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.')

  // Row-level security already restricts this to the signed-in customer; the
  // explicit customer_id filter is belt and braces, not the control.
  const { data, error } = await supabase
    .from('oco_reservations')
    .select(RESERVATION_COLUMNS)
    .eq('customer_id', authData.user.id)
    .order('start_date', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as unknown as Reservation[]
  if (rows.length === 0) return []

  const trailerIds = [...new Set(rows.map(row => row.trailer_id))]
  const locationIds = [
    ...new Set(rows.flatMap(row => [row.pickup_location_id, row.return_location_id])),
  ]

  const [trailers, locations] = await Promise.all([
    supabase.from('oco_trailers').select('id,name,slug,image_url').in('id', trailerIds),
    supabase.from('oco_locations').select('id,name,city').in('id', locationIds),
  ])
  if (trailers.error) throw trailers.error
  if (locations.error) throw locations.error

  const trailerMap = new Map(
    ((trailers.data ?? []) as unknown as TrailerLookup[]).map(item => [item.id, item])
  )
  const locationMap = new Map(
    ((locations.data ?? []) as unknown as LocationLookup[]).map(item => [item.id, item])
  )

  return rows.map(row => ({
    ...row,
    trailer: trailerMap.get(row.trailer_id),
    pickup: locationMap.get(row.pickup_location_id),
    dropoff: locationMap.get(row.return_location_id),
  }))
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  )
}

function ErrorState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm">
      <CircleAlert className="mb-3 h-5 w-5 text-destructive" />
      <h1 className="font-serif text-2xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{copy}</p>
    </div>
  )
}
