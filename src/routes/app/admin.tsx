import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Banknote,
  Building2,
  CircleAlert,
  CreditCard,
  Percent,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { TrailerImage } from '@/components/TrailerImage'
import { formatDate, formatMoney } from '@/lib/booking'
import { statusClass, statusInfo } from '@/lib/reservation-status'
import {
  ALL_ROLES,
  AdminData,
  AdminDiscount,
  AdminLocation,
  AdminProfile,
  STAFF_ROLES,
  loadAdminData,
  outstandingRows,
  summariseFinance,
} from '@/lib/admin'
import { supabase } from '@/lib/supabase'

const TABS = ['finance', 'trailers', 'discounts', 'locations', 'team'] as const
type Tab = (typeof TABS)[number]

// Exactly the values `oco_trailers_status_check` allows. Offering anything else
// produces a constraint violation the moment someone picks it.
const TRAILER_STATUSES = ['available', 'reserved', 'rented', 'maintenance', 'inactive']

// Narrow, so a typo cannot write to a table this page has no business touching,
// and so supabase-js can resolve the table name to a literal type.
type EditableTable = 'oco_trailers' | 'oco_locations' | 'oco_profiles'

export const Route = createFileRoute('/app/admin')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (TABS as readonly string[]).includes(String(search.tab)) ? (search.tab as Tab) : 'finance',
  }),
  head: () => ({ meta: [{ title: 'Admin · OCO Trailer Rentals' }] }),
  component: AdminConsole,
})

function AdminConsole() {
  const { tab } = useSearch({ from: '/app/admin' })
  const navigate = useNavigate()
  const query = useQuery({ queryKey: ['admin-console'], queryFn: loadAdminData })

  if (query.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    )
  }

  if (query.error) {
    return (
      <Notice
        title="We could not load the admin data"
        copy={query.error instanceof Error ? query.error.message : 'Please try again in a moment.'}
      />
    )
  }

  // The real gate is row-level security: a customer who types this URL gets a page
  // with nothing on it, because every query returns zero rows. This message just
  // explains that rather than showing empty tables.
  if (!query.data?.isStaff) {
    return (
      <Notice
        title="This area is for OCO staff"
        copy="Your account does not have access to the admin console. If that looks wrong, ask an administrator to check your role."
      />
    )
  }

  const data = query.data
  const finance = summariseFinance(data)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Administration
        </p>
        <h1 className="mt-2 font-serif text-4xl">
          {data.isManager ? `${scopeName(data)} overview` : 'Business overview'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.isManager
            ? 'You are seeing your own yard only. Figures and records from other locations are not included.'
            : `${data.locations.length} location${data.locations.length === 1 ? '' : 's'} · ${
                data.trailers.length
              } trailer${data.trailers.length === 1 ? '' : 's'} · ${
                data.profiles.filter(p => STAFF_ROLES.includes(p.role)).length
              } on the team`}
        </p>
        {data.isManager && !data.managerLocationId && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Your account is a manager but has no home yard assigned, so there is nothing to show.
            Ask an administrator to set your location on the Team tab.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          label="Collected"
          value={formatMoney(finance.collectedTotal)}
          note="Payments marked paid"
        />
        <Stat
          icon={<CircleAlert className="h-4 w-4" />}
          label="Outstanding"
          value={formatMoney(finance.outstanding)}
          note="Owed on live rentals"
        />
        <Stat
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Deposits held"
          value={formatMoney(finance.depositsOnFile)}
          note="On card, not charged"
        />
        <Stat
          icon={<Truck className="h-4 w-4" />}
          label="Live rentals"
          value={String(finance.liveReservations)}
          note="Not cancelled or declined"
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => void navigate({ to: '/app/admin', search: { tab: item } })}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === item
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'finance' && <FinanceTab data={data} />}
      {tab === 'trailers' && <TrailersTab data={data} />}
      {tab === 'discounts' && <DiscountsTab data={data} />}
      {tab === 'locations' && <LocationsTab data={data} />}
      {tab === 'team' && <TeamTab data={data} />}
    </div>
  )
}

/* --------------------------------------------------------------- finance tab */

