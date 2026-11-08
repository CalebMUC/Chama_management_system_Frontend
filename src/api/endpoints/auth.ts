import { api, publicApi } from '../client';
import type {
  AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest, UserResponse,
} from '../types';

/** §1 Auth & account. Public endpoints take the chama code explicitly; null means platform administrator. */
export const authApi = {
  register: (body: RegisterRequest, chamaCode: string) => publicApi.post<UserResponse>('/auth/register', body, chamaCode),
  login: (body: LoginRequest, chamaCode: string | null) => publicApi.post<AuthResponse>('/auth/login', body, chamaCode),
  logout: (refreshToken: string, chamaCode: string | null) => publicApi.post('/auth/logout', { refreshToken }, chamaCode),
  logoutAll: () => api.post('/auth/logout-all'),
  me: () => api.get<UserResponse>('/auth/me'),
  verifyEmail: (token: string, chamaCode: string | null) => publicApi.post('/auth/email/verify', { token }, chamaCode),
  resendVerification: (email: string, chamaCode: string | null) => publicApi.post('/auth/email/verify/resend', { email }, chamaCode),
  forgotPassword: (email: string, chamaCode: string | null) => publicApi.post('/auth/password/forgot', { email }, chamaCode),
  resetPassword: (body: ResetPasswordRequest, chamaCode: string | null) => publicApi.post('/auth/password/reset', body, chamaCode),
  changePassword: (body: ChangePasswordRequest) => api.post<AuthResponse>('/auth/password/change', body),
};
