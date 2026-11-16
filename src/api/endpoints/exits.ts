import { api } from '../client';
import type { ExitListParams, ExitPreviewView, ExitSettleRequest, ExitView, StartExitRequest } from '../types';

/** §3a Member exits. A member leaves through a settlement officials approve, then the treasurer pays out. */
export const exitsApi = {
  /** The settlement if the member left today, and anything that stops them (MEMBER_EXIT_REQUEST). */
  preview: (memberUserId: string) => api.get<ExitPreviewView>('/member-exits/preview', { memberUserId }),
  start: (body: StartExitRequest) => api.post<ExitView>('/member-exits', body),
  list: (params: ExitListParams) => api.getPaged<ExitView>('/member-exits', params),
  /** The caller's own exits, newest first (any active member). */
  mine: () => api.get<ExitView[]>('/member-exits/mine'),
  get: (id: string) => api.get<ExitView>(`/member-exits/${id}`),
  approve: (id: string, note?: string) => api.post<ExitView>(`/member-exits/${id}/approve`, note ? { note } : {}),
  reject: (id: string, reason: string) => api.post<ExitView>(`/member-exits/${id}/reject`, { reason }),
  cancel: (id: string) => api.post<ExitView>(`/member-exits/${id}/cancel`),
  /** Method and reference are needed only when payoutMinor > 0. */
  settle: (id: string, body: ExitSettleRequest) => api.post<ExitView>(`/member-exits/${id}/settle`, body),
};
