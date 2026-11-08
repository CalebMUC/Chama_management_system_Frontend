'use client';

import { Suspense, type ReactNode } from 'react';
import { LoadingState } from '@/components/shared/States';
import { AuthGuard } from '@/features/auth/AuthGuard';

export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard area="status">
      <Suspense fallback={<LoadingState className="min-h-screen" />}>{children}</Suspense>
    </AuthGuard>
  );
}
