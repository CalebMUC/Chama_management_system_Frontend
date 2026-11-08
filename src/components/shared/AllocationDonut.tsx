'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { slotColor } from './Charts';
import { MoneyText } from './Display';

// Kept apart from Charts.tsx so pages with only bar lists don't load Recharts.

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  /** Fixed palette slot for this entity (0-based). Outside 0–7, or "Other", renders neutral grey. */
  slot: number;
}

/** Part-to-whole for a handful of categories, with a legend that lists every value and share. */
export function AllocationDonut({ items, currency, centerLabel }: { items: DonutItem[]; currency?: string; centerLabel?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>;
  const focus = data.find((d) => d.key === active);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[12rem_1fr]">
      <div className="relative mx-auto size-48" role="img" aria-label={`${centerLabel ?? 'Allocation'}: ${data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}`}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="64%"
              outerRadius="100%"
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(data[i]?.key ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d) => <Cell key={d.key} fill={slotColor(d.slot)} opacity={active && active !== d.key ? 0.35 : 1} />)}
            </Pie>
            <RTooltip content={() => null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">{focus ? focus.label : centerLabel ?? 'Total'}</span>
          <span className="text-sm font-semibold"><MoneyText value={focus ? focus.value : total} currency={currency} /></span>
          {focus && <span className="text-xs text-muted-foreground">{Math.round((focus.value / total) * 100)}%</span>}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li
            key={d.key}
            className={cn('flex items-center gap-2 rounded px-1.5 py-1', active === d.key && 'bg-muted')}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="size-3 shrink-0 rounded-sm" style={{ background: slotColor(d.slot) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.label}</span>
            <MoneyText value={d.value} currency={currency} className="text-foreground" />
            <span className="w-10 text-right text-xs text-muted-foreground tabular">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

