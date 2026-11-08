'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { platformApi } from '@/api/endpoints/platform';
import type { PlatformChamaView } from '@/api/types';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader, StatusChip } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { usePaged } from '@/hooks/usePaged';
import { formatInstantDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

const expiring = (v: PlatformChamaView) => v.license.state === 'ACTIVE' && v.license.daysRemaining <= 14;

const columns: ColumnDef<PlatformChamaView, unknown>[] = [
  { id: 'name', header: 'Chama', accessorFn: (v) => v.chama.name, cell: ({ row }) => <span><span className="font-medium">{row.original.chama.name}</span><span className="block font-mono text-xs text-muted-foreground">{row.original.chama.code}</span></span> },
  { id: 'currency', header: 'Currency', accessorFn: (v) => v.chama.currency },
  { id: 'plan', header: 'Plan', accessorFn: (v) => label(v.license.plan) },
  { id: 'state', header: 'Licence', accessorFn: (v) => v.license.state, cell: ({ row }) => <StatusChip status={row.original.license.state} /> },
  {
    id: 'until',
    header: 'Valid until',
    accessorFn: (v) => v.license.validUntil,
    cell: ({ row }) => {
      const l = row.original.license;
      return (
        <span className="whitespace-nowrap">
          {formatInstantDate(l.validUntil)}
          <span className={cn('block text-xs', expiring(row.original) ? 'font-medium text-warning' : 'text-muted-foreground')}>{l.state === 'EXPIRED' ? 'expired' : `${l.daysRemaining} days left`}</span>
        </span>
      );
    },
  },
  { id: 'members', header: 'Max members', accessorFn: (v) => v.license.maxMembers, meta: { align: 'right' } },
  { id: 'features', header: 'Features', accessorFn: (v) => v.license.features.length, meta: { align: 'right' } },
  { id: 'created', header: 'Created', accessorFn: (v) => v.chama.createdAt, cell: ({ row }) => formatInstantDate(row.original.chama.createdAt) },
];

/** README §7.16: every chama, with licence health highlighted. */
export default function PlatformChamasPage() {
  const router = useRouter();
  const list = usePaged(['platform', 'chamas'], {}, platformApi.list);
  return (
    <div className="space-y-4">
      <PageHeader title="Chamas" description="Every chama on the platform and its licence." actions={<Button asChild><Link href="/platform/chamas/new"><Plus />Onboard a chama</Link></Button>} />
      <DataTable
        columns={columns}
        getRowId={(v) => v.chama.id}
        onRowClick={(v) => router.push(`/platform/chamas/${v.chama.id}`)}
        rowClassName={(v) => (v.license.state !== 'ACTIVE' ? 'bg-destructive/5' : expiring(v) ? 'bg-warning/10' : undefined)}
        emptyTitle="No chamas yet"
        emptyAction={<Button asChild><Link href="/platform/chamas/new">Onboard the first chama</Link></Button>}
        mobileCard={(v) => (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{v.chama.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{v.chama.code}</p>
            </div>
            <div className="text-right text-sm">
              <StatusChip status={v.license.state} />
              <p className="mt-1 text-xs text-muted-foreground">{label(v.license.plan)} · {v.license.daysRemaining}d left</p>
              {expiring(v) && <Badge variant="warning" className="mt-1">Expiring</Badge>}
            </div>
          </div>
        )}
        {...list.table}
      />
    </div>
  );
}
