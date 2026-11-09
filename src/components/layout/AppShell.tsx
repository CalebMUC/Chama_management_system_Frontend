'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AmountSettingsProvider } from '@/components/shared/Amount';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { ConnectivityBanner, LicenceBanner } from '@/features/access/Banners';
import { usePreferences } from '@/stores/preferences';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar, type ShellArea } from './Sidebar';

/** My banking screens: where "Hide balances" applies. */
export const isMemberRoute = (path: string) => path === '/home' || path.startsWith('/me/');

/** Text-heavy pages keep a readable line length; everything else uses the full width. */
const READABLE = ['/profile', '/settings/chama', '/settings/licence', '/settings/roles'];

export function AppShell({ children, area }: { children: ReactNode; area: ShellArea }) {
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const hideBalances = usePreferences((s) => s.hideBalances);
  const setPref = usePreferences((s) => s.set);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const readable = READABLE.some((p) => pathname === p);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only z-50 rounded-sm bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Skip to content</a>
      <aside className={cn('no-print fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block', collapsed ? 'w-14' : 'w-60')}>
        <Sidebar collapsed={collapsed} area={area} />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-full max-h-full w-72 max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <Sidebar collapsed={false} area={area} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding]', collapsed ? 'lg:pl-14' : 'lg:pl-60')}>
        <Header area={area} onToggleSidebar={() => setPref('sidebarCollapsed', !collapsed)} onOpenMobileNav={() => setMobileOpen(true)} />
        <ConnectivityBanner />
        {area === 'chama' && <LicenceBanner />}
        <main id="main" tabIndex={-1} className={cn('w-full min-w-0 flex-1 p-gutter focus:outline-none', area === 'chama' && 'pb-20 sm:pb-gutter')}>
          <AmountSettingsProvider hidden={area === 'chama' && hideBalances && isMemberRoute(pathname)}>
            <div className={cn(readable && 'max-w-5xl')}>{children}</div>
          </AmountSettingsProvider>
        </main>
      </div>
      {area === 'chama' && <MobileTabBar onMore={() => setMobileOpen(true)} />}
    </div>
  );
}
