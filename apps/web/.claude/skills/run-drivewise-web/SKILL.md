---
name: run-drivewise-web
description: Build, run, and drive the DriveWise web dashboard (apps/web, Next.js/Turbopack). Use when asked to start the web app, run it locally, take a screenshot of its UI, or interact with its pages (login, sign-up, dashboard).
---

DriveWise's web dashboard is a Next.js 16 (Turbopack) app served on
`http://localhost:3000`. It's driven by piping commands to
`.claude/skills/run-drivewise-web/driver.mjs`, a small Playwright REPL
(this container has no `chromium-cli`, so the driver was hand-rolled —
same command vocabulary, see the table below).

All paths below are relative to `apps/web/` (this skill's unit root).

## Prerequisites

No OS packages needed — Chromium is already pre-installed in this
container at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, and
the driver points `executablePath` at it directly so `playwright` never
tries to download its own browser build (which would fail — no network
access to Playwright's CDN from here).

Node/pnpm: whatever the repo already pins (`pnpm@10.33.0`, see root
`package.json`). No separate runtime install needed for this unit.

## Setup

From the repo root:

```bash
pnpm install
```

`playwright` is a devDependency of `apps/web` (added via `pnpm add -D
playwright` in this package) purely so the driver can `import { chromium
} from "playwright"` — nothing in the app itself depends on it.

Env vars — `apps/web/.env.local` (already present in this checkout with
real values; not committed):

```bash
NEXT_PUBLIC_SUPABASE_URL=...            # required for any Supabase-backed page to not error
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...            # required for map-rendering pages
```

## Build

No separate build step for local driving — `pnpm dev` runs Turbopack in
dev mode directly. (`pnpm build` exists for a production bundle but
isn't needed to drive the app locally.)

## Run (agent path)

Start the dev server in the background and poll the port instead of a
fixed sleep:

```bash
pnpm dev > /tmp/drivewise-web.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null 2>&1; do sleep 1; done' && echo UP
```

Drive it by piping commands to the driver's stdin:

```bash
SHOTS_DIR=/tmp/drivewise-shots node .claude/skills/run-drivewise-web/driver.mjs <<'EOF'
nav http://localhost:3000
wait-for text=DriveWise
screenshot home
console
quit
EOF
```

Stop the server with `fuser`, **not** `lsof -ti:PORT | xargs kill`:

```bash
fuser -k 3000/tcp
```

(`lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` — the pattern you'd
normally reach for — returned no PIDs in this container even with the
server still listening, confirmed via `ps aux`. `fuser -k 3000/tcp`
reliably kills it here.)

Screenshots land in `/tmp/drivewise-shots/` (override with `SHOTS_DIR`).
Server log: `/tmp/drivewise-web.log`.

Driver commands:

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<substr>` | wait until page text contains `<substr>` |
| `wait-for <css-selector>` | wait until selector is visible |
| `click <css-selector>` | click an element |
| `fill <css-selector> <text>` | type into an input (goes through Playwright's input pipeline, so React's `onChange` fires) |
| `press <key>` | press a key (e.g. `Enter`) on the focused element |
| `screenshot [name]` | save a PNG to `SHOTS_DIR` |
| `console` | print collected page console errors/warnings so far |
| `eval <js>` | `page.evaluate(<js>)`, prints the JSON result |
| `quit` | close the browser, exit |

### Verified representative interaction

This exact sequence was run against the real dev server this session:

```bash
SHOTS_DIR=/tmp/drivewise-shots node .claude/skills/run-drivewise-web/driver.mjs <<'EOF'
nav http://localhost:3000
wait-for text=DriveWise
screenshot 01-home
eval location.href
nav http://localhost:3000/en/sign-up
wait-for text=Sign
fill input[name=firstName] Test
fill input[name=lastName] Driver
fill input[name=email] driver-test@example.com
fill input[name=password] password123
fill input[name=confirmPassword] password124
click button[type=submit]
wait-for text=match
screenshot password-mismatch
quit
EOF
```

What this proves: `/` redirects (unauthenticated) to `/en/login`; the
locale prefix (`/en/...`) comes from `next-intl` and is on every route,
not optional; `/en/sign-up` renders a real form with
`firstName`/`lastName`/`email`/`phone`/`password`/`confirmPassword`
fields; submitting mismatched passwords triggers real client-side
validation (a "passwords must match"-style error, no network round
trip) — confirmed via screenshot, not assumed. Switching the URL to
`/es/login` renders the same page fully translated (confirmed via
screenshot) — the i18n setup is real and complete, not just
scaffolding.

## Run (human path)

`pnpm dev` from `apps/web/`, then open `http://localhost:3000` in a
real browser. `Ctrl-C` to stop (or `fuser -k 3000/tcp` if it's
backgrounded).

## Test

```bash
pnpm typecheck
```

No web-specific automated test suite exists in this package beyond
type-checking as of this writing.

---

## Gotchas

- **The route is `/en/sign-up`, not `/signup`.** Guessing the obvious
  slug 404s. Get real routes from the rendered page's own `<a href>`
  values (or `next-intl`'s routing config) rather than guessing —
  every route is locale-prefixed (`/en/...`, `/es/...`) because of
  `next-intl` middleware, which isn't obvious from the URL alone.
- **This container cannot reach Supabase.** The sandbox's outbound
  proxy denies `CONNECT` to `*.supabase.co` by organization policy
  (confirmed directly: `curl -x "$HTTPS_PROXY" https://<project>.supabase.co/...`
  returns the proxy's own `connect_rejected (... organization policy
  ...)` text, not a Supabase response). This means **no full
  signup/login/authenticated-dashboard flow can be demonstrated from
  this container** — form rendering and client-side validation work
  fine and are worth testing, but the actual `fetch` to Supabase Auth
  will fail here with a non-JSON proxy error body (surfaces in the UI
  as something like `"Unexpected token 'H', "Host not I"... is not
  valid JSON"`). This is an environment limitation, not an app bug —
  it won't reproduce in CI or a real deployment with normal network
  access.
- **A real hydration-mismatch warning fires on every page with a form
  input** (login, sign-up): React logs `"A tree hydrated but some
  attributes of the server rendered HTML didn't match the client
  properties"`, pointing at `style={{caret-color:"transparent"}}` being
  present on the client's `<input>` elements but absent from the
  server-rendered HTML. It doesn't break the page (React "wins" and
  reconciles), but it shows up in `console` output on every run — don't
  mistake it for something the driver broke.
- **`lsof -ti:PORT -sTCP:LISTEN | xargs kill` doesn't reliably work in
  this container** even though the server is genuinely listening
  (confirmed via `ps aux` showing the process alive after `lsof`
  returned nothing). Use `fuser -k <port>/tcp` instead.
- **Pin the driver's Chromium to the pre-installed revision.** The
  `playwright` npm package version can resolve ahead of whatever
  browser build is actually cached at `/opt/pw-browsers`; without
  `executablePath` pointing at the exact cached binary, `chromium.launch()`
  tries to download a different revision and fails offline. The driver
  already does this (`CHROME_PATH` constant) — keep it if you bump the
  `playwright` devDependency.
- **`eval` must return a value from `page.evaluate`, not execute in
  Node.** An earlier version of this driver did
  `page.evaluate(new Function("return (" + arg + ")")())`, which ran
  the function in the *driver's* Node context (crashing with `document
  is not defined`) instead of sending the string into the browser. Fixed
  to `page.evaluate(arg)` — Playwright serializes and runs the string
  inside the page itself.
- **`readline`'s `"line"` event fires synchronously for the whole
  buffered heredoc**, not one at a time as commands complete. Without a
  promise-chain queue, an async command (e.g. `wait-for`) can still be
  pending when the next command starts, executing out of order. The
  driver queues handlers (`queue = queue.then(() => handle(line))`) to
  keep heredoc scripts sequential.
