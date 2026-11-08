import { api } from '../client';
import type {
  CloseInvestmentRequest, DateRangeParams, DepositRequest, ExpenseListParams, ExpensePayRequest, ExpenseRequest, ExpenseSummaryView,
  ExpenseView, FundRequest, IncomeRequest, InvestmentDetailView, InvestmentListParams, InvestmentView, PortfolioView,
  ProposeInvestmentRequest, ValuationRequest, WithdrawalRequest,
} from '../types';

/** §10 Expenses (feature EXPENSES). Maker-checker. */
export const expensesApi = {
  create: (body: ExpenseRequest) => api.post<ExpenseView>('/expenses', body),
  list: (params: ExpenseListParams) => api.getPaged<ExpenseView>('/expenses', params),
  summary: (params: DateRangeParams) => api.get<ExpenseSummaryView>('/expenses/summary', params),
  get: (id: string) => api.get<ExpenseView>(`/expenses/${id}`),
  approve: (id: string, note?: string) => api.post<ExpenseView>(`/expenses/${id}/approve`, note ? { note } : {}),
  reject: (id: string, reason: string) => api.post<ExpenseView>(`/expenses/${id}/reject`, { reason }),
  cancel: (id: string) => api.post<ExpenseView>(`/expenses/${id}/cancel`),
  pay: (id: string, body: ExpensePayRequest) => api.post<ExpenseView>(`/expenses/${id}/pay`, body),
};

/** §11 Investments (feature INVESTMENTS). */
export const investmentsApi = {
  propose: (body: ProposeInvestmentRequest) => api.post<InvestmentView>('/investments', body),
  list: (params: InvestmentListParams) => api.getPaged<InvestmentView>('/investments', params),
  portfolio: () => api.get<PortfolioView>('/investments/portfolio'),
  get: (id: string) => api.get<InvestmentDetailView>(`/investments/${id}`),
  approve: (id: string, note?: string) => api.post<InvestmentView>(`/investments/${id}/approve`, note ? { note } : {}),
  reject: (id: string, reason: string) => api.post<InvestmentView>(`/investments/${id}/reject`, { reason }),
  cancel: (id: string) => api.post<InvestmentView>(`/investments/${id}/cancel`),
  fund: (id: string, body: FundRequest) => api.post<InvestmentDetailView>(`/investments/${id}/fund`, body),
  deposit: (id: string, body: DepositRequest) => api.post<InvestmentDetailView>(`/investments/${id}/deposits`, body),
  income: (id: string, body: IncomeRequest) => api.post<InvestmentDetailView>(`/investments/${id}/income`, body),
  withdraw: (id: string, body: WithdrawalRequest) => api.post<InvestmentDetailView>(`/investments/${id}/withdrawals`, body),
  value: (id: string, body: ValuationRequest) => api.post<InvestmentDetailView>(`/investments/${id}/valuations`, body),
  close: (id: string, body: CloseInvestmentRequest) => api.post<InvestmentDetailView>(`/investments/${id}/close`, body),
};
