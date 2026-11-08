'use client';

import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { memberAccountsApi, savingsProductsApi } from '@/api/endpoints/savings';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { NativeSelect } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';

const schema = z.object({
  memberUserId: z.string().min(1, 'Choose a member'),
  productId: z.string().min(1, 'Choose a product'),
});

/** README §7.7: open an account in a non-mandatory product (mandatory ones open automatically). */
export function OpenAccountDialog({ open, onOpenChange, memberUserId }: { open: boolean; onOpenChange(o: boolean): void; memberUserId?: string }) {
  const products = useQuery({ queryKey: ['savingsProducts'], queryFn: savingsProductsApi.list, enabled: open });
  const options = (products.data ?? []).filter((p) => p.active && !p.mandatory);
  const openAccount = useApiMutation((v: z.output<typeof schema>) => memberAccountsApi.open(v.memberUserId, v.productId), { invalidate: ['memberAccounts', 'savingsProducts'], toastErrors: false });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Open a savings account"
      description="Mandatory products open automatically for every member. Here you open voluntary ones."
      schema={schema}
      defaultValues={{ memberUserId: memberUserId ?? '', productId: '' }}
      submitLabel="Open account"
      onSubmit={(v) => openAccount.mutateAsync(v)}
    >
      {(form) => (
        <>
          <Field label="Member" required error={form.formState.errors.memberUserId}>
            <Controller control={form.control} name="memberUserId" render={({ field }) => <MemberPicker ref={field.ref} value={field.value} onChange={(id) => field.onChange(id ?? '')} />} />
          </Field>
          <Field label="Product" required error={form.formState.errors.productId} hint={products.data && options.length === 0 ? 'No voluntary products. Create one in Settings → Savings products.' : undefined}>
            <NativeSelect {...form.register('productId')}>
              <option value="">Choose…</option>
              {options.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
            </NativeSelect>
          </Field>
        </>
      )}
    </FormDialog>
  );
}
