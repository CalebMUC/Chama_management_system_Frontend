'use client';

import { Suspense, type ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingState } from '@/components/shared/States';
import { AuthGuard } from '@/features/auth/AuthGuard';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard area="platform">
      <AppShell area="platform"><Suspense fallback={<LoadingState />}>{children}</Suspense></AppShell>
    </AuthGuard>
  );
}
