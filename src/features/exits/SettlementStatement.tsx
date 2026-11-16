'use client';

import { AlertTriangle } from 'lucide-react';
import type { ExitSettlementView, ExitStatus } from '@/api/types';
import { MoneyText, StatusChip } from '@/components/shared/Display';
import { KeyValue } from '@/components/shared/Panel';
import { cn } from '@/lib/utils';
import { EXIT_STATUS_VARIANT, groupLines, settlementTotals } from './exitRules';

export function ExitStatusChip({ status, className }: { status: ExitStatus; className?: string }) {
  return <StatusChip status={status} variant={EXIT_STATUS_VARIANT[status]} className={className} />;
}

/**
 * The exit settlement statement (preview dialog, exit page, a member's own card): the lines by kind, then refundable less loans
 * less penalties gives the payout. Savings the chama keeps are shown apart; no dividend is paid for the year of exit.
 */
export function SettlementStatement({ settlement: s, className }: { settlement: ExitSettlementView; className?: string }) {
  const groups = groupLines(s.lines);
  const { rows, forfeitedMinor, shortfallMinor } = settlementTotals(s);
  const c = s.currency;

  return (
    <div className={cn('space-y-4', className)}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">The member has no savings, loans or penalties to settle.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.kind} aria-label={g.title} className="rounded-md border">
              <header className="flex items-baseline justify-between gap-3 border-b bg-panel-header px-3 py-1.5">
                <h3 className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{g.title}</h3>
                <MoneyText value={g.totalMinor} currency={c} className="text-sm font-medium" />
              </header>
              <ul className="divide-y">
                {g.lines.map((l) => (
                  <li key={`${l.kind}-${l.sourceId}`} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="min-w-0">{l.description}</span>
                    <MoneyText value={l.amountMinor} currency={c} className="shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-md border px-3">
        <KeyValue
          items={[
            ...rows.map((r) => ({ label: r.label, value: <MoneyText value={r.amountMinor} currency={c} className={r.emphasis ? 'text-base' : undefined} />, emphasis: r.emphasis })),
            { label: 'Kept by the chama (not refundable)', value: <MoneyText value={forfeitedMinor} currency={c} /> },
            { label: 'Dividend', value: <span className="text-muted-foreground">None for the year of exit</span> },
          ]}
        />
      </div>

      {shortfallMinor > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Shortfall <MoneyText value={shortfallMinor} currency={c} className="font-semibold" />: the member owes more than their refundable savings.
            They must pay this before they can leave.
          </span>
        </p>
      )}
    </div>
  );
}
