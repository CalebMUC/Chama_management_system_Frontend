'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError, type ApiError } from '@/api/errors';
import { sessionStore } from '@/api/session';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/overlays';
import { Alert, AlertDescription, Input, Label } from '@/components/ui/primitives';
import { emailSchema } from '@/lib/schemas';
import { homePathFor, useSession } from '@/stores/session';
import { safeReturnTo } from './AuthGuard';
import { login, logout } from './sessionActions';

const schema = z.object({
  chamaCode: z.string().trim(),
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
  persistent: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Member sign-in (with chama code) or platform-admin sign-in (none). README §4.2. */
export function LoginForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const status = useSession((s) => s.status);
  const [error, setError] = useState<ApiError | null>(null);
  const [lockedFor, setLockedFor] = useState(0);
  const [resent, setResent] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema.refine((v) => admin || v.chamaCode.length > 0, { path: ['chamaCode'], message: 'Enter your chama code' })),
    defaultValues: { chamaCode: params.get('chama') ?? '', email: '', password: '', persistent: true },
  });

  // Prefill the last chama code used on this device (after mount: localStorage isn't available on the server).
  useEffect(() => {
    if (!admin && !form.getValues('chamaCode')) form.setValue('chamaCode', sessionStore.getLastChamaCode());
  }, [admin, form]);

  useEffect(() => {
    if (params.get('expired')) toast.info('Your session ended. Please sign in again.', { id: 'expired' });
  }, [params]);

  // Already signed in: go where the session belongs.
  useEffect(() => {
    if (status === 'authenticated') router.replace(safeReturnTo(params.get('returnTo')) ?? homePathFor(useSession.getState()));
  }, [status, router, params]);

  // Locked account countdown from retryAfterSeconds.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockedFor]);

  async function submit(values: Values) {
    setError(null);
    setResent(false);
    const code = admin ? null : values.chamaCode.trim().toLowerCase();
    try {
      const s = await login(values.email, values.password, code, values.persistent);
      if (admin && !s.isPlatformAdmin) {
        await logout();
        setError(normaliseError(new Error('This sign-in is for platform administrators. Members sign in with their chama code.')));
        return;
      }
      if (!admin && s.isPlatformAdmin) {
        router.replace('/platform');
        return;
      }
      const returnTo = safeReturnTo(params.get('returnTo'));
      router.replace(returnTo && homePathFor(s) === '/home' ? returnTo : homePathFor(s));
    } catch (e) {
      const err = normaliseError(e);
      if (err.code === 'TENANT_NOT_FOUND') {
        form.setError('chamaCode', { message: err.message || 'No chama has that code.' }, { shouldFocus: true });
        return;
      }
      if (err.code === 'AUTH_INVALID_CREDENTIALS') {
        setError(normaliseError(new Error('Invalid email or password.')));
        return;
      }
      if (err.code === 'AUTH_ACCOUNT_LOCKED') setLockedFor(err.retryAfterSeconds ?? 0);
      setError(err);
    }
  }

  async function resendVerification() {
    const code = admin ? null : form.getValues('chamaCode').trim().toLowerCase();
    try {
      const res = await authApi.resendVerification(form.getValues('email').trim(), code);
      setResent(true);
      toast.success(res.message || 'Verification email sent.');
    } catch (e) {
      toast.error(normaliseError(e).message);
    }
  }

  const errors = form.formState.errors;
  const chama = form.watch('chamaCode');
  const mins = Math.floor(lockedFor / 60);
  const secs = String(lockedFor % 60).padStart(2, '0');
  const forgotHref = `/forgot-password${chama ? `?chama=${encodeURIComponent(chama.trim().toLowerCase())}` : ''}`;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
      {error && error.code === 'AUTH_ACCOUNT_LOCKED' ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{error.message}</p>
            {lockedFor > 0 && <p className="mt-1 font-medium tabular">Try again in {mins}:{secs}</p>}
            <Link href={forgotHref} className="mt-1 inline-block underline">Forgot password?</Link>
          </AlertDescription>
        </Alert>
      ) : error && error.code === 'AUTH_EMAIL_NOT_VERIFIED' ? (
        <Alert variant="warning">
          <AlertDescription>
            <p>{error.message}</p>
            {resent ? <p className="mt-1">Check your inbox for the new link.</p> : (
              <button type="button" onClick={resendVerification} className="mt-1 font-medium underline">Resend verification email</button>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <FormAlert error={error} />
      )}

      {!admin && (
        <Field label="Chama code" required error={errors.chamaCode} hint="Your chama's short code, e.g. mokica">
          <Input {...form.register('chamaCode')} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="organization" />
        </Field>
      )}
      <Field label="Email" required error={errors.email}>
        <Input type="email" {...form.register('email')} autoComplete="username" />
      </Field>
      <Field label="Password" required error={errors.password}>
        <Input type="password" {...form.register('password')} autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox id="persistent" checked={form.watch('persistent')} onCheckedChange={(v) => form.setValue('persistent', v === true)} />
          <Label htmlFor="persistent" className="font-normal">Keep me signed in</Label>
        </div>
        {!admin && <Link href={forgotHref} className="text-sm font-medium text-primary hover:underline">Forgot password?</Link>}
      </div>
      <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting} disabled={lockedFor > 0}>Sign in</Button>
    </form>
  );
}
