'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { ledgerApi } from '@/api/endpoints/books';
import { normaliseError } from '@/api/errors';
import { Guard } from '@/components/shared/Can';
import { MoneyText, PageHeader, Section } from '@/components/shared/Display';
import { Field, FieldMessage } from '@/components/shared/Field';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { MoneyInput, PastDateInput } from '@/components/shared/MoneyFields';
import { FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Input, NativeSelect, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCurrency } from '@/hooks/useSessionInfo';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { parseMoney, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { pastDateSchema, requiredText } from '@/lib/schemas';
import { opt } from '@/lib/utils';

const line = z.object({
  accountCode: z.string().min(1, 'Choose an account'),
  memberUserId: z.string().optional(),
  debitMinor: z.string().trim().optional(),
  creditMinor: z.string().trim().optional(),
  memo: z.string().trim().max(200, 'At most 200 characters').optional(),
});
const schema = z.object({
  entryDate: pastDateSchema,
  description: requiredText(500, 'Describe the entry'),
  reference: z.string().trim().max(100).optional(),
  lines: z.array(line).min(2, 'At least two lines').max(200, 'At most 200 lines'),
});
type Values = z.infer<typeof schema>;
const emptyLine = { accountCode: '', memberUserId: '', debitMinor: '', creditMinor: '', memo: '' };

export default function NewEntryPage() {
  return (
    <Guard permission="LEDGER_POST">
      <NewEntry />
    </Guard>
  );
}

/** README §7.12: a balanced manual journal entry. Member is required only on member-ledger accounts. */
function NewEntry() {
  const router = useRouter();
  const currency = useCurrency();
  const accounts = useQuery({ queryKey: ['ledger', 'accounts'], queryFn: ledgerApi.accounts });
  const active = useMemo(() => (accounts.data ?? []).filter((a) => a.active).sort((a, b) => a.code.localeCompare(b.code)), [accounts.data]);
  const byCode = useMemo(() => new Map(active.map((a) => [a.code, a])), [active]);
  const form = useForm<Values>({ resolver: zResolver(schema), defaultValues: { entryDate: todayNairobi(), description: '', reference: '', lines: [emptyLine, emptyLine] } });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const [messages, setMessages] = useState<string[]>([]);
  const post = useApiMutation(ledgerApi.post, { invalidate: keys('ledger'), toastErrors: false });

  const lines = form.watch('lines');
  const toMinor = (v?: string) => {
    if (!v) return 0;
    try { return parseMoney(v, currency); } catch { return NaN; }
  };
  const debits = lines.reduce((s, l) => s + (toMinor(l.debitMinor) || 0), 0);
  const credits = lines.reduce((s, l) => s + (toMinor(l.creditMinor) || 0), 0);
  const diff = debits - credits;
  const balanced = debits > 0 && diff === 0;

  async function submit(v: Values) {
    setMessages([]);
    let bad = false;
    const body = v.lines.map((l, i) => {
      const acct = byCode.get(l.accountCode);
      const d = toMinor(l.debitMinor);
      const c = toMinor(l.creditMinor);
      if (Number.isNaN(d)) { form.setError(`lines.${i}.debitMinor`, { message: 'Bad amount' }); bad = true; }
      if (Number.isNaN(c)) { form.setError(`lines.${i}.creditMinor`, { message: 'Bad amount' }); bad = true; }
      if ((d > 0) === (c > 0)) { form.setError(`lines.${i}.debitMinor`, { message: 'Enter a debit or a credit' }); bad = true; }
      if (acct?.memberLedger && !l.memberUserId) { form.setError(`lines.${i}.memberUserId`, { message: 'Choose the member' }); bad = true; }
      return { accountCode: l.accountCode, debitMinor: d > 0 ? d : undefined, creditMinor: c > 0 ? c : undefined, memberUserId: acct?.memberLedger ? l.memberUserId || undefined : undefined, memo: opt(l.memo) };
    });
    if (bad || !balanced) return;
    try {
      const res = await post.mutateAsync({ entryDate: v.entryDate, description: v.description, reference: opt(v.reference), lines: body });
      router.push(`/ledger/journal/${res.data.id}`);
    } catch (e) {
      const unmatched = applyApiErrors(form, e);
      const err = normaliseError(e);
      setMessages(unmatched.length ? unmatched : err.hasFieldErrors() ? [] : [err.message]);
    }
  }

  if (accounts.isLoading) return <LoadingState />;
  const errors = form.formState.errors;

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/ledger/journal', label: 'Journal' }} title="Manual journal entry" description="For corrections and transactions no other screen records. Debits must equal credits." />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        <Section title="Entry">
          <div className="space-y-4">
            <FormAlert messages={messages} />
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr_14rem]">
              <Field label="Date" required error={errors.entryDate}><PastDateInput {...form.register('entryDate')} /></Field>
              <Field label="Description" required error={errors.description}><Textarea {...form.register('description')} maxLength={500} rows={1} /></Field>
              <Field label="Reference" error={errors.reference}><Input {...form.register('reference')} maxLength={100} /></Field>
            </div>
          </div>
        </Section>

        <Section title="Lines" actions={<Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine)} disabled={fields.length >= 200}><Plus />Add line</Button>}>
          <div className="space-y-3">
            {errors.lines?.root?.message && <p className="text-sm text-destructive">{errors.lines.root.message}</p>}
            {fields.map((f, i) => {
              const acct = byCode.get(lines[i]?.accountCode ?? '');
              const le = errors.lines?.[i];
              return (
                <div key={f.id} className="grid gap-2 rounded-md border p-3 lg:grid-cols-[minmax(14rem,2fr)_minmax(12rem,1.5fr)_9rem_9rem_minmax(8rem,1fr)_auto] lg:items-start lg:border-0 lg:p-0">
                  <div>
                    <NativeSelect {...form.register(`lines.${i}.accountCode`)} aria-label={`Line ${i + 1} account`} aria-invalid={!!le?.accountCode}>
                      <option value="">Account…</option>
                      {ACCOUNT_TYPES.map((t) => (
                        <optgroup key={t.type} label={t.label}>
                          {active.filter((a) => a.type === t.type).map((a) => <option key={a.id} value={a.code}>{a.code} · {a.name}</option>)}
                        </optgroup>
                      ))}
                    </NativeSelect>
                    <FieldMessage error={le?.accountCode} />
                  </div>
                  <div>
                    {acct?.memberLedger ? (
                      <>
                        <Controller control={form.control} name={`lines.${i}.memberUserId`} render={({ field }) => <MemberPicker ref={field.ref} value={field.value} onChange={(id) => field.onChange(id ?? '')} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} aria-invalid={!!le?.memberUserId} />} />
                        <FieldMessage error={le?.memberUserId} />
                      </>
                    ) : <span className="hidden text-xs text-muted-foreground lg:block lg:pt-2">{acct ? 'No member needed' : ''}</span>}
                  </div>
                  <div><MoneyInput placeholder="Debit" aria-label={`Line ${i + 1} debit`} {...form.register(`lines.${i}.debitMinor`)} /><FieldMessage error={le?.debitMinor} /></div>
                  <div><MoneyInput placeholder="Credit" aria-label={`Line ${i + 1} credit`} {...form.register(`lines.${i}.creditMinor`)} /><FieldMessage error={le?.creditMinor} /></div>
                  <div><Input placeholder="Memo" aria-label={`Line ${i + 1} memo`} maxLength={200} {...form.register(`lines.${i}.memo`)} /><FieldMessage error={le?.memo} /></div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length <= 2} aria-label={`Remove line ${i + 1}`}><Trash2 /></Button>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t pt-3 text-sm" aria-live="polite">
              <span>Debits <MoneyText value={debits} className="font-semibold" /></span>
              <span>Credits <MoneyText value={credits} className="font-semibold" /></span>
              {balanced ? <Badge variant="success">Balanced</Badge> : <Badge variant="destructive">{debits === 0 && credits === 0 ? 'Enter amounts' : <>Off by <MoneyText value={Math.abs(diff)} /></>}</Badge>}
            </div>
          </div>
        </Section>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push('/ledger/journal')}>Cancel</Button>
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!balanced}>Post entry</Button>
        </div>
      </form>
    </div>
  );
}
