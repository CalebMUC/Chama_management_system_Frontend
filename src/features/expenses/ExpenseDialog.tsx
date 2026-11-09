'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ledgerApi } from '@/api/endpoints/books';
import { expensesApi, investmentsApi } from '@/api/endpoints/spending';
import { Field } from '@/components/shared/Field';
import { Amount } from '@/components/shared/Amount';
import { KeyValue } from '@/components/shared/Panel';
import { FormDialog } from '@/components/shared/FormDialog';
import { MoneyInput, PastDateInput } from '@/components/shared/MoneyFields';
import { Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCurrency, useHasFeature, usePermission } from '@/hooks/useSessionInfo';
import { formatDate, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { moneySchema, pastDateSchema, requiredText } from '@/lib/schemas';

/** README §7.10: record an expense. It waits for approval before it can be paid. */
export function ExpenseDialog({ open, onOpenChange, investmentId, onCreated }: { open: boolean; onOpenChange(o: boolean): void; investmentId?: string; onCreated?(id: string): void }) {
  const currency = useCurrency();
  const ledgerView = usePermission('LEDGER_VIEW');
  const hasInvestments = useHasFeature()('INVESTMENTS');
  const canSeeInvestments = usePermission('INVESTMENT_VIEW') && hasInvestments;
  const accounts = useQuery({ queryKey: ['ledger', 'accounts'], queryFn: ledgerApi.accounts, enabled: open && ledgerView });
  const investments = useQuery({ queryKey: ['investments', 'list', { status: 'ACTIVE' }, 0, 100], queryFn: () => investmentsApi.list({ status: 'ACTIVE', page: 0, size: 100 }), enabled: open && canSeeInvestments });
  const expenseAccounts = (accounts.data ?? []).filter((a) => a.type === 'EXPENSE' && a.active);

  const schema = z.object({
    amount: moneySchema(currency),
    payee: requiredText(120, 'Who was paid?'),
    description: requiredText(300, 'What was it for?'),
    accountCode: z.string().optional(),
    investmentId: z.string().optional(),
    incurredOn: pastDateSchema,
  });
  const create = useApiMutation((v: z.output<typeof schema>) => expensesApi.create({
    amountMinor: v.amount,
    payee: v.payee,
    description: v.description,
    accountCode: v.accountCode || undefined,
    investmentId: v.investmentId || undefined,
    incurredOn: v.incurredOn,
  }), { invalidate: keys('expense'), toastErrors: false, onSuccess: (e) => onCreated?.(e.id) });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record an expense"
      description="Officials approve it before it is paid."
      schema={schema}
      defaultValues={{ amount: '', payee: '', description: '', accountCode: '', investmentId: investmentId ?? '', incurredOn: todayNairobi() }}
      submitLabel="Record expense"
      size="lg"
      review={(v) => (
        <div className="rounded-md border px-3">
          <KeyValue
            items={[
              { label: 'Amount', value: <Amount value={v.amount} currency={currency} className="text-base font-semibold" />, emphasis: true },
              { label: 'Payee', value: v.payee },
              { label: 'For', value: v.description },
              { label: 'Incurred on', value: formatDate(v.incurredOn) },
              { label: 'Expense account', value: expenseAccounts.find((a) => a.code === v.accountCode)?.name ?? 'Operating expenses' },
              v.investmentId ? { label: 'Investment', value: investments.data?.items.find((i) => i.id === v.investmentId)?.name ?? '—' } : null,
              { label: 'Next', value: 'Waits for approval before it is paid' },
            ]}
          />
        </div>
      )}
      onSubmit={(v) => create.mutateAsync(v)}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" required error={e.amount}><MoneyInput {...form.register('amount')} /></Field>
            <Field label="Incurred on" required error={e.incurredOn}><PastDateInput {...form.register('incurredOn')} /></Field>
            <Field label="Payee" required error={e.payee} className="sm:col-span-2"><Input {...form.register('payee')} maxLength={120} placeholder="e.g. Kamau Stationers" /></Field>
            <Field label="Description" required error={e.description} className="sm:col-span-2"><Textarea {...form.register('description')} maxLength={300} rows={2} /></Field>
            {ledgerView && (
              <Field label="Expense account" error={e.accountCode} hint="Leave empty for Operating expenses (5000)">
                <NativeSelect {...form.register('accountCode')}>
                  <option value="">Operating expenses (default)</option>
                  {expenseAccounts.filter((a) => a.code !== '5000').map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}
                </NativeSelect>
              </Field>
            )}
            {canSeeInvestments && (
              <Field label="For an investment" error={e.investmentId} hint="Optional: running costs of an active investment">
                <NativeSelect {...form.register('investmentId')}>
                  <option value="">None</option>
                  {(investments.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </NativeSelect>
              </Field>
            )}
          </div>
        );
      }}
    </FormDialog>
  );
}
