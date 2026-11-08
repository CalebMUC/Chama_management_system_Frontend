import { api } from '../client';
import type {
  ContributionListParams, CreateSavingsProductRequest, DateRangeParams, MemberAccountListParams, MemberAccountStatementView,
  MemberAccountView, MyAccountsView, MyContributionsView, PaymentView, PeriodDetailView, PeriodSummaryView, RecordPaymentRequest,
  SavingsProductView, StandingView, UpdateSavingsProductRequest,
} from '../types';

/** §4 Contributions (feature CONTRIBUTIONS). */
export const contributionsApi = {
  record: (body: RecordPaymentRequest) => api.post<PaymentView>('/contributions', body),
  list: (params: ContributionListParams) => api.getPaged<PaymentView>('/contributions', params),
  get: (id: string) => api.get<PaymentView>(`/contributions/${id}`),
  reverse: (id: string, reason: string) => api.post<PaymentView>(`/contributions/${id}/reverse`, { reason }),
  periods: () => api.get<PeriodSummaryView[]>('/contributions/periods'),
  period: (id: string) => api.get<PeriodDetailView>(`/contributions/periods/${id}`),
  standings: (inArrears = false) => api.get<StandingView[]>('/contributions/standings', { inArrears }),
  mine: () => api.get<MyContributionsView>('/contributions/me'),
};

/** §5 Savings products. */
export const savingsProductsApi = {
  list: () => api.get<SavingsProductView[]>('/savings-products'),
  get: (id: string) => api.get<SavingsProductView>(`/savings-products/${id}`),
  create: (body: CreateSavingsProductRequest) => api.post<SavingsProductView>('/savings-products', body),
  update: (id: string, body: UpdateSavingsProductRequest) => api.put<SavingsProductView>(`/savings-products/${id}`, body),
  activate: (id: string) => api.post<SavingsProductView>(`/savings-products/${id}/activate`),
  deactivate: (id: string) => api.post<SavingsProductView>(`/savings-products/${id}/deactivate`),
};

/** §6 Member accounts: one per member per savings product. */
export const memberAccountsApi = {
  list: (params: MemberAccountListParams) => api.get<MemberAccountView[]>('/member-accounts', params),
  get: (id: string) => api.get<MemberAccountView>(`/member-accounts/${id}`),
  statement: (id: string, params: DateRangeParams) => api.get<MemberAccountStatementView>(`/member-accounts/${id}/statement`, params),
  mine: () => api.get<MyAccountsView>('/member-accounts/me'),
  myStatement: (id: string, params: DateRangeParams) => api.get<MemberAccountStatementView>(`/member-accounts/me/${id}/statement`, params),
  open: (memberUserId: string, productId: string) => api.post<MemberAccountView>('/member-accounts', { memberUserId, productId }),
  close: (id: string, reason: string) => api.post<MemberAccountView>(`/member-accounts/${id}/close`, { reason }),
  reopen: (id: string) => api.post<MemberAccountView>(`/member-accounts/${id}/reopen`),
};
