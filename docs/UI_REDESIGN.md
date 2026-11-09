# UI redesign: a core-banking console

ChamaBank's presentation layer follows a bank staff console (dense, flat, figures first) for officials, and a retail banking
app for members. This is presentation only: API calls, session handling, permissions, licence gating, query keys and schemas are
unchanged. What the design wanted but the API doesn't provide is in [BACKEND_ASKS.md](BACKEND_ASKS.md).

## Tokens (`src/app/globals.css`, `tailwind.config.ts`)

| Token | Use |
|-------|-----|
| `--radius: 0.375rem` | 6 px panels, 4 px controls, 2 px chips (`rounded-lg` / `md` / `sm`). |
| `--panel-header` (`bg-panel-header`) | Panel header strips, table header rows, toolbars, pagers. |
| `--warning-text` (`text-warning-text`) | Amber text that passes AA; `--warning` stays the fill colour. |
| `--gutter` (`p-gutter`, `-mx-gutter`) | Page gutters: 16 px, 20 px from 768 px, 24 px from 1536 px. |
| `--topbar-h` (`h-topbar`, `top-topbar`) | Top bar height (48 px); the page bar sticks under it. |
| `--control-h` (`h-control`) | Inputs, selects and default buttons: 32 px compact, 36 px comfortable. |
| `--row-h`, `--cell-py`, `--cell-px`, `--table-text` | Table density: 36 px rows and 13 px text compact; 44 px and 14 px comfortable. |
| `--panel-p` | Panel padding: 12 px compact, 16 px comfortable. |
| `--font-sans`, `--font-mono` | Inter and JetBrains Mono through `next/font` (self-hosted at build time). |
| `shadow-overlay` | The only shadow: menus, popovers, dialogs. Surfaces are flat. |

Density is a preference (`density` in `src/stores/preferences.ts`, toggled from the user menu) applied as
`<html data-density="compact|comfortable">` before first paint. Touch targets stay at least 36 px on coarse pointers whatever the
density (`globals.css`).

Colour: navy (`primary`, `sidebar`) for chrome and primary actions; gold only for the brand mark and attention counts. Never
hard-code a hex colour in a component; add a token.

## Components

| Component | Where | Notes |
|-----------|-------|-------|
| `Amount` | `components/shared/Amount.tsx` | Every amount. Tabular figures, the ISO code small and muted, a true minus sign, `side="DR"|"CR"` for ledgers, `signed` for credits, `bare` without the code. Never truncates. Inside a `KpiStrip` it renders compact ("KES 2.10M") with the exact amount in a tooltip and for screen readers. Masked when balances are hidden. `MoneyText` and `SignedMoney` wrap it. |
| `Identifier` | `components/shared/Identifier.tsx` | Account, loan, journal and member numbers; M-Pesa and bank references. Monospace with a copy button. `sensitive` ones are masked to the last four characters while balances are hidden. |
| `Panel`, `KeyValue` | `components/shared/Panel.tsx` | The basic surface: hairline border, a header strip (11 px uppercase title, toolbar on the right), `flush` for edge-to-edge tables. `Section` wraps it. |
| `KpiStrip`, `KpiTile` | `components/shared/Kpi.tsx` | `repeat(auto-fit, minmax(220px, 1fr))`, equal heights, compact amounts, a tone bar on the left, optional link. `StatCard` wraps `KpiTile`. |
| `PageHeader` (page bar) | `components/shared/Display.tsx` | Breadcrumbs from the route, a 17 px title, an optional `asAt` instant ("As at 9 Nov 2026, 10:15"), actions on the right. Sticky under the top bar from 640 px. |
| `Breadcrumbs` | `components/layout/Breadcrumbs.tsx` | Built from `config/navigation.ts`: workspace › group › page; the matching item becomes a link on detail and "new" pages. |
| `StatusChip` | `components/shared/Display.tsx` | 20 px, `rounded-sm`, always icon + text. |
| `DataTable` | `components/shared/DataTable.tsx` | One framed grid: toolbar strip, sticky header (the grid scrolls inside a viewport-high box), dense rows, `meta: { numeric: true }` for right-aligned tabular columns, optional `columnToggle`, `footer` for totals, keyboard-reachable rows, `mobileCard` below 640 px. |

## Shell and navigation

- **Top bar**: chama name, code and licence plan; an environment badge from `NEXT_PUBLIC_APP_ENV` (hidden in production or when
  unset); the current contribution period; search (Ctrl/⌘K); the approvals inbox; **+ New**; theme; user menu.
- **Command palette** (`cmdk`, `components/layout/TopBarTools.tsx`): New actions, every page the user can open (grouped by
  workspace), and members from the cached directory.
- **Approvals inbox** (`features/access/useApprovalQueues.ts`): one row per queue with the same permission rules and dashboard
  queries as the sidebar badges, so its total equals theirs. Rows link to the same pre-filtered lists as the overview.
- **+ New** (`newActions` in `config/navigation.ts`): Record contribution, Record loan repayment (pick an active loan, then the
  loan page opens its repayment dialog), New expense (the existing dialog), Post journal entry. Each gated by permission and
  feature.
- **Sidebar**: a workspace switcher, **My banking** (the Me group) and **Operations** (Chama, Money, Books, Settings), shown only
  to users with an official permission. Plain members see My banking plus any ungated pages they could already open ("Chama
  products"). Groups fold, and the folding is remembered. Item permissions, features and badges are unchanged.
- **Phones**: a bottom tab bar (Home, Accounts, Loans, Statement, More) below 640 px; More opens the full menu.
- **Width**: fluid with gutters; profile and settings text pages cap at `max-w-5xl`.

## Checking the UI

`npm run ui:shots -- --label <name>` screenshots the key screens against `npm run dev` with the API mocked
(`scripts/ui-review/`). Add `--audit` to check for truncated amounts and horizontal overflow at 1280, 1440, 1920 and 390 px, and
`--persona member` to see a plain member's view.
