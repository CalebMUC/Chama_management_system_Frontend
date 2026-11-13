import { api } from '../client';
import type {
  AddMemberRequest, ChamaPermission, ChamaResponse, ChamaRole, ChamaSettingsRequest, InvitationView, KycRequest, LicenseView,
  MemberKycView, MemberView, MembershipStatus, MyMembershipView, RolePermissionsMap,
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
  /** Opens an ACTIVE member's account with a temporary password and KYC details. */
  add: (body: AddMemberRequest) => api.post<MemberView>('/members', body),
  invite: (email: string) => api.post<InvitationView>('/members/invitations', { email }),
  /** null when no KYC details were recorded yet. */
  kyc: (id: string) => api.get<MemberKycView | null>(`/members/${id}/kyc`),
  updateKyc: (id: string, body: KycRequest) => api.put<MemberKycView>(`/members/${id}/kyc`, body),
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
