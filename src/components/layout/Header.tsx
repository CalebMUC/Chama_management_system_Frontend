'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, LogOut, Menu, Monitor, Moon, PanelLeft, Rows3, Rows4, Sun, UserRound, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { loginPath, logout, logoutEverywhere } from '@/features/auth/sessionActions';
import { fullName } from '@/lib/format';
import { label } from '@/lib/labels';
import { usePreferences, type Theme } from '@/stores/preferences';
import { useSession } from '@/stores/session';
import { usePathname } from 'next/navigation';
import { isMemberRoute } from '@/lib/routes';
import type { ShellArea } from './Sidebar';
import { ApprovalsInbox, CommandSearch, EnvBadge, NewMenu, PeriodChip, PlanChip } from './TopBarTools';

const nextTheme: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const themeIcon = (theme: Theme) => (theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor);

/** Show / hide balances, on My banking screens only (where the preference applies). */
function BalancesButton() {
  const pathname = usePathname();
  const hidden = usePreferences((s) => s.hideBalances);
  const set = usePreferences((s) => s.set);
  if (!isMemberRoute(pathname)) return null;
  const Icon = hidden ? Eye : EyeOff;
  return (
    <Button variant="ghost" size="icon" onClick={() => set('hideBalances', !hidden)} aria-pressed={hidden} aria-label={hidden ? 'Show balances' : 'Hide balances'} title={hidden ? 'Show balances' : 'Hide balances'}>
      <Icon />
    </Button>
  );
}

export function ThemeToggle() {
  const theme = usePreferences((s) => s.theme);
  const set = usePreferences((s) => s.set);
  const Icon = themeIcon(theme);
  return (
    <Button variant="ghost" size="icon" onClick={() => set('theme', nextTheme[theme])} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}>
      <Icon />
    </Button>
  );
}

export function UserMenu({ area }: { area: ShellArea }) {
  const user = useSession((s) => s.user);
  const membership = useSession((s) => s.membership);
  const [confirmAll, setConfirmAll] = useState(false);
  const density = usePreferences((s) => s.density);
  const theme = usePreferences((s) => s.theme);
  const ThemeIcon = themeIcon(theme);
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
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
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
          {/* The theme button is in the top bar from 640 px up; on phones it lives here. */}
          <DropdownMenuItem className="sm:hidden" onSelect={(e) => { e.preventDefault(); setPref('theme', nextTheme[theme]); }}>
            <ThemeIcon />Theme: {theme}
          </DropdownMenuItem>
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
    <header className="no-print sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-1.5 border-b bg-card px-2 sm:gap-2 sm:px-3">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open menu"><Menu /></Button>
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label="Toggle sidebar"><PanelLeft /></Button>
      {area === 'platform' ? (
        <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">Platform administration</span>
      ) : (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold" title={chamaName ?? undefined}>{chamaName ?? 'Your chama'}</span>
          {chamaCode && <Badge variant="outline" className="hidden font-mono sm:inline-flex" title="Chama code">{chamaCode}</Badge>}
          <PlanChip />
        </span>
      )}
      <EnvBadge />
      {area === 'chama' && <PeriodChip />}
      <div className="flex-1" />
      {area === 'chama' && (
        <>
          <CommandSearch />
          <ApprovalsInbox />
          <NewMenu />
        </>
      )}
      {area === 'chama' && <BalancesButton />}
      <span className="hidden sm:contents"><ThemeToggle /></span>
      <UserMenu area={area} />
    </header>
  );
}
