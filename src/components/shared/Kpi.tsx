import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AmountSettingsProvider } from './Amount';

export type KpiTone = 'default' | 'success' | 'warning' | 'destructive' | 'gold';

/**
 * A row of KPI tiles that never truncates: an auto-fit grid (each tile at least 220px), equal heights, and amounts inside
 * render compact ("KES 2.10M") with the exact figure in a tooltip.
 */
export function KpiStrip({ children, className, min = 220, compact = true }: { children: ReactNode; className?: string; min?: number; compact?: boolean }) {
  return (
    <AmountSettingsProvider compact={compact}>
      <div className={cn('grid auto-rows-fr gap-2', className)} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))` }}>
        {children}
      </div>
    </AmountSettingsProvider>
  );
}

const toneBar: Record<KpiTone, string> = {
  default: 'before:bg-primary',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  destructive: 'before:bg-destructive',
  gold: 'before:bg-gold',
};

/** One KPI: label, figure, an optional line of context. With href, the whole tile links to the page behind the figure. */
export function KpiTile({ label, value, hint, icon, tone = 'default', href, className }: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {icon && <span className="text-muted-foreground [&_svg]:size-3.5" aria-hidden>{icon}</span>}
        <span className="min-w-0">{label}</span>
        {href && <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-50 transition-opacity group-hover/kpi:opacity-100" aria-hidden />}
      </span>
      <span className="mt-1 block whitespace-nowrap text-xl font-semibold leading-tight tracking-tight tabular">{value}</span>
      {hint && <span className="mt-1 block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </>
  );
  const cls = cn(
    'group/kpi relative flex h-full min-w-0 flex-col rounded-lg border bg-card px-3 py-2.5 pl-4',
    "before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-sm before:content-['']",
    toneBar[tone],
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cn(cls, 'transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
