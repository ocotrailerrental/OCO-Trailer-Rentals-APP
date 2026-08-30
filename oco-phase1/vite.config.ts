import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'node:fs';

/**
 * Guarantee the global stylesheet reaches the build.
 *
 * TanStack Start only emits a stylesheet for CSS imported by a ROUTE module.
 * `__root.tsx` links it via a `?url` import, and this adds the bare side-effect
 * import as well so Tailwind is never orphaned if that link is refactored away.
 * Idempotent, and skips silently if `src/index.css` does not exist.
 */
function ensureRootCssImport() {
  return {
    name: 'ensure-root-css-import',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0];
      if (!file.endsWith('/src/routes/__root.tsx')) return null;
      if (/import\s+['"][^'"]*index\.css['"]/.test(code)) return null;
      const cssPath = path.resolve(path.dirname(file), '../index.css');
      if (!fs.existsSync(cssPath)) return null;
      // Appended, not prepended: ES imports hoist anyway, and this keeps line
      // numbers in __root.tsx stable for stack traces.
      return { code: `${code}\nimport '../index.css';\n`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [
    ensureRootCssImport(),
    // Tailwind v4 via the official Vite plugin. Must NOT be a PostCSS plugin here:
    // Start's prerender build runs postcss-import first and cannot resolve the v4
    // bare `@import "tailwindcss"`.
    tailwindcss(),
    // SSR + static prerendering, so search engines and AI crawlers (which do not
    // execute JavaScript) receive fully-rendered HTML on the first request.
    // The Start plugin MUST come before the React plugin.
    tanstackStart({
      prerender: {
        enabled: true,
        crawlLinks: true,
        // Do not abort the build when a crawled link 404s. `crawlLinks` follows
        // auth-gated and dynamic links too; one dead link must not destroy dist/.
        failOnError: false,
      },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // Radix and TanStack must resolve to a single React instance, or hooks throw
    // "Cannot read properties of null (reading 'useRef')" inside a portal.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle the client-entry dependency closure at dev-server start, so the
    // hydration entry's dynamic import never lands mid-reoptimize and 504s.
    //
    // DELIBERATELY OMITTED: `@tanstack/react-start/client`. It transitively imports
    // `node:async_hooks`, which Vite externalizes to a throwing browser stub;
    // force-optimizing it bakes that stub in and every client-only route dies with
    // "AsyncLocalStorage is not a constructor".
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-router',
      '@tanstack/react-query',
    ],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    // Build into a temp dir; scripts/finalize-static-build.mjs then flattens
    // .vite-out/client/* into dist/, which is what Vercel serves.
    outDir: '.vite-out',
    emptyOutDir: true,
  },
});
