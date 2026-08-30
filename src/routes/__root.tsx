/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'
import { supabaseConfigError } from '@/lib/supabase'
import indexCss from '../index.css?url'

/**
 * Pre-paint theme script. Runs synchronously in <head> BEFORE first paint, so
 * the document renders in the correct theme on the very first frame — no flash.
 * Dark mode is a single `.dark` class on <html>; the token values in index.css
 * flip under it. Persisted to localStorage, falls back to system preference.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

const queryClient = new QueryClient()

/**
 * Root route — owns the HTML document, the global <head>, and the app-wide
 * providers. No sidebar or top bar here: marketing and booking pages are
 * full-bleed, and the customer dashboard gets its chrome from `routes/app.tsx`.
 *
 * <HeadContent /> renders the merged head() output on the server, so crawlers
 * and AI bots receive a fully-rendered document on the first request.
 *
 * Anything reading browser-only state at render time must sit inside
 * <ClientOnlyBoundary>. Never use a route's `ssr: false` option — see the note
 * in that component for why it ships a blank page here.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'OCO Trailer Rentals · Haul More. Go Further.' },
      { name: 'description', content: 'Car hauler trailer rentals in Omaha, Nebraska and Anchorage, Alaska. Transparent rates, maintained equipment, straightforward pickup.' },
      { name: 'theme-color', content: '#322b23' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'OCO Trailer Rentals' },
      { property: 'og:description', content: 'Car hauler trailer rentals in Omaha, Nebraska and Anchorage, Alaska. Transparent rates, maintained equipment, straightforward pickup.' },
      { property: 'og:site_name', content: 'OCO Trailer Rentals' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: indexCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* MUST be first: sets the theme class before paint so there is no
            flash-of-wrong-theme. Do not move below <HeadContent />. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
        {/*
          WebSite + Organization entity, rendered once at the root on every page.
          Gives search engines and AI answer engines a machine-readable identity for
          the business. Add real profile links to `sameAs` (Google Business, Facebook)
          and swap `url` for the live domain once one is pointed at this app.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { '@type': 'WebSite', name: 'OCO Trailer Rentals', url: '/' },
                {
                  '@type': 'AutoRental',
                  name: 'OCO Trailer Rentals LLC',
                  url: '/',
                  slogan: 'Haul More. Go Further.',
                  areaServed: [
                    { '@type': 'City', name: 'Omaha', address: { '@type': 'PostalAddress', addressRegion: 'NE', addressCountry: 'US' } },
                    { '@type': 'City', name: 'Anchorage', address: { '@type': 'PostalAddress', addressRegion: 'AK', addressCountry: 'US' } },
                  ],
                  sameAs: [],
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={0}>
            <Toaster />
            {/*
              Full-bleed by default — no app chrome here. The customer dashboard's
              sidebar shell lives at `src/routes/app.tsx` (the real `/app` segment);
              pages under `src/routes/app/` render inside it. Marketing and booking
              routes stay full-bleed.

              If the Supabase settings are absent, every page would otherwise render
              and then fail on its first query with an unexplained error. Say so once,
              here, instead.
            */}
            {supabaseConfigError ? <ConfigurationNotice detail={supabaseConfigError} /> : children}
          </TooltipProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

/**
 * Shown in place of the app when the Supabase settings are missing. Deliberately
 * plain HTML with inline styles: if configuration is broken, the stylesheet may be
 * the next thing to go, and this message has to survive that to be worth anything.
 */
function ConfigurationNotice({ detail }: { detail: string }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f6f2ea',
        color: '#241f19',
      }}
    >
      <div style={{ maxWidth: '32rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.72rem',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: '#b8622a',
            fontWeight: 700,
          }}
        >
          OCO Trailer Rentals
        </p>
        <h1 style={{ fontSize: '1.6rem', margin: '0.75rem 0 0', lineHeight: 1.25 }}>
          This deployment is not connected to its database yet
        </h1>
        <p style={{ lineHeight: 1.6, color: '#574f45' }}>
          The app built and deployed correctly, but it has not been told where the
          OCO database lives, so it cannot load locations, trailers, or reservations.
          Nothing is broken in the code and no data is affected.
        </p>
        <p
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.85rem',
            background: '#efe9de',
            padding: '0.7rem 0.85rem',
            borderRadius: '4px',
            borderLeft: '2px solid #b8622a',
          }}
        >
          {detail}
        </p>
        <p style={{ lineHeight: 1.6, color: '#574f45' }}>
          Add both values in Vercel under <strong>Project Settings → Environment
          Variables</strong>, then redeploy. They are listed in <code>.env.example</code>
          {' '}in the repository.
        </p>
      </div>
    </main>
  )
}
