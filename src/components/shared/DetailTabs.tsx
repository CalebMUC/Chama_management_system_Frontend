'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';

export interface DetailTab {
  id: string;
  label: string;
  /** A count beside the label (schedule lines, approvals). */
  count?: number;
  content: ReactNode;
}

/**
 * Tabbed panels for detail pages (Details, Schedule, Transactions, Approvals, Audit). Only tabs with content are passed in; a
 * single tab renders as a plain panel. Every tab prints, so printing a detail page keeps all of it.
 */
export function DetailTabs({ tabs, defaultTab, label }: { tabs: (DetailTab | false | null | undefined)[]; defaultTab?: string; label: string }) {
  const list = tabs.filter(Boolean) as DetailTab[];
  if (list.length === 0) return null;
  if (list.length === 1) return <div className="rounded-lg border bg-card p-[var(--panel-p)]">{list[0].content}</div>;
  return (
    <Tabs defaultValue={defaultTab ?? list[0].id} className="overflow-hidden rounded-lg border bg-card">
      <TabsList aria-label={label} className="no-print flex w-full bg-panel-header px-1.5">
        {list.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
            {t.label}
            {t.count !== undefined && <span className="rounded-sm bg-muted px-1 text-[10px] font-semibold leading-4 text-muted-foreground tabular">{t.count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {list.map((t) => (
        <TabsContent key={t.id} value={t.id} forceMount className="mt-0 p-[var(--panel-p)] data-[state=inactive]:hidden print:!block">
          <h2 className="print-only mb-2 text-sm font-semibold">{t.label}</h2>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
