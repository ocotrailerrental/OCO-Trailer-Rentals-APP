import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  Camera,
  CircleAlert,
  FileText,
  IdCard,
  MapPin,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatMoney } from '@/lib/booking'
import { statusClass, statusInfo } from '@/lib/reservation-status'
import { AdminData, AdminReservation } from '@/lib/admin'
import { InspectionPanel } from '@/components/InspectionPanel'
import { supabase } from '@/lib/supabase'

/**
 * Everything a member of staff needs before approving a rental, on one panel:
 * who is renting, what they agreed to, what documents they supplied, the money,
 * and any inspection photos already taken.
 *
 * Approving without seeing the documents is the failure this is built to prevent,
 * so the licence and insurance block is not hidden behind a second click.
 */
export function ReservationReview({
  reservation,
  data,
  onClose,
}: {
  reservation: AdminReservation
  data: AdminData
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [declineReason, setDeclineReason] = useState('')
  const [showDecline, setShowDecline] = useState(false)
  const [error, setError] = useState('')
  const [inspecting, setInspecting] = useState<'pickup' | 'return' | null>(null)

  const trailer = data.trailers.find(item => item.id === reservation.trailer_id)
  const pickup = data.locations.find(item => item.id === reservation.pickup_location_id)
  const dropoff = data.locations.find(item => item.id === reservation.return_location_id)
  const verification = data.verifications.find(item => item.profile_id === reservation.customer_id)
  const inspections = data.inspections.filter(item => item.reservation_id === reservation.id)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-console'] })
  const runRpc = (fn: string, args: Record<string, unknown>) =>
    supabase.rpc(fn, args).then(({ error: rpcError }) => {
      if (rpcError) throw new Error(rpcError.message)
    })

  const approve = useMutation({
    mutationFn: () => runRpc('oco_approve_reservation', { p_reservation_id: reservation.id }),
    onSuccess: () => { refresh(); onClose() },
    onError: e => setError(e instanceof Error ? e.message : 'The approval did not go through.'),
  })
  const decline = useMutation({
    mutationFn: () =>
      runRpc('oco_decline_reservation', {
        p_reservation_id: reservation.id,
        p_reason: declineReason.trim(),
      }),
    onSuccess: () => { refresh(); onClose() },
    onError: e => setError(e instanceof Error ? e.message : 'The decline did not go through.'),
  })
  const collect = useMutation({
    mutationFn: () => runRpc('oco_mark_picked_up', { p_reservation_id: reservation.id }),
    onSuccess: refresh,
    onError: e => setError(e instanceof Error ? e.message : 'Could not record collection.'),
  })
  const complete = useMutation({
    mutationFn: () => runRpc('oco_mark_returned', { p_reservation_id: reservation.id }),
    onSuccess: refresh,
    onError: e => setError(e instanceof Error ? e.message : 'Could not record the return.'),
  })

  const status = reservation.reservation_status.toLowerCase()
  const busy = approve.isPending || decline.isPending || collect.isPending || complete.isPending

  const inspectionFor = (type: string) => inspections.find(item => item.inspection_type === type)
  const pickupDone = Boolean(inspectionFor('pickup')?.completed_at)
  const returnDone = Boolean(inspectionFor('return')?.completed_at)

  // Anything that ought to make a member of staff pause before approving.
  const concerns: string[] = []
  if (!reservation.agreement_accepted_at) concerns.push('The rental agreement has not been accepted.')
  if (!verification) concerns.push('No licence or insurance has been supplied.')
  else {
    if (!verification.license_expiry) concerns.push('No driving licence on file.')
    else if (verification.license_expiry < new Date().toISOString().slice(0, 10))
      concerns.push('The driving licence on file has expired.')
    if (!verification.insurance_type) concerns.push('No insurance recorded.')
    if (!verification.verified_at) concerns.push('Documents have not been verified by staff yet.')
  }

  if (inspecting) {
    return (
      <InspectionPanel
        reservation={reservation}
        inspectionType={inspecting}
        data={data}
        onClose={() => setInspecting(null)}
      />
    )
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm font-semibold">{reservation.reservation_number}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(status)}`}>
                {statusInfo(status).label}
              </span>
            </div>
            <h3 className="mt-2 font-serif text-2xl">{trailer?.name ?? 'Trailer'}</h3>
          </div>
          <Button variant="outline" onClick={onClose} className="bg-transparent">
            Close
          </Button>
        </div>

        {concerns.length > 0 && status === 'pending' && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <CircleAlert className="h-4 w-4" /> Check before approving
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-300">
              {concerns.map(item => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Customer" icon={<User className="h-4 w-4 text-primary" />}>
            <Row label="Name" value={reservation.customer_name} />
            <Row label="Email" value={reservation.customer_email} />
            <Row label="Phone" value={reservation.customer_phone ?? '—'} />
            {reservation.customer_notes && <Row label="Their note" value={reservation.customer_notes} />}
          </Section>

          <Section title="Rental" icon={<CalendarDays className="h-4 w-4 text-primary" />}>
            <Row
              label="Dates"
              value={`${formatDate(reservation.start_date)} – ${formatDate(reservation.end_date)}`}
            />
            <Row
              label="Route"
              value={`${pickup?.city ?? 'Pickup'} → ${dropoff?.city ?? 'Return'}`}
            />
            <Row
              label="Collection"
              value={
                reservation.pickup_method === 'delivery'
                  ? `Delivery · ${reservation.delivery_address ?? 'address not given'}`
                  : 'Customer collects'
              }
            />
            {reservation.due_back_at && (
              <Row label="Due back" value={new Date(reservation.due_back_at).toLocaleString()} />
            )}
          </Section>

          <Section title="Documents" icon={<IdCard className="h-4 w-4 text-primary" />}>
            {!verification ? (
              <p className="text-sm text-muted-foreground">
                Nothing supplied yet. Licence, age and insurance are checked in person at collection
                until the customer uploads them.
              </p>
            ) : (
              <>
                <Row
                  label="Licence"
                  value={
                    verification.license_state
                      ? `${verification.license_state} ····${verification.license_last4 ?? '????'}`
                      : 'Not supplied'
                  }
                />
                <Row label="Licence expires" value={verification.license_expiry ?? '—'} />
                <Row label="Date of birth" value={verification.date_of_birth ?? '—'} />
                <Row
                  label="Insurance"
                  value={
                    verification.insurance_type === 'oco_coverage'
                      ? verification.coverage_label ?? 'OCO coverage'
                      : verification.insurer_name ?? 'Own policy'
                  }
                />
                <Row label="Policy expires" value={verification.policy_expiry ?? '—'} />
                <Row
                  label="Verified"
                  value={verification.verified_at ? formatDate(verification.verified_at.slice(0, 10)) : 'Not yet'}
                />
                <DocumentLink path={verification.license_photo_path} label="View licence image" />
                <DocumentLink path={verification.insurance_doc_path} label="View insurance document" />
              </>
            )}
          </Section>

          <Section title="Agreement" icon={<FileText className="h-4 w-4 text-primary" />}>
            {reservation.agreement_accepted_at ? (
              <>
                <Row label="Accepted" value={new Date(reservation.agreement_accepted_at).toLocaleString()} />
                <Row label="Signed as" value={reservation.agreement_accepted_name ?? '—'} />
                <p className="pt-1 text-xs leading-5 text-muted-foreground">
                  Take the paper signature at collection. It is the same document.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not accepted. This booking predates the agreement, or acceptance did not record.
              </p>
            )}
          </Section>
        </div>

        <Section title="Money" icon={<Truck className="h-4 w-4 text-primary" />}>
          <Row label="Rental" value={formatMoney(reservation.pre_discount_subtotal)} />
          {reservation.discount_amount > 0 && (
            <Row
              label={`Discount · ${reservation.discount_code ?? ''}`}
              value={`−${formatMoney(reservation.discount_amount)}`}
            />
          )}
          {reservation.delivery_fee > 0 && (
            <Row label={`Delivery · ${reservation.delivery_miles} mi`} value={formatMoney(reservation.delivery_fee)} />
          )}
          <Row
            label={`Sales tax · ${(Number(reservation.tax_rate) * 100).toFixed(2).replace(/\.00$/, '')}%`}
            value={formatMoney(reservation.taxes)}
          />
          <Row label="Security deposit" value={formatMoney(reservation.security_deposit)} />
          {reservation.late_fee_amount > 0 && (
            <Row label="Late fee" value={formatMoney(reservation.late_fee_amount)} />
          )}
          <Row label="Total" value={formatMoney(reservation.total)} strong />
          <Row
            label="Payment"
            value={reservation.payment_method === 'cash' ? 'Cash at pickup' : 'Card'}
          />
        </Section>

        <Section title="Inspections" icon={<Camera className="h-4 w-4 text-primary" />}>
          {inspections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inspection recorded yet for this rental.
            </p>
          ) : (
            inspections.map(item => (
              <Row
                key={item.id}
                label={`${item.inspection_type === 'pickup' ? 'Pickup' : 'Return'} · ${item.condition_status.replace(/_/g, ' ')} · ${item.photo_count} photo${item.photo_count === 1 ? '' : 's'}`}
                value={item.completed_at ? formatDate(item.completed_at.slice(0, 10)) : 'In progress'}
              />
            ))
          )}
        </Section>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          {status === 'pending' && !showDecline && (
            <>
              <Button
                disabled={busy}
                onClick={() => { setError(''); approve.mutate() }}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <ShieldCheck className="h-4 w-4" />
                {approve.isPending ? 'Approving…' : 'Approve rental'}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setShowDecline(true)} className="bg-transparent">
                Decline
              </Button>
            </>
          )}

          {status === 'pending' && showDecline && (
            <div className="w-full space-y-3">
              <Label htmlFor="decline-reason">Why are you declining? The customer is told.</Label>
              <Input
                id="decline-reason"
                value={declineReason}
                onChange={event => setDeclineReason(event.target.value)}
                placeholder="Trailer needed for maintenance that week"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={busy || !declineReason.trim()}
                  onClick={() => { setError(''); decline.mutate() }}
                  className="gap-2 border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10"
                >
                  {decline.isPending ? 'Declining…' : 'Confirm decline'}
                </Button>
                <Button variant="outline" onClick={() => setShowDecline(false)} className="bg-transparent">
                  Back
                </Button>
              </div>
            </div>
          )}

          {status === 'confirmed' && (
            <>
              <Button
                variant={pickupDone ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => setInspecting('pickup')}
                className={
                  pickupDone
                    ? 'gap-2 bg-transparent'
                    : 'gap-2 bg-primary text-primary-foreground hover:bg-primary/90'
                }
              >
                <Camera className="h-4 w-4" />
                {pickupDone ? 'Pickup photos' : 'Pickup inspection'}
              </Button>
              <Button
                variant={pickupDone ? 'default' : 'outline'}
                disabled={busy}
                onClick={() => { setError(''); collect.mutate() }}
                className={
                  pickupDone
                    ? 'gap-2 bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'gap-2 bg-transparent'
                }
              >
                <MapPin className="h-4 w-4" />
                {collect.isPending ? 'Recording…' : 'Record collection'}
              </Button>
              {!pickupDone && (
                <p className="w-full text-xs text-muted-foreground">
                  Photograph the trailer before it leaves. Without a pickup record there is nothing
                  to compare the return against, and damage becomes a matter of opinion.
                </p>
              )}
            </>
          )}

          {status === 'active' && (
            <>
              <Button
                variant={returnDone ? 'outline' : 'default'}
                disabled={busy}
                onClick={() => setInspecting('return')}
                className={
                  returnDone
                    ? 'gap-2 bg-transparent'
                    : 'gap-2 bg-primary text-primary-foreground hover:bg-primary/90'
                }
              >
                <Camera className="h-4 w-4" />
                {returnDone ? 'Return photos' : 'Return inspection'}
              </Button>
              <Button
                variant={returnDone ? 'default' : 'outline'}
                disabled={busy}
                onClick={() => { setError(''); complete.mutate() }}
                className={
                  returnDone
                    ? 'gap-2 bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'gap-2 bg-transparent'
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {complete.isPending ? 'Recording…' : 'Record return'}
              </Button>
              {!returnDone && (
                <p className="w-full text-xs text-muted-foreground">
                  Photograph it before you close the rental. Recording the return works out the late
                  fee against the agreed deadline.
                </p>
              )}
            </>
          )}

          {['completed'].includes(status) && inspections.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setInspecting('return')}
              className="gap-2 bg-transparent"
            >
              <Camera className="h-4 w-4" /> Inspection photos
            </Button>
          )}

          {['completed', 'cancelled', 'declined'].includes(status) && (
            <p className="text-sm text-muted-foreground">
              This rental is {statusInfo(status).label.toLowerCase()}.
              {reservation.decline_reason ? ` Reason: ${reservation.decline_reason}` : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Inspection photos and licence images live in a private bucket, so they are
 * reached through a short-lived signed URL rather than a public link. The URL is
 * minted only when a member of staff asks for it.
 */
function DocumentLink({ path, label }: { path: string | null; label: string }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const signed = useQuery({
    queryKey: ['signed-doc', path],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('oco-inspection-photos')
        .createSignedUrl(path as string, 300)
      if (error) throw error
      return data.signedUrl
    },
  })
  if (!path) return null
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline">
        {label} — opens for 5 minutes
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          const result = await signed.refetch()
          if (result.data) setUrl(result.data)
          else setFailed(true)
        } catch {
          setFailed(true)
        }
      }}
      className="text-left text-sm font-semibold text-primary hover:underline"
    >
      {failed ? 'That document could not be opened' : label}
    </button>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {title}
      </h4>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  )
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? 'border-t border-border pt-2 text-base font-semibold' : 'text-sm'}`}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
