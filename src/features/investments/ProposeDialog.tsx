'use client';

import { z } from 'zod';
import { investmentsApi } from '@/api/endpoints/spending';
import type { InvestmentType } from '@/api/types';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCurrency } from '@/hooks/useSessionInfo';
import { addDays, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';
import { moneySchema, optionalText, requiredText } from '@/lib/schemas';
import { opt } from '@/lib/utils';

export const INVESTMENT_TYPES: InvestmentType[] = ['MONEY_MARKET_FUND', 'FIXED_DEPOSIT', 'TREASURY_BILL', 'TREASURY_BOND', 'SACCO_SHARES', 'EQUITIES', 'LAND', 'BUSINESS', 'OTHER'];

/** README §7.11: propose an investment. Officials approve it, then it is funded. */
export function ProposeDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange(o: boolean): void; onCreated?(id: string): void }) {
  const currency = useCurrency();
  const schema = z.object({
    name: requiredText(120),
    type: z.enum(INVESTMENT_TYPES as [InvestmentType, ...InvestmentType[]]),
    institution: optionalText(120),
    description: optionalText(300),
    amount: moneySchema(currency),
    expectedReturn: z.string().trim().optional().refine((v) => !v || (/^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= 1000), 'Enter a percentage like 9.5'),
    maturityDate: z.string().optional().refine((v) => !v || v > todayNairobi(), 'Must be in the future'),
  });
  const propose = useApiMutation((v: z.output<typeof schema>) => investmentsApi.propose({
    name: v.name,
    type: v.type,
    institution: opt(v.institution),
    description: opt(v.description),
    amountMinor: v.amount,
    expectedReturnBasisPoints: v.expectedReturn ? Math.round(Number(v.expectedReturn) * 100) : undefined,
    maturityDate: v.maturityDate || undefined,
  }), { invalidate: keys('investment'), toastErrors: false, onSuccess: (i) => onCreated?.(i.id) });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Propose an investment"
      description="Officials approve it before the money is put in."
      schema={schema}
      defaultValues={{ name: '', type: 'MONEY_MARKET_FUND', institution: '', description: '', amount: '', expectedReturn: '', maturityDate: '' }}
      submitLabel="Propose"
      size="lg"
      onSubmit={(v) => propose.mutateAsync(v)}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={e.name} className="sm:col-span-2"><Input {...form.register('name')} maxLength={120} placeholder="e.g. CIC Money Market Fund" /></Field>
            <Field label="Type" required error={e.type}>
              <NativeSelect {...form.register('type')}>{INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</NativeSelect>
            </Field>
            <Field label="Institution" error={e.institution}><Input {...form.register('institution')} maxLength={120} /></Field>
            <Field label="Amount" required error={e.amount}><MoneyInput {...form.register('amount')} /></Field>
            <Field label="Expected yearly return (%)" error={e.expectedReturn} hint="Optional"><Input inputMode="decimal" {...form.register('expectedReturn')} /></Field>
            <Field label="Matures on" error={e.maturityDate} hint="Optional, for fixed-term investments"><Input type="date" min={addDays(todayNairobi(), 1)} {...form.register('maturityDate')} /></Field>
            <Field label="Description" error={e.description} className="sm:col-span-2"><Textarea {...form.register('description')} maxLength={300} rows={2} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
