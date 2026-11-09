'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { KeyValue, Panel } from './Panel';

export type TransactionStep = 'edit' | 'review';

/** Banking-style entry: inputs on the left, a live summary on the right (stacked on phones). */
export function TransactionLayout({ form, summary }: { form: ReactNode; summary: ReactNode }) {
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="min-w-0 space-y-3">{form}</div>
      <aside className="min-w-0 lg:sticky lg:top-[calc(var(--topbar-h)+5.5rem)]">{summary}</aside>
    </div>
  );
}

/** The summary panel: what will be recorded, updated as the user types. In review it frames the Confirm step. */
export function TransactionSummary({ step, rows, footer }: {
  step: TransactionStep;
  rows: ({ label: ReactNode; value: ReactNode; emphasis?: boolean } | false | null | undefined)[];
  footer?: ReactNode;
}) {
  return (
    <Panel
      title={step === 'review' ? 'Review and confirm' : 'Summary'}
      className={cn(step === 'review' && 'border-primary ring-1 ring-primary')}
      footer={footer}
    >
      {step === 'review' && <p className="mb-2 text-xs text-muted-foreground">Check every line. Recording posts to the member&apos;s accounts and the books at once.</p>}
      <KeyValue items={rows} />
    </Panel>
  );
}

/**
 * A success receipt: what was recorded, by whom and when, with links into the books. `.report` makes it print on its own.
 */
export function Receipt({ title, amount, rows, children, actions }: {
  title: ReactNode;
  amount: ReactNode;
  rows: ({ label: ReactNode; value: ReactNode } | false | null | undefined)[];
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="report mx-auto max-w-xl space-y-3">
      <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="receipt-title">
        <div className="flex items-center gap-3 border-b bg-success/[0.08] px-4 py-3">
          <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden />
          <div className="min-w-0">
            <h2 id="receipt-title" className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">Transaction receipt</p>
          </div>
          <div className="ml-auto text-right text-xl font-semibold">{amount}</div>
        </div>
        <div className="px-4 py-2">
          <KeyValue items={rows} />
        </div>
        {children && <div className="border-t px-4 py-3">{children}</div>}
      </section>
      <div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.print()}><Printer />Print receipt</Button>
        {actions}
      </div>
    </div>
  );
}
