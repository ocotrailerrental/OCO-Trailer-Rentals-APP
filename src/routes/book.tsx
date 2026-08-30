import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CircleAlert, MapPin, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AuthLoading } from '@/components/CustomerAuthLayout'
import { TrailerImage } from '@/components/TrailerImage'
import { BookingSearch, Location, Trailer, formatMoney, formatDate, parseBookingSearch } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/book')({
  validateSearch: (search: Record<string, unknown>) => parseBookingSearch(search),
  head: () => ({ meta: [
    { title: 'Available trailers · OCO Trailer Rentals' },
    { name: 'description', content: 'Find an OCO car hauler for your next move.' },
  ] }),
  component: BookRoute,
})

function BookRoute() {
  return <AvailabilityPage />
}

function AvailabilityPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/book' }) as BookingSearch
  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount marker prevents SSR/client data divergence
    setIsHydrated(true)
  }, [])
  const validSearch = Boolean(
    typeof search.pickupLocationId === 'string' && search.pickupLocationId.trim().length > 0 &&
    typeof search.returnLocationId === 'string' && search.returnLocationId.trim().length > 0 &&
    typeof search.startDate === 'string' && search.startDate.trim().length > 0 &&
    typeof search.endDate === 'string' && search.endDate.trim().length > 0 &&
    search.endDate > search.startDate,
  )
  const locationsQuery = useQuery({
    queryKey: ['booking-locations', search.pickupLocationId, search.returnLocationId],
    enabled: isHydrated && validSearch,
    queryFn: async () => {
      const { data, error } = await supabase.from('oco_locations').select('id,name,city,state,timezone').in('id', [search.pickupLocationId, search.returnLocationId]).eq('is_active', true)
      if (error) throw error
      return (data ?? []) as Location[]
    },
  })
  const trailersQuery = useQuery({
    queryKey: ['available-trailers', search.pickupLocationId, search.startDate, search.endDate],
    enabled: isHydrated && validSearch,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('oco_search_available_trailers', { p_pickup_location_id: search.pickupLocationId, p_start_date: search.startDate, p_end_date: search.endDate })
      if (error) throw error
      return (data ?? []) as Trailer[]
    },
  })
  const locations = locationsQuery.data ?? []
  const pickupLocation = locations.find(location => location.id === search.pickupLocationId)
  const returnLocation = locations.find(location => location.id === search.returnLocationId)
  const oneWay = search.pickupLocationId !== search.returnLocationId
  const changeSearch = () => navigate({ to: '/', hash: 'book' })

  if (!isHydrated) return <LoadingState />
  if (!validSearch) return <ValidationState onChange={changeSearch} />
  if (locationsQuery.isLoading || trailersQuery.isLoading) return <LoadingState />
  if (locationsQuery.error || trailersQuery.error) return <DatabaseErrorState copy={getErrorMessage(locationsQuery.error ?? trailersQuery.error)} onChange={changeSearch} />
  if (!pickupLocation || !returnLocation) return <DatabaseErrorState copy="Choose an active OCO location and search again." onChange={changeSearch} />

  return <main className="min-h-dvh bg-background"><div className="border-b border-border bg-sidebar text-sidebar-foreground"><div className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><button onClick={changeSearch} className="mb-7 flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"><ArrowLeft className="h-4 w-4" /> Change search</button><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">OCO availability</p><h1 className="mt-3 font-serif text-4xl">Trailers ready for your dates.</h1><div className="mt-5 flex flex-wrap gap-4 text-sm text-sidebar-foreground/70"><span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {pickupLocation.name} → {returnLocation.name}</span><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {formatDate(search.startDate)} – {formatDate(search.endDate)}</span></div></div></div><div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">{oneWay && <div className="mb-7 flex gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>One-way rental selected.</strong> A manager must confirm the return location before this reservation is approved. {search.delivery && 'Delivery requests also require manager confirmation.'}</p></div>}{!oneWay && search.delivery && <div className="mb-7 flex gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p><strong>Delivery requested.</strong> Your address and mileage will be collected on the next step and confirmed by the local team.</p></div>}<div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">{trailersQuery.data?.length ?? 0} available result{trailersQuery.data?.length === 1 ? '' : 's'}</p><h2 className="mt-1 font-serif text-3xl">Choose your trailer</h2></div><span className="hidden text-xs text-muted-foreground sm:block">Availability is checked by Supabase</span></div>{trailersQuery.data?.length ? <div className="grid gap-6 lg:grid-cols-2">{trailersQuery.data.map(trailer => <TrailerResult key={trailer.id} trailer={trailer} location={pickupLocation} search={search} onReserve={() => navigate({ to: '/reserve', search: { ...search, trailerId: trailer.id } })} />)}</div> : <EmptyResultsState onChange={changeSearch} />}</div></main>
}

