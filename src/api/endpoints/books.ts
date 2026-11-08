import { api } from '../client';
import type {
  AuditLogEntry, AuditLogParams, CashBookView, ChamaDashboardView, ContributionReportView, CreateLedgerAccountRequest, DateRangeParams,
  EntryView, FinancialPositionView, ImportPreviewView, ImportView, IncomeStatementView, LedgerAccountView, LedgerEntryListParams,
  LedgerStatementView, LoanPortfolioView, ManualEntryRequest, MemberBalancesView, MemberDashboardView, MemberStatementView,
  SavingsRegisterView, TrialBalanceView,
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

/** §13 Dashboards. Sections for unlicensed features are null. */
export const dashboardApi = {
  chama: () => api.get<ChamaDashboardView>('/dashboard'),
  mine: () => api.get<MemberDashboardView>('/dashboard/me'),
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

function toForm(file: File, asOf: string): FormData {
  const form = new FormData();
  form.append('file', file);
  form.append('asOf', asOf);
  return form;
}
