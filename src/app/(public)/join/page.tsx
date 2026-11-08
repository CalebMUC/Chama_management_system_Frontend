'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingState } from '@/components/shared/States';

/** The invitation email links here; joining happens on the register page. */
export default function JoinPage() {
  const router = useRouter();
  const chama = useSearchParams().get('chama');
  useEffect(() => {
    router.replace(chama ? `/register?chama=${encodeURIComponent(chama)}` : '/register');
  }, [chama, router]);
  return <LoadingState className="min-h-screen" />;
}
