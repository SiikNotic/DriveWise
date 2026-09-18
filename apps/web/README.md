# @drivewise/web

The DriveWise web dashboard. Next.js (App Router) + TypeScript + Tailwind
CSS + shadcn/ui, bilingual (English/Español) via `next-intl`, backed by
Supabase.

See the [repo root README](../../README.md) for the overall architecture,
the Supabase schema, and the sync design shared with the (not yet
scaffolded) mobile tracking app.

## Development

Run from the repo root, not this directory, so the pnpm workspace resolves
`@drivewise/shared` correctly:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to
`/en` (or `/es`, based on the `NEXT_LOCALE` cookie / `Accept-Language`).

Copy `.env.example` to `.env.local` and fill in your own Supabase project's
URL and publishable key to enable the Supabase client. The app runs without
it; it just skips the session refresh (see
`src/lib/supabase/proxy.ts`).

## Structure

- `src/app/[locale]/` — routes, one subtree per locale prefix.
- `src/components/ui/` — shadcn/ui primitives (hand-added: `ui.shadcn.com`
  isn't reachable from this sandbox's network policy, so components are
  written to match its conventions rather than fetched via the CLI. Once
  the CLI is reachable, `npx shadcn@latest add <component>` works normally
  against `components.json`).
- `src/components/layout/`, `src/components/settings/` — app-specific
  composed components.
- `src/i18n/` — `next-intl` routing/navigation/request config.
- `src/lib/supabase/` — browser/server/proxy Supabase client helpers.
- `src/proxy.ts` — Next.js 16's renamed `middleware.ts`; composes locale
  routing with the Supabase session refresh.
- `messages/{en,es}.json` — all UI strings. No hardcoded interface text
  belongs in components.
