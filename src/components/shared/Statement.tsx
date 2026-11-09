'use client';

import type { ReactNode } from 'react';
import { BrandMark } from '@/components/layout/BrandMark';
import { formatDate, formatInstant } from '@/lib/format';
import { useSession } from '@/stores/session';

/** The chama's letterhead: name, code and description. (The API has no chama address or phone: see docs/BACKEND_ASKS.md.) */
export function Letterhead({ title, reference }: { title: string; reference?: ReactNode }) {
  const chama = useSession((s) => s.chama);
  const chamaName = useSession((s) => s.chamaName);
  const code = useSession((s) => s.user?.chamaCode);
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-3">
      <div className="flex min-w-0 items-start gap-3">
        <BrandMark compact />
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight">{chama?.name ?? chamaName ?? 'Your chama'}</p>
          {chama?.description && <p className="text-xs text-muted-foreground">{chama.description}</p>}
          {code && <p className="text-xs text-muted-foreground">Chama code <span className="ident">{code}</span> · via ChamaBank</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">{title}</p>
        {reference && <div className="text-xs text-muted-foreground">{reference}</div>}
      </div>
    </header>
  );
}

/**
 * A statement laid out like a bank's: letterhead, who it is for and the period, the body (balances and transactions), then
 * the generated time and a footer. On paper the footer repeats at the bottom of every page.
 */
export function StatementDocument({ title, subject, from, to, generatedAt, summary, children }: {
  title: string;
  /** Member and/or account the statement is for. */
  subject: ReactNode;
  from?: string | null;
  to?: string | null;
  generatedAt?: string | null;
  /** Opening/closing balances or position figures, shown in the header block. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const chamaName = useSession((s) => s.chamaName);
  const period = `${from ? formatDate(from) : 'From the start'} – ${to ? formatDate(to) : 'today'}`;
  const generated = generatedAt ? formatInstant(generatedAt) : null;
  return (
    <article className="statement-doc space-y-4 rounded-lg border bg-card p-4 sm:p-6 print:border-0 print:p-0">
      <Letterhead title={title} reference={<>Statement period<br /><span className="font-medium text-foreground">{period}</span></>} />
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="text-sm">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Statement for</p>
          <div className="mt-0.5">{subject}</div>
        </div>
        {summary && <div className="min-w-[16rem]">{summary}</div>}
      </div>
      {children}
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-2 text-2xs text-muted-foreground">
        <span>{generated ? `Generated ${generated}` : null}</span>
        <span>Computer-generated statement. Report errors to your chama officials within 30 days.</span>
      </footer>
      <div className="print-footer hidden" aria-hidden>
        {chamaName} · {title} · {period}{generated ? ` · generated ${generated}` : ''}
      </div>
    </article>
  );
}
