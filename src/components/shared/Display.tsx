'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle, type BadgeVariant } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useSessionInfo';

/** Money in minor units. Negative amounts are red. Currency defaults to the chama's. */
export function MoneyText({ value, currency, className, signed }: { value: number | null | undefined; currency?: string; className?: string; signed?: boolean }) {
  const chamaCurrency = useCurrency();
  const negative = value !== null && value !== undefined && value < 0;
  const text = formatMoney(value, currency ?? chamaCurrency);
  return <span className={cn('tabular whitespace-nowrap', negative && 'text-destructive', className)}>{signed && value && value > 0 ? `+${text}` : text}</span>;
}

// Status colours (README §8.5). Colour is never the only signal: every chip has its text and an icon.
const GREEN = ['ACTIVE', 'PAID', 'APPROVED', 'RECORDED', 'REPAID', 'ACCEPTED'];
const AMBER = ['PROPOSED', 'PARTIALLY_PAID', 'PARTLY_PAID', 'DUE', 'OUTSTANDING', 'REQUESTED'];
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

export function PageHeader({ title, description, actions, back, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {back && <Link href={back.href} className="no-print text-sm text-muted-foreground hover:text-foreground">← {back.label}</Link>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
        {children}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'gold';

/** A KPI tile. With href it links to the page behind the figure. */
export function StatCard({ label: text, value, hint, icon, tone = 'default', href }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone; href?: string }) {
  const toneClass = { default: 'bg-primary/10 text-primary', success: 'bg-success/15 text-success', warning: 'bg-warning/20 text-warning', destructive: 'bg-destructive/10 text-destructive', gold: 'bg-gold/15 text-gold' }[tone];
  const body = (
    <>
      {icon && <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5', toneClass)}>{icon}</span>}
      <span className="min-w-0 [&>span]:block">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{text}</span>
        <span className="mt-0.5 truncate text-xl font-semibold tabular">{value}</span>
        {hint && <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>}
      </span>
    </>
  );
  const cls = 'flex items-start gap-3 rounded-lg border bg-card p-4 shadow-sm';
  if (href) return <Link href={href} className={cn(cls, 'transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>{body}</Link>;
  return <div className={cls}>{body}</div>;
}

/** Label/value pairs for detail pages. */
export function DetailList({ items, columns = 2 }: { items: ({ label: string; value: ReactNode } | false | null | undefined)[]; columns?: 1 | 2 | 3 | 4 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3', { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns])}>
      {items.filter(Boolean).map((item) => {
        const it = item as { label: string; value: ReactNode };
        return (
          <div key={it.label} className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">{it.label}</dt>
            <dd className="mt-0.5 break-words text-sm">{it.value ?? '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A titled card section. */
export function Section({ title, description, actions, children, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** A thin progress bar with an accessible value. */
export function Progress({ value, max, className, tone = 'default' }: { value: number; max: number; className?: string; tone?: 'default' | 'success' | 'warning' | 'destructive' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = { default: 'bg-primary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive' }[tone];
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "#57" entry numbers link to the journal. */
export function EntryLink({ id, number }: { id: string | null | undefined; number?: number | null }) {
  if (!id) return <span className="text-muted-foreground">—</span>;
  return <Link href={`/ledger/journal/${id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{number ? `#${number}` : 'View entry'}</Link>;
}

/** Signed balance coloured: negative red (arrears), positive green (credit). */
export function SignedMoney({ value, currency }: { value: number; currency?: string }) {
  return <MoneyText value={value} currency={currency} className={value > 0 ? 'text-success' : undefined} signed />;
}
