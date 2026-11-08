'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError, type ApiError } from '@/api/errors';
import { LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useSession } from '@/stores/session';

// The token works once: React strict mode mounts twice in development, so remember which tokens were already sent.
const sent = new Map<string, Promise<unknown>>();

/** Opened from the verification email (README §7.1). */
export default function VerifyEmailPage() {
  const params = useSearchParams();
  const chama = params.get('chama');
  const token = params.get('token') ?? '';
  const signedIn = useSession((s) => s.status === 'authenticated');
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const [error, setError] = useState<ApiError | null>(null);
  const [email, setEmail] = useState('');
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent'>('idle');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!token) return;
    if (!sent.has(token)) sent.set(token, authApi.verifyEmail(token, chama));
    sent.get(token)!.then(
      () => mounted.current && setState('done'),
      (e) => { if (mounted.current) { setError(normaliseError(e)); setState('failed'); } },
    );
    return () => { mounted.current = false; };
  }, [token, chama]);

  async function resendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setResend('sending');
    try {
      await authApi.resendVerification(email.trim(), chama);
    } finally {
      // The server answers neutrally whether or not the account exists.
      setResend('sent');
    }
  }

  const continueHref = signedIn ? '/' : `/login${chama ? `?chama=${encodeURIComponent(chama)}` : ''}`;

  if (state === 'working') return <AuthLayout title="Verifying your email"><LoadingState label="Checking your link…" /></AuthLayout>;

  if (state === 'done') {
    return (
      <AuthLayout title="Email verified">
        <div className="flex items-start gap-3 rounded-lg border border-success/40 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 size-5 text-success" />
          <p className="text-sm">Thanks. Your email address is confirmed.</p>
        </div>
        <Button asChild className="w-full" size="lg"><Link href={continueHref}>Continue</Link></Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="This link didn't work">
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <XCircle className="mt-0.5 size-5 text-destructive" />
        <p className="text-sm">{error?.code === 'AUTH_LINK_INVALID' || !token ? 'The verification link is invalid, already used or expired.' : error?.message}</p>
      </div>
      {resend === 'sent' ? (
        <p className="text-sm text-muted-foreground">If an account exists for that email, a new link is on its way.</p>
      ) : (
        <form onSubmit={resendLink} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="resend-email">Send a new link to</Label>
            <Input id="resend-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <Button type="submit" className="w-full" loading={resend === 'sending'}>Send a new link</Button>
        </form>
      )}
      <Link href={continueHref} className="block text-center text-sm font-medium text-primary hover:underline">Back to sign in</Link>
    </AuthLayout>
  );
}
