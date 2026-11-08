'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { cn } from '@/lib/utils';

/** Public pages: a brand panel on wide screens and a single card. */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <div className="relative hidden overflow-hidden bg-[hsl(var(--sidebar))] p-10 text-[hsl(var(--sidebar-foreground))] lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">Your chama&apos;s savings, loans and books in one place.</h2>
          <p className="text-[hsl(var(--sidebar-muted))]">
            Contributions, loans with guarantors, expenses, investments and a full double-entry ledger, with approvals that keep every
            shilling accountable.
          </p>
        </div>
        <p className="text-xs text-[hsl(var(--sidebar-muted))]">Every amount is recorded, approved and auditable.</p>
        <svg className="pointer-events-none absolute -right-24 -top-24 size-96 opacity-10" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--gold))" strokeWidth="6" />
          <circle cx="50" cy="50" r="14" fill="hsl(var(--gold))" />
        </svg>
      </div>
      <div className="flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <BrandMark dark={false} className="lg:hidden" />
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <div className="text-sm text-muted-foreground">{description}</div>}
          </div>
          {children}
          {footer && <div className="border-t pt-4 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

const RULES = [
  { test: (v: string) => v.length >= 8, text: 'At least 8 characters' },
  { test: (v: string) => /[A-Za-z]/.test(v), text: 'A letter' },
  { test: (v: string) => /\d/.test(v), text: 'A digit' },
];

/** The password rule, shown live (README §7.1). */
export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-live="polite">
      {RULES.map((r) => {
        const ok = r.test(value ?? '');
        return (
          <li key={r.text} className={cn('flex items-center gap-1', ok ? 'text-success' : 'text-muted-foreground')}>
            {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
            {r.text}
            <span className="sr-only">{ok ? '(met)' : '(not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
