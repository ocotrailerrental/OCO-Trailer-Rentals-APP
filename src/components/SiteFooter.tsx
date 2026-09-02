import { Mail, MapPin, Phone } from 'lucide-react'
import { OcoLockup } from '@/components/OcoLogo'

/**
 * The public footer, shared by every page a customer can reach without signing in.
 *
 * One component rather than a copy per page: the contact details and the terms
 * link are the sort of thing that has to be correct everywhere at once, and a
 * footer duplicated across four files is a footer that goes stale in three of them.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <OcoLockup className="h-9" />
            <p className="mt-4 text-sm text-sidebar-foreground/55">Haul More. Go Further.</p>
            <p className="mt-6 text-sm text-sidebar-foreground/55">
              Professional car haulers in Anchorage and Omaha.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                Contact
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-sidebar-foreground/70">
                <li>
                  <a
                    href="mailto:Robert@OCOTrailerRentals.com"
                    className="flex items-start gap-2.5 hover:text-sidebar-foreground"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Robert@OCOTrailerRentals.com
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+12532640083"
                    className="flex items-start gap-2.5 hover:text-sidebar-foreground"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    253-264-0083
                  </a>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    13633 41st Division Drive
                    <br />
                    Joint Base Lewis-McChord, WA 98433
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                Company
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-sidebar-foreground/70">
                <li>
                  <a href="/terms" className="hover:text-sidebar-foreground">
                    Terms and conditions
                  </a>
                </li>
                <li>
                  <a href="/privacy" className="hover:text-sidebar-foreground">
                    Privacy policy
                  </a>
                </li>
                <li>
                  <a href="/#fleet" className="hover:text-sidebar-foreground">
                    The fleet
                  </a>
                </li>
                <li>
                  <a href="/#how-it-works" className="hover:text-sidebar-foreground">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="/#locations" className="hover:text-sidebar-foreground">
                    Locations
                  </a>
                </li>
                <li>
                  <a
                    href="https://ocotrailerrentals.com"
                    className="hover:text-sidebar-foreground"
                    rel="noreferrer"
                  >
                    ocotrailerrentals.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-sidebar-foreground/10 pt-6 text-xs text-sidebar-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} OCO Trailer Rental. All rights reserved.</p>
          <p>
            By providing your information on this website you agree to our{' '}
            <a href="/terms" className="underline hover:text-sidebar-foreground">
              terms and conditions
            </a>{' '}
            and{' '}
            <a href="/privacy" className="underline hover:text-sidebar-foreground">
              privacy policy
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  )
}
