import { api } from '../client';
import type {
  AuditLogEntry, AuditLogParams, CashBookView, ChamaDashboardView, ChamaOverviewView, ContributionReportView, CreateLedgerAccountRequest, DateRangeParams,
  EntryView, FinancialPositionView, HistoryBatchView, HistoryImportKind, HistoryPreviewView, ImportPreviewView, ImportView, IncomeStatementView, LedgerAccountView, LedgerEntryListParams,
  LedgerStatementView, LoanPortfolioView, ManualEntryRequest, MemberBalancesView, MemberDashboardView, MemberStatementView,
  SavingsRegisterView, TopInvestmentsView, TopMembersView, TrendsView, TrialBalanceView,
} from '../types';

/** §12 Ledger: double-entry books. Entries are reversed, never edited. */
export const ledgerApi = {
  accounts: () => api.get<LedgerAccountView[]>('/ledger/accounts'),
  createAccount: (body: CreateLedgerAccountRequest) => api.post<LedgerAccountView>('/ledger/accounts', body),
  setAccountActive: (id: string, active: boolean) => api.put<LedgerAccountView>(`/ledger/accounts/${id}/status`, { active }),
  statement: (id: string, params: DateRangeParams & { memberUserId?: string }) => api.get<LedgerStatementView>(`/ledger/accounts/${id}/statement`, params),
  entries: (params: LedgerEntryListParams) => api.getPaged<EntryView>('/ledger/entries', params),
  entry: (id: string) => api.get<EntryView>(`/ledger/entries/${id}`),
  post: (body: ManualEntryRequest) => api.post<EntryView>('/ledger/entries', body),
  reverse: (id: string, reason: string) => api.post<EntryView>(`/ledger/entries/${id}/reverse`, { reason }),
  trialBalance: (asOf?: string) => api.get<TrialBalanceView>('/ledger/trial-balance', { asOf }),
  mine: () => api.get<MemberBalancesView>('/ledger/me'),
};

/** §13 Dashboards (DASHBOARDS.md). Sections for unlicensed features are null. */
export const dashboardApi = {
  chama: () => api.get<ChamaDashboardView>('/dashboard'),
  mine: () => api.get<MemberDashboardView>('/dashboard/me'),
  /** The chama-wide totals for every member (CHAMA_VIEW): no work queue, no member names, no ledger detail. */
  overview: () => api.get<ChamaOverviewView>('/dashboard/overview'),
  /** Ranked by contributions in [from, to]; the server defaults the range to this year and clamps limit to 1–50. */
  topMembers: (params: { from?: string; to?: string; limit?: number }) => api.get<TopMembersView>('/dashboard/top-members', params),
  /** Funded investments ranked by return; limit clamped to 1–50. */
  topInvestments: (limit?: number) => api.get<TopInvestmentsView>('/dashboard/top-investments', { limit }),
  /** Monthly series, oldest first, ending with this month to date. months must be 1–24. */
  trends: (months?: number) => api.get<TrendsView>('/dashboard/trends', { months }),
};

/**
 * Dashboard query keys, all under the `dashboard` prefix so invalidating ['dashboard'] refreshes the drill-downs too
 * (DASHBOARDS.md "Query keys").
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  chama: ['dashboard', 'chama'] as const,
  overview: ['dashboard', 'overview'] as const,
  me: ['dashboard', 'me'] as const,
  topMembers: (from?: string, to?: string, limit?: number) => ['dashboard', 'topMembers', { from, to, limit }] as const,
  topInvestments: (limit?: number) => ['dashboard', 'topInvestments', { limit }] as const,
  trends: (months?: number) => ['dashboard', 'trends', { months }] as const,
};

/** §14 Reports (feature REPORTS). JSON only: CSV and print are client-side. */
export const reportsApi = {
  financialPosition: (asOf?: string) => api.get<FinancialPositionView>('/reports/financial-position', { asOf }),
  incomeStatement: (params: DateRangeParams) => api.get<IncomeStatementView>('/reports/income-statement', params),
  cashBook: (params: DateRangeParams & { account?: string }) => api.get<CashBookView>('/reports/cash-book', params),
  contributions: (params: DateRangeParams) => api.get<ContributionReportView>('/reports/contributions', params),
  loanPortfolio: () => api.get<LoanPortfolioView>('/reports/loan-portfolio'),
  savings: () => api.get<SavingsRegisterView>('/reports/savings'),
  memberStatement: (userId: string, params: DateRangeParams) => api.get<MemberStatementView>(`/reports/members/${userId}/statement`, params),
  myStatement: (params: DateRangeParams) => api.get<MemberStatementView>('/reports/members/me/statement', params),
};

/** §15 Audit log. */
export const auditApi = {
  list: (params: AuditLogParams) => api.getPaged<AuditLogEntry>('/audit-log', params),
};

/** §16 Opening-balance import: once per chama, all-or-nothing. */
export const importsApi = {
  template: () => api.download('/imports/opening-balances/template', 'opening-balances-template.xlsx'),
  status: () => api.getResult<ImportView | null>('/imports/opening-balances'),
  preview: (file: File, asOf: string) => api.postForm<ImportPreviewView>('/imports/opening-balances/preview', toForm(file, asOf)),
  run: (file: File, asOf: string) => api.postForm<ImportView>('/imports/opening-balances', toForm(file, asOf)),
};

/** The chama's history, one file per step (see HistoryImportKind). Previews save nothing; the latest import can be undone. */
export const historyImportsApi = {
  template: (kind: HistoryImportKind) =>
    api.download(`/imports/history/${slug(kind)}/template`, `history-${slug(kind)}-template.xlsx`),
  preview: (kind: HistoryImportKind, file: File) =>
    api.postForm<HistoryPreviewView>(`/imports/history/${slug(kind)}/preview`, fileForm(file)),
  run: (kind: HistoryImportKind, file: File) => api.postForm<HistoryBatchView>(`/imports/history/${slug(kind)}`, fileForm(file)),
  batches: () => api.get<HistoryBatchView[]>('/imports/history/batches'),
  undo: (id: string) => api.post<HistoryBatchView>(`/imports/history/batches/${id}/undo`),
};

const slug = (kind: HistoryImportKind) => kind.toLowerCase();

function fileForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

function toForm(file: File, asOf: string): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('asOf', asOf);
  return form;
}
