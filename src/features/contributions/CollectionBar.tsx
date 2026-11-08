'use client';

import type { PeriodSummaryView } from '@/api/types';
import { MoneyText, Progress } from '@/components/shared/Display';

/** Collected vs expected for a contribution period. */
export function CollectionBar({ s }: { s: PeriodSummaryView }) {
  const pct = s.expectedMinor > 0 ? Math.round((s.collectedMinor / s.expectedMinor) * 100) : 0;
  return (
    <div className="min-w-[10rem] space-y-1">
      <div className="flex justify-between text-xs">
        <MoneyText value={s.collectedMinor} currency={s.period.currency} />
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={s.collectedMinor} max={s.expectedMinor} tone={pct >= 100 ? 'success' : s.due ? 'warning' : 'default'} />
    </div>
  );
}
