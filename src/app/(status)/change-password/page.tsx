'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError } from '@/api/errors';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { StatusFrame } from '@/features/access/StatusFrame';
import { PasswordRules } from '@/features/auth/AuthLayout';
import { adoptTokens, loadContext } from '@/features/auth/sessionActions';
import { passwordSchema } from '@/lib/schemas';
import { homePathFor, useSession } from '@/stores/session';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter the temporary password'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password from the temporary one' });
type Values = z.infer<typeof schema>;

/**
 * First sign-in of a member an official added (POST /members): the account has a temporary password, and the API
 * answers AUTH_PASSWORD_CHANGE_REQUIRED to everything until the member chooses their own.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  async function submit(v: Values) {
    setError(null);
    try {
      const res = await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      adoptTokens(res.data);
      await loadContext();
      toast.success('Password changed. Welcome!');
      router.replace(homePathFor(useSession.getState()));
    } catch (e) {
      const err = normaliseError(e);
      if (err.code === 'AUTH_CURRENT_PASSWORD_INCORRECT') form.setError('currentPassword', { message: 'That is not the temporary password' }, { shouldFocus: true });
      else if (err.fieldErrors.newPassword) form.setError('newPassword', { message: err.fieldErrors.newPassword });
      else setError(err);
    }
  }

  return (
    <StatusFrame icon={<KeyRound />} title="Choose your own password">
      <p>
        {user?.firstName ? `Welcome, ${user.firstName}. ` : ''}Your chama official set a temporary password for you. Replace it with one only you
        know before you continue.
      </p>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-2 text-foreground" noValidate>
        <FormAlert error={error} />
        <Field label="Temporary password" required error={form.formState.errors.currentPassword}>
          <Input type="password" {...form.register('currentPassword')} autoComplete="current-password" autoFocus />
        </Field>
        <Field label="New password" required error={form.formState.errors.newPassword}>
          <Input type="password" {...form.register('newPassword')} autoComplete="new-password" />
        </Field>
        <PasswordRules value={form.watch('newPassword')} />
        <Field label="Confirm new password" required error={form.formState.errors.confirm}>
          <Input type="password" {...form.register('confirm')} autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>Save and continue</Button>
      </form>
    </StatusFrame>
  );
}