function FinanceTab({ data }: { data: AdminData }) {
  const finance = summariseFinance(data)
  const owed = outstandingRows(data)
  const locationName = (id: string) =>
    data.locations.find(location => location.id === id)?.city ?? 'Unknown'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Cash" icon={<Banknote className="h-4 w-4 text-primary" />}>
          <Row label="Collected" value={formatMoney(finance.collectedCash)} strong />
          <Row label="Recorded but not yet collected" value={formatMoney(finance.pendingCash)} />
          <p className="pt-2 text-xs leading-5 text-muted-foreground">
            Cash counts only once a member of staff records it as taken. Until then it sits in the
            second line, not the first.
          </p>
        </Panel>
        <Panel title="Card" icon={<CreditCard className="h-4 w-4 text-primary" />}>
          <Row label="Collected" value={formatMoney(finance.collectedCard)} strong />
          <Row label="Authorised or in flight" value={formatMoney(finance.pendingCard)} />
          <p className="pt-2 text-xs leading-5 text-muted-foreground">
            Card payments land here once the provider confirms them. Stripe is not wired up yet, so
            this stays at zero until it is.
          </p>
        </Panel>
      </div>

      <Panel title="Where the money stands">
        <Row label="Expected rental revenue" value={formatMoney(finance.expectedRevenue)} />
        <Row label="Collected so far" value={formatMoney(finance.collectedTotal)} />
        <Row label="Still owed" value={formatMoney(finance.outstanding)} strong />
        <Row label="Deposits held on file" value={formatMoney(finance.depositsOnFile)} />
        <p className="pt-2 text-xs leading-5 text-muted-foreground">
          Revenue excludes the security deposit. The deposit is only charged if a return inspection
          finds damage, so counting it as income would overstate every figure on this page.
        </p>
      </Panel>

      {finance.byLocation.length > 0 && (
        <Panel title="By location">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 text-right font-medium">Rentals</th>
                  <th className="pb-2 text-right font-medium">Collected</th>
                  <th className="pb-2 text-right font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {finance.byLocation.map(row => (
                  <tr key={row.locationId} className="border-b border-border last:border-0">
                    <td className="py-2.5">{locationName(row.locationId)}</td>
                    <td className="py-2.5 text-right tabular-nums">{row.rentals}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(row.collected)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(row.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title={`Owed on live rentals (${owed.length})`}>
        {owed.length === 0 ? (
          <Empty copy="Nothing outstanding. Every live rental is paid up." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Reservation</th>
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Dates</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Owed</th>
                </tr>
              </thead>
              <tbody>
                {owed.map(row => (
                  <tr key={row.reservation.id} className="border-b border-border last:border-0">
                    <td className="py-2.5">
                      <span className="font-medium">{row.reservation.reservation_number}</span>
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                          row.reservation.reservation_status
                        )}`}
                      >
                        {statusInfo(row.reservation.reservation_status).label}
                      </span>
                    </td>
                    <td className="py-2.5">{row.reservation.customer_name}</td>
                    <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.reservation.start_date)}
                    </td>
                    <td className="py-2.5 capitalize text-muted-foreground">
                      {row.reservation.payment_method}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {formatMoney(row.owed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Recent payments (${data.payments.length})`}>
        {data.payments.length === 0 ? (
          <Empty copy="No payments have been recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.slice(0, 25).map(payment => (
                  <tr key={payment.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate((payment.paid_at ?? payment.created_at).slice(0, 10))}
                    </td>
                    <td className="py-2.5 capitalize">{payment.method}</td>
                    <td className="py-2.5 capitalize text-muted-foreground">{payment.status}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatMoney(payment.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------- discounts tab */

function scopeName(data: AdminData) {
  const home = data.locations.find(location => location.id === data.managerLocationId)
  return home ? home.city : 'Your yard'
}

function DiscountsTab({ data }: { data: AdminData }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-console'] })

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('oco_discounts').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
    onError: e => window.alert(`Not saved: ${e instanceof Error ? e.message : 'unknown error'}`),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('oco_discounts').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: refresh,
    onError: e => window.alert(`Not deleted: ${e instanceof Error ? e.message : 'unknown error'}`),
  })

  const locationName = (id: string | null) =>
    id ? data.locations.find(l => l.id === id)?.city ?? 'Unknown yard' : 'All locations'

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">
          These codes are not applied at checkout yet.
        </strong>{' '}
        You can create and manage them here, but the booking calculation does not read this table,
        so a customer entering a code today would still pay full price. Wiring it into pricing
        changes what people are charged, so say the word and it gets done deliberately.
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl">
          Discount codes <span className="text-muted-foreground">({data.discounts.length})</span>
        </h2>
        <Button
          onClick={() => setOpen(value => !value)}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Tag className="h-4 w-4" /> {open ? 'Cancel' : 'New code'}
        </Button>
      </div>

      {open && <DiscountForm data={data} onDone={() => { setOpen(false); refresh() }} />}

      {data.discounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Percent className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No discount codes yet.
              {data.isManager && ' Codes you create will apply to your yard only.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.discounts.map((discount: AdminDiscount) => {
            const usedUp = discount.max_uses !== null && discount.times_used >= discount.max_uses
            return (
              <Card key={discount.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-md bg-secondary px-2.5 py-1 font-mono text-sm font-semibold tracking-wider">
                        {discount.code}
                      </span>
                      <span className="font-serif text-xl">
                        {discount.kind === 'percent'
                          ? `${Number(discount.value)}% off`
                          : `${formatMoney(discount.value)} off`}
                      </span>
                      {!discount.is_active && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                          Off
                        </span>
                      )}
                      {usedUp && (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Fully used
                        </span>
                      )}
                    </div>
                    {discount.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{discount.description}</p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{locationName(discount.location_id)}</span>
                      {discount.min_days && <span>{discount.min_days}+ day rentals</span>}
                      {discount.starts_on && <span>From {formatDate(discount.starts_on)}</span>}
                      {discount.ends_on && <span>Until {formatDate(discount.ends_on)}</span>}
                      <span>
                        Used {discount.times_used}
                        {discount.max_uses ? ` of ${discount.max_uses}` : ' times'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={discount.is_active}
                      label="Active"
                      onChange={value => toggle.mutate({ id: discount.id, is_active: value })}
                    />
                    <button
                      type="button"
                      aria-label={`Delete ${discount.code}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete the code ${discount.code}? This removes the record entirely. ` +
                              `If you only want to stop it being used, switch Active off instead.`
                          )
                        ) {
                          remove.mutate(discount.id)
                        }
                      }}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiscountForm({ data, onDone }: { data: AdminData; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState('10')
  // A manager can only ever create a code for their own yard, and the database
  // agrees: the insert policy rejects any other location_id.
  const [locationId, setLocationId] = useState(data.isManager ? data.managerLocationId ?? '' : '')
  const [minDays, setMinDays] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = code.trim().toUpperCase()
      const amount = Number(value)
      if (!trimmed) throw new Error('Give the code a name, for example SUMMER25.')
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('The value must be above zero.')
      if (kind === 'percent' && amount > 100) throw new Error('A percentage cannot exceed 100.')
      if (startsOn && endsOn && endsOn < startsOn)
        throw new Error('The end date cannot be before the start date.')

      const { error: insertError } = await supabase.from('oco_discounts').insert({
        code: trimmed,
        description: description.trim() || null,
        kind,
        value: amount,
        location_id: locationId || null,
        min_days: minDays ? Number(minDays) : null,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        max_uses: maxUses ? Number(maxUses) : null,
        created_by: data.selfId,
      })
      if (insertError) throw insertError
    },
    onSuccess: onDone,
    onError: e => setError(e instanceof Error ? e.message : 'The code was not created.'),
  })

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="font-serif text-xl">New discount code</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="d-code">Code</Label>
            <Input
              id="d-code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER25"
              className="font-mono tracking-wider"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-kind">Type</Label>
            <select
              id="d-kind"
              value={kind}
              onChange={e => setKind(e.target.value as 'percent' | 'amount')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="percent">Percentage off</option>
              <option value="amount">Fixed amount off</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-value">{kind === 'percent' ? 'Percent' : 'Amount ($)'}</Label>
            <Input id="d-value" type="number" min="0" value={value} onChange={e => setValue(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="d-desc">Description</Label>
            <Input
              id="d-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Off-season promotion for returning customers"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-loc">Applies to</Label>
            <select
              id="d-loc"
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              disabled={data.isManager}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            >
              {!data.isManager && <option value="">All locations</option>}
              {data.locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.city}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-min">Minimum rental days</Label>
            <Input id="d-min" type="number" min="1" value={minDays} onChange={e => setMinDays(e.target.value)} placeholder="Any" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-max">Maximum uses</Label>
            <Input id="d-max" type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-start">Starts</Label>
            <Input id="d-start" type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-end">Ends</Label>
            <Input id="d-end" type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3 border-t border-border pt-5">
          <Button
            onClick={() => { setError(''); create.mutate() }}
            disabled={create.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {create.isPending ? 'Creating…' : 'Create code'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------- trailers tab */

function TrailersTab({ data }: { data: AdminData }) {
  const save = useSaver()
  const locationName = (id: string) =>
    data.locations.find(location => location.id === id)?.name ?? 'Unassigned'
  const registration = (id: string) => data.registrations.find(item => item.trailer_id === id)

  const busy = data.reservations.filter(r =>
    ['pending', 'confirmed', 'active'].includes(r.reservation_status.toLowerCase())
  )

  // The fleet table is readable by everyone — that is what lets customers browse
  // it — so a manager would otherwise see trailers from yards they cannot touch.
  // Writes are already blocked by policy; this keeps the page honest about scope.
  const trailers = data.isManager
    ? data.trailers.filter(trailer => trailer.location_id === data.managerLocationId)
    : data.trailers

  if (trailers.length === 0) {
    return <Empty copy="No trailers are assigned to your yard." />
  }

  return (
    <div className="space-y-4">
      {trailers.map(trailer => {
        const reg = registration(trailer.id)
        const onRent = busy.filter(r => r.trailer_id === trailer.id).length
        return (
          <Card key={trailer.id}>
            <CardContent className="flex flex-col gap-0 p-0 sm:flex-row">
              <div className="h-40 w-full shrink-0 bg-sidebar sm:h-auto sm:w-52">
                <TrailerImage src={trailer.image_url} alt={trailer.name} className="h-full w-full" />
              </div>
              <div className="flex-1 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-2xl">{trailer.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {locationName(trailer.location_id)}
                      {reg?.asset_number ? ` · ${reg.asset_number}` : ''}
                      {reg?.model_year ? ` · ${reg.model_year}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={trailer.status}
                      onChange={event =>
                        save('oco_trailers', trailer.id, { status: event.target.value })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {TRAILER_STATUSES.map(value => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <Toggle
                      checked={trailer.is_active}
                      label="Listed"
                      onChange={value => save('oco_trailers', trailer.id, { is_active: value })}
                    />
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                  <Spec label="GVWR" value={trailer.gvwr_lbs ? `${trailer.gvwr_lbs.toLocaleString()} lb` : null} />
                  <Spec label="Payload" value={trailer.payload_lbs ? `${trailer.payload_lbs.toLocaleString()} lb` : null} />
                  <Spec label="Axles" value={trailer.axle_config} />
                  <Spec label="On rent" value={onRent ? `${onRent} booking${onRent === 1 ? '' : 's'}` : 'Free'} />
                  <Spec label="Daily" value={formatMoney(trailer.daily_rate)} />
                  <Spec label="Weekly" value={formatMoney(trailer.weekly_rate)} />
                  <Spec label="Monthly" value={formatMoney(trailer.monthly_rate)} />
                  <Spec label="Deposit" value={formatMoney(trailer.security_deposit)} />
                </dl>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>
                    VIN <span className="font-mono text-foreground">{reg?.vin ?? '—'}</span>
                  </span>
                  <span>
                    Plate <span className="font-mono text-foreground">{reg?.license_plate ?? '—'}</span>
                  </span>
                  <span className="text-muted-foreground/70">Staff only — never shown publicly</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------- locations tab */

function LocationsTab({ data }: { data: AdminData }) {
  const save = useSaver()
  const locations = data.isManager
    ? data.locations.filter(location => location.id === data.managerLocationId)
    : data.locations

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {!data.isAdmin && (
        <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground md:col-span-2">
          Opening and closing a yard is an administrator decision, so these are read-only for you.
        </p>
      )}
      {locations.map((location: AdminLocation) => {
        const trailers = data.trailers.filter(t => t.location_id === location.id)
        const staff = data.profiles.filter(
          p => p.location_id === location.id && STAFF_ROLES.includes(p.role)
        )
        return (
          <Card key={location.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl">{location.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {location.city}, {location.state} · {location.timezone}
                  </p>
                </div>
                <Toggle
                  checked={location.is_active}
                  label="Open"
                  disabled={!data.isAdmin}
                  onChange={value => save('oco_locations', location.id, { is_active: value })}
                />
              </div>

              <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
                <Row label="Address" value={location.address ?? 'Not set'} />
                <Row label="Contact" value={location.contact_name ?? 'Not set'} />
                <Row label="Phone" value={location.contact_phone ?? 'Not set'} />
                <Row label="Trailers" value={String(trailers.length)} />
                <Row
                  label="Managers"
                  value={
                    staff.length ? staff.map(s => s.full_name || s.email || 'Unnamed').join(', ') : 'None assigned'
                  }
                />
              </dl>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ team tab */

function TeamTab({ data }: { data: AdminData }) {
  const save = useSaver()
  const staff = data.profiles.filter(p => STAFF_ROLES.includes(p.role))
  const customers = data.profiles.filter(p => !STAFF_ROLES.includes(p.role))

  return (
    <div className="space-y-6">
      {!data.isAdmin && (
        <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          You can see the team but not change roles. Only an administrator or owner can do that.
        </p>
      )}

      <Panel title={`Team (${staff.length})`} icon={<Users className="h-4 w-4 text-primary" />}>
        {staff.length === 0 ? (
          <Empty copy="No staff accounts yet." />
        ) : (
          staff.map(person => (
            <PersonRow key={person.id} person={person} data={data} save={save} />
          ))
        )}
      </Panel>

      <Panel
        title={`Customers (${customers.length})`}
        icon={<Building2 className="h-4 w-4 text-primary" />}
      >
        {customers.length === 0 ? (
          <Empty copy="No customer accounts yet." />
        ) : (
          customers.map(person => (
            <PersonRow key={person.id} person={person} data={data} save={save} />
          ))
        )}
      </Panel>
    </div>
  )
}

function PersonRow({
  person,
  data,
  save,
}: {
  person: AdminProfile
  data: AdminData
  save: ReturnType<typeof useSaver>
}) {
  // The database refuses a self role change too — this just avoids offering a
  // control that would only produce an error.
  const isSelf = person.id === data.selfId
  const canEditRole = data.isAdmin && !isSelf

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-medium">
          {person.full_name || 'Unnamed account'}
          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {person.email ?? 'No email on file'}
          {person.phone ? ` · ${person.phone}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={person.location_id ?? ''}
          onChange={event =>
            save('oco_profiles', person.id, { location_id: event.target.value || null })
          }
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">No home yard</option>
          {data.locations.map(location => (
            <option key={location.id} value={location.id}>
              {location.city}
            </option>
          ))}
        </select>
        {canEditRole ? (
          <select
            value={person.role}
            onChange={event => save('oco_profiles', person.id, { role: event.target.value })}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm capitalize"
          >
            {ALL_ROLES.map(role => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold capitalize text-secondary-foreground">
            {person.role}
          </span>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- shared */

/**
 * One writer for every editable field on this page.
 *
 * Failures surface rather than disappearing: if row-level security rejects the
 * update — a manager trying to change a role, say — the error is shown and the
 * data refetched, so the control snaps back to what the database actually holds
 * instead of showing a change that never happened.
 */
function useSaver() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({
      table,
      id,
      patch,
    }: {
      table: EditableTable
      id: string
      patch: Record<string, unknown>
    }) => {
      const { error } = await supabase.from(table).update(patch).eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-console'] }),
    onError: error => {
      const message = error instanceof Error ? error.message : 'The change was not saved.'
      if (typeof window !== 'undefined') window.alert(`Not saved: ${message}`)
    },
  })
  return (table: EditableTable, id: string, patch: Record<string, unknown>) =>
    mutation.mutate({ table, id, patch })
}

function Stat({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </p>
        <p className="mt-2 font-serif text-3xl tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-serif text-xl">
          {icon}
          {title}
        </h2>
        <div className="mt-4 space-y-2">{children}</div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        strong ? 'border-t border-border pt-2 text-base font-semibold' : 'text-sm'
      }`}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function Toggle({
  checked,
  label,
  onChange,
  disabled = false,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-center gap-2 text-sm ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  )
}

function Empty({ copy }: { copy: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{copy}</p>
}

function Notice({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
      <CircleAlert className="mx-auto h-9 w-9 text-muted-foreground" />
      <h1 className="mt-4 font-serif text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
    </div>
  )
}

