import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, CreditCard, MapPin, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Payment, Reservation, formatDate, formatMoney } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

const replaceUnderscores = (value: string) => value.replace(/_/g, ' ')
const formatPaymentStatus = (value: string) => value.toLowerCase() === 'pending_cash' || value.toLowerCase() === 'cash' ? 'Cash due at pickup' : replaceUnderscores(value)

export const Route = createFileRoute('/app/reservations/$reservationId')({
  head: () => ({ meta: [{ title: 'Reservation details · OCO Trailer Rentals' }] }),
  component: ReservationDetailPage,
})

type DetailData = { reservation: Reservation; trailer: { name: string; length_feet: number; description: string | null } | null; pickup: { name: string; timezone: string } | null; dropoff: { name: string; timezone: string } | null; payments: Payment[] }

function ReservationDetailPage() {
  const { reservationId } = Route.useParams()
  const query = useQuery({ queryKey: ['customer-reservation', reservationId], queryFn: () => loadReservation(reservationId) })
  if (query.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
  if (query.error || !query.data) return <div className="rounded-xl border border-border bg-card p-6 text-center"><CircleAlert className="mx-auto h-9 w-9 text-destructive" /><h1 className="mt-4 font-serif text-3xl">Reservation not found</h1><p className="mt-2 text-sm text-muted-foreground">This reservation may not exist or may not be available to your account.</p><Link to="/app/reservations" className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">Back to My Rentals</Link></div>
  const { reservation, trailer, pickup, dropoff, payments } = query.data
  return <div className="space-y-6"><Link to="/app/reservations" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> My rentals</Link><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{reservation.reservation_number}</p><h1 className="mt-2 font-serif text-4xl">Reservation details</h1><p className="mt-2 text-sm text-muted-foreground">Submitted {formatDate(reservation.created_at.slice(0, 10))}</p></div><span className="w-fit rounded-full bg-secondary px-3 py-1 text-sm capitalize text-secondary-foreground">{replaceUnderscores(reservation.reservation_status)}</span></div><div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]"><div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-2xl"><Truck className="h-5 w-5 text-primary" /> Rental</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><Detail label="Trailer" value={trailer?.name ?? 'Trailer'} /><Detail label="Dates" value={`${formatDate(reservation.start_date)} – ${formatDate(reservation.end_date)}`} icon={<CalendarDays className="h-4 w-4 text-primary" />} /><Detail label="Route" value={`${pickup?.name ?? 'Pickup location'} → ${dropoff?.name ?? 'Return location'}`} icon={<MapPin className="h-4 w-4 text-primary" />} /><Detail label="Pickup method" value={reservation.pickup_method === 'delivery' ? `Delivery${reservation.delivery_address ? ` · ${reservation.delivery_address}` : ''}` : 'Customer pickup'} /></CardContent></Card><Card><CardHeader><CardTitle className="font-serif text-2xl">Pricing</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><MoneyRow label="Rental subtotal" value={reservation.rental_subtotal} /><MoneyRow label={`Delivery · ${reservation.delivery_miles || 0} miles`} value={reservation.delivery_fee} /><MoneyRow label="Security deposit" value={reservation.security_deposit} /><MoneyRow label="Taxes" value={reservation.taxes} /><MoneyRow label="Estimated total" value={reservation.total} strong /></CardContent></Card></div><div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-2xl"><CreditCard className="h-5 w-5 text-primary" /> Payment</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><Detail label="Method" value={reservation.payment_method === 'cash' ? 'Cash at pickup' : 'Card'} /><Detail label="Status" value={reservation.payment_method === 'cash' ? 'Cash due at pickup' : formatPaymentStatus(reservation.payment_status)} /><MoneyRow label="Amount recorded" value={payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)} />{reservation.payment_method === 'cash' && <p className="rounded-lg bg-primary/10 p-3 text-xs leading-5">Cash remains due until an authorized OCO team member records collection.</p>}</CardContent></Card><Card className="border-primary/20 bg-primary/5"><CardContent className="p-5 text-sm leading-6"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Your request is in the OCO system. The local team will confirm availability and share next steps.</p></div></CardContent></Card></div></div></div>
}

async function loadReservation(id: string): Promise<DetailData | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.')
  const reservationResult = await supabase.from('oco_reservations').select('id,reservation_number,customer_id,trailer_id,pickup_location_id,return_location_id,customer_name,customer_email,customer_phone,start_date,end_date,pickup_method,delivery_address,delivery_miles,delivery_fee,rental_subtotal,security_deposit,taxes,total,payment_method,payment_status,reservation_status,customer_notes,created_at').eq('id', id).eq('customer_id', authData.user.id).maybeSingle()
  if (reservationResult.error) throw reservationResult.error
  if (!reservationResult.data) return null
  const reservation = reservationResult.data as Reservation
  const [trailerResult, locationsResult, paymentsResult] = await Promise.all([
    supabase.from('oco_trailers').select('name,length_feet,description').eq('id', reservation.trailer_id).maybeSingle(),
    supabase.from('oco_locations').select('id,name,timezone').in('id', [reservation.pickup_location_id, reservation.return_location_id]),
    supabase.from('oco_payments').select('id,amount,method,status,provider,paid_at,created_at').eq('reservation_id', reservation.id).order('created_at', { ascending: true }),
  ])
  if (trailerResult.error) throw trailerResult.error
  if (locationsResult.error) throw locationsResult.error
  if (paymentsResult.error) throw paymentsResult.error
  const locations = (locationsResult.data ?? []) as { id: string; name: string; timezone: string }[]
  return { reservation, trailer: trailerResult.data, pickup: locations.find(item => item.id === reservation.pickup_location_id) ?? null, dropoff: locations.find(item => item.id === reservation.return_location_id) ?? null, payments: (paymentsResult.data ?? []) as Payment[] }
}
function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) { return <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="flex items-center gap-2 text-right font-medium">{icon}{value}</span></div> }
function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? 'border-t border-border pt-4 text-base font-semibold' : ''}`}><span className={strong ? '' : 'text-muted-foreground'}>{label}</span><span>{formatMoney(value)}</span></div> }
