'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/overlays';
import { env } from '@/config/env';
import { loginPath, logout } from './sessionActions';

const WARNING_SECONDS = 60;
const ACTIVITY_KEY = 'chama.lastActivity';
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

/** Minutes from NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES; 0 (unset or invalid) turns the timeout off. */
export function idleTimeoutMinutes(raw: string | undefined = env.idleTimeoutMinutes): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Last activity across tabs: each tab writes it (throttled) and reads the newest. */
function readShared(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}
function writeShared(t: number) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(t));
  } catch {
    /* storage blocked: this tab's own timer still works */
  }
}

/**
 * Banking hygiene: after the configured idle time, a countdown ("Your session will end in 60s") with Stay signed in and Sign
 * out. When it runs out the user is signed out through the normal logout flow. Activity in any tab counts.
 */
export function IdleTimeout({ area }: { area: 'chama' | 'platform' }) {
  const minutes = idleTimeoutMinutes();
  const [remaining, setRemaining] = useState<number | null>(null);
  const last = useRef(Date.now());
  const lastWrite = useRef(0);
  const signingOut = useRef(false);

  const signOut = useCallback(async (expired: boolean) => {
    if (signingOut.current) return;
    signingOut.current = true;
    const code = await logout();
    window.location.assign(area === 'platform' ? `/admin/login${expired ? '?expired=1' : ''}` : loginPath(code, expired ? { expired: '1' } : undefined));
  }, [area]);

  const stay = useCallback(() => {
    last.current = Date.now();
    writeShared(last.current);
    setRemaining(null);
  }, []);

  useEffect(() => {
    if (!minutes) return;
    const limit = minutes * 60_000;
    const onActivity = () => {
      // While the warning is up, only the buttons count: a stray mouse move shouldn't dismiss it.
      if (remainingRef.current !== null) return;
      const now = Date.now();
      last.current = now;
      if (now - lastWrite.current > 10_000) {
        lastWrite.current = now;
        writeShared(now);
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const tick = window.setInterval(() => {
      const newest = Math.max(last.current, readShared());
      const idle = Date.now() - newest;
      if (idle >= limit + WARNING_SECONDS * 1000) {
        void signOut(true);
      } else if (idle >= limit) {
        setRemaining(Math.ceil((limit + WARNING_SECONDS * 1000 - idle) / 1000));
      } else if (remainingRef.current !== null) {
        // Another tab saw activity: close the warning here too.
        last.current = newest;
        setRemaining(null);
      }
    }, 1000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(tick);
    };
  }, [minutes, signOut]);

  const remainingRef = useRef<number | null>(null);
  remainingRef.current = remaining;

  if (!minutes) return null;
  return (
    <AlertDialog open={remaining !== null}>
      <AlertDialogContent onEscapeKeyDown={(e) => { e.preventDefault(); stay(); }}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-text" aria-hidden><Clock className="size-5" /></span>
          <div className="space-y-1">
            <AlertDialogTitle className="text-base font-semibold">Are you still there?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              For your security, your session will end in <span className="font-semibold text-foreground tabular" aria-live="polite">{remaining ?? WARNING_SECONDS}s</span> because
              there has been no activity for {minutes} minute{minutes === 1 ? '' : 's'}.
            </AlertDialogDescription>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void signOut(false)}>Sign out</Button>
          <Button onClick={stay} autoFocus>Stay signed in</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
