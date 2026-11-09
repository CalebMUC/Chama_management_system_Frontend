import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The basic surface: a flat panel with a hairline border and a header strip (small uppercase title, toolbar on the right).
 * `flush` drops the body padding for tables and lists that run edge to edge.
 */
export function Panel({ title, description, actions, footer, children, className, bodyClassName, flush, id }: {
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons, filters or links, right-aligned in the header strip. */
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn('flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground', className)}>
      {(title || actions) && (
        <header className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-panel-header px-[var(--panel-p)] py-1.5">
          <div className="min-w-0 flex-1">
            {title && <h2 id={headingId} className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn('min-w-0 flex-1', !flush && 'p-[var(--panel-p)]', bodyClassName)}>{children}</div>
      {footer && <footer className="border-t bg-panel-header px-[var(--panel-p)] py-1.5 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  );
}

/** Label/value rows inside a panel: label left, value right-aligned (figures line up). */
export function KeyValue({ items, className }: { items: ({ label: ReactNode; value: ReactNode; emphasis?: boolean } | false | null | undefined)[]; className?: string }) {
  return (
    <dl className={cn('divide-y text-sm', className)}>
      {items.filter(Boolean).map((item, i) => {
        const it = item as { label: ReactNode; value: ReactNode; emphasis?: boolean };
        return (
          <div key={i} className={cn('flex items-baseline justify-between gap-3 py-1.5', it.emphasis && 'font-semibold')}>
            <dt className={cn('text-muted-foreground', it.emphasis && 'text-foreground')}>{it.label}</dt>
            <dd className="text-right tabular">{it.value ?? '—'}</dd>
          </div>
        );
      })}
    </dl>
  );
}
