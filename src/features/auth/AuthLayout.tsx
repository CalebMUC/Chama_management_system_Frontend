'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/layout/BrandMark';
import { env } from '@/config/env';
import { cn } from '@/lib/utils';

/**
 * Public pages (sign-in, registration, password reset, email verification): one secure panel centred on a quiet navy
 * background, with the security notice, support contacts and the app version. Fields and logic belong to each page.
 */
export function AuthLayout({ title, description, children, footer, eyebrow = 'Secure access' }: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** The label in the panel's header strip. */
  eyebrow?: string;
}) {
  return (
    <div className="auth-backdrop flex min-h-screen flex-col bg-sidebar text-sidebar-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <BrandMark />
        <span className="inline-flex items-center gap-1.5 text-xs text-sidebar-muted">
          <Lock className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Encrypted connection</span>
          <span className="sm:hidden">Secure</span>
        </span>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-10">
        <div className="w-full max-w-[27rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-overlay">
          <div className="flex items-center gap-2 border-b bg-panel-header px-5 py-2.5">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <span className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</span>
          </div>
          <div className="space-y-5 px-5 py-6 sm:px-6">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {description && <div className="text-sm text-muted-foreground">{description}</div>}
            </div>
            {children}
            {footer && <div className="border-t pt-4 text-sm text-muted-foreground">{footer}</div>}
          </div>
          <p className="flex gap-2 border-t bg-panel-header px-5 py-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-px size-4 shrink-0 text-warning-text" aria-hidden />
            <span>ChamaBank will never ask for your password by phone, SMS or email.</span>
          </p>
        </div>
      </main>

      <footer className="flex flex-col gap-1 px-4 py-4 text-xs text-sidebar-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <SupportLine />
        <p className="tabular">ChamaBank{env.appVersion ? ` · v${env.appVersion}` : ''}</p>
      </footer>
    </div>
  );
}

/** NEXT_PUBLIC_SUPPORT_EMAIL / NEXT_PUBLIC_SUPPORT_PHONE, when set. */
function SupportLine() {
  const { supportEmail: email, supportPhone: phone } = env;
  if (!email && !phone) return <p>Need help? Ask your chama officials.</p>;
  const link = 'text-sidebar-foreground underline-offset-2 hover:underline';
  return (
    <p>
      Need help?{' '}
      {email && <a href={`mailto:${email}`} className={link}>{email}</a>}
      {email && phone && ' · '}
      {phone && <a href={`tel:${phone.replace(/\s+/g, '')}`} className={link}>{phone}</a>}
    </p>
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
