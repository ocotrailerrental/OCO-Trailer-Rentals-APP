import { cn } from '@/lib/utils'

/**
 * The OCO badge mark, drawn from the company logo: an enclosed trailer inside a
 * steel-blue disc.
 *
 * The ring is `currentColor` on purpose. The real logo outlines the badge in deep
 * ink, which vanishes against the dark sidebar and hero. Inheriting the text colour
 * means the outline is dark on light surfaces and light on dark ones, so the mark
 * keeps its shape everywhere instead of only working on one background.
 *
 * The disc and the trailer stay fixed — those two colours are the logo.
 */
export function OcoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="21" fill="#486C7B" stroke="currentColor" strokeWidth="3" />
      {/* Enclosed trailer: rear wall, roof, slanted nose, deck. */}
      <path d="M18 36V24h20l6 5v7z" fill="#FFFFFF" />
      <path d="M38 24v12" stroke="#486C7B" strokeWidth="1.6" />
      <circle cx="24" cy="40" r="3.4" fill="#FFFFFF" />
      <circle cx="24" cy="40" r="1.3" fill="#16272F" />
      <circle cx="39" cy="40" r="3.4" fill="#FFFFFF" />
      <circle cx="39" cy="40" r="1.3" fill="#16272F" />
      {/* Hitch */}
      <path d="M18 36h-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Badge plus wordmark — the standard lockup for headers, footers and auth pages.
 *
 * The wordmark is set in type rather than traced as vector paths: the supplied
 * logo is a rendered mockup, not an editable file, so tracing it would be a guess
 * at letterforms. The weight, tracking and two-line hierarchy follow the logo, and
 * this can be swapped for the real vector wordmark whenever one exists.
 */
export function OcoLockup({
  className,
  markClassName,
  showLlc = true,
}: {
  className?: string
  markClassName?: string
  showLlc?: boolean
}) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <OcoMark className={cn('h-10 w-10', markClassName)} />
      <span className="leading-none">
        <strong className="block text-sm font-bold tracking-[0.18em]">OCO</strong>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.2em] opacity-70">
          Trailer Rentals{showLlc ? ' LLC' : ''}
        </span>
      </span>
    </span>
  )
}
