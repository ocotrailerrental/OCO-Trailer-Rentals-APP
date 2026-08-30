import { ClientOnly } from '@tanstack/react-router'
import type { ReactNode } from 'react'

/**
 * SSR-safe boundary.
 *
 * Every route here is server-rendered or prerendered by TanStack Start. Anything
 * that touches the browser AT RENDER TIME — the Supabase auth session,
 * `localStorage`, `window`, or a hook that reads any of them — either throws on the
 * server or mismatches during hydration, and the visitor gets a blank first page.
 * Wrap that subtree in this component: the server renders `fallback`, and the real
 * interface mounts in the browser.
 *
 *   <ClientOnlyBoundary fallback={<AuthLoading />}>
 *     <CustomerDashboard />
 *   </ClientOnlyBoundary>
 *
 * Keep marketing and other static content OUTSIDE the boundary so it stays
 * server-rendered and crawlable. If a whole page needs the browser, wrap its
 * entire tree.
 *
 * Do NOT reach for the route's `ssr: false` option instead. A client-only route in
 * this setup hits Start's server-context `node:async_hooks` path, which Vite
 * externalizes to a throwing browser stub, and the page ships blank with
 * "AsyncLocalStorage is not a constructor". This boundary — TanStack's `ClientOnly`
 * — is the supported escape hatch, and it keeps the surrounding shell
 * server-rendered.
 */
export function ClientOnlyBoundary({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return <ClientOnly fallback={fallback}>{children}</ClientOnly>
}
