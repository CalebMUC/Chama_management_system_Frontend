'use client';

import { Fragment, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { accountNavigation, navigation, platformNavigation, workspaceOf, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

// The longest matching href wins, so `exact` (a sidebar highlighting rule) doesn't matter here.
const matches = (pathname: string, item: NavItem) => pathname === item.href || pathname.startsWith(`${item.href}/`);

/**
 * The trail for a route, from the navigation config: workspace › group › page. On a page below a nav item (a detail or "new"
 * page) the item becomes a link and the page's own title follows in the page bar.
 */
export function crumbsFor(pathname: string): Crumb[] {
  if (pathname.startsWith('/platform')) {
    const item = platformNavigation[0].items.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
    const trail: Crumb[] = [{ label: 'Platform' }];
    if (item && pathname !== item.href) trail.push({ label: item.label, href: item.href });
    return trail;
  }
  const groups = [...navigation, { label: 'Account', items: accountNavigation }];
  let best: { group: string; item: NavItem } | null = null;
  for (const g of groups) {
    for (const item of g.items) {
      if (matches(pathname, item) && (!best || item.href.length > best.item.href.length)) best = { group: g.label, item };
    }
  }
  if (!best) return [];
  const workspace = workspaceOf(best.group);
  const trail: Crumb[] = [];
  if (workspace) trail.push({ label: workspace.label });
  if (best.group !== 'Me' && best.group !== 'Account') trail.push({ label: best.group });
  if (pathname !== best.item.href) trail.push({ label: best.item.label, href: best.item.href });
  return trail;
}

export function Breadcrumbs({ extra, className }: { extra?: Crumb; className?: string }) {
  const pathname = usePathname();
  const crumbs = useMemo(() => {
    const trail = crumbsFor(pathname);
    if (extra && !trail.some((c) => c.href === extra.href)) trail.push(extra);
    return trail;
  }, [pathname, extra]);
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 text-2xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />}
            <li className="truncate">
              {c.href ? <Link href={c.href} className="hover:text-foreground hover:underline">{c.label}</Link> : <span>{c.label}</span>}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
