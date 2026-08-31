import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, MapPin, Truck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { BookingSearchForm } from '@/components/BookingSearchForm'
import { TrailerImage } from '@/components/TrailerImage'
import { Location, TRAILER_COLUMNS, Trailer, formatMoney } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/app/book')({
  head: () => ({ meta: [{ title: 'Book a trailer · OCO Trailer Rentals' }] }),
  component: PortalBookingPage,
})

/**
 * Booking, inside the customer portal.
 *
 * Signed-in customers previously had no way to start a rental from their account:
 * the only search form lived on the marketing home page, and the portal's only
 * links to it sat inside empty states, so a customer who already had a booking
 * saw no route to a second one at all.
 */
function PortalBookingPage() {
  const locationsQuery = useQuery({
    queryKey: ['public-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oco_locations')
        .select('id,name,city,state,timezone')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Location[]
    },
  })

  const trailersQuery = useQuery({
    queryKey: ['public-trailers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oco_trailers')
        .select(TRAILER_COLUMNS)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Trailer[]
    },
  })

  const locations = locationsQuery.data ?? []
  const trailers = trailersQuery.data ?? []
  const locationName = (id: string) =>
    locations.find(location => location.id === id)?.city ?? 'OCO location'

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Start a rental
        </p>
        <h1 className="mt-2 font-serif text-4xl">Book a trailer</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick your dates and we&rsquo;ll show what is free at that location.
        </p>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-7">
          <BookingSearchForm
            locations={locations}
            isLoading={locationsQuery.isLoading}
            loadError={locationsQuery.error}
          />
        </CardContent>
      </Card>

      <section>
        <h2 className="font-serif text-2xl">The fleet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Availability depends on your dates &mdash; search above to see what is free.
        </p>

        {trailersQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading the current OCO fleet&hellip;</p>
        ) : trailersQuery.error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            We could not load the fleet right now: {trailersQuery.error.message}
          </p>
        ) : trailers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No trailers are listed right now.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {trailers.map(trailer => (
              <a
                key={trailer.id}
                href={`/trailers/${trailer.slug}`}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-40 w-full bg-sidebar">
                  <TrailerImage
                    src={trailer.image_url}
                    alt={trailer.name}
                    className="h-full w-full"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl">{trailer.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {locationName(trailer.location_id)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-right text-sm font-bold text-primary">
                      {formatMoney(trailer.daily_rate)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        per day
                      </span>
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
                    Specifications <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <p className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        Two confirmed rentals can never overlap on the same trailer, so anything the search
        returns is genuinely free for those dates.
      </p>
    </div>
  )
}
