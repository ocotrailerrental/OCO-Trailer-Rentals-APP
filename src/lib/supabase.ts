import { createClient } from '@supabase/supabase-js'

/**
 * The single Supabase client for the whole app.
 *
 * Only the publishable (anon) key is ever used here. This module runs in the
 * browser, so it must never see the service-role key — that key bypasses
 * row-level security and would hand every visitor full access to the database.
 * Privileged work belongs in a Supabase Edge Function.
 *
 * Previously `createClient` was called with `undefined` when the settings were
 * absent and threw while the module was still loading, taking the whole app down
 * to a blank white page with nothing on screen to explain why. Now we fall back to
 * a syntactically valid placeholder so the app still renders, and expose
 * `supabaseConfigError` so the interface can say plainly what is missing.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const missing: string[] = []
if (!url) missing.push('VITE_SUPABASE_URL')
if (!publishableKey) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY')

/** Null when configured correctly; otherwise names what is missing. */
export const supabaseConfigError: string | null = missing.length > 0
  ? `Missing ${missing.join(' and ')}.`
  : null

export const isSupabaseConfigured = supabaseConfigError === null

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  publishableKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
