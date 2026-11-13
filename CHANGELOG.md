# Changelog

## Unreleased — Member self-service (backend 0524f80)

API change: `src/api/types.ts` re-synced (PAYMENT_SUBMIT, submissions, ChamaOverviewView, GuarantorCandidate, SUBMISSION_* codes).

- Chama overview for every member with CHAMA_VIEW: officials (REPORT_VIEW_ALL) keep GET /dashboard; everyone else gets
  GET /dashboard/overview, without the work queue, top members, members owing most, recent entries or the trends drill-down.
  Nav item renamed "Overview"; the member home links to it for CHAMA_VIEW.
- Report a payment (`/me/payments/new`, PAYMENT_SUBMIT): contribution, penalty or loan repayment, capped at what is owed, with
  review → send. Entry points: member home (header, quick actions, "I've paid this" on each penalty, "Report a repayment" on
  each active loan), My penalties, My loans, My contributions, and "+ New".
- My reported payments (`/me/payments`): status filter, Withdraw on pending reports, "Report again" on rejected ones.
- Payments to confirm (`/payment-submissions`, any record permission): To confirm / All tabs, kind and member filters,
  Confirm (optional note) and Reject (reason); a user's own reports can't be reviewed. Nav badge and approvals-inbox row use
  GET /payment-submissions/pending-count (reviewable kinds, own reports excluded, no REPORT_VIEW_ALL needed), refreshed on
  focus, every 3 minutes and after confirm/reject.
- Guarantor pickers (apply, add guarantor) use GET /loans/guarantor-candidates; plain members no longer need GET /members.
  The member picker's popover is now the shared `OptionPicker`.

## Unreleased — Dashboards (backend docs/frontend/DASHBOARDS.md)

API change: `src/api/types.ts` re-synced with the backend's `api-types.ts` (new dashboard fields); three new endpoints.

- Chama overview (`/chama`, GET /dashboard): seven key figures, Needs attention (including reported payments to review), section
  cards for members, contributions, loans (with ageing), penalties, investments, savings, cash and performance, top members and
  top investments, a six-month trend chart and recent entries. Polls every 3 minutes while open.
- Top members (`/chama/top-members`, GET /dashboard/top-members): This month / This year / Last year / Custom range and
  10 / 25 / 50 rows, kept in the URL.
- Top investments (`/investments/top`, GET /dashboard/top-investments): every funded investment by return; reachable by plain
  members with INVESTMENT_VIEW.
- Trends (`/chama/trends`, GET /dashboard/trends): 6 / 12 / 24 months, chart and table.
- Member home: net position from the server with its breakdown; contributions (compliance, rank), loans (one row per loan with
  repayment progress), penalties (each outstanding item), pending payment reports and "Our investments" cards.
- Dashboard query keys live in `dashboardKeys`, all under the `dashboard` prefix.
- Drill-downs redirect instead of showing an error: no permission → `/home`; feature not licensed → back to the overview.

## Unreleased — Banking UI redesign, phases 2–4

Presentation only: no API, session, permission, licence, query-key or schema changes. See docs/UI_REDESIGN.md and docs/BACKEND_ASKS.md.

### Phase 2: shell and navigation
- Top bar: licence plan chip, environment badge (NEXT_PUBLIC_APP_ENV), contribution period chip, command palette (Ctrl/⌘K), Approvals inbox, + New transaction menu.
- Sidebar: My banking / Operations workspaces for officials, collapsible groups, Record contribution moved to + New.
- Phones: bottom tab bar (Home, Accounts, Loans, Statement, More).

### Phase 3: key screens
- Secure sign-in panel with security notice, support contacts and app version.
- Member home becomes My accounts: balance hero, account tiles, obligations, quick actions, 30-day mini-statement.
- Chama overview becomes the Operations dashboard.
- Transaction entry: live summary, Review → Confirm, printable receipt; review step on every money dialog.
- Lists and detail pages: identifiers, numeric columns, summary strips and tabbed panels.
- Statements and reports: bank-statement layout with letterhead, running balances and a printed page footer.

### Phase 4: banking hygiene
- Idle timeout with a 60-second countdown (NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES; off when unset).
- Hide balances on every My banking screen, from the top bar or the balance hero.
- One date format (09 Nov 2026) and 24-hour times.

## v0.2.0 — Banking UI redesign, phases 0–1 (2026-11-09)

Presentation only: no API, session, permission, licence, query-key or schema changes.

### Phase 0: screenshot harness
- `scripts/ui-review/` (dev only): Playwright against `npm run dev` with `/api/v1` mocked by realistic KES fixtures and a seeded session.
- `npm run ui:shots -- --label <name>` captures 9 key screens at 1440×900 and 390×844 in light and dark.
- `--audit` reports truncated amounts and horizontal overflow at 1280, 1440, 1920 and 390 px.
- Uses the installed Chrome or Edge (no browser download). Output in `scripts/ui-review/out/` (gitignored).

### Phase 1: foundations
- Flat surfaces: 6 px radius, hairline borders, no card, button or input shadows; a panel-header colour; AA-checked status colours in light and dark.
- Density: compact by default (36 px table rows, 13 px table text); "Comfortable rows" in the user menu.
- Inter and JetBrains Mono loaded through `next/font`.
- New components: `Panel`, `KpiStrip` / `KpiTile`, `Amount`, `Identifier`, `Breadcrumbs`.
- `MoneyText`, `StatCard`, `Section` and `PageHeader` now render through them; `PageHeader` is a sticky page bar with breadcrumbs and an optional "As at" stamp.
- `DataTable`: one framed grid with a toolbar strip, sticky header, dense rows, numeric column meta, optional column menu, keyboard-reachable rows.
- Money shows the ISO code ("KES 1,500.00"); KPI tiles use compact amounts ("KES 2.10M") with the exact figure in a tooltip and for screen readers.

### Fixed
- KPI amounts on the chama overview were truncated ("Ksh 2,099,45…").
- Native selects clipped their value (the page-size select showed "2…").
