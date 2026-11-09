'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/overlays';
import { useCurrency } from '@/hooks/useSessionInfo';
import { formatCompactMoney, formatFigure, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * How amounts render below a point in the tree:
 *  - compact: KPI tiles show "KES 2.10M" with the exact amount in a tooltip and aria-label.
 *  - hidden:  balances are masked (the hide-balances preference on My banking screens).
 */
interface AmountSettings {
  compact?: boolean;
  hidden?: boolean;
}
const AmountContext = createContext<AmountSettings>({});

export function AmountSettingsProvider({ compact, hidden, children }: AmountSettings & { children: ReactNode }) {
  const parent = useContext(AmountContext);
  return <AmountContext.Provider value={{ compact: compact ?? parent.compact, hidden: hidden ?? parent.hidden }}>{children}</AmountContext.Provider>;
}

/** True when balances are masked here (My banking screens with "Hide balances" on). */
export const useBalancesHidden = () => !!useContext(AmountContext).hidden;

export interface AmountProps {
  /** Minor units. null/undefined -> "—". */
  value: number | null | undefined;
  /** Defaults to the chama's currency. */
  currency?: string;
  /** "+" on positive amounts (credits, gains). */
  signed?: boolean;
  /** Ledger side: shows the amount with a DR/CR marker instead of a sign. */
  side?: 'DR' | 'CR';
  /** Forces compact notation on (true) or off (false); otherwise inherited (KPI tiles). */
  compact?: boolean;
  /** Hide the currency code (dense tables whose header names the currency). */
  bare?: boolean;
  /** auto: negatives red, signed positives green. negative: only negatives red. none: no colour. */
  tone?: 'auto' | 'negative' | 'none';
  /** Masked when balances are hidden. Default true; pass false for amounts that aren't the member's own balances. */
  sensitive?: boolean;
  className?: string;
}

/**
 * Every amount in the app. Tabular figures, the currency code smaller and muted, never truncated (no-wrap; the layout makes room).
 * Negative amounts carry a true minus sign and red, so colour is never the only signal.
 */
export function Amount({ value, currency, signed, side, compact, bare, tone = 'auto', sensitive = true, className }: AmountProps) {
  const chamaCurrency = useCurrency();
  const settings = useContext(AmountContext);
  const cur = currency ?? chamaCurrency;

  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn('text-muted-foreground', className)}>—</span>;
  }

  const exact = formatMoney(value, cur);
  if (settings.hidden && sensitive) {
    return (
      <span className={cn('tabular whitespace-nowrap', className)} aria-label="Balance hidden">
        {!bare && <Code>{cur}</Code>}
        <span aria-hidden className="tracking-widest">••••••</span>
      </span>
    );
  }

  const useCompact = compact ?? settings.compact ?? false;
  const negative = value < 0 && !side;
  const sign = negative ? '−' : signed && value > 0 ? '+' : '';
  const figure = useCompact ? formatCompactMoney(Math.abs(value), cur).replace(`${cur} `, '') : formatFigure(value, cur);
  const shortened = useCompact && figure !== formatFigure(value, cur);

  // Screen readers get the exact amount in words when the visible text is shortened or carries a DR/CR marker.
  const spoken = shortened || side ? `${exact}${side ? ` ${side === 'DR' ? 'debit' : 'credit'}` : ''}` : null;
  const body = (
    <span
      className={cn(
        'amount tabular inline-flex items-baseline whitespace-nowrap',
        tone !== 'none' && negative && 'text-destructive',
        tone === 'auto' && signed && value > 0 && 'text-success',
        shortened && 'cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      tabIndex={shortened ? 0 : undefined}
    >
      <span aria-hidden={spoken ? true : undefined} className="inline-flex items-baseline">
        {sign}
        {!bare && <Code>{cur}</Code>}
        {figure}
        {side && <span className="ml-1 text-[0.72em] font-medium text-muted-foreground">{side}</span>}
      </span>
      {spoken && <span className="sr-only">{spoken}</span>}
    </span>
  );
  return shortened ? <Tooltip content={exact}>{body}</Tooltip> : body;
}

function Code({ children }: { children: ReactNode }) {
  return <span className="mr-[0.3em] text-[0.75em] font-medium tracking-wide text-muted-foreground">{children}</span>;
}
