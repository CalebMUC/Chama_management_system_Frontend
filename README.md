# Chama Platform: frontend

The web app for the Chama Management System: a banking-style console where chama (savings group) officials run
contributions, loans, penalties, expenses, investments and the books, and where every member sees their own savings, loans and
statements and reports payments they made.

It is a Next.js 14 (App Router) client for the Spring Boot API in the backend repo. The API is the source of truth for every
rule: this app formats, gates and explains, and never computes balances itself.

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [How the app works](#how-the-app-works)
- [Conventions](#conventions)
- [Screenshot harness](#screenshot-harness)
- [Further reading](#further-reading)

## Quick start

You need Node.js 20 or later, and the backend API running (by default on `http://localhost:8080`; see "Running the backend
locally" in the backend's `docs/frontend/README.md`).

```bash
npm install
cp .env.example .env.local   # optional: the defaults work against a local API
npm run dev                  # http://localhost:3000
```

Sign in at `/login` with a chama code and a member's email and password. Platform operators sign in at `/admin/login`.

## Configuration

Next.js reads `.env.local`, then `.env.development` or `.env.production`. Everything prefixed `NEXT_PUBLIC_` is inlined into the
browser bundle at build time, so never put a secret in one.

| Variable | Default | Purpose |
|---|---|---|
| `API_PROXY_TARGET` | `http://localhost:8080` | Where the dev and production server proxy `/api/v1/*` and `/actuator/*`. Server-side only. |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` | The API root the browser calls. Keep it same-origin: the API sends no CORS headers. |
| `NEXT_PUBLIC_APP_ENV` | empty | `development`, `test`, `staging` or `production`. Shows an environment badge in the top bar, except in production. |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` | empty (off) | Signs the user out after this many idle minutes, after a 60-second countdown. |
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE` | empty | The platform operator's contacts, shown on the licence screens and the sign-in page. |

The app version shown on the sign-in page comes from `package.json`.

**Deploying:** the API has no CORS, so serve the app and the API from one origin. The built-in rewrites in `next.config.mjs` do
this for `next start`; behind a reverse proxy, route `/api/v1` and `/actuator` to the API and everything else to Next. The app
also sets `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy: no-referrer`, because the refresh token lives in browser
storage.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000, proxying the API. |
| `npm run build` / `npm start` | Production build, and serving it on port 3000. |
| `npm run typecheck` | `tsc --noEmit` (strict, no unused locals or parameters). |
| `npm run lint` | ESLint (`next lint`). |
| `npm test` / `npm run test:watch` | Vitest unit and component tests (`src/**/*.test.ts(x)`, jsdom). |
| `npm run ui:shots -- --label <name>` | Screenshots of key screens against a mocked API. See [Screenshot harness](#screenshot-harness). |

Before you push, run `npm run typecheck && npm run lint && npm test`.

## Project layout

```
src/
  app/                      Routes (App Router)
    (public)/               Sign-in, registration, join, password reset, email verification
    (status)/               Pending approval, membership status, licence blocked
    (app)/                  The signed-in chama app (AuthGuard, AppShell)
      home/, me/            "My banking": member home, savings, contributions, loans, penalties, statement, reported payments
      chama/                Chama overview, top members, trends
      members/, contributions/, loans/, penalties/, expenses/, investments/, member-accounts/
      payment-submissions/  "Payments to confirm": the review queue for members' reported payments
      ledger/, reports/, audit-log/, settings/
    platform/               The platform operator's console (onboard chamas, licences)
  api/
    client.ts               Axios client: envelope unwrapping, token refresh (single-flight), typed errors
    types.ts                Request and response types: a copy of the backend's docs/frontend/api-types.ts
    endpoints/*.ts          One object per API area (loansApi, dashboardApi, submissionsApi, …)
  components/
    ui/                     Primitives (Radix-based buttons, dialogs, tables, inputs)
    shared/                 App building blocks: Amount, DataTable, Panel, PageHeader, money fields, dialogs, states
    layout/                 Shell, sidebar, top bar, breadcrumbs, mobile tab bar
  features/<area>/          Screen pieces too big for a page file (dashboard cards, loan panels, submission parts, …)
  config/navigation.ts      Sidebar groups, "+ New" actions and mobile tabs, each with its permission and licence feature
  hooks/                    useApiMutation, usePaged, useSessionInfo (can, hasFeature), useMembers
  lib/                      Formatting, zod schemas, form helpers, query invalidation map, labels, CSV
  stores/                   Zustand: session (tokens, membership, permissions, licence), preferences, connectivity
scripts/ui-review/          The screenshot harness and its API fixtures
docs/                       Design notes for this repo (see Further reading)
```

## How the app works

**Session.** Sign-in returns an access token and a refresh token, stored by `stores/session.ts`. `api/client.ts` attaches the
access token and the chama code (`X-Chama-Code`) to every call. On a `401` it refreshes once, then retries. The refresh is
shared by every request in flight and locked across browser tabs. Refresh tokens rotate, and the server treats a reused one as
theft and signs the user out everywhere, so two refreshes must never race. After sign-in the app loads `GET /members/me` (membership and permissions) and the licence.
`AuthGuard` sends users to the right place for their state: sign-in, pending approval, suspended, or licence blocked.

**Access.** Gate every screen, menu item and button on the permissions from `GET /members/me`, never on role names: each chama can
remap roles to permissions. Use `useCan()` and `useHasFeature()` from `hooks/useSessionInfo.ts`, or the `<Can>` and `<Guard>`
components. A page guard shows "No access" or "Not in your plan" instead of a blank screen. The API enforces the same rules
regardless.

**Data.** TanStack Query, with keys that start with the area name (`['loans', …]`, `['dashboard', …]`). After a write,
`useApiMutation` toasts the server's message and invalidates the areas listed for that change in `lib/invalidation.ts`. There
is no push: the work-queue badges poll every 3 minutes and refetch on window focus.

**Licence.** A chama's plan switches features on (`CONTRIBUTIONS`, `LOANS`, `PENALTIES`, `EXPENSES`, `INVESTMENTS`, `REPORTS`, …).
Dashboard sections for unlicensed features come back as `null`: hide them, never show them as zero.

## Conventions

- **Money is integer minor units** (cents) everywhere: `amountMinor`, `balanceMinor`. Render it with `<Amount>` and parse input
  with `parseMoney`. Never use floats or do arithmetic on formatted strings. Rates are integer basis points (`formatBp`).
- **Business dates are plain `YYYY-MM-DD` days in Africa/Nairobi.** Don't pass them through `new Date()`. Use `formatDate`,
  `todayNairobi` and `addDays` from `lib/format.ts`. Instants (`…At`) are shown in local time.
- **Money-movement forms** take an amount, method, reference (required for M-Pesa and bank) and date (never in the future), and go
  through a review step before Confirm. Reuse `PaymentFields`, `PaymentDialog` or `TransactionLayout`.
- **API errors**: field errors go beside their inputs (`applyApiErrors`). A `*_DUPLICATE_REFERENCE` error goes on the reference
  field. Anything else shows as a form alert or a toast with the server's message.
- **Labels** for enum values come from `lib/labels.ts` (`label('PARTIALLY_PAID')` gives "Part paid"), so wording can change in
  one place.
- **Styling**: Tailwind with the tokens in `src/app/globals.css`. Don't hard-code colours. Light and dark themes and a density
  preference are built in. See `docs/UI_REDESIGN.md`.
- **Updating API types:** when the backend changes, copy its `docs/frontend/api-types.ts` over `src/api/types.ts`. Don't edit
  the copy by hand.

## Screenshot harness

`scripts/ui-review/` screenshots key screens with Playwright against `npm run dev`, with every `/api/v1` call answered from
realistic KES fixtures (`fixtures.mjs`). No backend is needed. It uses your installed Chrome or Edge.

```bash
npm run ui:shots -- --label before
npm run ui:shots -- --label after --only home,chama --themes light --widths 1440
npm run ui:shots -- --label after --audit            # also flags truncated amounts and horizontal overflow
npm run ui:shots -- --label member --persona member  # a plain member instead of the treasurer
```

Output goes to `scripts/ui-review/out/<label>/`. When you add a screen, add it to the `screens` list in `shots.mjs`; when you call
a new endpoint, mock it in `resolve()` in `fixtures.mjs`.

## Further reading

- **Frontend build guide** (backend repo, `docs/frontend/`): `README.md` (screens, permissions, routes, UX rules), `API_REFERENCE.md`
  (every endpoint and error code) and `DASHBOARDS.md` (the overview, drill-downs and member home). Code comments that cite
  "README §7.4" or "DASHBOARDS.md" point there.
- [docs/UI_REDESIGN.md](docs/UI_REDESIGN.md): design tokens, shared components and layout rules.
- [docs/BACKEND_ASKS.md](docs/BACKEND_ASKS.md): what the UI would use if the API provided it, and the workaround meanwhile.
- [CHANGELOG.md](CHANGELOG.md): what changed, release by release.
