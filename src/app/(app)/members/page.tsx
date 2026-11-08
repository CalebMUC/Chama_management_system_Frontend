'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MailCheck, MailWarning, UserPlus } from 'lucide-react';
import type { MembershipStatus, MemberView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusChip } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { InviteDialog } from '@/features/members/InviteDialog';
import { MemberActions } from '@/features/members/MemberActions';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { formatInstantDate } from '@/lib/format';
import { label } from '@/lib/labels';

const TABS: { value: MembershipStatus | 'ALL'; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

const columns: ColumnDef<MemberView, unknown>[] = [
  { id: 'number', header: '#', accessorFn: (m) => m.memberNumber ?? Number.MAX_SAFE_INTEGER, cell: ({ row }) => (row.original.memberNumber ? `#${row.original.memberNumber}` : '—') },
  { id: 'name', header: 'Name', accessorFn: (m) => memberName(m), cell: ({ row }) => <span className="font-medium">{memberName(row.original)}</span> },
  {
    id: 'email',
    header: 'Email',
    accessorKey: 'email',
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        {row.original.emailVerified ? <MailCheck className="size-4 text-success" aria-label="Verified" /> : <MailWarning className="size-4 text-warning" aria-label="Not verified" />}
        {row.original.email}
      </span>
    ),
  },
  { id: 'phone', header: 'Phone', accessorFn: (m) => m.phoneNumber ?? '', cell: ({ row }) => row.original.phoneNumber ?? '—' },
  {
    id: 'roles',
    header: 'Roles',
    accessorFn: (m) => m.roles.join(' '),
    enableSorting: false,
    cell: ({ row }) => <span className="flex flex-wrap gap-1">{row.original.roles.filter((r) => r !== 'MEMBER').map((r) => <Badge key={r} variant="outline">{label(r)}</Badge>)}</span>,
  },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
  {
    id: 'date',
    header: 'Joined / applied',
    accessorFn: (m) => m.joinedAt ?? m.appliedAt,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatInstantDate(row.original.joinedAt ?? row.original.appliedAt)}</span>,
  },
  { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => <MemberActions member={row.original} /> },
];

export default function MembersPage() {
  return (
    <Guard permission="MEMBER_VIEW">
      <Members />
    </Guard>
  );
}

/** README §7.5. No server search: the whole directory is loaded once and filtered here. */
function Members() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (params.get('status') as MembershipStatus | 'ALL' | null) ?? 'ACTIVE';
  const directory = useMemberDirectory();
  const [inviting, setInviting] = useState(false);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: directory.members.length };
    for (const m of directory.members) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [directory.members]);
  const rows = useMemo(() => (status === 'ALL' ? directory.members : directory.members.filter((m) => m.status === status)), [directory.members, status]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Members"
        description={`${counts.ACTIVE ?? 0} active members`}
        actions={<Can permission="MEMBER_INVITE"><Button onClick={() => setInviting(true)}><UserPlus />Invite</Button></Can>}
      />
      <Tabs value={status} onValueChange={(v) => router.replace(v === 'ACTIVE' ? '/members' : `/members?status=${v}`)}>
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {(counts[t.value] ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular">{counts[t.value]}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <DataTable
        key={status}
        columns={columns}
        data={rows}
        isLoading={directory.isLoading}
        error={directory.error}
        onRetry={() => directory.refetch()}
        getRowId={(m) => m.membershipId}
        onRowClick={(m) => router.push(`/members/${m.userId}`)}
        searchable
        searchPlaceholder="Name, email, phone or number"
        emptyTitle={status === 'PENDING_APPROVAL' ? 'No applications waiting' : 'No members here'}
        csv={{
          fileName: 'members',
          columns: [
            { header: 'Member number', value: (m) => m.memberNumber },
            { header: 'First name', value: (m) => m.firstName },
            { header: 'Last name', value: (m) => m.lastName },
            { header: 'Email', value: (m) => m.email },
            { header: 'Phone', value: (m) => m.phoneNumber },
            { header: 'Roles', value: (m) => m.roles.join(' ') },
            { header: 'Status', value: (m) => m.status },
            { header: 'Applied', value: (m) => m.appliedAt },
            { header: 'Joined', value: (m) => m.joinedAt },
          ],
        }}
        mobileCard={(m) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{m.memberNumber ? `#${m.memberNumber} ` : ''}{memberName(m)}</p>
              <p className="truncate text-xs text-muted-foreground">{m.phoneNumber ?? m.email}</p>
              <p className="mt-1 flex flex-wrap gap-1">{m.roles.filter((r) => r !== 'MEMBER').map((r) => <Badge key={r} variant="outline">{label(r)}</Badge>)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusChip status={m.status} />
              <MemberActions member={m} />
            </div>
          </div>
        )}
      />
      <InviteDialog open={inviting} onOpenChange={setInviting} />
    </div>
  );
}
