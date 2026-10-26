import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { OcoLockup } from '@/components/OcoLogo'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/support')({
  head: () => ({
    meta: [
      { title: 'Support · OCO Trailer Rentals' },
      {
        name: 'description',
        content:
          'Get help with an OCO Trailer Rentals booking — contact details, cancellations, extensions, breakdowns and your account.',
      },
    ],
  }),
  component: SupportPage,
})

/**
 * The public support page. App Store listings require a support URL that reaches
 * a real page with a way to contact the business, and this is it.
 *
 * Every answer here describes what the app actually does today. If a feature
 * changes — self-service extensions, in-app account deletion — this page changes
 * with it, rather than promising something a customer cannot find.
 */
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'How do I cancel a booking?',
    a: 'Sign in, open My Rentals, and use the Cancel button on the rental. Cancelling is free up to 24 hours before your pickup time. Inside 24 hours a rental can only be cancelled with our written approval, and a rental that is neither collected nor cancelled in time is charged a $50 no-show fee. If you booked in person, contact the rental location directly.',
  },
  {
    q: 'When is my booking confirmed?',
    a: 'A booking you submit is a request. Your local yard reviews it and you receive an email when it is approved or declined. The trailer is held for you once it is approved.',
  },
  {
    q: 'When is the trailer due back?',
    a: 'At your pickup time, on the day after your last billed day. Billed days count both the collection day and the return day. After a 60-minute grace period, late returns are charged $40 per hour.',
  },
  {
    q: 'Can I extend my rental?',
    a: 'Contact us before your due-back time. Extensions must be approved in writing before the trailer is due; there is no self-service extension in the app yet.',
  },
  {
    q: 'The trailer has broken down or been in an accident.',
    a: 'If anyone is in danger, get to a safe place and call 911 first. Then call us. Do not authorize repairs or towing beyond what is needed for immediate safety without our approval.',
  },
  {
    q: 'How do payments and the deposit work?',
    a: 'Card payments go to our payment provider, Stripe — OCO never sees your card number. Your card is charged when you collect the trailer, not when you book. A $100 security deposit is held separately and released when the trailer comes back undamaged.',
  },
  {
    q: 'How do I delete my account?',
    a: 'In the app or on the website, sign in and open Account, then choose Delete account. This removes your login and personal details straight away. Records of rentals you have already taken are kept, as the law requires. You can also email us to ask for deletion.',
  },
]

function SupportPage() {
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

      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-16">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the home page
        </a>

        <h1 className="mt-6 font-serif text-4xl sm:text-5xl">Support</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          We rent car haulers from yards in Anchorage, Alaska and Omaha, Nebraska. If something
          about a booking is not right, get in touch — a person reads every message.
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href="mailto:Robert@OCOTrailerRentals.com"
            className="flex items-start gap-3 rounded-xl border border-border p-5 transition-colors hover:border-primary"
          >
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">Email</span>
              <span className="text-sm text-muted-foreground">Robert@OCOTrailerRentals.com</span>
            </span>
          </a>
          <a
            href="tel:+12532640083"
            className="flex items-start gap-3 rounded-xl border border-border p-5 transition-colors hover:border-primary"
          >
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold">Phone</span>
              <span className="text-sm text-muted-foreground">253-264-0083</span>
              <span className="mt-1 block text-xs text-muted-foreground">For anything urgent during a rental.</span>
            </span>
          </a>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-2xl">Common questions</h2>
          <div className="mt-6 divide-y divide-border rounded-xl border border-border">
            {QUESTIONS.map(item => (
              <details key={item.q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {item.q}
                    <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-3 leading-7 text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-10 text-sm leading-6 text-muted-foreground">
          See also our <a href="/privacy" className="font-semibold text-primary hover:underline">privacy policy</a> and{' '}
          <a href="/terms" className="font-semibold text-primary hover:underline">terms and conditions</a>. A rental itself
          is governed by the rental agreement you sign at checkout.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
