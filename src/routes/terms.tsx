import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { OcoLockup } from '@/components/OcoLogo'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms and conditions · OCO Trailer Rentals' },
      {
        name: 'description',
        content:
          'The terms and conditions covering information submitted through the OCO Trailer Rental website.',
      },
    ],
  }),
  component: TermsPage,
})

/**
 * The terms covering information a visitor submits through the website.
 *
 * The text is held here as data rather than as hand-written markup so the
 * headings, numbering and spacing cannot drift clause to clause, and so a
 * revision is an edit to one array rather than a hunt through JSX.
 *
 * This is a lead-capture and website-use notice. It is not the rental agreement
 * — that is a separate, versioned document a renter accepts at checkout.
 */
const SECTIONS: { heading: string; clauses: string[] }[] = [
  {
    heading: '1. Information Collection and Purpose',
    clauses: [
      '1.1. Purpose of Collection: The information you provide will be used to contact you regarding your interest in our trailer rental services, send promotional offers, and provide relevant updates about our services.',
      '1.2. Opt-In Consent: By submitting your information, you consent to receiving communications from us via email, phone, or text message. You can opt-out of these communications at any time by following the instructions provided in the message or contacting us directly.',
      '1.3. Accuracy of Information: You are responsible for providing accurate and up-to-date information. Incorrect or incomplete information may prevent us from responding to your inquiries effectively.',
    ],
  },
  {
    heading: '2. No Obligation',
    clauses: [
      '2.1. Non-Binding Inquiry: Submitting your information through our website does not obligate you to rent a trailer or use our services, nor does it constitute a binding agreement with us.',
      '2.2. Follow-Up: Our team may follow up with you to discuss your needs and provide further details about our services. This communication is purely informational and exploratory.',
    ],
  },
  {
    heading: '3. Privacy and Data Protection',
    clauses: [
      '3.1. Privacy Policy: Your information will be handled in accordance with our Privacy Policy, which explains how your data is collected, stored, and used.',
      '3.2. Third-Party Sharing: We do not sell your information to third parties. However, we may share your information with trusted partners solely for the purpose of fulfilling your inquiry or providing related services.',
    ],
  },
  {
    heading: '4. User Responsibilities',
    clauses: [
      '4.1. Lawful Use: Users must provide information only for lawful purposes and refrain from submitting false, misleading, or fraudulent details.',
      '4.2. Age Requirement: By submitting your information, you confirm that you are at least 18 years old.',
    ],
  },
  {
    heading: '5. Limitations of Liability',
    clauses: [
      '5.1. No Guarantee of Availability: Submission of your information does not guarantee the availability of specific trailers or services at the time of inquiry.',
      '5.2. Website Content: While we strive for accuracy, we are not responsible for errors or omissions on our website and reserve the right to update content as needed.',
    ],
  },
  {
    heading: '6. Changes to These Terms',
    clauses: [
      'We may update these terms from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Any updates will be posted on this page, and the "Effective Date" will be revised accordingly.',
    ],
  },
]

function TermsPage() {
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

        <h1 className="mt-6 font-serif text-4xl sm:text-5xl">Terms and conditions</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last Updated: 1-19-2025</p>

        <p className="mt-8 leading-7">
          Welcome to OCO Trailer Rental (&ldquo;Company,&rdquo; &ldquo;we,&rdquo;
          &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By using our website and providing your
          information, you (the &ldquo;User&rdquo;) agree to the following terms and conditions.
          These terms are designed to inform you of how your information will be used for lead
          generation purposes. Please read them carefully before submitting your details.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map(section => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.clauses.map(clause => (
                  <p key={clause} className="leading-7 text-muted-foreground">
                    {clause}
                  </p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="font-serif text-2xl">7. Contact Information</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              If you have any questions or concerns regarding these terms or how your information is
              used, please contact us at:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:ocotrailerrental@gmail.com"
                  className="font-semibold text-primary hover:underline"
                >
                  ocotrailerrental@gmail.com
                </a>
              </li>
              <li>
                <a href="tel:+12532640083" className="font-semibold text-primary hover:underline">
                  253-264-0083
                </a>
              </li>
              <li className="text-muted-foreground">
                13633 41st Division Drive, Joint Base Lewis-McChord, WA 98433
              </li>
              <li>
                <a
                  href="https://ocotrailerrentals.com"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  ocotrailerrentals.com
                </a>
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-12 rounded-xl border border-border bg-secondary/40 p-5 leading-7">
          By providing your information on our website, you acknowledge that you have read and agree
          to these terms and conditions.
        </p>

        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          These terms cover the information you submit through this website. A rental itself is
          governed by the separate rental agreement you accept at checkout.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
