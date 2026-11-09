# Backend asks

The banking UI redesign is presentation only: it uses what `src/api/endpoints/*` return today. These are the things the design
wanted but the API doesn't provide. Each lists what the UI does in the meantime.

| # | Ask | Where the UI wants it | What the UI does now |
|---|-----|-----------------------|----------------------|
| 1 | **Find a loan by number.** `LoanView` has no human-readable loan number, and `GET /loans` has no search parameter. | Command palette (Ctrl/⌘K): type a loan number and jump to the loan. | The palette finds pages, actions and members only. Loans are found by borrower through the member filter on the loan book. |
| 2 | **Find a journal entry by number.** `GET /ledger/entries` filters by date and source only. | Command palette: type `#1284` and jump to the entry. | Not offered. The journal list can be filtered by date and source. |
| 3 | **Server-side member search.** There is no `?q=` on `GET /members`; the client loads every page (100 at a time) and searches locally. | Command palette, member pickers. | Works from the cached directory (needs `MEMBER_VIEW`). Fine for hundreds of members; slow for thousands. |
| 4 | **A notifications or activity feed.** Work-queue counts come only from the two dashboards, polled every 3 minutes. | Approvals inbox: "new since you last looked", and push updates. | The inbox shows counts per queue from `GET /dashboard` and `GET /dashboard/me`, refreshed every few minutes and on window focus. |
| 5 | **The due date of the current contribution period for members.** `MyContributionsSection` has `currentPeriod` but no `dueDate` (only the officials' dashboard has it). | Top-bar period chip ("Nov 2026 · due 5 Nov"). | The chip shows the period only. |
| 6 | **Last sign-in time and device.** `UserResponse` has `createdAt` but no last-login details. | Security line in the user menu and on the sign-in page ("Last signed in 8 Nov 2026, 18:02 from Chrome on Android"). | Left out. |
