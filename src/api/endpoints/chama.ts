import { api } from '../client';
import type {
  ChamaPermission, ChamaResponse, ChamaRole, ChamaSettingsRequest, InvitationView, LicenseView, MemberView, MembershipStatus,
  MyMembershipView, RolePermissionsMap,
} from '../types';

/** §2 My chama. */
export const chamaApi = {
  get: () => api.get<ChamaResponse>('/chama'),
  updateSettings: (body: ChamaSettingsRequest) => api.put<ChamaResponse>('/chama/settings', body),
  licence: () => api.get<LicenseView>('/chama/license'),
};

/** §3 Members & roles. `{id}` is MemberView.membershipId, not the user id. */
export const membersApi = {
  me: () => api.get<MyMembershipView>('/members/me'),
  list: (params: { status?: MembershipStatus; page?: number; size?: number }) => api.getPaged<MemberView>('/members', params),
  /** There is no server search or single-member endpoint: load every page (100 at a time) and cache. */
  async all(status?: MembershipStatus): Promise<MemberView[]> {
    const out: MemberView[] = [];
    for (let page = 0; page < 100; page++) {
      const res = await membersApi.list({ status, page, size: 100 });
      out.push(...res.items);
      if (!res.meta.hasNext) break;
    }
    return out;
  },
  invite: (email: string) => api.post<InvitationView>('/members/invitations', { email }),
  approve: (id: string) => api.post<MemberView>(`/members/${id}/approve`),
  reject: (id: string) => api.post<MemberView>(`/members/${id}/reject`),
  suspend: (id: string, reason: string) => api.post<MemberView>(`/members/${id}/suspend`, { reason }),
  reactivate: (id: string) => api.post<MemberView>(`/members/${id}/reactivate`),
  changeRoles: (id: string, roles: ChamaRole[]) => api.put<MemberView>(`/members/${id}/roles`, { roles }),
};

export const rolesApi = {
  list: () => api.get<RolePermissionsMap>('/roles'),
  update: (role: ChamaRole, permissions: ChamaPermission[]) => api.put<ChamaPermission[]>(`/roles/${role}/permissions`, { permissions }),
};
