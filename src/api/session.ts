import type { AuthResponse } from './types';

/**
 * The stored session (README §4.1). The backend has no cookie session, so the refresh token must be readable by JS: it lives in
 * localStorage, or sessionStorage when "Keep me signed in" is off. The chama code is stored with it because refresh and logout
 * must send it as X-Chama-Code.
 */
export interface StoredSession {
  accessToken: string;
  /** Epoch ms. */
  accessTokenExpiresAt: number;
  refreshToken: string;
  refreshTokenExpiresAt: number;
  /** null for platform administrators. */
  chamaCode: string | null;
  isPlatformAdmin: boolean;
}

const KEY = 'chama.session';
const LAST_CHAMA_KEY = 'chama.lastChamaCode';
const CHANNEL = 'chama-session';

type Listener = (session: StoredSession | null) => void;

const browser = typeof window !== 'undefined';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function read(): StoredSession | null {
  if (!browser) return null;
  return safe(() => {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  }, null);
}

let current: StoredSession | null = read();
const listeners = new Set<Listener>();
const channel: BroadcastChannel | null = browser && 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;

function emit() {
  listeners.forEach((l) => l(current));
}

// Another tab logged in, refreshed or logged out: adopt its tokens (or its logout).
channel?.addEventListener('message', () => {
  current = read();
  emit();
});

export const sessionStore = {
  get(): StoredSession | null {
    return current;
  },
  /** Re-reads storage: another tab may have refreshed while we waited for the lock. */
  reload(): StoredSession | null {
    current = read();
    return current;
  },
  isPersistent(): boolean {
    return safe(() => localStorage.getItem(KEY) !== null, true);
  },
  save(auth: AuthResponse, chamaCode: string | null, isPlatformAdmin: boolean, persistentArg?: boolean) {
    const persistent = persistentArg ?? sessionStore.isPersistent();
    current = {
      accessToken: auth.accessToken,
      accessTokenExpiresAt: Date.parse(auth.accessTokenExpiresAt),
      refreshToken: auth.refreshToken,
      refreshTokenExpiresAt: Date.parse(auth.refreshTokenExpiresAt),
      chamaCode: chamaCode ? chamaCode.toLowerCase() : null,
      isPlatformAdmin,
    };
    safe(() => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      (persistent ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(current));
    }, undefined);
    if (chamaCode) this.setLastChamaCode(chamaCode);
    channel?.postMessage('changed');
  },
  clear() {
    const had = current !== null;
    current = null;
    safe(() => {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    }, undefined);
    if (had) channel?.postMessage('cleared');
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The chama code last used on this device, to prefill the sign-in form. */
  getLastChamaCode(): string {
    return browser ? safe(() => localStorage.getItem(LAST_CHAMA_KEY) ?? '', '') : '';
  },
  setLastChamaCode(code: string) {
    safe(() => localStorage.setItem(LAST_CHAMA_KEY, code.trim().toLowerCase()), undefined);
  },
};
