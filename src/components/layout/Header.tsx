'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, Monitor, Moon, PanelLeft, Rows3, Rows4, Sun, UserRound, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { loginPath, logout, logoutEverywhere } from '@/features/auth/sessionActions';
import { fullName } from '@/lib/format';
import { label } from '@/lib/labels';
import { usePreferences, type Theme } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import type { ShellArea } from './Sidebar';

export function ThemeToggle() {
  const theme = usePreferences((s) => s.theme);
  const set = usePreferences((s) => s.set);
  const next: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" onClick={() => set('theme', next[theme])} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
      <Icon />
    </Button>
  );
}

export function UserMenu({ area }: { area: ShellArea }) {
  const user = useSession((s) => s.user);
  const membership = useSession((s) => s.membership);
  const [confirmAll, setConfirmAll] = useState(false);
  const density = usePreferences((s) => s.density);
  const setPref = usePreferences((s) => s.set);
  const name = fullName(user?.firstName, user?.lastName) ?? user?.email ?? '';
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  const roles = membership?.roles.filter((r) => r !== 'MEMBER') ?? [];

  const signOut = async () => {
    const code = await logout();
    window.location.assign(area === 'platform' ? '/admin/login' : loginPath(code));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{initials}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            <span className="block truncate text-xs">{user?.email}</span>
            {membership?.memberNumber && <span className="mt-1 block text-xs">Member #{membership.memberNumber}</span>}
            {roles.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{roles.map((r) => <Badge key={r} variant="secondary">{label(r)}</Badge>)}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {area === 'chama' && (
            <DropdownMenuItem asChild>
              <Link href="/profile"><UserRound />Profile & security</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPref('density', density === 'compact' ? 'comfortable' : 'compact'); }}>
            {density === 'compact' ? <Rows3 /> : <Rows4 />}
            {density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmAll(true)}><MonitorSmartphone />Sign out everywhere</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={signOut}><LogOut />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out of every device?"
        description="Every session on every phone and computer ends, including this one."
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          const code = await logoutEverywhere();
          window.location.assign(area === 'platform' ? '/admin/login' : loginPath(code));
        }}
      />
    </>
  );
}

export function Header({ onToggleSidebar, onOpenMobileNav, area }: { onToggleSidebar(): void; onOpenMobileNav(): void; area: ShellArea }) {
  const chamaName = useSession((s) => s.chamaName);
  const chamaCode = useSession((s) => s.user?.chamaCode);
  return (
    <header className="no-print sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open menu"><Menu /></Button>
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label="Toggle sidebar"><PanelLeft /></Button>
      {area === 'platform' ? (
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">Platform administration</span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{chamaName ?? 'Your chama'}</span>
          {chamaCode && <Badge variant="outline" className="hidden font-mono sm:inline-flex">{chamaCode}</Badge>}
        </span>
      )}
      <div className="flex-1" />
      <ThemeToggle />
      <UserMenu area={area} />
    </header>
  );
}