function TrailerResult({ trailer, location, search, onReserve }: { trailer: Trailer; location: Location; search: BookingSearch; onReserve: () => void }) { return <Card className="overflow-hidden border-border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"><div className="grid sm:grid-cols-[0.75fr_1fr]"><TrailerImage src={trailer.image_url} alt={trailer.name} className="h-56 w-full sm:h-full" /><CardContent className="p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{trailer.length_feet}-foot car hauler</p><h3 className="mt-2 font-serif text-2xl">{trailer.name}</h3></div><Truck className="h-5 w-5 text-primary" /></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{trailer.description || 'OCO equipment details are being updated.'}</p><div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{trailer.gvwr_lbs && <span><b>GVWR</b><br />{trailer.gvwr_lbs.toLocaleString()} lb</span>}{trailer.payload_lbs && <span><b>Payload</b><br />{trailer.payload_lbs.toLocaleString()} lb</span>}{trailer.hitch_type && <span><b>Hitch</b><br />{trailer.hitch_type}</span>}{trailer.brake_connector && <span><b>Brakes</b><br />{trailer.brake_connector}</span>}</div><div className="mt-5 border-t border-border pt-4 text-sm"><p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-primary" /> Pickup at {location.name}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>Daily <b className="block text-foreground">{formatMoney(trailer.daily_rate)}</b></span><span>Weekly <b className="block text-foreground">{formatMoney(trailer.weekly_rate)}</b></span><span>30 days <b className="block text-foreground">{formatMoney(trailer.monthly_rate)}</b></span><span>Deposit <b className="block text-foreground">{formatMoney(trailer.security_deposit)}</b></span></div></div><Button onClick={onReserve} className="mt-6 h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">Reserve this trailer <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></div></Card> }

function ValidationState({ onChange }: { onChange: () => void }) { return <StateFrame icon="error" title="Complete your rental search" copy="Use the booking form to choose a pickup location and valid dates." onChange={onChange} /> }
function LoadingState() { return <StateFrame icon="loading" title="Checking the fleet…" copy="We’re asking the OCO availability service for trailers that fit your dates." /> }
function DatabaseErrorState({ copy, onChange }: { copy: string; onChange: () => void }) { return <StateFrame icon="error" title="Availability is temporarily unavailable" copy={copy} onChange={onChange} /> }
function EmptyResultsState({ onChange }: { onChange: () => void }) { return <StateFrame icon="empty" title="No trailers available for those dates" copy="Try a different date range or choose another OCO location." onChange={onChange} /> }
function StateFrame({ icon, title, copy, onChange }: { icon: 'loading' | 'error' | 'empty'; title: string; copy: string; onChange?: () => void }) { return <main className="flex min-h-dvh items-center justify-center bg-background px-5"><div className="max-w-md text-center">{icon === 'loading' ? <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /> : <CircleAlert className={`mx-auto h-10 w-10 ${icon === 'error' ? 'text-destructive' : 'text-primary'}`} />}<h1 className="mt-5 font-serif text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>{onChange && <Button onClick={onChange} className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">Change search</Button>}</div></main> }
function getErrorMessage(error: unknown) { return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again in a moment.' }
