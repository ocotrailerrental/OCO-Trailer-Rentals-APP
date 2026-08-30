# Routing and deployment

## The shape of the deployment

This app is built by TanStack Start with prerendering enabled, and then
`scripts/finalize-static-build.mjs` throws the SSR server bundle away and copies
`.vite-out/client/` into `dist/`. Vercel serves `dist/` as **static files**. There
is no server running in production.

That has one consequence worth understanding before adding routes.

## Why `vercel.json` exists

Static routes get prerendered to real HTML files at build time, so `/book`
becomes `book.html` and Vercel serves it. **Dynamic routes do not.** There is no
file at `/app/reservations/<some-uuid>`, so before `vercel.json` was added Vercel
returned its own 404 page for every one of them.

That was not theoretical. `/app/reservations/$reservationId` shipped in the
original build, and clicking "View details" on any rental in the customer portal
returned a Vercel 404 in production. The page itself was fine; nothing was ever
served to run it.

`vercel.json` adds one rewrite:

```json
{ "source": "/((?!.*\\.).*)", "destination": "/index.html" }
```

Any path with **no file extension** that does not match a real file falls back to
`index.html`, the router reads the URL on the client, and the correct route
renders. Paths that do contain an extension are excluded on purpose: a missing
`/assets/main-a1b2c3.js` should return a clean 404, not an HTML page served with
a JavaScript content type, which produces a far more confusing error.

Vercel checks the filesystem before applying rewrites, so every prerendered page
still serves its own HTML. The rewrite only catches what would otherwise 404.

## What this means when you add a route

- **Static route** (`src/routes/about.tsx`) — prerendered. Nothing to do.
- **Dynamic route** (`src/routes/trailers.$slug.tsx`) — served through the
  fallback. It works, but the first paint is `index.html`, so a visitor landing
  directly on that URL sees the home page shell for a moment before the router
  swaps in the real route. Crawlers that do not run JavaScript see the home page.

## The open item

For SEO, the trailer detail pages should be prerendered as real HTML rather than
relying on the fallback, since those are the pages a search engine should index
for "24 foot car hauler rental Anchorage".

The clean way is to have `vite.config.ts` ask Supabase for the active trailer
slugs at build time and hand them to Start's `prerender.routes`. That keeps the
fleet in the database, where it belongs, rather than hard-coding slugs into build
config. It is deliberately **not** done yet: it makes every deploy depend on a
database round trip during the build, and that is a failure mode worth taking on
consciously rather than as a side effect of adding a page.

The alternative — deploying as a real SSR app on Vercel instead of a static
bundle — solves it properly and is the better long-term answer. It is an
architecture change and needs a decision, not a drive-by commit.
