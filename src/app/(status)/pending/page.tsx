'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Hourglass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusFrame } from '@/features/access/StatusFrame';
import { loadContext } from '@/features/auth/sessionActions';
import { formatInstantDate } from '@/lib/format';
import { homePathFor, useSession } from '@/stores/session';

/** README §7.2: waiting for an official to approve the application. Polls every 60 s while visible. */
export default function PendingPage() {
  const router = useRouter();
  const isNew = useSearchParams().get('new') !== null;
  const membership = useSession((s) => s.membership);
  const user = useSession((s) => s.user);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      await loadContext();
      const next = homePathFor(useSession.getState());
      if (next !== '/pending') router.replace(next);
    } catch {
      // Keep waiting; the next check may succeed.
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <StatusFrame icon={<Hourglass />} title="Waiting for approval" actions={<Button onClick={check} loading={checking}><RefreshCw />Check again</Button>}>
      <p>
        Your application to join <span className="font-medium text-foreground">{user?.chamaCode ?? 'the chama'}</span> is waiting for an official to approve it.
        {membership?.appliedAt && <> You applied on {formatInstantDate(membership.appliedAt)}.</>}
      </p>
      {isNew && !user?.emailVerified && <p>We&apos;ve emailed you a link to verify your address.</p>}
      <p>This page checks again every minute.</p>
    </StatusFrame>
  );
}
