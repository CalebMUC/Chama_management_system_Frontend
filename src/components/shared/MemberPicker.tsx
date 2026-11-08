'use client';

import { forwardRef, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import type { MembershipStatus, MemberView } from '@/api/types';
import { Input } from '@/components/ui/primitives';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { memberLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface MemberPickerProps {
  /** The member's userId (what financial endpoints call memberUserId). */
  value: string | null | undefined;
  onChange(userId: string | null, member: MemberView | null): void;
  /** ACTIVE by default; seated members (ACTIVE + SUSPENDED) for contributions and fines. */
  statuses?: MembershipStatus[];
  /** userIds that can't be picked (yourself, existing guarantors). */
  exclude?: (string | null | undefined)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** A searchable picker over the cached member directory (no server search exists). */
export const MemberPicker = forwardRef<HTMLButtonElement, MemberPickerProps>(function MemberPicker(
  { value, onChange, statuses = ['ACTIVE'], exclude = [], placeholder = 'Choose a member', disabled, className, ...aria },
  ref,
) {
  const directory = useMemberDirectory();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const options = useMemo(() => {
    const ex = new Set(exclude.filter(Boolean));
    const q = search.trim().toLowerCase();
    return directory.members
      .filter((m) => statuses.includes(m.status) && !ex.has(m.userId))
      .filter((m) => !q || [memberName(m), m.email, m.phoneNumber, m.memberNumber ? `#${m.memberNumber}` : '', String(m.memberNumber ?? '')].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.memberNumber ?? 1e9) - (b.memberNumber ?? 1e9));
  }, [directory.members, statuses, exclude, search]);
  const selected = value ? directory.byUserId.get(value) : undefined;

  if (!directory.allowed) {
    return <p className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">You need permission to view members to pick one.</p>;
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          ref={ref}
          type="button"
          {...aria}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-[invalid=true]:border-destructive',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? memberLabel(memberName(selected), selected.memberNumber) : directory.isLoading ? 'Loading members…' : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0">
        <div className="relative border-b p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, number, phone…" className="pl-8" aria-label="Search members" />
        </div>
        <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
          {options.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">No members match.</li>}
          {options.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                role="option"
                aria-selected={m.userId === value}
                onClick={() => { onChange(m.userId, m); setOpen(false); setSearch(''); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <Check className={cn('size-4 shrink-0', m.userId === value ? 'opacity-100' : 'opacity-0')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{memberLabel(memberName(m), m.memberNumber)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.phoneNumber ?? m.email}{m.status !== 'ACTIVE' ? ` · ${m.status.toLowerCase()}` : ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
