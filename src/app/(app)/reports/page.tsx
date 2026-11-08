'use client';

import Link from 'next/link';
import { BookOpenCheck, Coins, FileText, HandCoins, Landmark, PiggyBank, Scale, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shared/Display';

const REPORTS = [
  { href: '/reports/financial-position', title: 'Financial position', text: 'Assets, liabilities and equity on a date.', icon: Scale },
  { href: '/reports/income-statement', title: 'Income statement', text: 'Income, expenses and the surplus for a period.', icon: Coins },
  { href: '/reports/cash-book', title: 'Cash book', text: 'Receipts and payments through cash, bank and M-Pesa.', icon: Wallet },
  { href: '/reports/contributions', title: 'Contributions', text: 'Every member against every period: paid and due.', icon: BookOpenCheck },
  { href: '/reports/loan-portfolio', title: 'Loan portfolio', text: 'Outstanding loans, arrears ageing and PAR30.', icon: HandCoins },
  { href: '/reports/savings', title: 'Savings register', text: "Each member's balance in each savings product.", icon: PiggyBank },
  { href: '/reports/member-statement', title: 'Member statement', text: "One member's savings, loans and penalties.", icon: FileText },
  { href: '/ledger/trial-balance', title: 'Trial balance', text: 'Debits and credits of every account.', icon: Landmark },
];

export default function ReportsIndexPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Each report prints cleanly and downloads as CSV." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="flex gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><r.icon className="size-5" /></span>
            <span>
              <span className="block font-medium">{r.title}</span>
              <span className="block text-sm text-muted-foreground">{r.text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
