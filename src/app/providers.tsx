'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/overlays';
import { onAccessDenied, onLicenceBlocked, onNetworkError, onPasswordChangeRequired, onSessionExpired } from '@/api/client';
import { sessionStore } from '@/api/session';
import { bootstrapSession, loginPath, refreshLicence, refreshMembership } from '@/features/auth/sessionActions';
import { queryClient } from '@/lib/queryClient';
import { useConnectivity } from '@/stores/connectivity';
import { applyDensity, applyTheme, usePreferences } from '@/stores/preferences';
import { useSession } from '@/stores/session';

/** Routes reachable without a session: an expired session there is not an event. */
const PUBLIC = ['/login', '/admin/login', '/register', '/join', '/verify-email', '/forgot-password', '/reset-password'];
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const theme = usePreferences((s) => s.theme);
  const density = usePreferences((s) => s.density);

  useEffect(() => applyDensity(density), [density]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  useEffect(() => {
    const endSession = () => {
      const s = useSession.getState();
      const code = s.user?.chamaCode ?? sessionStore.getLastChamaCode();
      const wasAdmin = s.isPlatformAdmin;
      s.clear();
      queryClient.clear();
      const here = window.location.pathname;
      if (isPublic(here)) return;
      window.location.assign(wasAdmin ? '/admin/login?expired=1' : loginPath(code, { expired: '1', returnTo: here }));
    };
    onSessionExpired(endSession);
    // Another tab signed out (or this session was revoked there): follow it.
    const unsubscribe = sessionStore.subscribe((session) => {
      if (!session && useSession.getState().status === 'authenticated') endSession();
    });
    // LICENSE_EXPIRED / LICENSE_SUSPENDED anywhere: re-read the licence and show the blocked screen.
    onLicenceBlocked(() => {
      void refreshLicence().then(() => {
        if (!window.location.pathname.startsWith('/licence-blocked')) router.replace('/licence-blocked');
      });
    });
    // ACCESS_DENIED: permissions may have changed (role change, suspension). Re-read them.
    onAccessDenied(() => void refreshMembership(true));
    // The account still has an official's temporary password (e.g. a session from before it was flagged).
    onPasswordChangeRequired(() => {
      const user = useSession.getState().user;
      if (user && !user.mustChangePassword) useSession.getState().setContext({ user: { ...user, mustChangePassword: true } });
      if (!window.location.pathname.startsWith('/change-password')) router.replace('/change-password');
    });
    onNetworkError(() => useConnectivity.getState().set(true));
    const onFocus = () => void refreshMembership();
    window.addEventListener('focus', onFocus);
    // Strict mode runs effects twice; bootstrapSession guards itself so refresh tokens are spent once.
    void bootstrapSession();
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
