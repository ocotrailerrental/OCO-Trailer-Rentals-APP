import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { OcoLockup } from '@/components/OcoLogo'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy policy · OCO Trailer Rentals' },
      {
        name: 'description',
        content:
          'How OCO Trailer Rental collects, uses, shares and protects personal information.',
      },
    ],
  }),
  component: PrivacyPage,
})

type Block =
  | { kind: 'text'; text: string }
  | { kind: 'label'; text: string }
  | { kind: 'bullets'; items: { term?: string; text: string }[] }

type Section = { heading: string; blocks: Block[] }

/**
 * The privacy notice, held as data for the same reason the terms are: a revision
 * is an edit to one array, and the heading and spacing cannot drift section to
 * section.
 */
const SECTIONS: Section[] = [
  {
    heading: 'About Our Business and Services',
    blocks: [
      {
        kind: 'text',
        text:
          'OCO Trailer Rental provides trailer rental services, including rental management, operational tools, and customer support (collectively, “Services”). When you interact with our website (ocotrailerrentals.com) or conduct business with us, we act as the data controller of the Personal Information collected and process it according to this Privacy Policy.',
      },
    ],
  },
  {
    heading: 'Information We Collect and How We Collect It',
    blocks: [
      {
        kind: 'text',
        text:
          'The type of information we collect depends on your interactions with us. We gather information when you visit our website (ocotrailerrentals.com) or engage in business transactions with us.',
      },
      { kind: 'label', text: '1.1 Information Collected Through Our Website' },
      {
        kind: 'text',
        text:
          'We may collect the following types of Personal Information when you interact with our website:',
      },
      {
        kind: 'bullets',
        items: [
          {
            term: 'Identifiers',
            text:
              'Name, contact information (e.g., phone number, email address, physical address), and login credentials.',
          },
          {
            term: 'Device and Internet Activity',
            text: 'IP address, browser type, operating system, and traffic logs.',
          },
          {
            term: 'Commercial Information',
            text: 'Details related to transactions, such as payment information, provided voluntarily.',
          },
        ],
      },
      {
        kind: 'text',
        text:
          'This information may be collected directly from you when you provide it voluntarily while using our website.',
      },
      { kind: 'label', text: '1.2 Information Collected During Business Transactions' },
      {
        kind: 'text',
        text:
          'When conducting business directly with OCO Trailer Rental, we may collect additional Personal Information such as:',
      },
      {
        kind: 'bullets',
        items: [
          { term: 'Identifiers', text: 'Name, company name, and business contact details.' },
          {
            term: 'Payment Information',
            text: 'Credit or debit card details provided voluntarily for payment processing.',
          },
        ],
      },
      {
        kind: 'text',
        text:
          'Providing Personal Information is optional but may be necessary for certain services or transactions.',
      },
    ],
  },
  {
    heading: 'Purposes for Using Your Information',
    blocks: [
      { kind: 'text', text: 'We collect and use Personal Information for the following purposes:' },
      {
        kind: 'bullets',
        items: [
          { text: 'Providing, maintaining, and enhancing our Services and website.' },
          { text: 'Processing trailer rental transactions and fulfilling service requests.' },
          { text: 'Offering customer support and responding to inquiries.' },
          { text: 'Conducting internal business analysis.' },
          { text: 'Complying with legal obligations and protecting our rights.' },
        ],
      },
      {
        kind: 'text',
        text:
          'We will only use your Personal Information to assist with your trailer rental needs. We do not sell your Personal Information to anyone.',
      },
    ],
  },
  {
    heading: 'Sharing Your Information',
    blocks: [
      { kind: 'text', text: 'We may share your Personal Information with:' },
      {
        kind: 'bullets',
        items: [
          { term: 'Service Providers', text: 'Partners who assist in delivering our Services.' },
          {
            term: 'Legal and Regulatory Entities',
            text: 'When required to comply with legal obligations or to protect our rights.',
          },
        ],
      },
      {
        kind: 'text',
        text:
          'We do not sell Personal Information. Non-identifiable, aggregated data may be shared for any lawful purpose.',
      },
    ],
  },
  {
    heading: 'Storage and Retention of Personal Information',
    blocks: [
      {
        kind: 'text',
        text:
          'Your Personal Information is stored and processed within the United States. We retain information only as long as necessary for business or legal purposes and securely delete or anonymize it when no longer needed.',
      },
    ],
  },
  {
    heading: 'Your Rights Regarding Personal Information',
    blocks: [
      {
        kind: 'text',
        text:
          'Depending on your location, you may have the following rights under applicable data privacy laws:',
      },
      {
        kind: 'bullets',
        items: [
          { text: 'Accessing details about the Personal Information we hold.' },
          { text: 'Requesting corrections or updates.' },
          { text: 'Deleting your Personal Information.' },
          { text: 'Opting out of data sharing or marketing communications.' },
        ],
      },
      {
        kind: 'text',
        text: 'To exercise your rights, contact us at Robert@OCOTrailerRentals.com.',
      },
    ],
  },
  {
    heading: 'Security Measures',
    blocks: [
      {
        kind: 'text',
        text:
          'We use industry-standard security measures to protect your information. However, no system is completely secure, so please exercise caution when sharing information online.',
      },
    ],
  },
  {
    heading: 'Cookies and Tracking Technologies',
    blocks: [
      {
        kind: 'text',
        text:
          'Our website uses cookies and similar browser storage to keep you signed in to your account and to remember display preferences. We do not use advertising or cross-site tracking cookies. You can manage your cookie preferences through your browser settings, though signing in will not work with cookies disabled.',
      },
    ],
  },
  {
    heading: "Children's Privacy",
    blocks: [
      {
        kind: 'text',
        text:
          'Our services are not intended for individuals under the age of 16. If we learn we have collected Personal Information from a minor, we will delete it promptly. Renting a trailer from OCO has its own, higher age requirement, which is set out in the rental agreement.',
      },
    ],
  },
  {
    heading: 'Third-Party Links',
    blocks: [
      {
        kind: 'text',
        text:
          'Our website may contain links to third-party websites. We are not responsible for their privacy practices and encourage you to review their policies.',
      },
    ],
  },
  {
    heading: 'Policy Updates',
    blocks: [
      {
        kind: 'text',
        text:
          'We may update this Privacy Policy from time to time. Changes will be indicated by the “Last Updated” date at the top of this document.',
      },
    ],
  },
  {
    heading: 'TCPA Compliance',
    blocks: [
      {
        kind: 'text',
        text:
          'By providing your phone number to OCO Trailer Rental, you consent to receive calls and text messages from us, including messages sent by automated systems, related to your trailer rental inquiries and transactions. Message and data rates may apply. You can opt out of receiving messages at any time by contacting us at Robert@OCOTrailerRentals.com.',
      },
    ],
  },
]

