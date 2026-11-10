'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, CalendarRange, Gavel, HandCoins, Info } from 'lucide-react';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import { submissionsApi } from '@/api/endpoints/submissions';
import { normaliseError } from '@/api/errors';
import type { MemberDashboardView, SubmissionKind } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Guard } from '@/components/shared/Can';
import { PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { Identifier } from '@/components/shared/Identifier';
import { MoneyInput, PaymentFields } from '@/components/shared/MoneyFields';
import { EmptyState, ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { TransactionLayout, TransactionSummary, type TransactionStep } from '@/components/shared/Transaction';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea } from '@/components/ui/primitives';
import { MY_REPORTS_PATH, readPrefill, type ReportPrefill } from '@/features/submissions/submissionLinks';
import { useApiMutation } from '@/hooks/useApiMutation';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { formatDate, formatMoney, formatPeriodKey, minorToInput, parseMoney, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';
import { moneySchema, normaliseReference, paymentShape, pastDateSchema, requireReference } from '@/lib/schemas';
import { cn, opt } from '@/lib/utils';

export default function ReportPaymentPage() {
  return (
    <Guard permission="PAYMENT_SUBMIT">
      <ReportPayment />
    </Guard>
  );
}

/** README §7.8a: a member reports a payment they made; the treasurer confirms it. The targets come from GET /dashboard/me. */
function ReportPayment() {
  const params = useSearchParams();
  const q = useQuery({ queryKey: dashboardKeys.me, queryFn: dashboardApi.mine });
  // Read the prefill once: the form owns the values after that.
  const [prefill] = useState(() => readPrefill(new URLSearchParams(params.toString())));
  return (
    <div className="space-y-3">
      <PageHeader
        back={{ href: MY_REPORTS_PATH, label: 'My reported payments' }}
        title="Report a payment"
        description="Tell the treasurer about money you paid. They check it and record it; nothing changes on your balances until then."
      />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <LoadingState /> : <ReportForm d={q.data} prefill={prefill} />}
    </div>
  );
}

interface Target {
  id: string;
  /** The option text: name, date and what is owed. */
  label: string;
  /** Short, for the summary. */
  name: string;
  outstandingMinor: number;
  /** What to fill the amount with when the target is chosen. */
  suggestedMinor: number;
}

interface KindOption {
  kind: SubmissionKind;
  title: string;
  hint: string;
  icon: React.ReactNode;
  targets: Target[] | null;
  disabledReason?: string;
}

/** The kinds whose feature is licensed, with what can be paid under each. */
function kindOptions(d: MemberDashboardView): KindOption[] {
  const out: KindOption[] = [];
  if (d.contributions) {
    const c = d.contributions;
    out.push({
      kind: 'CONTRIBUTION',
      title: 'Contribution',
      hint: c.arrearsMinor > 0 ? `In arrears: ${formatMoney(c.arrearsMinor, d.currency)}` : c.currentPeriod ? `For ${formatPeriodKey(c.currentPeriod)} or ahead` : 'Your regular contribution',
      icon: <CalendarRange />,
      targets: null,
    });
  }
  if (d.penalties) {
    const targets = d.penalties.outstanding.map((p) => ({
      id: p.penaltyId,
      name: p.description,
      label: `${p.description} · assessed ${formatDate(p.assessedOn)} · ${formatMoney(p.outstandingMinor, d.currency)} owed`,
      outstandingMinor: p.outstandingMinor,
      suggestedMinor: p.outstandingMinor,
    }));
    out.push({ kind: 'PENALTY_PAYMENT', title: 'Penalty', hint: targets.length ? `${targets.length} owed` : 'Nothing owed', icon: <Gavel />, targets, disabledReason: targets.length ? undefined : 'You have no outstanding penalties.' });
  }
  if (d.loans) {
    const targets = d.loans.loans
      .filter((l) => l.status === 'ACTIVE' && l.outstandingMinor > 0)
      .map((l) => ({
        id: l.loanId,
        name: `${l.productName}${l.purpose ? ` · ${l.purpose}` : ''}`,
        label: `${l.productName}${l.purpose ? ` · ${l.purpose}` : ''} · ${formatMoney(l.outstandingMinor, d.currency)} outstanding`,
        outstandingMinor: l.outstandingMinor,
        suggestedMinor: l.nextDueMinor > 0 ? Math.min(l.nextDueMinor, l.outstandingMinor) : l.outstandingMinor,
      }));
    out.push({ kind: 'LOAN_REPAYMENT', title: 'Loan repayment', hint: targets.length ? `${targets.length} active loan${targets.length === 1 ? '' : 's'}` : 'No active loan', icon: <HandCoins />, targets, disabledReason: targets.length ? undefined : 'You have no active loan to repay.' });
  }
  return out;
}

function ReportForm({ d, prefill }: { d: MemberDashboardView; prefill: ReportPrefill }) {
  const router = useRouter();
  const currency = d.currency;
  const options = useMemo(() => kindOptions(d), [d]);
  const usable = options.filter((o) => !o.disabledReason);
  const initialKind = usable.find((o) => o.kind === prefill.kind)?.kind ?? usable[0]?.kind ?? 'CONTRIBUTION';
  const initialTargets = options.find((o) => o.kind === initialKind)?.targets ?? null;
  const initialTarget = initialTargets?.find((t) => t.id === prefill.targetId) ?? (initialTargets?.length === 1 ? initialTargets[0] : undefined);
  const initialAmount = prefill.amountMinor ?? initialTarget?.suggestedMinor;

  const schema = useMemo(
    () =>
      z
        .object({
          kind: z.enum(['CONTRIBUTION', 'PENALTY_PAYMENT', 'LOAN_REPAYMENT']),
          targetId: z.string().optional(),
          amount: moneySchema(currency),
          ...paymentShape,
          paidOn: pastDateSchema,
          notes: z.string().trim().max(300, 'At most 300 characters').optional(),
        })
        .superRefine((v, ctx) => {
          requireReference(v, ctx);
          if (v.kind === 'CONTRIBUTION') return;
          const target = options.find((o) => o.kind === v.kind)?.targets?.find((t) => t.id === v.targetId);
          if (!target) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetId'], message: v.kind === 'PENALTY_PAYMENT' ? 'Choose the penalty you paid' : 'Choose the loan you repaid' });
          } else if (v.amount > target.outstandingMinor) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: `At most ${formatMoney(target.outstandingMinor, currency)}, what is still owed` });
          }
        }),
    [currency, options],
  );
  type In = z.input<typeof schema>;
  type Out = z.output<typeof schema>;
  const form = useForm<In, unknown, Out>({
    resolver: zResolver(schema),
    defaultValues: {
      kind: initialKind,
      targetId: initialTarget?.id ?? '',
      amount: initialAmount ? minorToInput(initialAmount, currency) : '',
      method: prefill.method === 'CASH' || prefill.method === 'BANK' ? prefill.method : 'MPESA',
      reference: prefill.reference ?? '',
      paidOn: prefill.paidOn && prefill.paidOn <= todayNairobi() ? prefill.paidOn : todayNairobi(),
      notes: prefill.notes ?? '',
    },
  });
  const [step, setStep] = useState<TransactionStep>('edit');
  const [pending, setPending] = useState<Out | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const submit = useApiMutation(submissionsApi.submit, { invalidate: keys('submission'), toastErrors: false });

  const kind = form.watch('kind');
  const targetId = form.watch('targetId');
  const amountText = form.watch('amount');
  const method = form.watch('method');
  const reference = form.watch('reference');
  const paidOn = form.watch('paidOn');
  const option = options.find((o) => o.kind === kind);
  const target = option?.targets?.find((t) => t.id === targetId);
  let amount = 0;
  try { amount = amountText ? parseMoney(amountText, currency) : 0; } catch { amount = 0; }

  if (usable.length === 0) {
    return (
      <EmptyState
        title="Nothing to report a payment for"
        message="You have no contributions, outstanding penalties or active loans that a payment could go to."
        action={<Button variant="outline" asChild><Link href="/home">Back to home</Link></Button>}
      />
    );
  }

  function chooseKind(k: SubmissionKind) {
    const o = options.find((x) => x.kind === k);
    form.setValue('kind', k);
    const only = o?.targets?.length === 1 ? o.targets[0] : undefined;
    form.setValue('targetId', only?.id ?? '');
    if (only) form.setValue('amount', minorToInput(only.suggestedMinor, currency));
    form.clearErrors(['targetId', 'amount']);
  }

  function chooseTarget(id: string) {
    form.setValue('targetId', id, { shouldValidate: form.formState.isSubmitted });
    const t = option?.targets?.find((x) => x.id === id);
    // Fill the amount with what is owed (or the next instalment); the member can lower it for a part payment.
    if (t) form.setValue('amount', minorToInput(t.suggestedMinor, currency), { shouldValidate: form.formState.isSubmitted });
  }

  async function confirm() {
    if (!pending) return;
    const v = pending;
    setMessages([]);
    try {
      await submit.mutateAsync({
        kind: v.kind,
        targetId: v.kind === 'CONTRIBUTION' ? undefined : v.targetId,
        amountMinor: v.amount,
        method: v.method,
        reference: normaliseReference(v.method, v.reference),
        paidOn: v.paidOn,
        notes: opt(v.notes),
      });
      router.push(MY_REPORTS_PATH);
    } catch (e) {
      setStep('edit');
      setPending(null);
      const err = normaliseError(e);
      // SUBMISSION_TARGET_INVALID says what is still outstanding; DUPLICATE_REFERENCE goes on the reference field.
      const unmatched = applyApiErrors(form, e, ['kind', 'targetId', 'amount', 'method', 'reference', 'paidOn', 'notes']);
      setMessages(err.code.endsWith('_DUPLICATE_REFERENCE') ? [] : unmatched.length ? unmatched : err.hasFieldErrors() ? [] : [err.message]);
    }
  }

  const errors = form.formState.errors;
  const reviewing = step === 'review';
  const refLabel = method === 'MPESA' ? 'M-Pesa code' : method === 'BANK' ? 'Bank slip' : 'Reference';

  const summary = (
    <TransactionSummary
      step={step}
      rows={[
        { label: 'For', value: option?.title ?? '—' },
        kind !== 'CONTRIBUTION' && { label: kind === 'PENALTY_PAYMENT' ? 'Penalty' : 'Loan', value: target ? <span className="text-right">{target.name}</span> : <span className="text-muted-foreground">Not chosen</span> },
        target && { label: 'Still owed', value: <Amount value={target.outstandingMinor} currency={currency} /> },
        { label: 'Channel', value: label(method) },
        { label: refLabel, value: reference ? <Identifier value={method === 'MPESA' ? reference.toUpperCase() : reference} copy={false} /> : '—' },
        { label: 'Date paid', value: paidOn ? formatDate(paidOn) : '—' },
        { label: 'Amount', value: <Amount value={amount} currency={currency} className="text-base" />, emphasis: true },
      ]}
      footer={
        reviewing ? (
          <div className="flex flex-wrap justify-end gap-2 py-1">
            <Button type="button" variant="outline" size="sm" onClick={() => { setStep('edit'); setPending(null); }} disabled={submit.isPending}><ArrowLeft />Back to edit</Button>
            <Button type="button" size="sm" onClick={confirm} loading={submit.isPending}>Send to the treasurer</Button>
          </div>
        ) : (
          <div className="flex justify-end py-1">
            <Button type="submit" form="report-payment" size="sm">Review</Button>
          </div>
        )
      }
    />
  );

  return (
    <TransactionLayout
      summary={
        <div className="space-y-2">
          {summary}
          <p className="flex gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            This is a report, not a payment. It shows as &ldquo;awaiting confirmation&rdquo; until an official checks it against the M-Pesa or bank statement and records it.
          </p>
        </div>
      }
      form={
        <form id="report-payment" onSubmit={form.handleSubmit((v) => { setMessages([]); setPending(v); setStep('review'); })} className="space-y-3" noValidate>
          <fieldset disabled={reviewing} className="space-y-3 disabled:opacity-75">
            <Section title="What did you pay?">
              <div className="space-y-4">
                <FormAlert messages={messages} />
                <div role="radiogroup" aria-label="What the payment was for" className="grid gap-2 sm:grid-cols-3">
                  {options.map((o) => {
                    const checked = kind === o.kind;
                    return (
                      <label
                        key={o.kind}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring',
                          checked ? 'border-primary bg-primary/[0.06]' : 'hover:bg-accent/50',
                          o.disabledReason && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                        )}
                      >
                        <input type="radio" name="kind" value={o.kind} checked={checked} disabled={!!o.disabledReason} onChange={() => chooseKind(o.kind)} className="sr-only" />
                        <span className={cn('mt-0.5 [&_svg]:size-4', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden>{o.icon}</span>
                        <span className="min-w-0">
                          <span className="block font-medium">{o.title}</span>
                          <span className="block text-xs text-muted-foreground">{o.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {option?.targets && (
                  <Field label={kind === 'PENALTY_PAYMENT' ? 'Which penalty' : 'Which loan'} required error={errors.targetId}>
                    <NativeSelect value={targetId ?? ''} onChange={(e) => chooseTarget(e.target.value)}>
                      <option value="">Choose…</option>
                      {option.targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </NativeSelect>
                  </Field>
                )}

                <Field
                  label="Amount paid"
                  required
                  error={errors.amount}
                  hint={target ? <>Up to <Amount value={target.outstandingMinor} currency={currency} sensitive={false} /> still owed. A part payment is fine.</> : undefined}
                >
                  <MoneyInput {...form.register('amount')} currency={currency} />
                </Field>
              </div>
            </Section>

            <Section title="How did you pay?">
              <div className="space-y-4">
                <PaymentFields form={form} dateField="paidOn" dateLabel="Date paid" />
                <Field label="Notes" error={errors.notes} hint="Optional: anything that helps the treasurer find it (e.g. paid from my wife's line).">
                  <Textarea {...form.register('notes')} maxLength={300} rows={2} />
                </Field>
              </div>
            </Section>
          </fieldset>
        </form>
      }
    />
  );
}
