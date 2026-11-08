import { Suspense, type ReactNode } from 'react';
import { LoadingState } from '@/components/shared/States';

/** Public pages read the query string (chama, token, returnTo), which needs a Suspense boundary. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState className="min-h-screen" />}>{children}</Suspense>;
}
