'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, DoorOpen } from 'lucide-react';
import { exitsApi } from '@/api/endpoints/exits';
import type { MemberView } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/primitives';
import { formatInstantDate } from '@/lib/format';
import { isExitOpen } from './exitRules';
import { ExitStatusChip } from './SettlementStatement';

/**
 * On a member's page: an exit in progress (link to it), or for an EXITED member when they left, why, and their settled exit.
 */
export function MemberExitNotice({ member }: { member: MemberView }) {
  const relevant = member.status === 'ACTIVE' || member.status === 'SUSPENDED' || member.status === 'EXITED';
  const q = useQuery({
    queryKey: ['memberExits', 'list', { memberUserId: member.userId }],
    queryFn: () => exitsApi.list({ memberUserId: member.userId, page: 0, size: 20 }),
    enabled: relevant,
  });
  if (!relevant) return null;
  const exits = q.data?.items ?? [];

  if (member.status === 'EXITED') {
    const settled = exits.find((e) => e.status === 'SETTLED');
    return (
      <Alert>
        <DoorOpen />
        <AlertTitle>Left the chama{member.exitedAt && ` on ${formatInstantDate(member.exitedAt)}`}</AlertTitle>
        <AlertDescription>
          {settled ? <ExitLink id={settled.id} text="View the settled exit and its payout" /> : <p className="text-muted-foreground">Their accounts are closed; their records stay for the books.</p>}
        </AlertDescription>
      </Alert>
    );
  }

  const open = exits.find((e) => isExitOpen(e.status));
  if (!open) return null;
  return (
    <Alert variant="info">
      <DoorOpen />
      <AlertTitle className="flex flex-wrap items-center gap-2">This member&apos;s exit is in progress <ExitStatusChip status={open.status} /></AlertTitle>
      <AlertDescription className="space-y-1">
        <p>Started {formatInstantDate(open.requestedAt)}{open.requestedByName && ` by ${open.requestedByName}`} · {open.reason}</p>
        <ExitLink id={open.id} text="Open the exit" />
      </AlertDescription>
    </Alert>
  );
}

function ExitLink({ id, text }: { id: string; text: string }) {
  return (
    <Link href={`/members/exits/${id}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
      {text}<ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
