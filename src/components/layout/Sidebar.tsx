'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigation, platformNavigation, type BadgeKey, type NavGroup, type NavItem } from '@/config/navigation';
import { useWorkQueue } from '@/features/access/useWorkQueue';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { useSession } from '@/stores/session';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';

export type ShellArea = 'chama' | 'platform';

/** The navigation the user can see: permission and licence feature on every item, empty groups hidden. */
export function useVisibleNavigation(area: ShellArea): NavGroup[] {
  const can = useCan();
  const hasFeature = useHasFeature();
  return useMemo(() => {
    if (area === 'platform') return platformNavigation;
    return navigation
      .map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission ?? 'member') && hasFeature(i.feature)) }))
      .filter((g) => g.items.length > 0);
  }, [area, can, hasFeature]);
}

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The longest matching href wins, so /contributions/periods doesn't also light up /contributions. */
function bestMatch(pathname: string, groups: NavGroup[]): string | null {
  const items = groups.flatMap((g) => g.items).filter((i) => isActive(pathname, i));
  return items.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function Count({ value, label }: { value: number; label: string }) {
  if (!value) return null;
  return (
    <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold leading-4 text-sidebar" aria-label={`${value} ${label}`}>
      {value > 99 ? '99+' : value}
    </span>
  );
}

const badgeLabels: Record<BadgeKey, string> = {
  applications: 'applications waiting',
  loans: 'loans waiting for you',
  expenses: 'expenses waiting for you',
  investments: 'investments waiting for approval',
  guarantees: 'guarantee requests',
};

export function Sidebar({ collapsed, onNavigate, area }: { collapsed: boolean; onNavigate?: () => void; area: ShellArea }) {
  const pathname = usePathname();
  const groups = useVisibleNavigation(area);
  const active = bestMatch(pathname, groups);
  const chamaName = useSession((s) => s.chamaName);
  const queue = useWorkQueue();

  return (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Main">
      <div className={cn('flex h-topbar shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-4')}>
        <BrandMark compact={collapsed} subtitle={area === 'platform' ? 'Platform console' : chamaName} />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const on = active === item.href;
                const count = item.badge ? queue[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                      on ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground/85 hover:bg-white/5 hover:text-sidebar-foreground',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && <Count value={count} label={badgeLabels[item.badge]} />}
                    {collapsed && count > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-gold" aria-label={`${count} ${badgeLabels[item.badge!]}`} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
