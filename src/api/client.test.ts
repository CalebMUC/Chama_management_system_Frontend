import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse } from './types';

// A fake server behind both axios instances (they inherit axios.defaults.adapter when created).
type Route = (config: InternalAxiosRequestConfig) => { status: number; data: unknown };
let route: Route;
const calls: { url: string; headers: Record<string, unknown> }[] = [];
axios.defaults.adapter = async (config) => {
  calls.push({ url: config.url ?? '', headers: { ...(config.headers as object) } });
  await new Promise((r) => setTimeout(r, 5));
  const { status, data } = route(config);
  const response = { status, data, headers: {}, config, statusText: String(status) } as AxiosResponse;
  if (status >= 400) throw new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, response);
  return response;
};

const { api, publicApi, onSessionExpired } = await import('./client');
const { sessionStore } = await import('./session');

const tokens = (access: string, refresh: string, accessMs = 15 * 60_000): AuthResponse => ({
  accessToken: access,
  tokenType: 'Bearer',
  expiresIn: accessMs / 1000,
  accessTokenExpiresAt: new Date(Date.now() + accessMs).toISOString(),
  refreshToken: refresh,
  refreshTokenExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
});
const ok = (data: unknown) => ({ status: 200, data: { success: true, message: 'OK', data } });
const fail = (status: number, code: string) => ({ status, data: { success: false, message: code, error: { code } } });
const auth = (c: InternalAxiosRequestConfig) => String((c.headers as Record<string, unknown>).Authorization ?? '');

describe('API client (README §4)', () => {
  beforeEach(() => {
    calls.length = 0;
    sessionStore.clear();
  });

  it('refreshes exactly once for two simultaneous 401s and retries both (README §4.4)', async () => {
    sessionStore.save(tokens('old', 'r1'), 'mokica', false);
    let refreshes = 0;
    route = (c) => {
      if (c.url === '/auth/refresh') {
        refreshes++;
        return ok(tokens('new', 'r2'));
      }
      return auth(c) === 'Bearer new' ? ok({ url: c.url }) : fail(401, 'AUTH_INVALID_ACCESS_TOKEN');
    };
    const [a, b] = await Promise.all([api.get<{ url: string }>('/a'), api.get<{ url: string }>('/b')]);
    expect(a.url).toBe('/a');
    expect(b.url).toBe('/b');
    expect(refreshes).toBe(1);
    expect(sessionStore.get()?.refreshToken).toBe('r2');
  });

  it('sends the stored chama code on refresh and never a bearer token', async () => {
    sessionStore.save(tokens('old', 'r1', 10_000), 'mokica', false); // expires within a minute: proactive refresh
    route = (c) => (c.url === '/auth/refresh' ? ok(tokens('new', 'r2')) : ok(null));
    await api.get('/x');
    const refresh = calls.find((c) => c.url === '/auth/refresh')!;
    expect(refresh.headers['X-Chama-Code']).toBe('mokica');
    expect(refresh.headers.Authorization).toBeUndefined();
    expect(calls.find((c) => c.url === '/x')!.headers.Authorization).toBe('Bearer new');
  });

  it('ends the session when the refresh token is rejected', async () => {
    sessionStore.save(tokens('old', 'r1'), 'mokica', false);
    const expired = vi.fn();
    onSessionExpired(expired);
    route = (c) => (c.url === '/auth/refresh' ? fail(401, 'AUTH_INVALID_TOKEN') : fail(401, 'AUTH_INVALID_ACCESS_TOKEN'));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalled();
    expect(sessionStore.get()).toBeNull();
  });

  it('public auth calls send X-Chama-Code only for chama users and no Authorization', async () => {
    sessionStore.save(tokens('old', 'r1'), 'mokica', false);
    route = () => ok(null);
    await publicApi.post('/auth/login', {}, 'MoKiCa ');
    await publicApi.post('/auth/login', {}, null);
    expect(calls[0].headers['X-Chama-Code']).toBe('mokica');
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].headers['X-Chama-Code']).toBeUndefined();
  });

  it('returns the server message with mutation data', async () => {
    sessionStore.save(tokens('t', 'r'), 'mokica', false);
    route = () => ({ status: 200, data: { success: true, message: 'Approval recorded (1 of 2)', data: { id: 1 } } });
    await expect(api.post('/loans/1/approve')).resolves.toEqual({ data: { id: 1 }, message: 'Approval recorded (1 of 2)' });
  });
});
