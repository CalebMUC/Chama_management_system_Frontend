'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { loanProductsApi, loansApi } from '@/api/endpoints/loans';
import { normaliseError } from '@/api/errors';
import type { EligibilityView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DetailList, MoneyText, PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle, Badge, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { candidateLabel, GuarantorPicker, useGuarantorCandidates } from '@/features/loans/GuarantorPicker';
import { formatBp, formatMoney, parseMoney } from '@/lib/format';

export default function ApplyPage() {
  return (
    <Guard permission="LOAN_APPLY" feature="LOANS">
      <ApplyForLoan />
    </Guard>
  );
}

/** README §7.9: product → eligibility → amount/term/purpose with a live estimate → guarantors → submit. */
function ApplyForLoan() {
  const router = useRouter();
  const qc = useQueryClient();
  // Plain members can't read the member directory: names come from the guarantor candidates.
  const candidates = useGuarantorCandidates();
  const products = useQuery({ queryKey: ['loanProducts'], queryFn: loanProductsApi.list });
  const active = useMemo(() => (products.data ?? []).filter((p) => p.active), [products.data]);
  const [productId, setProductId] = useState<string>('');
  useEffect(() => {
    if (!productId && active.length) setProductId((active.find((p) => p.defaultProduct) ?? active[0]).id);
  }, [active, productId]);

  const eligibility = useQuery({
    queryKey: ['loans', 'eligibility', productId],
    queryFn: () => loansApi.eligibility(productId),
    enabled: !!productId,
  });
  const e = eligibility.data;

  const [principal, setPrincipal] = useState('');
  const [term, setTerm] = useState('');
  const [purpose, setPurpose] = useState('');
  const [guarantors, setGuarantors] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const currency = e?.currency ?? 'KES';
  let principalMinor = 0;
  try { principalMinor = principal ? parseMoney(principal, currency) : 0; } catch { principalMinor = 0; }
  const termNum = Number(term) || 0;
  const needsGuarantors = !!e && e.guarantorsRequired > 0 && principalMinor > e.guarantorThresholdMinor;
  const interest = e ? Math.round((principalMinor * e.interestBasisPoints) / 10_000) : 0;
  const total = principalMinor + interest;
  const instalment = termNum > 0 ? Math.ceil(total / termNum) : 0;

  function validate(el: EligibilityView) {
    const out: Record<string, string> = {};
    try {
      const p = parseMoney(principal, el.currency);
      if (p <= 0) out.principalMinor = 'Must be more than 0';
      else if (p > el.maxLoanMinor) out.principalMinor = `At most ${formatMoney(el.maxLoanMinor, el.currency)}`;
    } catch (err) {
      out.principalMinor = principal ? (err as Error).message : 'Enter an amount';
    }
    if (!Number.isInteger(termNum) || termNum < 1 || termNum > el.maxTermMonths) out.termMonths = `Enter 1–${el.maxTermMonths} months`;
    if (!purpose.trim()) out.purpose = 'Say what the loan is for';
    else if (purpose.length > 300) out.purpose = 'At most 300 characters';
    if (needsGuarantors && guarantors.length < el.guarantorsRequired) out.guarantorUserIds = `Choose at least ${el.guarantorsRequired} guarantor${el.guarantorsRequired === 1 ? '' : 's'}`;
    if (guarantors.length > 10) out.guarantorUserIds = 'At most 10 guarantors';
    return out;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!e) return;
    const v = validate(e);
    setErrors(v);
    setSubmitError(null);
    if (Object.keys(v).length) return;
    setSubmitting(true);
    try {
      const res = await loansApi.apply({
        productId: e.productId,
        principalMinor,
        termMonths: termNum,
        purpose: purpose.trim(),
        guarantorUserIds: needsGuarantors ? guarantors : undefined,
      });
      await Promise.all(['loans', 'dashboard'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success(res.message || 'Loan application sent.');
      router.push('/me/loans');
    } catch (err) {
      const apiErr = normaliseError(err);
      if (apiErr.hasFieldErrors()) setErrors(apiErr.fieldErrors);
      setSubmitError(apiErr);
    } finally {
      setSubmitting(false);
    }
  }

  if (products.error) return <ErrorState error={products.error} onRetry={() => products.refetch()} />;
  if (!products.data) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/me/loans', label: 'My loans' }} title="Apply for a loan" />
      <Field label="Loan product">
        <NativeSelect value={productId} onChange={(ev) => { setProductId(ev.target.value); setErrors({}); }} className="max-w-sm">
          {active.map((p) => <option key={p.id} value={p.id}>{p.name}{p.defaultProduct ? ' (default)' : ''}</option>)}
        </NativeSelect>
      </Field>

      {eligibility.error ? <ErrorState error={eligibility.error} onRetry={() => eligibility.refetch()} /> : !e ? <LoadingState label="Checking eligibility…" /> : (
        <>
          <Section title="Your eligibility">
            <div className="space-y-4">
              {e.eligible ? (
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>You can borrow up to {formatMoney(e.maxLoanMinor, e.currency)}</AlertTitle>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <XCircle />
                  <AlertTitle>You can&apos;t apply for this product yet</AlertTitle>
                  <AlertDescription><ul className="list-disc pl-4">{e.reasons.map((r) => <li key={r}>{r}</li>)}</ul></AlertDescription>
                </Alert>
              )}
              <DetailList
                columns={4}
                items={[
                  { label: 'Savings counted', value: <MoneyText value={e.savingsMinor} currency={e.currency} /> },
                  { label: 'Multiplier', value: `× ${e.maxMultiplier}` },
                  { label: 'Other loans', value: <MoneyText value={e.otherLoansMinor} currency={e.currency} /> },
                  { label: 'Maximum loan', value: <MoneyText value={e.maxLoanMinor} currency={e.currency} className="font-semibold" /> },
                  { label: 'Interest', value: `${formatBp(e.interestBasisPoints)} flat` },
                  { label: 'Longest term', value: `${e.maxTermMonths} months` },
                  { label: 'Membership', value: `${e.membershipMonths} months (minimum ${e.minMembershipMonths})` },
                  { label: 'Guarantors', value: e.guarantorsRequired > 0 ? `${e.guarantorsRequired} needed above ${formatMoney(e.guarantorThresholdMinor, e.currency)}` : 'Not needed' },
                  { label: 'Approvals needed', value: e.approvalQuorum },
                ]}
              />
            </div>
          </Section>

          <form onSubmit={submit} noValidate>
            <fieldset disabled={!e.eligible || submitting} className="space-y-5">
              <Section title="Loan details">
                <div className="space-y-4">
                  <FormAlert error={submitError && !normaliseError(submitError).hasFieldErrors() ? submitError : undefined} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Amount" required error={errors.principalMinor ? { message: errors.principalMinor } : undefined} hint={`Up to ${formatMoney(e.maxLoanMinor, e.currency)}`}>
                      <MoneyInput currency={e.currency} value={principal} onChange={(ev) => setPrincipal(ev.target.value)} />
                    </Field>
                    <Field label="Term (months)" required error={errors.termMonths ? { message: errors.termMonths } : undefined} hint={`1 to ${e.maxTermMonths}`}>
                      <Input type="number" inputMode="numeric" min={1} max={e.maxTermMonths} value={term} onChange={(ev) => setTerm(ev.target.value)} />
                    </Field>
                  </div>
                  <Field label="Purpose" required error={errors.purpose ? { message: errors.purpose } : undefined}>
                    <Textarea value={purpose} onChange={(ev) => setPurpose(ev.target.value)} maxLength={300} placeholder="e.g. School fees for Term 1" />
                  </Field>
                  {principalMinor > 0 && termNum > 0 && (
                    <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-3">
                      <div><p className="text-xs text-muted-foreground">Interest</p><p className="font-semibold"><MoneyText value={interest} currency={e.currency} /></p></div>
                      <div><p className="text-xs text-muted-foreground">Total repayable</p><p className="font-semibold"><MoneyText value={total} currency={e.currency} /></p></div>
                      <div><p className="text-xs text-muted-foreground">Monthly instalment (estimate)</p><p className="font-semibold">≈ <MoneyText value={instalment} currency={e.currency} /></p></div>
                      <p className="text-xs text-muted-foreground sm:col-span-3">The repayment schedule is set by the chama when the loan is disbursed.</p>
                    </div>
                  )}
                </div>
              </Section>

              {needsGuarantors && (
                <Section title="Guarantors" description={`Loans above ${formatMoney(e.guarantorThresholdMinor, e.currency)} need ${e.guarantorsRequired} member${e.guarantorsRequired === 1 ? '' : 's'} to stand surety. They are asked to accept.`}>
                  <div className="space-y-3">
                    {guarantors.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {guarantors.map((id) => {
                          return (
                            <li key={id}>
                              <Badge variant="secondary" className="gap-1 py-1 pl-2.5 pr-1 text-sm">
                                {candidateLabel(candidates.byUserId.get(id))}
                                <button type="button" onClick={() => setGuarantors((g) => g.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-background" aria-label="Remove guarantor"><X className="size-3" /></button>
                              </Badge>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {guarantors.length < 10 && (
                      <div className="max-w-sm">
                        <GuarantorPicker
                          value={null}
                          onChange={(id) => id && setGuarantors((g) => (g.includes(id) ? g : [...g, id]))}
                          exclude={guarantors}
                          placeholder={`Add a guarantor (${guarantors.length} of ${e.guarantorsRequired})`}
                          aria-invalid={!!errors.guarantorUserIds}
                        />
                      </div>
                    )}
                    {errors.guarantorUserIds && <p className="text-xs text-destructive">{errors.guarantorUserIds}</p>}
                  </div>
                </Section>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.push('/me/loans')}>Cancel</Button>
                <Button type="submit" loading={submitting} disabled={!e.eligible}>Send application</Button>
              </div>
            </fieldset>
          </form>
        </>
      )}
    </div>
  );
}
