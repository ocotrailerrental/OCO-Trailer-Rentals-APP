import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'oco-rentals-platform-mmexc4ll',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_w1k-tJ_RGhPAAGM16GCgclKQaAZCvluy',
  authRequired: false,
  auth: { mode: 'managed' },
})
