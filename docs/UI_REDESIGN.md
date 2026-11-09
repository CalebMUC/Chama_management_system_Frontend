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

## Key screens (Phase 3)

| Screen | Pattern |
|--------|---------|
| Sign-in and other public pages (`features/auth/AuthLayout.tsx`) | One secure panel on a navy backdrop: header strip, title, the page's own fields, the security notice ("ChamaBank will never ask for your password by phone, SMS or email"), support contacts from `NEXT_PUBLIC_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_PHONE`, and the app version (from `package.json`). |
| Member home, "My accounts" (`features/home/MemberHome.tsx`) | Balance hero (`.hero` re-points text tokens so figures stay AA on navy), account tiles with masked numbers, "What you owe" (non-zero rows highlighted with an icon and text), quick actions, and a 30-day mini-statement from `reportsApi.myStatement`. |
| Operations dashboard (`app/(app)/chama/page.tsx`) | KPI strip; approvals queue (one row per queue, Go to queue); cash position by channel; loan book with PAR30 status (icon + word, not colour alone) and pipeline; collections; income vs expenses table; recent journal entries. |
| Transaction entry (`components/shared/Transaction.tsx`) | Inputs left, live summary right; **Review → Confirm** before anything is sent; a printable receipt. Record contribution uses the full pattern; every `PaymentDialog` and `ExpenseDialog` gets the review step through `FormDialog`'s `review` prop. Schemas and mutations are unchanged. |
| Detail pages (`DetailTabs`) | A summary strip of key figures (`KpiStrip compact={false}`) and tabbed panels: loan (Details, Schedule, Repayments, Approvals), member (its existing tabs, framed), journal entry (details and postings with Dr/Cr totals). Every tab prints. |
| Statements (`components/shared/Statement.tsx`) | `StatementDocument`: letterhead, statement period, who it is for, balances, transactions with running balance (`StatementTable`, bare figures under currency headers, references in their own column), generated time, and a footer that repeats on each printed page. Used by My statement, the member statement report, member detail and account statements. |

## Banking hygiene (Phase 4)

- **Idle timeout** (`features/auth/IdleTimeout.tsx`): after `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` without activity in any tab, a
  60-second countdown with **Stay signed in** and **Sign out**; at zero it signs out through `logout()`. Off when unset or 0.
- **Hide balances**: the `hideBalances` preference masks every `Amount` and every `sensitive` `Identifier` on My banking routes
  (`/home`, `/me/*`, see `lib/routes.ts`). Toggles: the eye button in the top bar on those routes and the hero on My accounts.
- **Dates**: one format from `lib/format.ts`: `formatDate` "09 Nov 2026", `formatInstant` "09 Nov 2026, 13:15" (24-hour,
  browser time zone as before), `formatInstantDate`, `formatTime`, `formatPeriodKey` "Nov 2026". Month names are fixed in code
  so every browser shows "Sep", not "Sept".

## Print

Reports and statements print on their own (`.report`). On paper: the page bar is hidden when a statement brings its own
letterhead, table headers repeat, rows don't split, the statement footer repeats on every page, and dark mode prints with the
light palette.
