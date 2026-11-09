# Changelog

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
