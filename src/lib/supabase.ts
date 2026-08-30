import { createClient } from '@supabase/supabase-js'

/**
 * The single Supabase client for the whole app.
 *
 * Only the publishable (anon) key is ever used here. This module also runs during
 * the prerender build and on the server, so it must never see the service-role
 * key — that key bypasses row-level security and would hand every visitor full
 * access to the database. Privileged work belongs in a Supabase Edge Function.
 *
 * This module must NEVER throw. It is imported by the router, which means an
 * exception here does not just break a page — it takes down the prerender step
 * and fails the entire deployment. A misconfigured environment variable is a
 * setup mistake; it should surface as a readable notice, not a broken build.
 */

/** Environment values arrive verbatim, so strip whitespace and any wrapping quotes. */
function cleanValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * Accepts what people actually paste. A Supabase project URL copied from the
 * dashboard sometimes arrives without its scheme (`abc123.supabase.co`), which is
 * a perfectly clear intention that `createClient` nonetheless rejects outright.
 * Returns the normalised origin, or null when the value cannot be a URL at all.
 */
function normaliseUrl(value: string): string | null {
  if (!value) return null
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (!parsed.hostname.includes('.')) return null
    return parsed.origin
  } catch {
    return null
  }
}

const rawUrl = cleanValue(import.meta.env.VITE_SUPABASE_URL)
const rawKey = cleanValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

const resolvedUrl = normaliseUrl(rawUrl)

const problems: string[] = []
if (!rawUrl) {
  problems.push('VITE_SUPABASE_URL is not set')
} else if (!resolvedUrl) {
  problems.push(`VITE_SUPABASE_URL is not a usable web address (got "${rawUrl}")`)
}
if (!rawKey) problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is not set')

/** Null when the settings are usable; otherwise a plain description of what is wrong. */
export const supabaseConfigError: string | null = problems.length > 0
  ? `${problems.join('. ')}.`
  : null

export const isSupabaseConfigured = supabaseConfigError === null

export const supabase = createClient(
  resolvedUrl ?? 'https://placeholder.supabase.co',
  rawKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
