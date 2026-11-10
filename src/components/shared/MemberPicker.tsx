'use client';

import { forwardRef, useMemo } from 'react';
import type { MembershipStatus, MemberView } from '@/api/types';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { memberLabel } from '@/lib/format';
import { OptionPicker } from './OptionPicker';

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

/**
 * A searchable picker over the cached member directory (no server search exists). Needs MEMBER_VIEW: plain members pick
 * guarantors with GuarantorPicker instead.
 */
export const MemberPicker = forwardRef<HTMLButtonElement, MemberPickerProps>(function MemberPicker(
  { value, onChange, statuses = ['ACTIVE'], exclude = [], placeholder = 'Choose a member', ...rest },
  ref,
) {
  const directory = useMemberDirectory();
  const options = useMemo(() => {
    const ex = new Set(exclude.filter(Boolean));
    return directory.members
      .filter((m) => statuses.includes(m.status) && !ex.has(m.userId))
      .sort((a, b) => (a.memberNumber ?? 1e9) - (b.memberNumber ?? 1e9))
      .map((m) => ({
        id: m.userId,
        label: memberLabel(memberName(m), m.memberNumber),
        sub: `${m.phoneNumber ?? m.email}${m.status !== 'ACTIVE' ? ` · ${m.status.toLowerCase()}` : ''}`,
        keywords: [m.email, m.phoneNumber, m.memberNumber ? `#${m.memberNumber}` : ''].join(' '),
      }));
  }, [directory.members, statuses, exclude]);
  const selected = value ? directory.byUserId.get(value) : undefined;

  if (!directory.allowed) {
    return <p className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">You need permission to view members to pick one.</p>;
  }

  return (
    <OptionPicker
      ref={ref}
      value={value}
      onChange={(id) => onChange(id, id ? directory.byUserId.get(id) ?? null : null)}
      options={options}
      selectedLabel={selected ? memberLabel(memberName(selected), selected.memberNumber) : undefined}
      loading={directory.isLoading}
      placeholder={placeholder}
      searchPlaceholder="Name, number, phone…"
      searchLabel="Search members"
      emptyText="No members match."
      {...rest}
    />
  );
});
