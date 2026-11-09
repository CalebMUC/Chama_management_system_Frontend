'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { ConnectivityBanner, LicenceBanner } from '@/features/access/Banners';
import { usePreferences } from '@/stores/preferences';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Sidebar, type ShellArea } from './Sidebar';

export function AppShell({ children, area }: { children: ReactNode; area: ShellArea }) {
  const collapsed = usePreferences((s) => s.sidebarCollapsed);
  const setPref = usePreferences((s) => s.set);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside className={cn('no-print fixed inset-y-0 left-0 z-40 hidden transition-[width] lg:block', collapsed ? 'w-16' : 'w-64')}>
        <Sidebar collapsed={collapsed} area={area} />
      </aside>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="left-0 top-0 h-full max-h-full w-72 max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <Sidebar collapsed={false} area={area} onNavigate={() => setMobileOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding]', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Header area={area} onToggleSidebar={() => setPref('sidebarCollapsed', !collapsed)} onOpenMobileNav={() => setMobileOpen(true)} />
        <ConnectivityBanner />
        {area === 'chama' && <LicenceBanner />}
        <main id="main" className="w-full min-w-0 flex-1 p-gutter">{children}</main>
      </div>
    </div>
  );
}
