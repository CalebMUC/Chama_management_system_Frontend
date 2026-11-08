'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Check, Coins, LineChart, Lock, Receipt, Undo2, X } from 'lucide-react';
import { investmentsApi } from '@/api/endpoints/spending';
import type { InvestmentDetailView } from '@/api/types';
import { ApprovalProgress } from '@/components/shared/ApprovalProgress';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, EntryLink, MoneyText, PageHeader, Section, SignedMoney, StatusChip } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { GatedButton } from '@/components/shared/GatedButton';
import { MoneyInput, PastDateInput } from '@/components/shared/MoneyFields';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui/primitives';
import { CashBalances } from '@/features/books/CashBalances';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useCurrency, useMyUserId } from '@/hooks/useSessionInfo';
import { formatBp, formatDate, formatInstant, formatMoney, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';
import { moneySchema, pastDateSchema } from '@/lib/schemas';
import { opt } from '@/lib/utils';

export default function InvestmentDetailPage() {
  return (
    <Guard permission="INVESTMENT_VIEW" feature="INVESTMENTS">
      <InvestmentDetail />
    </Guard>
  );
}

function InvestmentDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['investments', 'detail', id], queryFn: () => investmentsApi.get(id) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  return <InvestmentView detail={q.data} />;
}

type Dialog = 'approve' | 'reject' | 'cancel' | 'fund' | 'deposit' | 'income' | 'withdraw' | 'value' | 'close' | null;

