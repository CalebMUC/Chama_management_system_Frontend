'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { BadgeCheck, LogOut, MailWarning } from 'lucide-react';
import { authApi } from '@/api/endpoints/auth';
import { normaliseError } from '@/api/errors';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Input } from '@/components/ui/primitives';
import { PasswordRules } from '@/features/auth/AuthLayout';
import { adoptTokens, loginPath, logoutEverywhere } from '@/features/auth/sessionActions';
import { formatInstantDate, fullName } from '@/lib/format';
import { label } from '@/lib/labels';
import { passwordSchema } from '@/lib/schemas';
import { useSession } from '@/stores/session';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: passwordSchema, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });
type Values = z.infer<typeof schema>;

/** README §7.1. Name, phone and email are read-only: there is no update endpoint. */
export default function ProfilePage() {
  const router = useRouter();
  const sessionUser = useSession((s) => s.user);
  const membership = useSession((s) => s.membership);
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me, initialData: sessionUser ?? undefined });
  const user = me.data;
  const [confirmAll, setConfirmAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  async function changePassword(v: Values) {
    setError(null);
    try {
      const res = await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      // Changing the password revokes other sessions; keep this one with the new tokens.
      adoptTokens(res.data);
      form.reset();
      toast.success(res.message || 'Password changed.');
    } catch (e) {
      const err = normaliseError(e);
      if (err.code === 'AUTH_CURRENT_PASSWORD_INCORRECT') form.setError('currentPassword', { message: err.message }, { shouldFocus: true });
      else if (err.fieldErrors.newPassword) form.setError('newPassword', { message: err.fieldErrors.newPassword });
      else setError(err);
    }
  }

  async function resend() {
    if (!user) return;
    setSending(true);
    try {
      const res = await authApi.resendVerification(user.email, user.chamaCode);
      toast.success(res.message || 'Verification email sent.');
    } catch (e) {
      toast.error(normaliseError(e).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & security" description="Your details are kept by your chama. Ask an official to correct them." />
      <Section title={fullName(user?.firstName, user?.lastName) ?? 'Your account'}>
        <DetailList
          items={[
            {
              label: 'Email',
              value: (
                <span className="flex flex-wrap items-center gap-2">
                  {user?.email}
                  {user?.emailVerified ? (
                    <Badge variant="success"><BadgeCheck className="size-3" />Verified</Badge>
                  ) : (
                    <Badge variant="warning"><MailWarning className="size-3" />Not verified</Badge>
                  )}
                </span>
              ),
            },
            { label: 'Phone', value: user?.phoneNumber },
            { label: 'Chama code', value: user?.chamaCode },
            membership && { label: 'Member number', value: membership.memberNumber ? `#${membership.memberNumber}` : '—' },
            membership && { label: 'Roles', value: <span className="flex flex-wrap gap-1">{membership.roles.map((r) => <Badge key={r} variant="outline">{label(r)}</Badge>)}</span> },
            membership?.joinedAt ? { label: 'Member since', value: formatInstantDate(membership.joinedAt) } : null,
          ]}
        />
        {user && !user.emailVerified && (
          <Button variant="outline" size="sm" className="mt-4" onClick={resend} loading={sending}>Resend verification email</Button>
        )}
      </Section>

      <Section title="Change password" description="You stay signed in here; other devices are signed out.">
        <form onSubmit={form.handleSubmit(changePassword)} className="max-w-md space-y-4" noValidate>
          <FormAlert error={error} />
          <Field label="Current password" required error={form.formState.errors.currentPassword}>
            <Input type="password" {...form.register('currentPassword')} autoComplete="current-password" />
          </Field>
          <Field label="New password" required error={form.formState.errors.newPassword}>
            <Input type="password" {...form.register('newPassword')} autoComplete="new-password" />
          </Field>
          <PasswordRules value={form.watch('newPassword')} />
          <Field label="Confirm new password" required error={form.formState.errors.confirm}>
            <Input type="password" {...form.register('confirm')} autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={form.formState.isSubmitting}>Change password</Button>
        </form>
      </Section>

      <Section title="Sessions" description="Signed in on a phone or computer you no longer use?">
        <Button variant="outline" onClick={() => setConfirmAll(true)}><LogOut />Sign out everywhere</Button>
      </Section>

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out everywhere?"
        description="This signs you out on every device, including this one."
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          const code = await logoutEverywhere();
          router.replace(loginPath(code));
        }}
      />
    </div>
  );
}
