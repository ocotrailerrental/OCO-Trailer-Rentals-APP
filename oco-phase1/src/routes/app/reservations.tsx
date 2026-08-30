import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CalendarDays, CircleAlert, ClipboardList, MapPin, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Reservation, formatDate, formatMoney } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

const replaceUnderscores = (value: string) => value.replace(/_/g, ' ')
const formatPaymentStatus = (value: string) => value.toLowerCase() === 'pending_cash' || value.toLowerCase() === 'cash' ? 'Cash due at pickup' : replaceUnderscores(value)

export const Route = createFileRoute('/app/reservations')({
  head: () => ({ meta: [{ title: 'My rentals · OCO Trailer Rentals' }] }),
  component: ReservationsPage,
})

type Lookup = { id: string; name: string }
type RentalRow = Reservation & { trailer?: Lookup; pickup?: Lookup; dropoff?: Lookup }

function ReservationsPage() {
  const query = useQuery({ queryKey: ['customer-reservations'], queryFn: loadReservations })
  if (query.isLoading) return <LoadingState />
  if (query.error) return <State title="We could not load your rentals" copy={getErrorMessage(query.error)} />
  const rentals = query.data ?? []
  const active = rentals.filter(rental => !['completed', 'cancelled', 'declined', 'no-show', 'returned'].includes(rental.reservation_status.toLowerCase()))
  const history = rentals.filter(rental => !active.includes(rental))
  return <div className="space-y-8"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Customer account</p><h1 className="mt-2 font-serif text-4xl">My rentals</h1><p className="mt-2 text-sm text-muted-foreground">Your reservations, payment status, and next steps.</p></div><RentalSection title="Upcoming and active" rentals={active} empty="No upcoming rentals yet. Search the fleet when you’re ready to haul." /><RentalSection title="Rental history" rentals={history} empty="Completed and cancelled rentals will appear here." /></div>
}

function RentalSection({ title, rentals, empty }: { title: string; rentals: RentalRow[]; empty: string }) { return <section><div className="mb-4 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /><h2 className="font-serif text-2xl">{title}</h2><span className="text-sm text-muted-foreground">({rentals.length})</span></div>{rentals.length === 0 ? <Card className="border-dashed"><CardContent className="p-6 text-sm text-muted-foreground">{empty}</CardContent></Card> : <div className="grid gap-4">{rentals.map(rental => <Link key={rental.id} to="/app/reservations/$reservationId" params={{ reservationId: rental.id }} className="group"><Card className="transition-all hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{rental.reservation_number}</p><h3 className="mt-2 font-serif text-2xl">{rental.trailer?.name ?? 'Trailer reservation'}</h3><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> {formatDate(rental.start_date)} – {formatDate(rental.end_date)}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {rental.pickup?.name ?? 'Pickup'} → {rental.dropoff?.name ?? 'Return'}</p></div><div className="flex items-end justify-between gap-5 sm:flex-col sm:items-end"><div className="text-right"><p className="text-lg font-semibold">{formatMoney(rental.total)}</p><p className="text-xs text-muted-foreground">{rental.payment_method === 'cash' ? 'Cash due at pickup' : formatPaymentStatus(rental.payment_status)}</p></div><span className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">View details <ArrowRight className="h-4 w-4" /></span></div></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-secondary px-3 py-1 capitalize text-secondary-foreground">{replaceUnderscores(rental.reservation_status)}</span>{rental.pickup_method === 'delivery' && <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Delivery requested</span>}</div></CardContent></Card></Link>)}</div>}</section> }

async function loadReservations() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.')
  const { data, error } = await supabase.from('oco_reservations').select('id,reservation_number,customer_id,trailer_id,pickup_location_id,return_location_id,customer_name,customer_email,customer_phone,start_date,end_date,pickup_method,delivery_address,delivery_miles,delivery_fee,rental_subtotal,security_deposit,taxes,total,payment_method,payment_status,reservation_status,customer_notes,created_at').eq('customer_id', authData.user.id).order('start_date', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Reservation[]
  const trailerIds = [...new Set(rows.map(row => row.trailer_id))]
  const locationIds = [...new Set(rows.flatMap(row => [row.pickup_location_id, row.return_location_id]))]
  const trailers = await supabase.from('oco_trailers').select('id,name').in('id', trailerIds)
  const locations = await supabase.from('oco_locations').select('id,name').in('id', locationIds)
  if (trailers.error) throw trailers.error
  if (locations.error) throw locations.error
  const trailerMap = new Map((trailers.data ?? []).map(item => [item.id, item as Lookup]))
  const locationMap = new Map((locations.data ?? []).map(item => [item.id, item as Lookup]))
  return rows.map(row => ({ ...row, trailer: trailerMap.get(row.trailer_id), pickup: locationMap.get(row.pickup_location_id), dropoff: locationMap.get(row.return_location_id) })) as RentalRow[]
}
function LoadingState() { return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div> }
function State({ title, copy }: { title: string; copy: string }) { return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm"><CircleAlert className="mb-3 h-5 w-5 text-destructive" /><h1 className="font-serif text-2xl">{title}</h1><p className="mt-2 text-muted-foreground">{copy}</p></div> }
function getErrorMessage(error: unknown) { return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again in a moment.' }
