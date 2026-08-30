/**
 * Flatten the TanStack Start build into a static `dist/` for deployment.
 *
 * `vite build` (with `build.outDir: '.vite-out'`) emits:
 *   .vite-out/client/   <- prerendered HTML + assets (what we want, static)
 *   .vite-out/server/   <- SSR server bundle (unused by static hosting)
 *
 * Vercel serves `dist/`, so this copies `.vite-out/client/*` up into a flat
 * `dist/` and drops the server build.
 *
 * Why build into `.vite-out` rather than `dist/` directly: some hosts pre-inject
 * a read-only `dist/_redirects`, and Start's client build empties its out dir
 * first, which fails with EACCES. Building into a clean temp dir sidesteps that;
 * here we only COPY into `dist/` and never delete, so a pre-existing read-only
 * `_redirects` is tolerated.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const SRC = '.vite-out/client'
const DEST = 'dist'

if (!existsSync(SRC)) {
  console.error(`[finalize] build output missing: ${SRC} — did "vite build" run?`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

for (const entry of readdirSync(SRC)) {
  try {
    cpSync(join(SRC, entry), join(DEST, entry), { recursive: true, force: true })
  } catch (e) {
    // ONLY a host-pre-injected `_redirects` may be skipped: it's read-only,
    // already in dist/, and byte-identical to ours. ANY other failed entry (assets/,
    // index.html, route html) would leave dist/index.html pointing at missing or
    // stale hashed assets — a silently broken deployment. Fail the build instead.
    if (entry === '_redirects') {
      console.warn(`[finalize] skip ${entry}: ${e.code || e.message} (pre-injected, identical content)`)
    } else {
      console.error(`[finalize] FAILED copying ${entry} into dist/: ${e.code || e.message} — aborting (a partial dist/ deploys broken)`)
      process.exit(1)
    }
  }
}

rmSync('.vite-out', { recursive: true, force: true })

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
