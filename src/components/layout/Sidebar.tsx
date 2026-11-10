'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, ChevronDown, Wallet } from 'lucide-react';
import { navigation, platformNavigation, workspaceOf, workspaces, type BadgeKey, type NavGroup, type NavItem, type WorkspaceId } from '@/config/navigation';
import { useWorkQueue } from '@/features/access/useWorkQueue';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { usePreferences } from '@/stores/preferences';
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

export interface WorkspaceNavigation {
  /** Holds an official permission: sees the Operations workspace and the switcher. */
  official: boolean;
  /** The workspace the current page belongs to (or the one last chosen). */
  active: WorkspaceId;
  /** Groups of each workspace, already filtered by permission and feature. */
  groups: Record<WorkspaceId, NavGroup[]>;
}

/**
 * Splits the visible navigation into My banking and Operations. Someone with no official permission sees only My banking; any
 * back-office item they can still open today (ungated product pages) moves into it, so nothing they could reach disappears.
 */
export function useWorkspaceNavigation(): WorkspaceNavigation {
  const visible = useVisibleNavigation('chama');
  const pathname = usePathname();
  const remembered = usePreferences((s) => s.workspace);
  return useMemo(() => {
    const of = (id: WorkspaceId) => visible.filter((g) => workspaceOf(g.label)?.id === id);
    const banking = of('banking');
    const operations = of('operations');
    const official = operations.some((g) => g.items.some((i) => i.permission && i.permission !== 'member'));
    const groups: Record<WorkspaceId, NavGroup[]> = official
      ? { banking, operations }
      : { banking: [...banking, ...(operations.length ? [{ label: 'Chama products', items: operations.flatMap((g) => g.items) }] : [])], operations: [] };
    const here = bestMatch(pathname, visible);
    const owner = here ? visible.find((g) => g.items.some((i) => i.href === here)) : undefined;
    const active: WorkspaceId = !official ? 'banking' : (owner && workspaceOf(owner.label)?.id) || remembered;
    return { official, active, groups };
  }, [visible, pathname, remembered]);
}

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The longest matching href wins, so /contributions/periods doesn't also light up /contributions. */
export function bestMatch(pathname: string, groups: NavGroup[]): string | null {
  const items = groups.flatMap((g) => g.items).filter((i) => isActive(pathname, i));
  return items.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

function Count({ value, label }: { value: number; label: string }) {
  if (!value) return null;
  return (
    <span className="ml-auto rounded-sm bg-gold px-1.5 text-[10px] font-semibold leading-4 text-sidebar tabular" aria-label={`${value} ${label}`}>
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
  payments: 'reported payments to confirm',
};

const workspaceIcons: Record<WorkspaceId, typeof Wallet> = { banking: Wallet, operations: Briefcase };

function WorkspaceSwitcher({ nav, collapsed, onNavigate }: { nav: WorkspaceNavigation; collapsed: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const setPref = usePreferences((s) => s.set);
  const go = (id: WorkspaceId) => {
    setPref('workspace', id);
    const first = nav.groups[id][0]?.items[0];
    if (first && id !== nav.active) {
      router.push(first.href);
      onNavigate?.();
    }
  };
  return (
    <div className={cn('border-b border-white/10 p-2', collapsed && 'px-1.5')} role="group" aria-label="Workspace">
      <div className={cn('grid gap-1 rounded-md bg-white/5 p-0.5', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
        {workspaces.map((w) => {
          const Icon = workspaceIcons[w.id];
          const on = nav.active === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => go(w.id)}
              aria-pressed={on}
              title={collapsed ? w.label : undefined}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                on ? 'bg-sidebar-foreground text-sidebar' : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {collapsed ? <span className="sr-only">{w.label}</span> : w.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onNavigate, area }: { collapsed: boolean; onNavigate?: () => void; area: ShellArea }) {
  const pathname = usePathname();
  const platformGroups = useVisibleNavigation(area);
  const nav = useWorkspaceNavigation();
  const groups = area === 'platform' ? platformGroups : nav.groups[nav.active];
  const active = bestMatch(pathname, groups);
  const chamaName = useSession((s) => s.chamaName);
  const queue = useWorkQueue();
  const folded = usePreferences((s) => s.collapsedGroups);
  const setPref = usePreferences((s) => s.set);
  const toggleGroup = (label: string) => setPref('collapsedGroups', folded.includes(label) ? folded.filter((g) => g !== label) : [...folded, label]);

  return (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Main">
      <div className={cn('flex h-topbar shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-3')}>
        <BrandMark compact={collapsed} subtitle={area === 'platform' ? 'Platform console' : chamaName} />
      </div>
      {area === 'chama' && nav.official && <WorkspaceSwitcher nav={nav} collapsed={collapsed} onNavigate={onNavigate} />}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {groups.map((group) => {
          const isFolded = !collapsed && folded.includes(group.label) && !group.items.some((i) => i.href === active);
          const listId = `nav-${group.label.replace(/\W+/g, '-').toLowerCase()}`;
          const hidden = group.items.reduce((n, i) => n + (i.badge ? queue[i.badge] : 0), 0);
          return (
            <div key={group.label}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={!isFolded}
                  aria-controls={listId}
                  className="group/nav flex w-full items-center gap-1 rounded px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <ChevronDown className={cn('size-3 shrink-0 transition-transform', isFolded && '-rotate-90')} aria-hidden />
                  {group.label}
                  {isFolded && <Count value={hidden} label="waiting in this group" />}
                </button>
              )}
              <div id={listId} className={cn('space-y-px', isFolded && 'hidden')}>
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
                        'relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold',
                        on ? 'bg-primary font-medium text-primary-foreground dark:bg-white/10 dark:text-sidebar-foreground' : 'text-sidebar-foreground/85 hover:bg-white/5 hover:text-sidebar-foreground',
                        on && "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r-sm before:bg-gold before:content-['']",
                        collapsed && 'justify-center px-0 py-2',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.badge && <Count value={count} label={badgeLabels[item.badge]} />}
                      {collapsed && count > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-gold" aria-label={`${count} ${badgeLabels[item.badge!]}`} />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
