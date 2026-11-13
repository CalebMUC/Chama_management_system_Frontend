'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';
import { homePathFor, licenceUsable, useSession, type RoutingState } from '@/stores/session';

/**
 * Areas:
 *  - chama:    the member/official app. ACTIVE membership and a usable licence (except /profile, reachable while blocked).
 *  - status:   /pending, /membership-status, /licence-blocked, /change-password: any signed-in chama user.
 *  - platform: platform administrators only.
 */
export type GuardArea = 'chama' | 'status' | 'platform';

export function guardRedirect(s: RoutingState, area: GuardArea, pathname: string): string | null {
  const home = homePathFor(s);
  if (s.user?.mustChangePassword) return home === pathname ? null : home;
  if (area === 'platform') return s.isPlatformAdmin ? null : home;
  if (s.isPlatformAdmin) return '/platform';
  if (area === 'status') return home === pathname || pathname === '/profile' ? null : home;
  // chama area
  if (s.membership?.status !== 'ACTIVE') return home;
  if (!licenceUsable(s.licence) && pathname !== '/profile') return '/licence-blocked';
  return null;
}

/** Same-origin paths only, so returnTo can't send the user off-site. */
export function safeReturnTo(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : null;
}

export function AuthGuard({ children, area }: { children: ReactNode; area: GuardArea }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSession((s) => s.status);
  const isPlatformAdmin = useSession((s) => s.isPlatformAdmin);
  const membership = useSession((s) => s.membership);
  const licence = useSession((s) => s.licence);
  const user = useSession((s) => s.user);
  const redirect = status === 'authenticated' ? guardRedirect({ status, isPlatformAdmin, membership, licence, user }, area, pathname) : null;

  useEffect(() => {
    if (status === 'anonymous') router.replace(area === 'platform' ? '/admin/login' : `/login?returnTo=${encodeURIComponent(pathname)}`);
    else if (redirect) router.replace(redirect);
  }, [status, redirect, pathname, router, area]);

  if (status !== 'authenticated' || redirect) return <LoadingState className="min-h-screen" />;
  return <>{children}</>;
}
