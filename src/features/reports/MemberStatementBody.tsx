'use client';

import type { MemberStatementView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { MoneyText, SignedMoney, StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { KeyValue } from '@/components/shared/Panel';
import { StatementDocument } from '@/components/shared/Statement';
import { StatementTable } from '@/components/shared/StatementTable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatDate, formatPeriodKey, fractionDigits } from '@/lib/format';

/** Member statement (README §7.13) as a bank statement: letterhead, member and period, position, then each account. */
export function MemberStatementBody({ s }: { s: MemberStatementView }) {
  const c = s.currency;
  return (
    <StatementDocument
      title="Member statement"
      from={s.from}
      to={s.to}
      generatedAt={s.generatedAt}
      subject={
        <>
          <p className="text-base font-semibold">{s.member.name ?? 'Unknown member'}</p>
          {s.member.memberNumber && <p className="text-muted-foreground">Member number <Identifier value={s.member.memberNumber} label="member number" copy={false} /></p>}
          <p className="text-muted-foreground">{s.chamaName}</p>
        </>
      }
      summary={
        <div className="rounded-md border px-3">
          <KeyValue
            items={[
              { label: 'Savings', value: <MoneyText value={s.savingsMinor} currency={c} /> },
              { label: 'Loans outstanding', value: <MoneyText value={s.loansOutstandingMinor} currency={c} /> },
              { label: 'Penalties owed', value: <MoneyText value={s.penaltiesOutstandingMinor} currency={c} /> },
              { label: 'Net position', value: <SignedMoney value={s.netPositionMinor} currency={c} />, emphasis: true },
            ]}
          />
        </div>
      }
    >
      {s.contributions && (
        <section className="space-y-1.5">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Contributions</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <div><p className="text-xs text-muted-foreground">Paid</p><MoneyText value={s.contributions.totalPaidMinor} currency={c} /></div>
            <div><p className="text-xs text-muted-foreground">Due to date</p><MoneyText value={s.contributions.dueToDateMinor} currency={c} /></div>
            <div><p className="text-xs text-muted-foreground">Arrears</p><MoneyText value={s.contributions.arrearsMinor} currency={c} className={s.contributions.arrearsMinor > 0 ? 'text-destructive' : undefined} /></div>
            <div><p className="text-xs text-muted-foreground">Advance</p><MoneyText value={s.contributions.advanceMinor} currency={c} /></div>
            <div><p className="text-xs text-muted-foreground">Late periods</p>{s.contributions.latePeriods}</div>
            <div>
              <p className="text-xs text-muted-foreground">Latest period</p>
              {formatPeriodKey(s.contributions.latestPeriod)} {s.contributions.latestPeriodStatus && <StatusChip status={s.contributions.latestPeriodStatus} />}
            </div>
          </div>
        </section>
      )}

      {s.savings.map((a) => (
        <section key={a.code + (a.accountNumber ?? '')} className="space-y-1.5">
          <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
            {a.name}
            <span className="text-xs font-normal text-muted-foreground">Account <Identifier value={a.accountNumber ?? a.code} label="account number" sensitive /></span>
          </h3>
          <StatementTable currency={c} opening={a.openingBalanceMinor} closing={a.closingBalanceMinor} lines={a.lines} />
        </section>
      ))}

      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold">Loans</h3>
        {s.loans.length === 0 ? <p className="rounded-md border p-3 text-sm text-muted-foreground">No loans in this period.</p> : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Applied</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Principal ({c})</TableHead>
                  <TableHead className="text-right">Repaid ({c})</TableHead>
                  <TableHead className="text-right">Outstanding ({c})</TableHead>
                  <TableHead className="text-right">Arrears ({c})</TableHead>
                  <TableHead>Next due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(l.appliedOn)}</TableCell>
                    <TableCell>{l.productName}</TableCell>
                    <TableCell><StatusChip status={l.status} /></TableCell>
                    <TableCell className="text-right"><Amount value={l.principalMinor} currency={l.currency} bare /></TableCell>
                    <TableCell className="text-right"><Amount value={l.repaidMinor} currency={l.currency} bare /></TableCell>
                    <TableCell className="text-right"><Amount value={l.outstandingMinor} currency={l.currency} bare /></TableCell>
                    <TableCell className="text-right">
                      <Amount value={l.arrearsMinor} currency={l.currency} bare className={l.arrearsMinor > 0 ? 'text-destructive' : undefined} />
                      {l.daysInArrears > 0 && <span className="block text-xs text-destructive">{l.daysInArrears} days</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.nextDueDate ? <>{formatDate(l.nextDueDate)} · <MoneyText value={l.nextDueMinor} currency={l.currency} /></> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {s.penalties && (
        <section className="space-y-1.5">
          <h3 className="text-sm font-semibold">Penalties account</h3>
          <StatementTable currency={c} opening={s.penalties.openingBalanceMinor} closing={s.penalties.closingBalanceMinor} lines={s.penalties.lines} />
        </section>
      )}
    </StatementDocument>
  );
}

export function memberStatementCsv(s: MemberStatementView) {
  const digits = fractionDigits(s.currency);
  type Row = { section: string; date: string; entry: number | ''; description: string; reference: string; debit: number | ''; credit: number | ''; balance: number | '' };
  const rows: Row[] = [];
  const add = (section: string, a: MemberStatementView['savings'][number]) => {
    rows.push({ section, date: '', entry: '', description: 'Opening balance', reference: '', debit: '', credit: '', balance: csvMoney(a.openingBalanceMinor, digits) as number });
    for (const l of a.lines) {
      rows.push({ section, date: l.date, entry: l.entryNumber, description: l.description, reference: l.reference ?? '', debit: csvMoney(l.debitMinor, digits) as number, credit: csvMoney(l.creditMinor, digits) as number, balance: csvMoney(l.balanceMinor, digits) as number });
    }
    rows.push({ section, date: '', entry: '', description: 'Closing balance', reference: '', debit: '', credit: '', balance: csvMoney(a.closingBalanceMinor, digits) as number });
  };
  s.savings.forEach((a) => add(a.name, a));
  if (s.penalties) add('Penalties', s.penalties);
  downloadCsv(`statement-${s.member.memberNumber ?? 'member'}`, rows, [
    { header: 'Section', value: (r) => r.section },
    { header: 'Date', value: (r) => r.date },
    { header: 'Entry', value: (r) => r.entry },
    { header: 'Description', value: (r) => r.description },
    { header: 'Reference', value: (r) => r.reference },
    { header: 'Debit', value: (r) => r.debit },
    { header: 'Credit', value: (r) => r.credit },
    { header: 'Balance', value: (r) => r.balance },
  ]);
}
