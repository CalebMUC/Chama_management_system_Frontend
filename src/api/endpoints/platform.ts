import { api } from '../client';
import type { LicenseView, OnboardingResponse, PlatformChamaView, PlatformOnboardChamaRequest, UpdateLicenseRequest } from '../types';

/** §17 Platform administration (ROLE_ADMIN). */
export const platformApi = {
  onboard: (body: PlatformOnboardChamaRequest) => api.post<OnboardingResponse>('/platform/chamas', body),
  list: (params: { page?: number; size?: number }) => api.getPaged<PlatformChamaView>('/platform/chamas', params),
  get: (id: string) => api.get<PlatformChamaView>(`/platform/chamas/${id}`),
  updateLicence: (id: string, body: UpdateLicenseRequest) => api.put<LicenseView>(`/platform/chamas/${id}/license`, body),
};
