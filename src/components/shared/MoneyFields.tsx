'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { Input, NativeSelect } from '@/components/ui/primitives';
import { useCurrency } from '@/hooks/useSessionInfo';
import { todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Field } from './Field';

/** A money amount typed as text (parsed with string math, never floats), with the currency shown in front. */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { currency?: string }>(function MoneyInput(
  { currency, className, ...props },
  ref,
) {
  const chamaCurrency = useCurrency();
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{currency ?? chamaCurrency}</span>
      <Input ref={ref} inputMode="decimal" autoComplete="off" placeholder="0.00" className={cn('pl-12 tabular', className)} {...props} />
    </div>
  );
});

/** A business-date input capped at today in Nairobi. */
export const PastDateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PastDateInput(props, ref) {
  return <Input ref={ref} type="date" max={todayNairobi()} {...props} />;
});

/**
 * "How was the money paid" (README §8.2): Method, Reference (required for Bank and M-Pesa, labelled by method), Date (default
 * today, max today). Field names: method, reference, and `dateField`.
 */
export function PaymentFields<T extends FieldValues>({ form, dateField, dateLabel = 'Date', methods = ['CASH', 'BANK', 'MPESA'], hideDate }: {
  form: UseFormReturn<T, any, any>;
  dateField?: Path<T>;
  dateLabel?: string;
  methods?: string[];
  hideDate?: boolean;
}) {
  const method = form.watch('method' as Path<T>) as string;
  const errors = form.formState.errors as Record<string, { message?: string } | undefined>;
  const refLabel = method === 'MPESA' ? 'M-Pesa code' : method === 'BANK' ? 'Bank slip number' : 'Reference';
  const needsRef = method === 'MPESA' || method === 'BANK';
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Method" required error={errors.method}>
        <NativeSelect {...form.register('method' as Path<T>)}>
          {methods.map((m) => <option key={m} value={m}>{label(m)}</option>)}
        </NativeSelect>
      </Field>
      <Field label={refLabel} required={needsRef} error={errors.reference} hint={method === 'MPESA' ? 'e.g. QK7H2XY9ZB' : needsRef ? undefined : 'Optional'}>
        <Input
          {...form.register('reference' as Path<T>, { setValueAs: (v: string) => (method === 'MPESA' ? v?.toUpperCase() : v) })}
          className={method === 'MPESA' ? 'uppercase' : undefined}
          autoComplete="off"
          maxLength={100}
        />
      </Field>
      {!hideDate && dateField && (
        <Field label={dateLabel} required error={errors[dateField as string]}>
          <PastDateInput {...form.register(dateField)} />
        </Field>
      )}
    </div>
  );
}
