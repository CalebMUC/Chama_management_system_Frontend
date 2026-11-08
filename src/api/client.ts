import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { ApiError, normaliseError } from './errors';
import { sessionStore } from './session';
import type { ApiSuccess, AuthResponse, PageMeta } from './types';

/**
 * The API client (README §3–4). Two axios instances:
 *  - `bare`: public auth endpoints. Never carries Authorization (an expired token there makes the server answer 401); carries
 *    X-Chama-Code for chama users.
 *  - `http`: everything else. Bearer token, refreshed proactively a minute before expiry and reactively on a 401.
 */
const baseConfig = { baseURL: env.apiBaseUrl, headers: { Accept: 'application/json' } };
const bare = axios.create(baseConfig);
export const http = axios.create(baseConfig);

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** A paged list: the items plus the server's paging. */
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

/** A mutation's payload and the server's user-facing message ("Approval recorded (1 of 2)"), which the UI toasts. */
export interface Result<T> {
  data: T;
  message: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// Global handlers (registered once by the app)
// ---------------------------------------------------------------------------------------------------------------------

type Handlers = {
  sessionExpired?: () => void;
  licenceBlocked?: (error: ApiError) => void;
  accessDenied?: (error: ApiError) => void;
  networkError?: () => void;
};
const handlers: Handlers = {};

/** A request failed to reach the server: the app shows the connectivity banner and polls /actuator/health. */
export function onNetworkError(fn: () => void) {
  handlers.networkError = fn;
}

export function onSessionExpired(fn: () => void) {
  handlers.sessionExpired = fn;
}
export function onLicenceBlocked(fn: (error: ApiError) => void) {
  handlers.licenceBlocked = fn;
}
export function onAccessDenied(fn: (error: ApiError) => void) {
  handlers.accessDenied = fn;
}

// ---------------------------------------------------------------------------------------------------------------------
// Refresh: single-flight per tab, locked across tabs (README §4.4)
// ---------------------------------------------------------------------------------------------------------------------

let inFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const before = sessionStore.get();
  const latest = sessionStore.reload();
  if (!latest) return false;
  // Another tab refreshed while we waited for the lock: adopt its tokens instead of spending the rotated refresh token.
  if (latest.accessToken !== before?.accessToken && latest.accessTokenExpiresAt - Date.now() > 30_000) return true;
  if (latest.refreshTokenExpiresAt <= Date.now()) {
    sessionStore.clear();
    return false;
  }
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (latest.chamaCode) headers['X-Chama-Code'] = latest.chamaCode;
    const res = await bare.post<ApiSuccess<AuthResponse>>('/auth/refresh', { refreshToken: latest.refreshToken }, { headers });
    sessionStore.save(res.data.data, latest.chamaCode, latest.isPlatformAdmin);
    return true;
  } catch (error) {
    const apiError = normaliseError(error);
    // A network failure is not a rejected session: keep it and let the user retry.
    if (apiError.code === 'NETWORK_ERROR') throw apiError;
    sessionStore.clear();
    return false;
  }
}

