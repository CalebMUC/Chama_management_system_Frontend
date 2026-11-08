import { authApi } from '@/api/endpoints/auth';
import { chamaApi, membersApi } from '@/api/endpoints/chama';
import { dashboardApi } from '@/api/endpoints/books';
import { isApiError, normaliseError } from '@/api/errors';
import { sessionStore } from '@/api/session';
import type { AuthResponse, ChamaResponse, LicenseView, UserResponse } from '@/api/types';
import { queryClient } from '@/lib/queryClient';
import { useSession } from '@/stores/session';

/**
 * Loads the app context after sign-in or on start-up (README §5):
 *   GET /auth/me → platform admin? → GET /members/me → (ACTIVE) GET /chama + GET /chama/license.
 */
export async function loadContext(knownUser?: UserResponse): Promise<void> {
  const user = knownUser ?? (await authApi.me());
  const isPlatformAdmin = user.roles.includes('ROLE_ADMIN') && !user.chamaId;
  if (isPlatformAdmin) {
    useSession.getState().setContext({ status: 'authenticated', user, isPlatformAdmin: true, membership: null, permissions: [], chama: null, licence: null, features: [] });
    return;
  }
  const me = await membersApi.me();
  let chama: ChamaResponse | null = null;
  let licence: LicenseView | null = null;
  let features: string[] = [];
  let chamaName: string | null = null;
  let currency = 'KES';
  if (me.membership.status === 'ACTIVE') {
    try {
      [chama, licence] = await Promise.all([chamaApi.get(), chamaApi.licence()]);
      features = licence.features;
      chamaName = chama.name;
      currency = chama.currency;
    } catch (e) {
      // A chama can take CHAMA_VIEW away: fall back to the member dashboard and treat the licence as active.
      if (!isApiError(e, 'ACCESS_DENIED')) throw e;
      const dash = await dashboardApi.mine();
      features = dash.features;
      chamaName = dash.chamaName;
      currency = dash.currency;
    }
  }
  useSession.getState().setContext({
    status: 'authenticated',
    user,
    isPlatformAdmin: false,
    membership: me.membership,
    permissions: me.permissions,
    chama,
    licence,
    features: features as never,
    chamaName,
    currency,
  });
}

let bootstrapped = false;

/** On app start: restore the stored session, if any. */
export async function bootstrapSession() {
  if (bootstrapped) return;
  bootstrapped = true;
  const stored = sessionStore.get();
  if (!stored || stored.refreshTokenExpiresAt <= Date.now()) {
    sessionStore.clear();
    useSession.getState().clear();
    return;
  }
  try {
    await loadContext();
  } catch (e) {
    const err = normaliseError(e);
    // Offline: keep the tokens for next time, but we can't show anything that needs the server.
    if (err.code !== 'NETWORK_ERROR') sessionStore.clear();
    useSession.getState().clear();
  }
}

/** Re-reads membership and permissions (on focus, after a 403, after role changes). Throttled. */
let lastMembershipRefresh = 0;
export async function refreshMembership(force = false) {
  const s = useSession.getState();
  if (s.status !== 'authenticated' || s.isPlatformAdmin) return;
  if (!force && Date.now() - lastMembershipRefresh < 15_000) return;
  lastMembershipRefresh = Date.now();
  try {
    const me = await membersApi.me();
    useSession.getState().setContext({ membership: me.membership, permissions: me.permissions });
  } catch {
    // The next request will surface any real problem.
  }
}

/** Re-reads the licence (after a LICENSE_EXPIRED / LICENSE_SUSPENDED anywhere). */
export async function refreshLicence() {
  try {
    const licence = await chamaApi.licence();
    useSession.getState().setContext({ licence, features: licence.features });
    return licence;
  } catch {
    return null;
  }
}

/** Signs in and loads the context. `chamaCode` null = platform administrator. */
export async function login(email: string, password: string, chamaCode: string | null, persistent: boolean) {
  const { data } = await authApi.login({ email: email.trim(), password }, chamaCode);
  queryClient.clear();
  sessionStore.save(data, chamaCode, chamaCode === null, persistent);
  try {
    await loadContext();
  } catch (e) {
    sessionStore.clear();
    useSession.getState().clear();
    throw e;
  }
  return useSession.getState();
}

/** Stores a token pair returned by password change. */
export function adoptTokens(auth: AuthResponse) {
  const s = sessionStore.get();
  sessionStore.save(auth, s?.chamaCode ?? null, s?.isPlatformAdmin ?? false);
}

/** Clears everything local. Always succeeds, even if the server call fails. */
function signOutLocally() {
  sessionStore.clear();
  useSession.getState().clear();
  queryClient.clear();
}

export async function logout() {
  const s = sessionStore.get();
  if (s) {
    try {
      await authApi.logout(s.refreshToken, s.chamaCode);
    } catch {
      // Signing out locally matters more than the server call.
    }
  }
  signOutLocally();
  return s?.chamaCode ?? null;
}

export async function logoutEverywhere() {
  const code = sessionStore.get()?.chamaCode ?? null;
  try {
    await authApi.logoutAll();
  } finally {
    signOutLocally();
  }
  return code;
}

export function loginPath(chamaCode?: string | null, extra?: Record<string, string>) {
  const p = new URLSearchParams();
  if (chamaCode) p.set('chama', chamaCode);
  for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
  const q = p.toString();
  return q ? `/login?${q}` : '/login';
}
