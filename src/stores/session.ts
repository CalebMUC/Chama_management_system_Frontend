import { create } from 'zustand';
import type { ChamaPermission, ChamaResponse, LicenseFeature, LicenseView, MemberView, UserResponse } from '@/api/types';

export type SessionStatus = 'booting' | 'anonymous' | 'authenticated';

/**
 * The app context (README §5): who is signed in, their membership and effective permissions, the chama and its licence.
 * Tokens are not here: they live in `sessionStore` (api/session.ts).
 */
export interface SessionState {
  status: SessionStatus;
  user: UserResponse | null;
  isPlatformAdmin: boolean;
  /** null for platform administrators. */
  membership: MemberView | null;
  permissions: ChamaPermission[];
  chama: ChamaResponse | null;
  /** null when it could not be read (no CHAMA_VIEW): treated as active. */
  licence: LicenseView | null;
  features: LicenseFeature[];
  chamaName: string | null;
  currency: string;

  setContext(ctx: Partial<Omit<SessionState, 'setContext' | 'clear' | 'status'>> & { status?: SessionStatus }): void;
  clear(): void;
}

const empty = {
  user: null,
  isPlatformAdmin: false,
  membership: null,
  permissions: [] as ChamaPermission[],
  chama: null,
  licence: null,
  features: [] as LicenseFeature[],
  chamaName: null,
  currency: 'KES',
};

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  ...empty,
  setContext: (ctx) => set((s) => ({ ...s, ...ctx })),
  clear: () => set({ status: 'anonymous', ...empty }),
}));

export const licenceUsable = (licence: LicenseView | null) => !licence || licence.state === 'ACTIVE';

/** What routing needs from the session. `user` is optional so callers without it route as before. */
export type RoutingState = Pick<SessionState, 'status' | 'isPlatformAdmin' | 'membership' | 'licence'> & { user?: Pick<UserResponse, 'mustChangePassword'> | null };

/** Where a signed-in user belongs (README §5 start-up flow). */
export function homePathFor(s: RoutingState): string {
  if (s.status !== 'authenticated') return '/login';
  // A temporary password set by an official: the API refuses everything else until it is replaced.
  if (s.user?.mustChangePassword) return '/change-password';
  if (s.isPlatformAdmin) return '/platform';
  const status = s.membership?.status;
  if (status === 'PENDING_APPROVAL') return '/pending';
  if (status !== 'ACTIVE') return '/membership-status';
  if (!licenceUsable(s.licence)) return '/licence-blocked';
  return '/home';
}
