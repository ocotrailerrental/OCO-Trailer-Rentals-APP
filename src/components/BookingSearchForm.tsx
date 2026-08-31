import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookingSearch, Location, addDays, localDateString } from '@/lib/booking'

/**
 * The "where are you hauling?" search. Used by the marketing home page and by the
 * signed-in customer portal.
 *
 * It lives in one place on purpose. There were previously no booking controls
 * inside the portal at all — a signed-in customer had to leave for the marketing
 * page to start a second rental — and the fix must not become two copies of the
 * same date validation quietly disagreeing with each other.
 *
 * This form only builds a search. Availability and price are decided by
 * `oco_search_available_trailers` and `oco_create_reservation` in the database;
 * nothing here is authoritative about what is free or what it costs.
 */
export function BookingSearchForm({
  locations,
  isLoading = false,
  loadError = null,
  defaultLocationId,
  submitLabel = 'Search availability',
}: {
  locations: Location[]
  isLoading?: boolean
  loadError?: { message: string } | null
  defaultLocationId?: string
  submitLabel?: string
}) {
  const navigate = useNavigate()
  // Keep one calendar baseline for this mounted form. Recomputing it during a
  // hydration retry can overwrite dates the customer has already entered.
  const today = useMemo(() => localDateString(new Date()), [])

  const [pickupLocationId, setPickupLocationId] = useState('')
  const [returnLocationId, setReturnLocationId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(() => addDays(today, 7))
  const [delivery, setDelivery] = useState(false)
  const [searchError, setSearchError] = useState('')

  const fallback = defaultLocationId || locations[0]?.id || ''
  const pickup = pickupLocationId || fallback
  const returnLocation = returnLocationId || fallback
  const disabled = isLoading || locations.length === 0

  function submitSearch() {
    setSearchError('')
    if (!pickup || !returnLocation || !startDate || !endDate) {
      setSearchError('Choose pickup, return, and both dates to search.')
      return
    }
    if (startDate < today) {
      setSearchError('Pickup date cannot be before today.')
      return
    }
    if (endDate < startDate) {
      setSearchError('Return date cannot be before pickup date.')
      return
    }
    const search: BookingSearch = {
      pickupLocationId: pickup,
      returnLocationId: returnLocation,
      startDate,
      endDate,
      delivery,
    }
    void navigate({ to: '/book', search })
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Pickup location">
          <select
            required
            value={pickup}
            onChange={event => setPickupLocationId(event.target.value)}
            className="h-12 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            disabled={disabled}
          >
            <option value="">Choose a location</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pickup date">
          <input
            required
            type="date"
            min={today}
            value={startDate}
            onChange={event => setStartDate(event.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Return location">
          <select
            required
            value={returnLocation}
            onChange={event => setReturnLocationId(event.target.value)}
            className="h-12 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            disabled={disabled}
          >
            <option value="">Choose a location</option>
            {locations.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Return date">
          <input
            required
            type="date"
            min={startDate || today}
            value={endDate}
            onChange={event => setEndDate(event.target.value)}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>
      </div>

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          We could not load locations: {loadError.message}
        </p>
      )}
      {searchError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {searchError}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={delivery}
            onChange={event => setDelivery(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          I need paid delivery{' '}
          <span className="text-muted-foreground">($0.50 / calculated mile)</span>
        </label>
        <Button
          type="button"
          onClick={submitSearch}
          disabled={disabled}
          className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-10"
        >
          {submitLabel} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="relative block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative">
        {children}
        <ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-muted-foreground" />
      </div>
    </label>
  )
}
