'use client';

import { Tooltip } from '@/components/ui/overlays';
import { MoneyText } from './Display';

// Charts follow the validated categorical palette in globals.css (--chart-1..8). Hues are assigned by a fixed entity order,
// never by rank, so a series keeps its colour when filters change. Every chart ships with its values in text beside it (the
// light palette has slots under 3:1 contrast, and colour is never the only signal).

export const CHART_SLOTS = 8;
export const slotColor = (slot: number) => (slot >= 0 && slot < CHART_SLOTS ? `var(--chart-${slot + 1})` : 'hsl(var(--muted-foreground))');

export interface BarItem {
  key: string;
  label: string;
  value: number;
  hint?: string;
}

/**
 * One measure across a few categories as labelled horizontal bars (single hue: the title names the series, no legend).
 * Each row carries its label and value as text; hovering shows the hint.
 */
export function BarList({ items, currency, tone = 'primary', formatValue }: { items: BarItem[]; currency?: string; tone?: 'primary' | 'destructive' | 'warning'; formatValue?: (v: number) => React.ReactNode }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  const fill = { primary: 'var(--chart-1)', destructive: 'hsl(var(--destructive))', warning: 'hsl(var(--warning))' }[tone];
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to show yet.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const row = (
          <li key={i.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{i.label}</span>
              <span className="shrink-0 font-medium">{formatValue ? formatValue(i.value) : <MoneyText value={i.value} currency={currency} />}</span>
            </div>
            <div className="h-2.5 w-full rounded-sm bg-muted" aria-hidden>
              <div className="h-full rounded-r-[4px] rounded-l-sm" style={{ width: `${max > 0 ? Math.max(i.value > 0 ? 1 : 0, (i.value / max) * 100) : 0}%`, background: fill }} />
            </div>
          </li>
        );
        return i.hint ? <Tooltip key={i.key} content={i.hint}>{row}</Tooltip> : row;
      })}
    </ul>
  );
}
