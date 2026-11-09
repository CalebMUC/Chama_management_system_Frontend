'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { ArrowRight, CalendarRange, ChevronDown, CornerDownLeft, Inbox, Plus, Search, UserRound } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints/books';
import { loansApi } from '@/api/endpoints/loans';
import { Amount } from '@/components/shared/Amount';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { env } from '@/config/env';
import { accountNavigation, newActions, workspaces, type NewAction } from '@/config/navigation';
import { useApprovalQueues } from '@/features/access/useApprovalQueues';
import { ExpenseDialog } from '@/features/expenses/ExpenseDialog';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { formatPeriodKey, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { licenceUsable, useSession } from '@/stores/session';
import { useWorkspaceNavigation } from './Sidebar';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// ---- Chips -----------------------------------------------------------------------------------------------------------------

/** The licence plan, beside the chama name. */
export function PlanChip() {
  const plan = useSession((s) => s.licence?.plan);
  if (!plan) return null;
  return <Badge variant="outline" className="hidden uppercase tracking-wide md:inline-flex" title="Licence plan">{label(plan)}</Badge>;
}

/** DEVELOPMENT / STAGING / TEST from NEXT_PUBLIC_APP_ENV; nothing in production or when unset. */
export function EnvBadge() {
  const name = env.appEnv.trim().toLowerCase();
  if (!name || name === 'production' || name === 'prod') return null;
  return (
    <span className="shrink-0 rounded-sm border border-warning/60 bg-warning/15 px-1.5 text-2xs font-semibold uppercase leading-5 tracking-wider text-warning-text" title={`Environment: ${name}`}>
      <span className="sm:hidden" aria-hidden>{name.slice(0, 3)}</span>
      <span className="sr-only sm:not-sr-only">{name}</span>
    </span>
  );
}

/** The current contribution period ("Period Nov 2026"), from the member dashboard. */
export function PeriodChip() {
  const hasFeature = useHasFeature();
  const usable = useSession((s) => s.status === 'authenticated' && s.membership?.status === 'ACTIVE' && licenceUsable(s.licence));
  const q = useQuery({ queryKey: ['dashboard', 'me'], queryFn: dashboardApi.mine, enabled: usable && hasFeature('CONTRIBUTIONS'), refetchOnWindowFocus: true });
  const period = q.data?.contributions?.currentPeriod;
  if (!period) return null;
  return (
    <span className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border bg-panel-header px-2 text-xs leading-6 text-muted-foreground xl:inline-flex" title="Current contribution period">
      <CalendarRange className="size-3.5" aria-hidden />
      Period <span className="font-medium text-foreground">{formatPeriodKey(period)}</span>
    </span>
  );
}

// ---- Approvals inbox -------------------------------------------------------------------------------------------------------

/** Everything waiting for this user, by queue, linking to the same pre-filtered lists as the overview. */
export function ApprovalsInbox() {
  const { queues, total } = useApprovalQueues();
  const [open, setOpen] = useState(false);
  if (queues.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative gap-1.5 px-2" aria-label={`Approvals: ${total} waiting`}>
          <Inbox />
          <span className="hidden lg:inline">Approvals</span>
          {total > 0 && <span className="rounded-sm bg-gold px-1 text-[10px] font-semibold leading-4 text-sidebar tabular">{total > 99 ? '99+' : total}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b bg-panel-header px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Approvals inbox</p>
          <span className="text-xs text-muted-foreground tabular">{total} waiting</span>
        </div>
        <ul className="divide-y">
          {queues.map((q) => (
            <li key={q.key}>
              <Link href={q.href} onClick={() => setOpen(false)} className={cn('flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none', q.count === 0 && 'text-muted-foreground')}>
                <span className={cn('min-w-7 rounded-sm px-1 text-center text-xs font-semibold tabular', q.count > 0 ? 'bg-gold/25 text-foreground' : 'bg-muted')}>{q.count}</span>
                <span className="flex-1">{q.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">Counts refresh every few minutes and when you return to this tab.</p>
      </PopoverContent>
    </Popover>
  );
}

// ---- New transaction -------------------------------------------------------------------------------------------------------

export function useAllowedActions(): NewAction[] {
  const can = useCan();
  const hasFeature = useHasFeature();
  return useMemo(() => newActions.filter((a) => can(a.permission) && hasFeature(a.feature)), [can, hasFeature]);
}

/** Runs a New action: routes, or opens the existing dialog. */
function useActionRunner() {
  const router = useRouter();
  const [dialog, setDialog] = useState<NewAction['dialog'] | null>(null);
  const run = (a: NewAction) => (a.href ? router.push(a.href) : setDialog(a.dialog ?? null));
  const dialogs = (
    <>
      <ExpenseDialog open={dialog === 'expense'} onOpenChange={(o) => !o && setDialog(null)} onCreated={(id) => router.push(`/expenses/${id}`)} />
      <LoanPickerDialog open={dialog === 'repayment'} onOpenChange={(o) => !o && setDialog(null)} />
    </>
  );
  return { run, dialogs };
}

/** Pick the active loan a repayment is for, then record it on the loan's page (its existing repayment dialog). */
function LoanPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const router = useRouter();
  const q = useQuery({
    queryKey: ['loans', 'list', { status: 'ACTIVE' }, 0, 100],
    queryFn: () => loansApi.list({ status: 'ACTIVE', page: 0, size: 100 }),
    enabled: open,
  });
  const loans = q.data?.items ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:p-0">
        <div className="border-b px-4 py-3 pr-10">
          <DialogTitle>Record loan repayment</DialogTitle>
          <DialogDescription>Choose the active loan the payment is for.</DialogDescription>
        </div>
        <Command label="Active loans" className="[&_[cmdk-input]]:h-10">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <Command.Input placeholder="Borrower name or member number…" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1">
            {q.isLoading && <Command.Loading><p className="px-3 py-4 text-sm text-muted-foreground">Loading active loans…</p></Command.Loading>}
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">No active loans match.</Command.Empty>
            {loans.map((l) => (
              <Command.Item
                key={l.id}
                value={`${l.id} ${l.borrowerName ?? ''} #${l.memberNumber ?? ''} ${l.memberNumber ?? ''} ${l.productName}`}
                onSelect={() => { onOpenChange(false); router.push(`/loans/${l.id}?action=repay`); }}
                className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm data-[selected=true]:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{memberLabel(l.borrowerName, l.memberNumber)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{l.productName}{l.nextDueDate ? ` · next due ${l.nextDueDate}` : ''}</span>
                </span>
                <span className="text-right text-xs">
                  <span className="block text-muted-foreground">Outstanding</span>
                  <Amount value={l.outstandingMinor} currency={l.currency} sensitive={false} />
                </span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** "+ New": the transactions this user may start. Hidden when they may start none. */
export function NewMenu() {
  const actions = useAllowedActions();
  const { run, dialogs } = useActionRunner();
  if (actions.length === 0) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1 px-2.5" aria-label="New transaction">
            <Plus /><span className="hidden sm:inline">New</span><ChevronDown className="hidden opacity-70 sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>New transaction</DropdownMenuLabel>
          {actions.map((a) => {
            const Icon = a.icon;
            return <DropdownMenuItem key={a.id} onSelect={() => run(a)}><Icon />{a.label}</DropdownMenuItem>;
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}

// ---- Command palette -------------------------------------------------------------------------------------------------------

/** The search button in the top bar; Ctrl/⌘K anywhere opens the same palette. */
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(isMac());
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground transition-colors shrink-0 hover:border-ring/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-52 xl:w-72"
        aria-label="Search pages, members and actions"
        aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 truncate whitespace-nowrap text-left md:inline">Search pages, members…</span>
        <kbd className="hidden rounded-sm border bg-muted px-1 font-mono text-[10px] leading-4 md:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

const itemClass = 'flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm aria-disabled:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground';

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const router = useRouter();
  const nav = useWorkspaceNavigation();
  const actions = useAllowedActions();
  const { run, dialogs } = useActionRunner();
  const directory = useMemberDirectory();
  const [search, setSearch] = useState('');
  useEffect(() => { if (!open) setSearch(''); }, [open]);

  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const q = search.trim().toLowerCase();
  // There is no server search: match the cached directory here and hand cmdk a short list.
  const members = useMemo(() => {
    if (!q || !directory.allowed) return [];
    return directory.members
      .filter((m) => [memberName(m), m.email, m.phoneNumber, m.memberNumber ? `#${m.memberNumber}` : ''].join(' ').toLowerCase().includes(q.replace(/^#/, '')))
      .slice(0, 8);
  }, [q, directory.members, directory.allowed]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Search ChamaBank</DialogTitle>
          <Command label="Search ChamaBank" loop className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-muted-foreground">
            <div className="flex items-center gap-2 border-b px-3 pr-10">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <Command.Input value={search} onValueChange={setSearch} placeholder="Search pages, members and actions…" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No results for “{search}”.</Command.Empty>
              {actions.length > 0 && (
                <Command.Group heading="New">
                  {actions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Command.Item key={a.id} value={a.label} keywords={['new', 'transaction']} onSelect={() => { onOpenChange(false); run(a); }} className={itemClass}>
                        <Icon />{a.label}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {workspaces.map((w) =>
                nav.groups[w.id].length === 0 ? null : (
                  <Command.Group key={w.id} heading={w.label}>
                    {nav.groups[w.id].flatMap((g) =>
                      g.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Command.Item key={item.href} value={`${item.label} ${item.href}`} keywords={[g.label, w.label]} onSelect={() => go(item.href)} className={itemClass}>
                            <Icon />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-xs text-muted-foreground">{g.label}</span>
                          </Command.Item>
                        );
                      }),
                    )}
                  </Command.Group>
                ),
              )}
              <Command.Group heading="Account">
                {accountNavigation.filter((i) => !i.permission).map((item) => {
                  const Icon = item.icon;
                  return <Command.Item key={item.href} value={item.label} keywords={['account']} onSelect={() => go(item.href)} className={itemClass}><Icon />{item.label}</Command.Item>;
                })}
              </Command.Group>
              {members.length > 0 && (
                <Command.Group heading="Members">
                  {members.map((m) => (
                    <Command.Item key={m.userId} value={`member ${search} ${m.userId}`} onSelect={() => go(`/members/${m.userId}`)} className={itemClass}>
                      <UserRound />
                      <span className="flex-1 truncate">{memberLabel(memberName(m), m.memberNumber)}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.phoneNumber ?? m.email}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex items-center gap-3 border-t bg-panel-header px-3 py-1.5 text-2xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CornerDownLeft className="size-3" aria-hidden />open</span>
              <span>↑↓ move</span>
              <span>Esc close</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  );
}
