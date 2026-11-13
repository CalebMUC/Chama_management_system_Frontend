'use client';

import { useState } from 'react';
import { Eye, EyeOff, Wand2 } from 'lucide-react';
import { z } from 'zod';
import { membersApi } from '@/api/endpoints/chama';
import type { AddMemberRequest, MemberView } from '@/api/types';
import { DetailList } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Input } from '@/components/ui/primitives';
import { PasswordRules } from '@/features/auth/AuthLayout';
import { useApiMutation } from '@/hooks/useApiMutation';
import { memberName } from '@/hooks/useMembers';
import { emailSchema, passwordSchema, phoneSchema, requiredText } from '@/lib/schemas';
import { useSession } from '@/stores/session';
import { CopyButton } from './InviteDialog';
import { FormSectionTitle, KycFields, kycDefaults, kycSchema } from './kyc';

const schema = z
  .object({
    firstName: requiredText(100, 'Enter the first name'),
    lastName: requiredText(100, 'Enter the last name'),
    email: emailSchema,
    phoneNumber: phoneSchema,
    temporaryPassword: passwordSchema,
    kyc: kycSchema,
  })
  .transform((v): AddMemberRequest => v);
type Input = z.input<typeof schema>;

const defaults = (): Input => ({ firstName: '', lastName: '', email: '', phoneNumber: '', temporaryPassword: '', kyc: kycDefaults() });

/** 10 characters without look-alikes (0/O, 1/l/I), always with a letter and a digit, so it can be read out over the phone. */
function generatePassword() {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const random = new Uint32Array(10);
  crypto.getRandomValues(random);
  const chars = Array.from(random, (n) => all[n % all.length]);
  chars[random[0] % 5] = letters[random[1] % letters.length];
  chars[5 + (random[2] % 5)] = digits[random[3] % digits.length];
  return chars.join('');
}

interface Added {
  member: MemberView;
  password: string;
}

/**
 * POST /members: an official opens an ACTIVE member's account with their KYC details and a temporary password, which the
 * member must replace at first sign-in. No email is sent, so the official hands the sign-in details over.
 */
export function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [added, setAdded] = useState<Added | null>(null);
  const add = useApiMutation((body: AddMemberRequest) => membersApi.add(body), { invalidate: ['members'], toastErrors: false, success: false });

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={(o) => {
          if (o) setShowPassword(false);
          onOpenChange(o);
        }}
        title="Add a member"
        description="They join as an active member straight away and choose their own password when they first sign in."
        size="lg"
        schema={schema}
        defaultValues={defaults()}
        submitLabel="Add member"
        onSubmit={async (v) => {
          const res = await add.mutateAsync(v);
          setAdded({ member: res.data, password: v.temporaryPassword });
        }}
      >
        {(form) => {
          const e = form.formState.errors;
          return (
            <>
              <FormSectionTitle>Personal details</FormSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" required error={e.firstName}><Input {...form.register('firstName')} autoComplete="off" autoFocus /></Field>
                <Field label="Last name" required error={e.lastName}><Input {...form.register('lastName')} autoComplete="off" /></Field>
                <Field label="Email" required error={e.email}><Input type="email" {...form.register('email')} autoComplete="off" /></Field>
                <Field label="Phone number" required error={e.phoneNumber}><Input type="tel" {...form.register('phoneNumber')} placeholder="0712 345 678" autoComplete="off" /></Field>
              </div>

              <KycFields form={form} prefix="kyc." />

              <FormSectionTitle>Sign-in</FormSectionTitle>
              <Field label="Temporary password" required error={e.temporaryPassword} hint="Share it with the member privately. They must change it when they first sign in.">
                <div className="flex gap-2">
                  <Input type={showPassword ? 'text' : 'password'} {...form.register('temporaryPassword')} autoComplete="new-password" className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      form.setValue('temporaryPassword', generatePassword(), { shouldValidate: true, shouldDirty: true });
                      setShowPassword(true);
                    }}
                  >
                    <Wand2 />Generate
                  </Button>
                </div>
              </Field>
              <PasswordRules value={form.watch('temporaryPassword')} />
            </>
          );
        }}
      </FormDialog>
      <AddedDialog added={added} onClose={() => setAdded(null)} />
    </>
  );
}

/** What the official needs to hand over: shown once, since the password is never readable again. */
function AddedDialog({ added, onClose }: { added: Added | null; onClose(): void }) {
  const code = useSession((s) => s.user?.chamaCode ?? '');
  const m = added?.member;
  const details = m && added ? `Chama code: ${code}\nEmail: ${m.email}\nTemporary password: ${added.password}` : '';
  return (
    <Dialog open={!!added} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{m ? `${memberName(m)} is a member` : 'Member added'}</DialogTitle>
          <DialogDescription>Give them these sign-in details privately. The temporary password is not shown again.</DialogDescription>
        </DialogHeader>
        {m && added && (
          <DetailList
            columns={1}
            items={[
              { label: 'Member number', value: m.memberNumber ? `#${m.memberNumber}` : '—' },
              { label: 'Chama code', value: <span className="font-mono font-semibold">{code}</span> },
              { label: 'Email', value: m.email },
              { label: 'Temporary password', value: <span className="font-mono font-semibold">{added.password}</span> },
            ]}
          />
        )}
        <DialogFooter>
          <CopyButton text={details} label="Copy sign-in details" />
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
