import { api } from '../client';
import type { FineRequest, MyPenaltiesView, PenaltyDetailView, PenaltyListParams, PenaltyPaymentRequest, PenaltyView } from '../types';

/** §7 Penalties (feature PENALTIES). */
export const penaltiesApi = {
  list: (params: PenaltyListParams) => api.getPaged<PenaltyView>('/penalties', params),
  get: (id: string) => api.get<PenaltyDetailView>(`/penalties/${id}`),
  fine: (body: FineRequest) => api.post<PenaltyView>('/penalties/fines', body),
  pay: (id: string, body: PenaltyPaymentRequest) => api.post<PenaltyView>(`/penalties/${id}/payments`, body),
  waive: (id: string, reason: string) => api.post<PenaltyView>(`/penalties/${id}/waive`, { reason }),
  assess: () => api.post<PenaltyView[]>('/penalties/assess'),
  mine: () => api.get<MyPenaltiesView>('/penalties/me'),
};
