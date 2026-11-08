'use client';

import type { MemberStatementView } from '@/api/types';
import { MoneyText, Section, SignedMoney, StatusChip } from '@/components/shared/Display';
import { StatementTable } from '@/components/shared/StatementTable';
import { EmptyState } from '@/components/shared/States';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatDate, formatPeriodKey, fractionDigits, memberLabel } from '@/lib/format';

/** Member statement layout (README §7.13), shared by My statement, the report and member detail. */
export function MemberStatementBody({ s }: { s: MemberStatementView }) {
  const c = s.currency;
  const tiles = [
    { label: 'Savings', value: <MoneyText value={s.savingsMinor} currency={c} /> },
    { label: 'Loans outstanding', value: <MoneyText value={s.loansOutstandingMinor} currency={c} /> },
    { label: 'Penalties owed', value: <MoneyText value={s.penaltiesOutstandingMinor} currency={c} /> },
    { label: 'Net position', value: <SignedMoney value={s.netPositionMinor} currency={c} /> },
  ];
  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold">{memberLabel(s.member.name, s.member.memberNumber)}</p>
        <p className="text-sm text-muted-foreground">
          {s.chamaName} · {s.from ? formatDate(s.from) : 'From the start'} to {s.to ? formatDate(s.to) : 'today'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-0.5 text-lg font-semibold">{t.value}</p>
          </div>
        ))}
      </div>

      {s.contributions && (
        <Section title="Contributions">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
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
        </Section>
      )}

      {s.savings.map((a) => (
        <div key={a.code + (a.accountNumber ?? '')} className="space-y-2">
          <h3 className="font-medium">{a.name} <span className="text-sm font-normal text-muted-foreground">{a.accountNumber ?? a.code}</span></h3>
          <StatementTable currency={c} opening={a.openingBalanceMinor} closing={a.closingBalanceMinor} lines={a.lines} />
        </div>
      ))}

      <Section title="Loans">
        {s.loans.length === 0 ? <EmptyState title="No loans" className="py-6" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Applied</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Repaid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Arrears</TableHead>
                  <TableHead>Next due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(l.appliedOn)}</TableCell>
                    <TableCell>{l.productName}</TableCell>
                    <TableCell><StatusChip status={l.status} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.principalMinor} currency={l.currency} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.repaidMinor} currency={l.currency} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={l.outstandingMinor} currency={l.currency} /></TableCell>
                    <TableCell className="text-right">
                      <MoneyText value={l.arrearsMinor} currency={l.currency} className={l.arrearsMinor > 0 ? 'text-destructive' : undefined} />
                      {l.daysInArrears > 0 && <span className="block text-xs text-destructive">{l.daysInArrears} days</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.nextDueDate ? <>{formatDate(l.nextDueDate)} · <MoneyText value={l.nextDueMinor} currency={l.currency} /></> : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {s.penalties && (
        <div className="space-y-2">
          <h3 className="font-medium">Penalties account</h3>
          <StatementTable currency={c} opening={s.penalties.openingBalanceMinor} closing={s.penalties.closingBalanceMinor} lines={s.penalties.lines} />
        </div>
      )}
    </div>
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
