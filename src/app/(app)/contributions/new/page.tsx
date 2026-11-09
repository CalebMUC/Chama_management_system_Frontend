'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowLeft, Plus } from 'lucide-react';
import { contributionsApi, memberAccountsApi } from '@/api/endpoints/savings';
import { normaliseError } from '@/api/errors';
import type { PaymentView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Guard } from '@/components/shared/Can';
import { EntryLink, PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { Identifier } from '@/components/shared/Identifier';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { MoneyInput, PaymentFields } from '@/components/shared/MoneyFields';
import { FormAlert } from '@/components/shared/States';
import { Receipt, TransactionLayout, TransactionSummary, type TransactionStep } from '@/components/shared/Transaction';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/overlays';
import { Label, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { useCurrency, useMyUserId } from '@/hooks/useSessionInfo';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { keys } from '@/lib/invalidation';
import { formatDate, formatInstant, formatMoney, memberLabel, parseMoney, todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';
import { moneySchema, normaliseReference, paymentShape, pastDateSchema, requireReference } from '@/lib/schemas';
import { opt } from '@/lib/utils';

export default function RecordContributionPage() {
  return (
    <Guard permission="CONTRIBUTION_RECORD" feature="CONTRIBUTIONS">
      <RecordContribution />
    </Guard>
  );
}

function RecordContribution() {
  const params = useSearchParams();
  const [result, setResult] = useState<PaymentView | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (result) return <ContributionReceipt p={result} onAnother={() => { setResult(null); setFormKey((k) => k + 1); }} />;
  return <ContributionForm key={formKey} initialMember={params.get('member') ?? ''} onDone={setResult} />;
}

/** The success state as a receipt: reference, ledger entry, when and by whom, where the money went. Prints on its own. */
function ContributionReceipt({ p, onAnother }: { p: PaymentView; onAnother(): void }) {
  const directory = useMemberDirectory();
  const me = useMyUserId();
  return (
    <div className="space-y-3">
      <PageHeader back={{ href: '/contributions', label: 'Contributions' }} title="Contribution recorded" asAt={p.recordedAt} />
      <Receipt
        title={memberLabel(p.memberName, p.memberNumber)}
        amount={<Amount value={p.amountMinor} currency={p.currency} />}
        rows={[
          { label: 'Channel', value: label(p.method) },
          { label: p.method === 'MPESA' ? 'M-Pesa code' : p.method === 'BANK' ? 'Bank slip' : 'Reference', value: p.reference ? <Identifier value={p.reference} /> : '—' },
          { label: 'Value date', value: formatDate(p.paidOn) },
          { label: 'Ledger entry', value: <EntryLink id={p.ledgerEntryId} /> },
          { label: 'Recorded', value: formatInstant(p.recordedAt) },
          { label: 'Recorded by', value: p.recordedBy === me ? 'You' : directory.nameOf(p.recordedBy) },
          { label: 'Status', value: label(p.status) },
          { label: 'Payment ID', value: <Identifier value={p.id} label="payment ID" /> },
        ]}
        actions={
          <>
            <Button onClick={onAnother}><Plus />Record another</Button>
            <Button variant="outline" asChild><Link href="/contributions">All payments</Link></Button>
          </>
        }
      >
        <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Where it went</p>
        <ul className="divide-y text-sm">
          {p.allocations.map((a) => (
            <li key={a.productId} className="flex justify-between gap-3 py-1.5">
              <span>{a.productName} <span className="text-muted-foreground">{a.productCode}</span></span>
              <Amount value={a.amountMinor} currency={p.currency} />
            </li>
          ))}
        </ul>
      </Receipt>
    </div>
  );
}

function ContributionForm({ initialMember, onDone }: { initialMember: string; onDone(p: PaymentView): void }) {
  const currency = useCurrency();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const schema = useMemo(
    () =>
      z
        .object({
          memberUserId: z.string().min(1, 'Choose a member'),
          amount: moneySchema(currency),
          ...paymentShape,
          paidOn: pastDateSchema,
          notes: z.string().trim().max(300, 'At most 300 characters').optional(),
        })
        .superRefine(requireReference),
    [currency],
  );
  type In = z.input<typeof schema>;
  type Out = z.output<typeof schema>;
  const form = useForm<In, unknown, Out>({
    resolver: zResolver(schema),
    defaultValues: { memberUserId: initialMember === me ? '' : initialMember, amount: '', method: 'MPESA', reference: '', paidOn: todayNairobi(), notes: '' },
  });
  const [messages, setMessages] = useState<string[]>([]);
  const [split, setSplit] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState<string | null>(null);
  // Review → Confirm: the validated values wait here until the official confirms.
  const [step, setStep] = useState<TransactionStep>('edit');
  const [pending, setPending] = useState<Out | null>(null);
  const [confirming, setConfirming] = useState(false);
  const memberUserId = form.watch('memberUserId');
  const amountText = form.watch('amount');
  const method = form.watch('method');
  const reference = form.watch('reference');
  const paidOn = form.watch('paidOn');

  const standings = useQuery({ queryKey: ['contributions', 'standings', false], queryFn: () => contributionsApi.standings(false) });
  const standing = standings.data?.find((s) => s.memberUserId === memberUserId);
  const accounts = useQuery({
    queryKey: ['memberAccounts', { memberUserId, status: 'ACTIVE' }],
    queryFn: () => memberAccountsApi.list({ memberUserId, status: 'ACTIVE' }),
    enabled: !!memberUserId && split,
  });
  useEffect(() => { setSplitAmounts({}); }, [memberUserId]);

  let total = 0;
  try { total = amountText ? parseMoney(amountText, currency) : 0; } catch { total = 0; }
  const parsedSplit = Object.entries(splitAmounts).map(([productId, v]) => {
    try { return { productId, amountMinor: v.trim() ? parseMoney(v, currency) : 0, bad: false }; } catch { return { productId, amountMinor: 0, bad: true }; }
  });
  const allocated = parsedSplit.reduce((s, a) => s + a.amountMinor, 0);
  const remaining = total - allocated;

  const record = useApiMutation(contributionsApi.record, { invalidate: keys('contribution'), toastErrors: false });

  /** Checks the split, then moves to review. Nothing is sent yet. */
  function review(v: Out) {
    setMessages([]);
    setSplitError(null);
    if (split) {
      if (parsedSplit.some((a) => a.bad)) return setSplitError('Fix the amounts in the split.');
      const chosen = parsedSplit.filter((a) => a.amountMinor > 0);
      if (chosen.length === 0) return setSplitError('Enter at least one amount, or turn the split off.');
      if (remaining !== 0) return setSplitError(`The split must add up to ${formatMoney(v.amount, currency)}.`);
    }
    setPending(v);
    setStep('review');
  }

  async function confirm() {
    if (!pending) return;
    const v = pending;
    const allocations = split ? parsedSplit.filter((a) => a.amountMinor > 0).map(({ productId, amountMinor }) => ({ productId, amountMinor })) : undefined;
    setConfirming(true);
    try {
      const res = await record.mutateAsync({
        memberUserId: v.memberUserId,
        amountMinor: v.amount,
        method: v.method,
        reference: normaliseReference(v.method, v.reference),
        paidOn: v.paidOn,
        notes: opt(v.notes),
        allocations,
      });
      onDone(res.data);
    } catch (e) {
      setStep('edit');
      setPending(null);
      const err = normaliseError(e);
      if (err.code === 'CONTRIBUTION_DUPLICATE_REFERENCE') {
        form.setError('reference', { message: err.message }, { shouldFocus: true });
        return;
      }
      const unmatched = applyApiErrors(form, e);
      const allocationErrors = Object.entries(err.fieldErrors).filter(([k]) => k.startsWith('allocations')).map(([, m]) => m);
      if (allocationErrors.length) setSplitError(allocationErrors.join(' '));
      setMessages(unmatched.length ? unmatched.filter((m) => !allocationErrors.includes(m)) : err.hasFieldErrors() ? [] : [err.message]);
    } finally {
      setConfirming(false);
    }
  }

  const errors = form.formState.errors;
  const reviewing = step === 'review';
  const member = memberUserId ? directory.byUserId.get(memberUserId) : undefined;
  const splitLines = parsedSplit.filter((a) => a.amountMinor > 0);
  const productName = (id: string) => accounts.data?.find((a) => a.productId === id)?.productName ?? 'Product';

  const summary = (
    <TransactionSummary
      step={step}
      rows={[
        { label: 'Member', value: member ? memberLabel(memberName(member), member.memberNumber) : <span className="text-muted-foreground">Not chosen</span> },
        { label: 'Account', value: split ? `Split across ${splitLines.length || '—'} product${splitLines.length === 1 ? '' : 's'}` : 'Automatic allocation' },
        ...(split ? splitLines.map((a) => ({ label: <span className="pl-3">{productName(a.productId)}</span>, value: <Amount value={a.amountMinor} currency={currency} /> })) : []),
        { label: 'Channel', value: label(method) },
        { label: method === 'MPESA' ? 'M-Pesa code' : method === 'BANK' ? 'Bank slip' : 'Reference', value: reference ? <Identifier value={method === 'MPESA' ? reference.toUpperCase() : reference} copy={false} /> : '—' },
        { label: 'Value date', value: paidOn ? formatDate(paidOn) : '—' },
        { label: 'Amount', value: <Amount value={total} currency={currency} className="text-base" />, emphasis: true },
      ]}
      footer={
        reviewing ? (
          <div className="flex flex-wrap justify-end gap-2 py-1">
            <Button type="button" variant="outline" size="sm" onClick={() => { setStep('edit'); setPending(null); }} disabled={confirming}><ArrowLeft />Back to edit</Button>
            <Button type="button" size="sm" onClick={confirm} loading={confirming}>Confirm and record</Button>
          </div>
        ) : (
          <div className="flex justify-end py-1">
            <Button type="submit" form="record-contribution" size="sm" loading={form.formState.isSubmitting}>Review</Button>
          </div>
        )
      }
    />
  );

  return (
    <div className="space-y-3">
      <PageHeader back={{ href: '/contributions', label: 'Contributions' }} title="Record a contribution" description="Record money a member paid. You can't record your own." />
      <TransactionLayout
        summary={summary}
        form={
          <form id="record-contribution" onSubmit={form.handleSubmit(review)} className="space-y-3" noValidate>
            <fieldset disabled={reviewing} className="space-y-3 disabled:opacity-75">
              <Section title="Payment">
                <div className="space-y-4">
                  <FormAlert messages={messages} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Member"
                      required
                      error={errors.memberUserId}
                      hint={standing && (standing.arrearsMinor > 0
                        ? <span className="text-destructive">In arrears: {formatMoney(standing.arrearsMinor, currency)}</span>
                        : standing.advanceMinor > 0 ? <>Paid ahead: {formatMoney(standing.advanceMinor, currency)}</> : 'Up to date')}
                    >
                      <Controller
                        control={form.control}
                        name="memberUserId"
                        render={({ field }) => <MemberPicker ref={field.ref} value={field.value} onChange={(id) => field.onChange(id ?? '')} statuses={['ACTIVE', 'SUSPENDED']} exclude={[me]} disabled={reviewing} />}
                      />
                    </Field>
                    <Field label="Amount" required error={errors.amount}><MoneyInput {...form.register('amount')} /></Field>
                  </div>
                  <PaymentFields form={form} dateField="paidOn" dateLabel="Date paid" />
                  <Field label="Notes" error={errors.notes}><Textarea {...form.register('notes')} maxLength={300} rows={2} /></Field>
                </div>
              </Section>

              <Section
                title="Split across products"
                description="Off: the payment clears the oldest dues first (by product priority) and the rest goes to Deposits."
                actions={<div className="flex items-center gap-2"><Switch id="split" checked={split} onCheckedChange={setSplit} disabled={!memberUserId || reviewing} /><Label htmlFor="split">Split</Label></div>}
              >
                {!split ? <p className="text-sm text-muted-foreground">Automatic allocation.</p> : !memberUserId ? <p className="text-sm text-muted-foreground">Choose a member first.</p> : accounts.isLoading ? <p className="text-sm text-muted-foreground">Loading their accounts…</p> : (
                  <div className="space-y-3">
                    {(accounts.data ?? []).map((a) => (
                      <div key={a.id} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem]">
                        <Label htmlFor={`split-${a.productId}`} className="font-normal">{a.productName} <span className="ident text-xs text-muted-foreground">{a.accountNumber}</span></Label>
                        <MoneyInput id={`split-${a.productId}`} value={splitAmounts[a.productId] ?? ''} onChange={(e) => setSplitAmounts((s) => ({ ...s, [a.productId]: e.target.value }))} />
                      </div>
                    ))}
                    {accounts.data?.length === 0 && <p className="text-sm text-muted-foreground">This member has no open accounts.</p>}
                    <p className={remaining === 0 ? 'text-sm text-success' : 'text-sm text-warning-text'} aria-live="polite">
                      {remaining === 0 ? 'Fully allocated.' : remaining > 0 ? <>Left to allocate: {formatMoney(remaining, currency)}</> : <>Over by {formatMoney(-remaining, currency)}</>}
                    </p>
                    {splitError && <p className="text-sm text-destructive">{splitError}</p>}
                  </div>
                )}
                {!split && splitError && <p className="text-sm text-destructive">{splitError}</p>}
              </Section>
            </fieldset>
          </form>
        }
      />
    </div>
  );
}
