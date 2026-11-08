'use client';

import { useMemo, type ReactNode } from 'react';
import { z } from 'zod';
import { useCurrency } from '@/hooks/useSessionInfo';
import { Textarea } from '@/components/ui/primitives';
import { formatMoney, minorToInput, parseMoney, todayNairobi } from '@/lib/format';
import { moneySchema, normaliseReference, paymentShape, pastDateSchema, requireReference } from '@/lib/schemas';
import { Field } from './Field';
import { FormDialog } from './FormDialog';
import { MoneyInput, PaymentFields } from './MoneyFields';

export interface PaymentValues {
  /** Minor units; present only when the dialog asks for an amount. */
  amountMinor?: number;
  method: 'CASH' | 'BANK' | 'MPESA';
  reference?: string;
  date: string;
  /** Present only when the dialog asks for a note. */
  note?: string;
}

/**
 * A money-movement dialog (README §8.2): optional amount (with a maximum), method, reference (required for Bank/M-Pesa) and
 * date (default today, max today). `dateField` is the API's name for the date (paidOn, disbursedOn…) so its errors map back.
 */
export function PaymentDialog({ open, onOpenChange, title, description, amount, dateField, dateLabel = 'Date', methods, submitLabel, onSubmit, summary, destructive, note, preview }: {
  open: boolean;
  onOpenChange(o: boolean): void;
  title: string;
  description?: ReactNode;
  /** Ask for an amount. `max` in minor units. */
  amount?: { label?: string; max?: number; hint?: ReactNode; defaultMinor?: number; allowZero?: boolean };
  /** Ask for an optional note (≤300). */
  note?: boolean;
  /** Live line under the amount, e.g. gain/loss on closing. */
  preview?: (amountMinor: number | null) => ReactNode;
  dateField: string;
  dateLabel?: string;
  methods?: string[];
  submitLabel: string;
  onSubmit(values: PaymentValues): Promise<unknown>;
  /** Shown above the fields: what is being paid. */
  summary?: ReactNode;
  destructive?: boolean;
}) {
  const currency = useCurrency();
  const schema = useMemo(() => {
    const shape = {
      ...paymentShape,
      ...(methods ? { method: z.string() } : {}),
      [dateField]: pastDateSchema,
      amount: amount
        ? moneySchema(currency, { allowZero: amount.allowZero, max: amount.max, maxMessage: amount.max !== undefined ? `At most ${formatMoney(amount.max, currency)}` : undefined })
        : z.string().optional(),
      note: z.string().trim().max(300, 'At most 300 characters').optional(),
    };
    return z.object(shape).superRefine((v, ctx) => requireReference(v as { method: string; reference?: string }, ctx));
  }, [currency, amount, dateField, methods]);

  const defaults = {
    method: 'MPESA',
    reference: '',
    amount: amount?.defaultMinor ? minorToInput(amount.defaultMinor, currency) : '',
    [dateField]: todayNairobi(),
    note: '',
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      schema={schema as never}
      defaultValues={defaults as never}
      submitLabel={submitLabel}
      destructive={destructive}
      onSubmit={(raw) => {
        const v = raw as Record<string, unknown>;
        return onSubmit({
          amountMinor: amount ? (v.amount as number) : undefined,
          method: v.method as PaymentValues['method'],
          reference: normaliseReference(v.method as string, v.reference as string | undefined),
          date: v[dateField] as string,
          note: note ? ((v.note as string | undefined)?.trim() || undefined) : undefined,
        });
      }}
    >
      {(form) => {
        const errors = form.formState.errors as Record<string, { message?: string } | undefined>;
        return (
          <>
            {summary}
            {amount && (
              <Field label={amount.label ?? 'Amount'} required error={errors.amount} hint={amount.hint}>
                <MoneyInput {...form.register('amount' as never)} />
              </Field>
            )}
            {amount && preview && <PreviewLine text={form.watch('amount' as never) as unknown as string} currency={currency} preview={preview} />}
            <PaymentFields form={form} dateField={dateField as never} dateLabel={dateLabel} methods={methods} />
            {note && (
              <Field label="Note" error={errors.note}>
                <Textarea {...form.register('note' as never)} maxLength={300} rows={2} />
              </Field>
            )}
          </>
        );
      }}
    </FormDialog>
  );
}

function PreviewLine({ text, currency, preview }: { text: string; currency: string; preview: (minor: number | null) => ReactNode }) {
  let minor: number | null = null;
  try { minor = text ? parseMoney(text, currency) : null; } catch { minor = null; }
  return <div className="text-sm" aria-live="polite">{preview(minor)}</div>;
}