/** README §7.11. */
function InvestmentView({ detail }: { detail: InvestmentDetailView }) {
  const i = detail.investment;
  const can = useCan();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const [dialog, setDialog] = useState<Dialog>(null);
  const opts = { invalidate: keys('investment'), toastErrors: false };
  const approve = useApiMutation((note: string) => investmentsApi.approve(i.id, note || undefined), opts);
  const reject = useApiMutation((reason: string) => investmentsApi.reject(i.id, reason), opts);
  const cancel = useApiMutation(() => investmentsApi.cancel(i.id), opts);
  const fund = useApiMutation((b: Parameters<typeof investmentsApi.fund>[1]) => investmentsApi.fund(i.id, b), opts);
  const deposit = useApiMutation((b: Parameters<typeof investmentsApi.deposit>[1]) => investmentsApi.deposit(i.id, b), opts);
  const income = useApiMutation((b: Parameters<typeof investmentsApi.income>[1]) => investmentsApi.income(i.id, b), opts);
  const withdraw = useApiMutation((b: Parameters<typeof investmentsApi.withdraw>[1]) => investmentsApi.withdraw(i.id, b), opts);
  const close = useApiMutation((b: Parameters<typeof investmentsApi.close>[1]) => investmentsApi.close(i.id, b), opts);

  const c = i.currency;
  const proposer = i.proposedBy === me;
  const approvedByMe = i.approvals.some((a) => a.approverUserId === me);
  const shut = (o: boolean) => !o && setDialog(null);
  const manage = can('INVESTMENT_MANAGE');
  const p = i.performance;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/investments', label: 'Investments' }}
        title={<span className="flex flex-wrap items-center gap-2">{i.name}<StatusChip status={i.status} /></span>}
        description={<>{label(i.type)}{i.institution && ` · ${i.institution}`}</>}
        actions={
          <>
            {i.status === 'PROPOSED' && can('INVESTMENT_APPROVE') && (
              <GatedButton blocked={proposer ? 'You proposed this investment, so someone else must approve it.' : approvedByMe && 'You have already approved this investment.'} onClick={() => setDialog('approve')}><Check />Approve</GatedButton>
            )}
            {(i.status === 'PROPOSED' || i.status === 'APPROVED') && can('INVESTMENT_APPROVE') && (
              <GatedButton variant="outline" blocked={proposer && 'You proposed this investment, so someone else must reject it.'} onClick={() => setDialog('reject')}><X />Reject</GatedButton>
            )}
            {i.status === 'APPROVED' && manage && <Button onClick={() => setDialog('fund')}><Banknote />Fund</Button>}
            {(i.status === 'PROPOSED' || i.status === 'APPROVED') && manage && proposer && <Button variant="ghost" onClick={() => setDialog('cancel')}><Undo2 />Cancel</Button>}
          </>
        }
      />

      {i.status === 'ACTIVE' && manage && (
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog('deposit')}><ArrowDownToLine />Deposit</Button>
          <Button variant="outline" size="sm" onClick={() => setDialog('income')}><Coins />Record income</Button>
          <Button variant="outline" size="sm" onClick={() => setDialog('withdraw')}><ArrowUpFromLine />Withdraw</Button>
          <Button variant="outline" size="sm" onClick={() => setDialog('value')}><LineChart />Record valuation</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDialog('close')}><Lock />Close</Button>
        </div>
      )}

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <DetailList
            columns={4}
            items={[
              { label: 'Amount', value: <MoneyText value={i.amountMinor} currency={c} /> },
              { label: 'Book value', value: <MoneyText value={i.bookValueMinor} currency={c} className="font-semibold" /> },
              { label: 'Market value', value: <>{<MoneyText value={i.marketValueMinor} currency={c} className="font-semibold" />}{i.latestValuationOn && <span className="block text-xs text-muted-foreground">valued {formatDate(i.latestValuationOn)}</span>}</> },
              { label: 'Income', value: <MoneyText value={i.incomeMinor} currency={c} /> },
              i.expectedReturnBasisPoints !== null ? { label: 'Expected return', value: `${formatBp(i.expectedReturnBasisPoints)} a year` } : null,
              i.maturityDate ? { label: 'Matures', value: formatDate(i.maturityDate) } : null,
              i.fundedOn ? { label: 'Funded', value: formatDate(i.fundedOn) } : null,
              i.closedOn ? { label: 'Closed', value: <>{formatDate(i.closedOn)} · proceeds <MoneyText value={i.closingProceedsMinor} currency={c} /></> } : null,
              { label: 'Proposed by', value: i.proposedByName ?? directory.nameOf(i.proposedBy) },
              i.description ? { label: 'Description', value: i.description } : null,
              i.rejectionReason ? { label: 'Rejected', value: `${directory.nameOf(i.rejectedBy)}: ${i.rejectionReason}` } : null,
              i.cancelledAt ? { label: 'Cancelled', value: formatInstant(i.cancelledAt) } : null,
            ]}
          />
          <Can permission="EXPENSE_VIEW" feature="EXPENSES">
            {i.status !== 'PROPOSED' && <Link href={`/expenses?investmentId=${i.id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><Receipt className="size-4" />Expenses for this investment</Link>}
          </Can>
        </CardContent>
      </Card>

      {p && (
        <Section title={<span className="flex items-center gap-2">Performance {p.profitable ? <Badge variant="success">Profitable</Badge> : <Badge variant="destructive">At a loss</Badge>}</span>}>
          <DetailList
            columns={4}
            items={[
              { label: 'Invested', value: <MoneyText value={p.investedMinor} currency={c} /> },
              { label: 'Income', value: <MoneyText value={p.incomeMinor} currency={c} /> },
              { label: 'Expenses', value: <MoneyText value={p.expensesMinor} currency={c} /> },
              { label: 'Net income', value: <SignedMoney value={p.netIncomeMinor} currency={c} /> },
              { label: p.gainRealised ? 'Realised gain' : 'Unrealised gain', value: <SignedMoney value={p.gainMinor} currency={c} /> },
              { label: 'Total return', value: <SignedMoney value={p.totalReturnMinor} currency={c} /> },
              { label: 'Return', value: <span className={p.returnBasisPoints < 0 ? 'text-destructive' : 'text-success'}>{formatBp(p.returnBasisPoints)}</span> },
              p.annualisedReturnBasisPoints !== null ? { label: 'Annualised', value: `${formatBp(p.annualisedReturnBasisPoints)} a year` } : null,
              { label: 'Days held', value: p.daysHeld },
            ]}
          />
        </Section>
      )}

      {(i.approvals.length > 0 || i.status === 'PROPOSED') && (
        <Section title="Approvals"><div className="max-w-md"><ApprovalProgress approvals={i.approvals} required={i.requiredApprovals} /></div></Section>
      )}

      {detail.transactions.length > 0 && (
        <Section title="Transactions">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Note</TableHead>
                  {can('LEDGER_VIEW') && <TableHead>Entry</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                    <TableCell>{label(t.kind)}</TableCell>
                    <TableCell className="text-right"><MoneyText value={t.amountMinor} currency={c} /></TableCell>
                    <TableCell>{label(t.method)}{t.reference && <span className="ml-1 font-mono text-xs text-muted-foreground">{t.reference}</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.note ?? ''}</TableCell>
                    {can('LEDGER_VIEW') && <TableCell><EntryLink id={t.ledgerEntryId} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}

      {detail.valuations.length > 0 && (
        <Section title="Valuations">
          <ul className="divide-y">
            {detail.valuations.map((v) => (
              <li key={v.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                <span>{formatDate(v.valuedOn)}{v.note && <span className="text-muted-foreground"> · {v.note}</span>}</span>
                <MoneyText value={v.valueMinor} currency={c} className="font-medium" />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ReasonDialog open={dialog === 'approve'} onOpenChange={shut} title="Approve this investment?" description={<><MoneyText value={i.amountMinor} currency={c} /> into {i.name}. Approvals so far: {i.approvals.length} of {i.requiredApprovals}.</>} confirmLabel="Approve" destructive={false} optional onConfirm={(n) => approve.mutateAsync(n)} />
      <ReasonDialog open={dialog === 'reject'} onOpenChange={shut} title="Reject this investment?" confirmLabel="Reject" onConfirm={(r) => reject.mutateAsync(r)} />
      <ConfirmDialog open={dialog === 'cancel'} onOpenChange={shut} title="Cancel this proposal?" description="Withdraw your proposal. It can't be approved or funded afterwards." confirmLabel="Cancel proposal" destructive onConfirm={() => cancel.mutateAsync(undefined)} />
      <PaymentDialog
        open={dialog === 'fund'}
        onOpenChange={shut}
        title="Fund this investment"
        description={<>Put in the approved <MoneyText value={i.amountMinor} currency={c} className="font-semibold" />.</>}
        summary={<CashBalances />}
        dateField="fundedOn"
        dateLabel="Date funded"
        submitLabel={`Fund ${formatMoney(i.amountMinor, c)}`}
        onSubmit={(v) => fund.mutateAsync({ method: v.method, reference: v.reference, fundedOn: v.date })}
      />
      <PaymentDialog
        open={dialog === 'deposit'}
        onOpenChange={shut}
        title="Deposit more"
        summary={<CashBalances />}
        amount={{}}
        note
        dateField="depositedOn"
        submitLabel="Record deposit"
        onSubmit={(v) => deposit.mutateAsync({ amountMinor: v.amountMinor!, method: v.method, reference: v.reference, depositedOn: v.date, note: v.note })}
      />
      <PaymentDialog
        open={dialog === 'income'}
        onOpenChange={shut}
        title="Record income"
        description="Interest, dividends or rent. Reinvested income adds to the book value instead of coming in as cash."
        amount={{}}
        note
        methods={['CASH', 'BANK', 'MPESA', 'REINVESTED']}
        dateField="receivedOn"
        dateLabel="Received on"
        submitLabel="Record income"
        onSubmit={(v) => income.mutateAsync({ amountMinor: v.amountMinor!, method: v.method, reference: v.reference, receivedOn: v.date, note: v.note })}
      />
      <PaymentDialog
        open={dialog === 'withdraw'}
        onOpenChange={shut}
        title="Withdraw"
        amount={{ max: Math.max(0, i.bookValueMinor - 1), hint: <>Less than the book value of {formatMoney(i.bookValueMinor, c)}. To take everything out, close the investment.</> }}
        note
        dateField="withdrawnOn"
        dateLabel="Withdrawn on"
        submitLabel="Record withdrawal"
        onSubmit={(v) => withdraw.mutateAsync({ amountMinor: v.amountMinor!, method: v.method, reference: v.reference, withdrawnOn: v.date, note: v.note })}
      />
      <PaymentDialog
        open={dialog === 'close'}
        onOpenChange={shut}
        title="Close this investment"
        description="Record everything that came back. The gain or loss is posted to the books."
        amount={{ label: 'Proceeds', allowZero: true, defaultMinor: i.marketValueMinor }}
        preview={(proceeds) => proceeds === null ? null : (
          <span>{proceeds - i.bookValueMinor >= 0 ? 'Gain' : 'Loss'}: <SignedMoney value={proceeds - i.bookValueMinor} currency={c} /> <span className="text-muted-foreground">(proceeds − book value {formatMoney(i.bookValueMinor, c)})</span></span>
        )}
        note
        dateField="closedOn"
        dateLabel="Closed on"
        submitLabel="Close investment"
        destructive
        onSubmit={(v) => close.mutateAsync({ proceedsMinor: v.amountMinor!, method: v.method, reference: v.reference, closedOn: v.date, note: v.note })}
      />
      <ValuationDialog open={dialog === 'value'} onOpenChange={shut} investmentId={i.id} />
    </div>
  );
}

function ValuationDialog({ open, onOpenChange, investmentId }: { open: boolean; onOpenChange(o: boolean): void; investmentId: string }) {
  const currency = useCurrency();
  const schema = z.object({ value: moneySchema(currency, { allowZero: true }), valuedOn: pastDateSchema, note: z.string().trim().max(300).optional() });
  const value = useApiMutation((v: z.output<typeof schema>) => investmentsApi.value(investmentId, { valueMinor: v.value, valuedOn: v.valuedOn, note: opt(v.note) }), { invalidate: keys('investment'), toastErrors: false });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record a valuation"
      description="What the investment is worth now. No money moves; it updates the market value and unrealised gain."
      schema={schema}
      defaultValues={{ value: '', valuedOn: todayNairobi(), note: '' }}
      submitLabel="Record valuation"
      onSubmit={(v) => value.mutateAsync(v)}
    >
      {(form) => (
        <>
          <Field label="Value" required error={form.formState.errors.value}><MoneyInput {...form.register('value')} /></Field>
          <Field label="Valued on" required error={form.formState.errors.valuedOn}><PastDateInput {...form.register('valuedOn')} /></Field>
          <Field label="Note" error={form.formState.errors.note}><Textarea {...form.register('note')} maxLength={300} rows={2} /></Field>
        </>
      )}
    </FormDialog>
  );
}
