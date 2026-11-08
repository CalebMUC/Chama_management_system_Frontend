'use client';

import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/shared/States';
import { AuthGuard } from '@/features/auth/AuthGuard';

export default function ChamaLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard area="chama">
      {/* Pages read filters from the query string through useSearchParams, which needs a Suspense boundary above them. */}
      <AppShell area="chama"><Suspense fallback={<LoadingState />}>{children}</Suspense></AppShell>
    </AuthGuard>
  );
}
