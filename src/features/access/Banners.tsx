'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, WifiOff, X } from 'lucide-react';
import { checkHealth } from '@/api/client';
import { queryClient } from '@/lib/queryClient';
import { usePermission } from '@/hooks/useSessionInfo';
import { todayNairobi, addDays, formatInstantDate } from '@/lib/format';
import { useConnectivity } from '@/stores/connectivity';
import { usePreferences } from '@/stores/preferences';
import { useSession } from '@/stores/session';

/** "Your licence expires in N days", for users who hold CHAMA_SETTINGS_MANAGE, when 14 days or fewer remain. Dismissible. */
export function LicenceBanner() {
  const licence = useSession((s) => s.licence);
  const canManage = usePermission('CHAMA_SETTINGS_MANAGE');
  const dismissed = usePreferences((s) => s.licenceBannerDismissed);
  const setPref = usePreferences((s) => s.set);
  if (!licence || licence.state !== 'ACTIVE' || licence.daysRemaining > 14 || !canManage) return null;
  if (dismissed && dismissed.key === licence.licenseKey && dismissed.until >= todayNairobi()) return null;
  const days = licence.daysRemaining;
  return (
    <div className="no-print flex items-center gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm">
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <p className="flex-1">
        Your licence expires {days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} ({formatInstantDate(licence.validUntil)}).{' '}
        <Link href="/settings/licence" className="font-medium underline underline-offset-2">See licence</Link>
      </p>
      <button
        type="button"
        onClick={() => setPref('licenceBannerDismissed', { key: licence.licenseKey, until: addDays(todayNairobi(), 1) })}
        className="rounded p-1 hover:bg-warning/20"
        aria-label="Dismiss for today"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Shown when requests fail with network errors; polls /actuator/health until the server answers again. */
export function ConnectivityBanner() {
  const unreachable = useConnectivity((s) => s.unreachable);
  const set = useConnectivity((s) => s.set);

  useEffect(() => {
    const offline = () => set(true);
    const online = () => void checkHealth().then((up) => set(!up));
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [set]);

  useEffect(() => {
    if (!unreachable) return;
    let delay = 5_000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (await checkHealth()) {
        set(false);
        void queryClient.invalidateQueries();
        return;
      }
      delay = Math.min(delay * 2, 60_000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [unreachable, set]);

  if (!unreachable) return null;
  return (
    <div role="status" className="no-print flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Can&apos;t reach the server. Check your connection; we&apos;ll keep trying.
    </div>
  );
}
