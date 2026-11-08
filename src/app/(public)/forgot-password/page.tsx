'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError } from '@/api/errors';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { emailSchema } from '@/lib/schemas';

const schema = z.object({ chamaCode: z.string().trim(), email: emailSchema });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const params = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { chamaCode: params.get('chama') ?? '', email: '' } });
  const code = form.watch('chamaCode').trim().toLowerCase();

  async function submit(v: Values) {
    setError(null);
    try {
      await authApi.forgotPassword(v.email.trim(), v.chamaCode.trim().toLowerCase() || null);
      setDone(true);
    } catch (e) {
      const err = normaliseError(e);
      // Always neutral, except when the request never got through.
      if (err.code === 'NETWORK_ERROR' || err.status === 429) setError(err);
      else setDone(true);
    }
  }

  const loginHref = `/login${code ? `?chama=${encodeURIComponent(code)}` : ''}`;
  return (
    <AuthLayout title="Reset your password" description="We'll email you a link to choose a new password." footer={<Link href={loginHref} className="font-medium text-primary hover:underline">Back to sign in</Link>}>
      {done ? (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <MailCheck className="mt-0.5 size-5 text-primary" />
          <p className="text-sm">If an account exists for that email, a reset link is on its way.</p>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <FormAlert error={error} />
          <Field label="Chama code" error={form.formState.errors.chamaCode} hint="Leave empty if you're a platform administrator">
            <Input {...form.register('chamaCode')} autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field label="Email" required error={form.formState.errors.email}><Input type="email" {...form.register('email')} autoComplete="email" /></Field>
          <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
