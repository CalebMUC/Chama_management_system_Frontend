'use client';

import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { penaltiesApi } from '@/api/endpoints/penalties';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCurrency, useMyUserId } from '@/hooks/useSessionInfo';
import { keys } from '@/lib/invalidation';
import { moneySchema, requiredText } from '@/lib/schemas';

/** README §7.8: fine a seated member (never yourself). */
export function FineDialog({ open, onOpenChange, memberUserId }: { open: boolean; onOpenChange(o: boolean): void; memberUserId?: string }) {
  const currency = useCurrency();
  const me = useMyUserId();
  const schema = z.object({
    memberUserId: z.string({ required_error: 'Choose a member' }).min(1, 'Choose a member'),
    amount: moneySchema(currency),
    reason: requiredText(300, 'Give a reason'),
  });
  const fine = useApiMutation((v: z.output<typeof schema>) => penaltiesApi.fine({ memberUserId: v.memberUserId, amountMinor: v.amount, reason: v.reason }), { invalidate: keys('penalty'), toastErrors: false });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Fine a member"
      description="The fine is added to their penalties and posted to the books."
      schema={schema}
      defaultValues={{ memberUserId: memberUserId ?? '', amount: '', reason: '' }}
      submitLabel="Record fine"
      onSubmit={(v) => fine.mutateAsync(v)}
    >
      {(form) => (
        <>
          <Field label="Member" required error={form.formState.errors.memberUserId}>
            <Controller
              control={form.control}
              name="memberUserId"
              render={({ field }) => <MemberPicker ref={field.ref} value={field.value} onChange={(id) => field.onChange(id ?? '')} statuses={['ACTIVE', 'SUSPENDED']} exclude={[me]} />}
            />
          </Field>
          <Field label="Amount" required error={form.formState.errors.amount}><MoneyInput {...form.register('amount')} /></Field>
          <Field label="Reason" required error={form.formState.errors.reason}><Textarea {...form.register('reason')} maxLength={300} placeholder="e.g. Missed the March meeting" /></Field>
        </>
      )}
    </FormDialog>
  );
}
