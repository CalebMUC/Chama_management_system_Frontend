'use client';

import type { ReactNode } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/format';
import { useSession } from '@/stores/session';

/**
 * Every report: parameters at the top, a print-friendly body (`.report` + @media print), and client-side CSV (README §7.13).
 */
export function ReportFrame({ title, description, params, onCsv, onRefresh, generatedAt, isLoading, error, children, back }: {
  title: string;
  description?: ReactNode;
  params?: ReactNode;
  onCsv?: () => void;
  onRefresh?: () => void;
  generatedAt?: string | null;
  isLoading?: boolean;
  error?: unknown;
  children?: ReactNode;
  back?: { href: string; label: string };
}) {
  const chamaName = useSession((s) => s.chamaName);
  return (
    <div className="report space-y-5">
      <PageHeader
        back={back}
        title={title}
        description={description}
        actions={
          <>
            {onRefresh && <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh"><RefreshCw /></Button>}
            {onCsv && <Button variant="outline" size="sm" onClick={onCsv} disabled={isLoading || !!error}><Download />CSV</Button>}
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={isLoading || !!error}><Printer />Print</Button>
          </>
        }
      />
      <p className="hidden text-sm print:block">{chamaName}{generatedAt && ` · generated ${formatInstant(generatedAt)}`}</p>
      {params && <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">{params}</div>}
      {error ? <ErrorState error={error} onRetry={onRefresh} /> : isLoading ? <LoadingState /> : children}
      {generatedAt && !error && !isLoading && <p className="no-print text-xs text-muted-foreground">Generated {formatInstant(generatedAt)}</p>}
    </div>
  );
}

/** A label + control pair for report parameters. */
export function Param({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
