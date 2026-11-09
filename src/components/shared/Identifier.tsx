'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { maskIdentifier } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBalancesHidden } from './Amount';

/**
 * An identifier: account, loan, journal or member number, an M-Pesa or bank reference. Monospace with a copy button.
 * `sensitive` identifiers (account numbers) are masked to their last four characters while balances are hidden.
 */
export function Identifier({ value, label = 'reference', href, sensitive, masked, copy = true, className }: {
  value: string | number | null | undefined;
  /** What it is, for the copy button's accessible name ("Copy account number"). */
  label?: string;
  href?: string;
  /** Masked while balances are hidden. */
  sensitive?: boolean;
  /** Always masked (account tiles on member screens). Copying is off while masked. */
  masked?: boolean;
  copy?: boolean;
  className?: string;
}) {
  const hidden = (useBalancesHidden() && !!sensitive) || !!masked;
  const [copied, setCopied] = useState(false);
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
  const text = String(value);
  const shown = hidden ? maskIdentifier(text) : text;

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <span className={cn('group/ident inline-flex max-w-full items-center gap-0.5 whitespace-nowrap align-baseline', className)}>
      {href ? (
        <Link href={href} className="ident text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{shown}</Link>
      ) : (
        <span className="ident">{shown}</span>
      )}
      {copy && !hidden && (
        <button
          type="button"
          onClick={onCopy}
          className="no-print no-touch-min inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-60 transition-opacity hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/ident:opacity-100"
          aria-label={copied ? 'Copied' : `Copy ${label} ${text}`}
          title={copied ? 'Copied' : `Copy ${label}`}
        >
          {copied ? <Check className="size-3 text-success" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        </button>
      )}
      <span className="sr-only" aria-live="polite">{copied ? 'Copied' : ''}</span>
    </span>
  );
}
