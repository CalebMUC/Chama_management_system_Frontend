'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError } from '@/api/errors';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Input } from '@/components/ui/primitives';
import { AuthLayout, PasswordRules } from '@/features/auth/AuthLayout';
import { login } from '@/features/auth/sessionActions';
import { applyApiErrors } from '@/lib/forms';
import { emailSchema, passwordSchema, phoneSchema, requiredText } from '@/lib/schemas';

const schema = z
  .object({
    chamaCode: requiredText(30, 'Enter the chama code'),
    firstName: requiredText(100, 'Enter your first name'),
    lastName: requiredText(100, 'Enter your last name'),
    email: emailSchema,
    phoneNumber: phoneSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: "Passwords don't match" });
type Values = z.infer<typeof schema>;

/** Join a chama (README §7.1): register, sign in, then wait for approval. */
export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [messages, setMessages] = useState<string[]>([]);
  const [exists, setExists] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { chamaCode: params.get('chama') ?? '', firstName: '', lastName: '', email: '', phoneNumber: '', password: '', confirm: '' },
  });
  const errors = form.formState.errors;
  const code = form.watch('chamaCode').trim().toLowerCase();

  async function submit(v: Values) {
    setMessages([]);
    setExists(false);
    const chamaCode = v.chamaCode.trim().toLowerCase();
    try {
      await authApi.register({ email: v.email.trim(), phoneNumber: v.phoneNumber.replace(/[\s-]/g, ''), password: v.password, firstName: v.firstName.trim(), lastName: v.lastName.trim() }, chamaCode);
    } catch (e) {
      const err = normaliseError(e);
      if (err.code === 'AUTH_USER_ALREADY_EXISTS') return setExists(true);
      if (err.code === 'TENANT_NOT_FOUND') return form.setError('chamaCode', { message: err.message || 'No chama has that code.' }, { shouldFocus: true });
      const unmatched = applyApiErrors(form, e);
      setMessages(unmatched.length ? unmatched : err.hasFieldErrors() ? [] : [err.message]);
      return;
    }
    try {
      await login(v.email, v.password, chamaCode, true);
      router.replace('/pending?new=1');
    } catch {
      router.replace(`/login?chama=${encodeURIComponent(chamaCode)}`);
    }
  }

  return (
    <AuthLayout
      title="Join your chama"
      eyebrow="New member registration"
      description="Your officials approve your application before you can use the chama."
      footer={<p>Already a member? <Link href={`/login${code ? `?chama=${encodeURIComponent(code)}` : ''}`} className="font-medium text-primary hover:underline">Sign in</Link></p>}
    >
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
        {exists && (
          <Alert variant="warning">
            <AlertDescription>
              This email already has an account in this chama.{' '}
              <Link href={`/login?chama=${encodeURIComponent(code)}`} className="font-medium underline">Sign in instead.</Link>
            </AlertDescription>
          </Alert>
        )}
        <FormAlert messages={messages} />
        <Field label="Chama code" required error={errors.chamaCode}>
          <Input {...form.register('chamaCode')} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={errors.firstName}><Input {...form.register('firstName')} autoComplete="given-name" maxLength={100} /></Field>
          <Field label="Last name" required error={errors.lastName}><Input {...form.register('lastName')} autoComplete="family-name" maxLength={100} /></Field>
        </div>
        <Field label="Email" required error={errors.email}><Input type="email" {...form.register('email')} autoComplete="email" maxLength={255} /></Field>
        <Field label="Phone number" required error={errors.phoneNumber} hint="e.g. 0712 345 678">
          <Input type="tel" {...form.register('phoneNumber')} autoComplete="tel" maxLength={20} />
        </Field>
        <Field label="Password" required error={errors.password}><Input type="password" {...form.register('password')} autoComplete="new-password" /></Field>
        <PasswordRules value={form.watch('password')} />
        <Field label="Confirm password" required error={errors.confirm}><Input type="password" {...form.register('confirm')} autoComplete="new-password" /></Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>Send application</Button>
      </form>
    </AuthLayout>
  );
}
