'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, Plus } from 'lucide-react';
import { contributionsApi, memberAccountsApi } from '@/api/endpoints/savings';
import { normaliseError } from '@/api/errors';
import type { PaymentView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { MoneyText, PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { MoneyInput, PaymentFields } from '@/components/shared/MoneyFields';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Label, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCurrency, useMyUserId } from '@/hooks/useSessionInfo';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { keys } from '@/lib/invalidation';
import { formatDate, formatMoney, memberLabel, parseMoney, todayNairobi } from '@/lib/format';
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
  if (result) {
    return (
      <div className="space-y-5">
        <PageHeader title="Contribution recorded" />
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle><MoneyText value={result.amountMinor} currency={result.currency} /> from {memberLabel(result.memberName, result.memberNumber)}</AlertTitle>
          <AlertDescription>
            {label(result.method)}{result.reference && ` ${result.reference}`} · paid {formatDate(result.paidOn)}
          </AlertDescription>
        </Alert>
        <Section title="Where it went">
          <ul className="divide-y">
            {result.allocations.map((a) => (
              <li key={a.productId} className="flex justify-between py-2 text-sm">
                <span>{a.productName} <span className="text-muted-foreground">{a.productCode}</span></span>
                <MoneyText value={a.amountMinor} currency={result.currency} />
              </li>
            ))}
          </ul>
        </Section>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setResult(null); setFormKey((k) => k + 1); }}><Plus />Record another</Button>
          <Button variant="outline" asChild><Link href="/contributions">All payments</Link></Button>
        </div>
      </div>
    );
  }
  return <ContributionForm key={formKey} initialMember={params.get('member') ?? ''} onDone={setResult} />;
}

function ContributionForm({ initialMember, onDone }: { initialMember: string; onDone(p: PaymentView): void }) {
  const currency = useCurrency();
  const me = useMyUserId();
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
  const form = useForm<In, unknown, z.output<typeof schema>>({
    resolver: zResolver(schema),
    defaultValues: { memberUserId: initialMember === me ? '' : initialMember, amount: '', method: 'MPESA', reference: '', paidOn: todayNairobi(), notes: '' },
  });
  const [messages, setMessages] = useState<string[]>([]);
  const [split, setSplit] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, string>>({});
  const [splitError, setSplitError] = useState<string | null>(null);
  const memberUserId = form.watch('memberUserId');
  const amountText = form.watch('amount');

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

  async function submit(v: z.output<typeof schema>) {
    setMessages([]);
    setSplitError(null);
    let allocations: { productId: string; amountMinor: number }[] | undefined;
    if (split) {
      if (parsedSplit.some((a) => a.bad)) return setSplitError('Fix the amounts in the split.');
      allocations = parsedSplit.filter((a) => a.amountMinor > 0).map(({ productId, amountMinor }) => ({ productId, amountMinor }));
      if (allocations.length === 0) return setSplitError('Enter at least one amount, or turn the split off.');
      if (remaining !== 0) return setSplitError(`The split must add up to ${formatMoney(v.amount, currency)}.`);
    }
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
      const err = normaliseError(e);
      if (err.code === 'CONTRIBUTION_DUPLICATE_REFERENCE') {
        form.setError('reference', { message: err.message }, { shouldFocus: true });
        return;
      }
      const unmatched = applyApiErrors(form, e);
      const allocationErrors = Object.entries(err.fieldErrors).filter(([k]) => k.startsWith('allocations')).map(([, m]) => m);
      if (allocationErrors.length) setSplitError(allocationErrors.join(' '));
      setMessages(unmatched.length ? unmatched.filter((m) => !allocationErrors.includes(m)) : err.hasFieldErrors() ? [] : [err.message]);
    }
  }

  const errors = form.formState.errors;
  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/contributions', label: 'Contributions' }} title="Record a contribution" description="Record money a member paid. You can't record your own." />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
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
                  render={({ field }) => <MemberPicker ref={field.ref} value={field.value} onChange={(id) => field.onChange(id ?? '')} statuses={['ACTIVE', 'SUSPENDED']} exclude={[me]} />}
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
          actions={<div className="flex items-center gap-2"><Switch id="split" checked={split} onCheckedChange={setSplit} disabled={!memberUserId} /><Label htmlFor="split">Split</Label></div>}
        >
          {!split ? <p className="text-sm text-muted-foreground">Automatic allocation.</p> : !memberUserId ? <p className="text-sm text-muted-foreground">Choose a member first.</p> : accounts.isLoading ? <p className="text-sm text-muted-foreground">Loading their accounts…</p> : (
            <div className="space-y-3">
              {(accounts.data ?? []).map((a) => (
                <div key={a.id} className="grid items-center gap-2 sm:grid-cols-[1fr_12rem]">
                  <Label htmlFor={`split-${a.productId}`} className="font-normal">{a.productName} <span className="text-xs text-muted-foreground">{a.accountNumber}</span></Label>
                  <MoneyInput id={`split-${a.productId}`} value={splitAmounts[a.productId] ?? ''} onChange={(e) => setSplitAmounts((s) => ({ ...s, [a.productId]: e.target.value }))} />
                </div>
              ))}
              {accounts.data?.length === 0 && <p className="text-sm text-muted-foreground">This member has no open accounts.</p>}
              <p className={remaining === 0 ? 'text-sm text-success' : 'text-sm text-warning'} aria-live="polite">
                {remaining === 0 ? 'Fully allocated.' : remaining > 0 ? <>Left to allocate: {formatMoney(remaining, currency)}</> : <>Over by {formatMoney(-remaining, currency)}</>}
              </p>
              {splitError && <p className="text-sm text-destructive">{splitError}</p>}
            </div>
          )}
        </Section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>Record contribution</Button>
        </div>
      </form>
    </div>
  );
}