function PrivacyPage() {
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

        <h1 className="mt-6 font-serif text-4xl sm:text-5xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last Updated: 9-1-2026</p>

        <p className="mt-8 leading-7">
          OCO Trailer Rental, headquartered at 13633 41st Division Drive, Joint Base Lewis-McChord,
          WA 98433 (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
          is committed to safeguarding the privacy of the Personal Information and data we handle in
          our business operations and the provision of our services. This Privacy Policy &amp; Notice
          (&ldquo;Privacy Policy&rdquo;) outlines how we collect, use, and share Personal Information
          and provides an overview of our data processing practices.
        </p>

        <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-5 text-sm font-semibold leading-6">
          PLEASE REVIEW THIS PRIVACY POLICY CAREFULLY BEFORE USING OUR WEBSITE OR ENGAGING OUR
          SERVICES.
        </p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map(section => (
            <section key={section.heading}>
              <h2 className="font-serif text-2xl">{section.heading}</h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, index) => {
                  if (block.kind === 'label') {
                    return (
                      <h3 key={index} className="pt-2 text-sm font-semibold">
                        {block.text}
                      </h3>
                    )
                  }
                  if (block.kind === 'bullets') {
                    return (
                      <ul key={index} className="space-y-2 pl-5">
                        {block.items.map(item => (
                          <li key={item.text} className="list-disc leading-7 text-muted-foreground">
                            {item.term && (
                              <span className="font-medium text-foreground">{item.term}: </span>
                            )}
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    )
                  }
                  return (
                    <p key={index} className="leading-7 text-muted-foreground">
                      {block.text}
                    </p>
                  )
                })}
              </div>
            </section>
          ))}

          <section>
            <h2 className="font-serif text-2xl">Contact Us</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              For questions or concerns about this Privacy Policy or our data practices, please
              contact us at:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="text-muted-foreground">OCO Trailer Rentals</li>
              <li className="text-muted-foreground">Attention: Privacy Officer</li>
              <li>
                <a
                  href="mailto:Robert@OCOTrailerRentals.com"
                  className="font-semibold text-primary hover:underline"
                >
                  Robert@OCOTrailerRentals.com
                </a>
              </li>
              <li>
                <a href="tel:+12532640083" className="font-semibold text-primary hover:underline">
                  253-264-0083
                </a>
              </li>
            </ul>
          </section>
        </div>

        <p className="mt-12 text-sm leading-6 text-muted-foreground">
          This policy covers personal information. The terms covering information you submit through
          this website are on the{' '}
          <a href="/terms" className="font-semibold text-primary hover:underline">
            terms and conditions
          </a>{' '}
          page, and a rental itself is governed by the separate rental agreement you accept at
          checkout.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
