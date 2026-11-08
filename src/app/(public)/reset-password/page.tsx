'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError, type ApiError } from '@/api/errors';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Input } from '@/components/ui/primitives';
import { AuthLayout, PasswordRules } from '@/features/auth/AuthLayout';
import { passwordSchema } from '@/lib/schemas';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

/** Opened from the reset email, and from the set-password email imported members receive (README §7.1). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const chama = params.get('chama');
  const token = params.get('token') ?? '';
  const firstTime = params.get('set') !== null || params.get('welcome') !== null;
  const [error, setError] = useState<ApiError | null>(token ? null : normaliseError(new Error('This link is missing its token.')));
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });
  const q = chama ? `?chama=${encodeURIComponent(chama)}` : '';

  async function submit(v: Values) {
    setError(null);
    try {
      const res = await authApi.resetPassword({ token, newPassword: v.password }, chama);
      toast.success(res.message || 'Password saved. Sign in with your new password.');
      router.replace(chama ? `/login${q}` : '/admin/login');
    } catch (e) {
      const err = normaliseError(e);
      if (err.fieldErrors.newPassword) form.setError('password', { message: err.fieldErrors.newPassword });
      else setError(err);
    }
  }

  const invalid = error?.code === 'AUTH_LINK_INVALID' || !token;
  return (
    <AuthLayout
      title={firstTime ? 'Set your password' : 'Choose a new password'}
      description={firstTime ? 'Your chama moved its records here. Choose a password to sign in.' : undefined}
      footer={<Link href={`/login${q}`} className="font-medium text-primary hover:underline">Back to sign in</Link>}
    >
      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription>
            This link is invalid, already used or expired.{' '}
            <Link href={`/forgot-password${q}`} className="font-medium underline">Request a new one.</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <FormAlert error={error} />
          <Field label="New password" required error={form.formState.errors.password}><Input type="password" {...form.register('password')} autoComplete="new-password" /></Field>
          <PasswordRules value={form.watch('password')} />
          <Field label="Confirm password" required error={form.formState.errors.confirm}><Input type="password" {...form.register('confirm')} autoComplete="new-password" /></Field>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Save password</Button>
        </form>
      )}
    </AuthLayout>
  );
}
