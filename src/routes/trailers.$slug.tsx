import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, CircleAlert, MapPin, ShieldCheck } from 'lucide-react'
import { AuthLoading } from '@/components/CustomerAuthLayout'
import { OcoLockup } from '@/components/OcoLogo'
import { SiteFooter } from '@/components/SiteFooter'
import { TrailerImage } from '@/components/TrailerImage'
import { Button } from '@/components/ui/button'
import {
  Location,
  TRAILER_COLUMNS,
  Trailer,
  addDays,
  formatMoney,
  localDateString,
  trailerSpecs,
} from '@/lib/booking'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/trailers/$slug')({
  head: () => ({
    meta: [
      { title: 'Trailer details · OCO Trailer Rentals' },
      {
        name: 'description',
        content:
          'Full specifications, capacities and daily, weekly and monthly rates for this OCO car hauler.',
      },
    ],
  }),
  component: TrailerDetailPage,
})

type DetailData = { trailer: Trailer; location: Location | null }

function TrailerDetailPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()

  // Same mount gate the other public pages use. The deployment is static, so the
  // first paint is prerendered HTML with no session and no data; querying before
  // hydration produces markup the client immediately contradicts.
  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount marker prevents SSR/client data divergence
    setIsHydrated(true)
  }, [])

  const query = useQuery({
    queryKey: ['trailer', slug],
    enabled: isHydrated,
    queryFn: () => loadTrailer(slug),
  })

  if (!isHydrated || query.isLoading) return <AuthLoading label="Loading trailer details…" />

  if (query.error) {
    return (
      <Shell>
        <Notice
          title="We could not load this trailer"
          copy={query.error instanceof Error ? query.error.message : 'Please try again in a moment.'}
        />
      </Shell>
    )
  }

  if (!query.data) {
    return (
      <Shell>
        <Notice
          title="That trailer is not in the fleet"
          copy="It may have been retired or the link may be out of date. The current fleet is on the home page."
        />
      </Shell>
    )
  }

  const { trailer, location } = query.data
  const specs = trailerSpecs(trailer)
  const features = trailer.features ?? []

  // Prefill the booking search with this trailer's own pickup location so the
  // customer lands on availability for the right yard rather than the first one
  // in the list.
  function checkAvailability() {
    const today = localDateString(new Date())
    void navigate({
      to: '/book',
      search: {
        pickupLocationId: trailer.location_id,
        returnLocationId: trailer.location_id,
        startDate: today,
        endDate: addDays(today, 7),
        delivery: false,
      },
    })
  }

  return (
    <Shell>
      <a
        href="/#fleet"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the fleet
      </a>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div>
          <div className="overflow-hidden rounded-2xl border border-border bg-sidebar">
            <TrailerImage src={trailer.image_url} alt={trailer.name} className="h-[22rem] w-full" />
          </div>

          {features.length > 0 && (
            <section className="mt-8">
              <h2 className="font-serif text-2xl">What comes with it</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-serif text-2xl">Specifications</h2>
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {specs.map(spec => (
                <div key={spec.label} className="flex items-baseline justify-between gap-6 py-3">
                  <dt className="text-sm text-muted-foreground">
                    {spec.label}
                    {spec.note && (
                      <span className="mt-0.5 block text-xs text-muted-foreground/70">{spec.note}</span>
                    )}
                  </dt>
                  <dd className="text-right text-sm font-semibold tabular-nums">{spec.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Payload is the most you can put on the deck. It is already the trailer&rsquo;s weight
              subtracted from its GVWR, so you do not need to subtract anything again. Check your
              tow vehicle&rsquo;s own towing and tongue-weight ratings before you load.
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {trailer.trailer_type.replace(/_/g, ' ')}
            </p>
            <h1 className="mt-3 font-serif text-4xl">{trailer.name}</h1>
            {location && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" /> Picks up in {location.city},{' '}
                {location.state}
              </p>
            )}
            {trailer.description && (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{trailer.description}</p>
            )}

            <div className="mt-7 border-t border-border pt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Rates
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Rate label="Daily" value={trailer.daily_rate} />
                <Rate label="Weekly" value={trailer.weekly_rate} note="7 days" />
                <Rate label="Monthly" value={trailer.monthly_rate} note="30 days" />
                <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-muted-foreground">
                    Security deposit
                    <span className="mt-0.5 block text-xs text-muted-foreground/70">
                      Card on file — charged only if the return inspection finds damage
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(trailer.security_deposit)}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Longer rentals bill at the better rate automatically: whole months first, then whole
                weeks, then any remaining days. Pickup and return days are both charged.
              </p>
            </div>

            <Button
              onClick={checkAvailability}
              className="mt-7 h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Check availability <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Inspected before every rental. Photographed at pickup and return, so the condition it
              left in is on the record.
            </p>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

function Rate({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">
        {label}
        {note && <span className="ml-1.5 text-xs text-muted-foreground/70">({note})</span>}
      </dt>
      <dd className="font-semibold tabular-nums">{formatMoney(value)}</dd>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-sidebar-foreground/10 bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="/" aria-label="OCO Trailer Rentals — home">
            <OcoLockup />
          </a>
          <a href="/login">
            <Button
              variant="outline"
              className="border-sidebar-foreground/30 bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Sign in
            </Button>
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">{children}</main>
      <SiteFooter />
    </div>
  )
}

function Notice({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 text-center">
      <CircleAlert className="mx-auto h-9 w-9 text-destructive" />
      <h1 className="mt-4 font-serif text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      <a href="/#fleet" className="mt-6 inline-flex text-sm font-semibold text-primary hover:underline">
        See the fleet
      </a>
    </div>
  )
}

async function loadTrailer(slug: string): Promise<DetailData | null> {
  const { data, error } = await supabase
    .from('oco_available_trailers')
    .select(TRAILER_COLUMNS)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const trailer = data as unknown as Trailer

  const { data: locationData, error: locationError } = await supabase
    .from('oco_locations')
    .select('id,name,city,state,timezone')
    .eq('id', trailer.location_id)
    .maybeSingle()
  if (locationError) throw locationError

  return { trailer, location: (locationData as Location | null) ?? null }
}