/** Exchanges the refresh token for a new pair. Resolves false when the session is over. */
export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  const run = () => doRefresh();
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  inFlight = (locks ? locks.request('chama-session-refresh', run) : run()).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** The access token, refreshed first if it expires within a minute. */
async function freshAccessToken(): Promise<string | null> {
  const s = sessionStore.get();
  if (!s) return null;
  if (s.accessTokenExpiresAt - Date.now() < 60_000) {
    const ok = await refreshSession().catch(() => true);
    if (!ok) {
      handlers.sessionExpired?.();
      return null;
    }
  }
  return sessionStore.get()?.accessToken ?? null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------------------------------------------------

http.interceptors.request.use(async (config) => {
  const token = await freshAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    // AUTH_INVALID_ACCESS_TOKEN / UNAUTHENTICATED: refresh once, then retry.
    if (status === 401 && config && !config._retried && sessionStore.get()) {
      config._retried = true;
      let ok = false;
      try {
        ok = await refreshSession();
      } catch (e) {
        throw normaliseError(e);
      }
      if (ok) {
        config.headers.set('Authorization', `Bearer ${sessionStore.get()?.accessToken}`);
        return http.request(config);
      }
      handlers.sessionExpired?.();
    }
    const apiError = normaliseError(error);
    if (apiError.code === 'LICENSE_EXPIRED' || apiError.code === 'LICENSE_SUSPENDED') handlers.licenceBlocked?.(apiError);
    else if (apiError.code === 'ACCESS_DENIED') handlers.accessDenied?.(apiError);
    else if (apiError.code === 'NETWORK_ERROR') handlers.networkError?.();
    throw apiError;
  },
);

// ---------------------------------------------------------------------------------------------------------------------
// Envelope helpers: the only place { success, message, data, meta } is unwrapped.
// ---------------------------------------------------------------------------------------------------------------------

type Params = object | undefined;

/** Drops undefined, null and empty values so they are not sent as query parameters. */
function clean(params: Params): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

function body<T>(res: { data: ApiSuccess<T> }): ApiSuccess<T> {
  if (!res.data || typeof res.data !== 'object' || res.data.success !== true) {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection and try again.");
  }
  return res.data;
}

const emptyMeta = (n: number): PageMeta => ({ page: 0, size: n, totalElements: n, totalPages: 1, hasNext: false, hasPrevious: false });

export const api = {
  async get<T>(url: string, params?: Params, config?: AxiosRequestConfig): Promise<T> {
    return body(await http.get<ApiSuccess<T>>(url, { ...config, params: clean(params) })).data;
  },
  async getPaged<T>(url: string, params?: Params): Promise<Paged<T>> {
    const b = body(await http.get<ApiSuccess<T[]>>(url, { params: clean(params) }));
    return { items: b.data ?? [], meta: b.meta ?? emptyMeta(b.data?.length ?? 0) };
  },
  /** GET that also returns the message (e.g. "Opening balances have not been imported yet" with data null). */
  async getResult<T>(url: string, params?: Params): Promise<Result<T>> {
    const b = body(await http.get<ApiSuccess<T>>(url, { params: clean(params) }));
    return { data: b.data, message: b.message };
  },
  async post<T = null>(url: string, payload?: unknown): Promise<Result<T>> {
    const b = body(await http.post<ApiSuccess<T>>(url, payload ?? null, payload === undefined ? undefined : { headers: { 'Content-Type': 'application/json' } }));
    return { data: b.data, message: b.message };
  },
  async put<T>(url: string, payload: unknown): Promise<Result<T>> {
    const b = body(await http.put<ApiSuccess<T>>(url, payload, { headers: { 'Content-Type': 'application/json' } }));
    return { data: b.data, message: b.message };
  },
  /** multipart/form-data: the browser sets the boundary, so no Content-Type header here. */
  async postForm<T>(url: string, form: FormData): Promise<Result<T>> {
    const b = body(await http.post<ApiSuccess<T>>(url, form));
    return { data: b.data, message: b.message };
  },
  /** A binary download (the .xlsx template): not wrapped in the envelope. */
  async download(url: string, fallbackName: string): Promise<void> {
    const res = await http.get<Blob>(url, { responseType: 'blob', headers: { Accept: '*/*' } });
    const disposition = String(res.headers['content-disposition'] ?? '');
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  },
};

/**
 * Public auth endpoints: no bearer, X-Chama-Code when given. `chamaCode` undefined = the stored session's code; null = none
 * (platform administrators).
 */
export const publicApi = {
  async post<T = null>(url: string, payload: unknown, chamaCode?: string | null): Promise<Result<T>> {
    const code = chamaCode !== undefined ? chamaCode : sessionStore.get()?.chamaCode ?? null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (code) headers['X-Chama-Code'] = code.trim().toLowerCase();
    try {
      const b = body(await bare.post<ApiSuccess<T>>(url, payload, { headers }));
      return { data: b.data, message: b.message };
    } catch (error) {
      throw normaliseError(error);
    }
  },
};

/** GET /actuator/health, for the "server unreachable" banner. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await axios.get('/actuator/health', { timeout: 5000 });
    return res.data?.status === 'UP';
  } catch {
    return false;
  }
}
