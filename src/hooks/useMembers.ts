'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { membersApi } from '@/api/endpoints/chama';
import type { MemberView } from '@/api/types';
import { fullName } from '@/lib/format';
import { usePermission } from './useSessionInfo';

export const memberName = (m: Pick<MemberView, 'firstName' | 'lastName' | 'email'>) => fullName(m.firstName, m.lastName) ?? m.email;

/**
 * Every member of the chama (all statuses), loaded page by page and cached. There is no server search or single-member
 * endpoint (README §12), so lists, pickers and name lookups all use this. Needs MEMBER_VIEW.
 */
export function useMemberDirectory() {
  const allowed = usePermission('MEMBER_VIEW');
  const query = useQuery({ queryKey: ['members', 'all'], queryFn: () => membersApi.all(), enabled: allowed, staleTime: 60_000 });
  const byUserId = useMemo(() => new Map((query.data ?? []).map((m) => [m.userId, m])), [query.data]);
  return {
    ...query,
    members: query.data ?? [],
    byUserId,
    /** Name for an id in an audit row or approval; "System" for null. */
    nameOf: (userId: string | null | undefined) => {
      if (!userId) return 'System';
      const m = byUserId.get(userId);
      return m ? memberName(m) : 'Unknown member';
    },
    allowed,
  };
}
