import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, CreditCard, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

/**
 * Putting a card on file.
 *
 * The card is typed into an iframe served by Stripe and goes straight to them —
 * the number never reaches OCO's servers, never reaches this JavaScript, and is
 * never in a request this app can read. What comes back is a token.
 *
 * Nothing is charged here. The rental is charged and the deposit authorised when
 * a member of staff records the collection, which is the arrangement the rental
 * agreement describes.
 *
 * Stripe.js is loaded from Stripe's own CDN rather than bundled, because Stripe
 * require the live script for PCI scope — a self-hosted copy is not supported.
 */

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`

declare global {
  interface Window {
    Stripe?: (key: string) => any
  }
}

let stripeScript: Promise<void> | null = null
function loadStripeJs(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser'))
  if (window.Stripe) return Promise.resolve()
  if (stripeScript) return stripeScript
  stripeScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Stripe could not be reached.'))
    document.head.appendChild(script)
  })
  return stripeScript
}

type SavedCard = { card_brand: string | null; card_last4: string | null } | null

export function CardOnFile({ onSaved }: { onSaved?: (saved: boolean) => void }) {
  const mountPoint = useRef<HTMLDivElement>(null)
  const elementsRef = useRef<any>(null)
  const stripeRef = useRef<any>(null)

  const [status, setStatus] = useState<'idle' | 'mounting' | 'ready' | 'saving' | 'done'>('idle')
  const [error, setError] = useState('')

  // What is already on file, if anything.
  const saved = useQuery({
    queryKey: ['card-on-file'],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return null
      const { data } = await supabase
        .from('oco_customer_billing')
        .select('card_brand,card_last4')
        .eq('profile_id', authData.user.id)
        .maybeSingle()
      return (data as unknown as SavedCard) ?? null
    },
  })

  const hasCard = Boolean(saved.data?.card_last4)

  useEffect(() => {
    onSaved?.(hasCard)
  }, [hasCard, onSaved])

  async function startCardEntry() {
    setError('')
    setStatus('mounting')
    try {
      if (!PUBLISHABLE_KEY) throw new Error('Card payments are not switched on yet.')
      await loadStripeJs()

      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Please sign in again.')

      const response = await fetch(`${FUNCTIONS_BASE}/payments/setup-intent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body?.error ?? 'Could not start card entry.')

      const stripe = window.Stripe!(PUBLISHABLE_KEY)
      const elements = stripe.elements({
        clientSecret: body.client_secret,
        appearance: { theme: 'flat', variables: { borderRadius: '8px' } },
      })
      elements.create('payment', { layout: 'tabs' }).mount(mountPoint.current!)
      stripeRef.current = stripe
      elementsRef.current = elements
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Card entry could not be started.')
      setStatus('idle')
    }
  }

  async function saveCard() {
    setError('')
    setStatus('saving')
    try {
      const { error: confirmError } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        redirect: 'if_required',
      })
      if (confirmError) throw new Error(confirmError.message ?? 'That card was not accepted.')
      setStatus('done')
      // Stripe's webhook writes the card details; give it a moment, then re-read.
      setTimeout(() => void saved.refetch(), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That card was not saved.')
      setStatus('ready')
    }
  }

  if (!PUBLISHABLE_KEY) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Online card payment is not switched on yet. Choose cash, or book anyway and pay at the
            counter when you collect.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-xl">
            <CreditCard className="h-5 w-5 text-primary" /> Card on file
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing is charged now. Your rental is charged when you collect the trailer, and a
            separate hold is placed for the deposit and released when it comes back undamaged.
          </p>
        </div>

        {hasCard || status === 'done' ? (
          <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <Check className="h-4 w-4 text-primary" />
            {hasCard
              ? `${saved.data?.card_brand ?? 'Card'} ending ${saved.data?.card_last4} is on file.`
              : 'Card saved.'}
          </p>
        ) : (
          <>
            {status === 'idle' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void startCardEntry()}
                className="bg-transparent"
              >
                Add a card
              </Button>
            )}
            {status === 'mounting' && (
              <p className="text-sm text-muted-foreground">Opening the secure card form&hellip;</p>
            )}
            <div ref={mountPoint} className={status === 'idle' ? 'hidden' : 'pt-1'} />
            {(status === 'ready' || status === 'saving') && (
              <Button
                type="button"
                disabled={status === 'saving'}
                onClick={() => void saveCard()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {status === 'saving' ? 'Saving…' : 'Save card'}
              </Button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Card details go straight to our payment provider. Your card number never reaches OCO.
        </p>
      </CardContent>
    </Card>
  )
}
