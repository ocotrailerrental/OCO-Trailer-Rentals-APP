/**
 * Presentation rules for `oco_reservations.reservation_status`.
 *
 * The seven values here are exactly the ones the database allows — see the
 * `oco_reservations_reservation_status_check` constraint. Keep them in step: the
 * previous version of the portal filtered on `returned` and `no-show`, neither of
 * which a reservation can ever hold, so those branches were dead code that read
 * as if it were doing something.
 */
export type ReservationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'declined'

/** Statuses that mean the rental is over. Everything else is still live. */
const FINISHED = new Set<string>(['completed', 'cancelled', 'declined'])

export const isFinished = (status: string) => FINISHED.has(status.toLowerCase())

type Tone = 'neutral' | 'waiting' | 'good' | 'live' | 'ended'

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-secondary text-secondary-foreground',
  waiting: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  good: 'bg-primary/12 text-primary',
  live: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  ended: 'bg-muted text-muted-foreground',
}

/**
 * What each status means to a customer, in their words rather than the
 * database's. "pending" tells someone nothing; "Waiting on confirmation" tells
 * them who they are waiting for.
 */
const STATUS: Record<string, { label: string; tone: Tone; hint?: string }> = {
  draft: { label: 'Not submitted', tone: 'neutral', hint: 'This request was never sent to us.' },
  pending: {
    label: 'Waiting on confirmation',
    tone: 'waiting',
    hint: 'The local team is checking the trailer is free for your dates.',
  },
  confirmed: { label: 'Confirmed', tone: 'good', hint: 'The trailer is held for you.' },
  active: { label: 'Out with you', tone: 'live', hint: 'This rental is in progress.' },
  completed: { label: 'Returned', tone: 'ended' },
  cancelled: { label: 'Cancelled', tone: 'ended' },
  declined: { label: 'Declined', tone: 'ended' },
}

export function statusInfo(status: string) {
  const key = status.toLowerCase()
  return (
    STATUS[key] ?? {
      label: status.replace(/_/g, ' '),
      tone: 'neutral' as Tone,
      hint: undefined,
    }
  )
}

export const statusClass = (status: string) => TONE_CLASS[statusInfo(status).tone]

/**
 * Payment wording. A cash rental is not "unpaid" in any sense the customer
 * should worry about — it is simply due at the counter — and showing raw
 * `pending_cash` in an account page is not an explanation.
 */
export function paymentLabel(paymentMethod: string, paymentStatus: string) {
  if (paymentMethod === 'cash') return 'Cash due at pickup'
  switch (paymentStatus.toLowerCase()) {
    case 'unpaid':
      return 'Card on file — not yet charged'
    case 'pending_cash':
      return 'Cash due at pickup'
    case 'processing':
      return 'Payment processing'
    case 'paid':
      return 'Paid'
    case 'partially_refunded':
      return 'Partially refunded'
    case 'refunded':
      return 'Refunded'
    case 'failed':
      return 'Payment failed'
    default:
      return paymentStatus.replace(/_/g, ' ')
  }
}

/**
 * A short line about where the rental sits in time, e.g. "Picks up in 3 days"
 * or "Due back tomorrow". Returns null when the dates say nothing useful —
 * a finished rental does not need a countdown.
 */
export function timingNote(status: string, startDate: string, endDate: string, today: string) {
  if (isFinished(status)) return null
  const days = (from: string, to: string) =>
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

  if (today < startDate) {
    const n = days(today, startDate)
    if (n === 1) return 'Picks up tomorrow'
    return `Picks up in ${n} days`
  }
  if (today <= endDate) {
    const n = days(today, endDate)
    if (n === 0) return 'Due back today'
    if (n === 1) return 'Due back tomorrow'
    return `Due back in ${n} days`
  }
  const n = days(endDate, today)
  return n === 1 ? 'Return date was yesterday' : `Return date was ${n} days ago`
}
