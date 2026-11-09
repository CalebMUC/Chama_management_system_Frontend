'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { mobileTabs } from '@/config/navigation';
import { useHasFeature } from '@/hooks/useSessionInfo';
import { cn } from '@/lib/utils';

/** Below 640 px: Home, Accounts, Loans, Statement and More (the full menu). Tabs follow the same licence features as the sidebar. */
export function MobileTabBar({ onMore }: { onMore(): void }) {
  const pathname = usePathname();
  const hasFeature = useHasFeature();
  const tabs = mobileTabs.filter((t) => hasFeature(t.feature));
  const cell = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
  return (
    <nav aria-label="Quick" className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined} className={cn(cell, on ? 'text-primary' : 'text-muted-foreground')}>
            <Icon className="size-5" aria-hidden />
            {t.label}
          </Link>
        );
      })}
      <button type="button" onClick={onMore} className={cn(cell, 'text-muted-foreground')}>
        <Menu className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
