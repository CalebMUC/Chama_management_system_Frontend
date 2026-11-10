'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';
import { formatInstant } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Amount } from './Amount';
import { Identifier } from './Identifier';
import { KpiTile, type KpiTone } from './Kpi';
import { Panel } from './Panel';

/** Money in minor units. Negative amounts are red with a minus sign. Currency defaults to the chama's. (Amount underneath.) */
export function MoneyText({ value, currency, className, signed }: { value: number | null | undefined; currency?: string; className?: string; signed?: boolean }) {
  return <Amount value={value} currency={currency} className={className} signed={signed} tone="negative" />;
}

// Status colours (README §8.5). Colour is never the only signal: every chip has its text and an icon.
const GREEN = ['ACTIVE', 'PAID', 'APPROVED', 'RECORDED', 'REPAID', 'ACCEPTED'];
const AMBER = ['PENDING', 'PROPOSED', 'PARTIALLY_PAID', 'PARTLY_PAID', 'DUE', 'OUTSTANDING', 'REQUESTED'];
const RED = ['OVERDUE', 'UNPAID', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'DECLINED'];
const GREY = ['CANCELLED', 'REVERSED', 'WAIVED', 'CLOSED', 'WITHDRAWN', 'EXITED', 'ARCHIVED'];

export function statusVariant(status: string): BadgeVariant {
  if (GREEN.includes(status)) return 'success';
  if (AMBER.includes(status) || status.startsWith('PENDING_')) return 'warning';
  if (RED.includes(status)) return 'destructive';
  if (GREY.includes(status)) return 'secondary';
  return 'outline';
}

const icons: Partial<Record<BadgeVariant, ReactNode>> = {
  success: <CheckCircle2 className="size-3" aria-hidden />,
  warning: <Clock className="size-3" aria-hidden />,
  destructive: <XCircle className="size-3" aria-hidden />,
  secondary: <Ban className="size-3" aria-hidden />,
  outline: <CircleDashed className="size-3" aria-hidden />,
};

export function StatusChip({ status, text, className }: { status: string | null | undefined; text?: string; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant = statusVariant(status);
  return <Badge variant={variant} className={className}>{icons[variant]}{text ?? label(status)}</Badge>;
}

/**
 * The page bar: breadcrumbs from the route, the title, an "As at" stamp for time-sensitive data, and the page's actions on the
 * right. Sticky under the top bar on wider screens.
 */
export function PageHeader({ title, description, actions, back, asAt, children }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The parent list; shown in the breadcrumb trail when the route doesn't already lead there. */
  back?: { href: string; label: string };
  /** An instant: "As at 9 Nov 2026, 10:15". */
  asAt?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="page-bar relative z-20 -mx-gutter -mt-gutter mb-gutter border-b bg-card px-gutter py-2 sm:sticky sm:top-topbar">
      <Breadcrumbs extra={back} className="no-print mb-0.5" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.0625rem] font-semibold leading-snug tracking-tight">{title}</h1>
          {(description || asAt) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {description && <div className="min-w-0">{description}</div>}
              {asAt && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  {description && <span aria-hidden>·</span>}
                  <Clock className="size-3" aria-hidden />As at {formatInstant(asAt)}
                </span>
              )}
            </div>
          )}
          {children}
        </div>
        {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}

type Tone = KpiTone;

/** A KPI tile (KpiTile underneath). Put several in a KpiStrip so amounts render compact and never truncate. */
export function StatCard({ label: text, value, hint, icon, tone = 'default', href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone; href?: string }) {
  return <KpiTile label={text} value={value} hint={hint} icon={icon} tone={tone} href={href} />;
}

/** Label/value pairs for detail pages. */
export function DetailList({ items, columns = 2 }: { items: ({ label: string; value: ReactNode } | false | null | undefined)[]; columns?: 1 | 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-2.5', { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns])}>
      {items.filter(Boolean).map((item) => {
        const it = item as { label: string; value: ReactNode };
        return (
          <div key={it.label} className="min-w-0">
            <dt className="text-2xs font-medium uppercase tracking-[0.04em] text-muted-foreground">{it.label}</dt>
            <dd className="mt-0.5 break-words text-sm">{it.value ?? '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A titled section (Panel underneath). */
export function Section({ title, description, actions, children, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <Panel title={title} description={description} actions={actions} className={className}>{children}</Panel>;
}

/** A thin progress bar with an accessible value. */
export function Progress({ value, max, className, tone = 'default', label: name }: { value: number; max: number; className?: string; tone?: 'default' | 'success' | 'warning' | 'destructive'; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = { default: 'bg-primary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive' }[tone];
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-sm bg-muted', className)} role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={cn('h-full rounded-sm transition-all', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "#57" entry numbers link to the journal. */
export function EntryLink({ id, number }: { id: string | null | undefined; number?: number | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  if (!number) return <Link href={`/ledger/journal/${id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>View entry</Link>;
  return <Identifier value={`#${number}`} label="journal entry number" href={`/ledger/journal/${id}`} copy={false} />;
}

/** Signed balance coloured: negative red (arrears), positive green (credit). */
export function SignedMoney({ value, currency }: { value: number; currency?: string }) {
  return <Amount value={value} currency={currency} signed />;
}
