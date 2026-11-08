'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';
import { homePathFor, useSession } from '@/stores/session';

/** "/" redirects by session state. The approval email links here. */
export default function IndexPage() {
  const router = useRouter();
  const state = useSession();

  useEffect(() => {
    if (state.status === 'anonymous') router.replace('/login');
    if (state.status === 'authenticated') router.replace(homePathFor(state));
  }, [state, router]);

  return <LoadingState label="Opening ChamaBank…" className="min-h-screen" />;
}
