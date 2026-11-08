'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gavel, PlayCircle } from 'lucide-react';
import { penaltiesApi } from '@/api/endpoints/penalties';
import type { PenaltyStatus } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { FineDialog } from '@/features/penalties/FineDialog';
import { PenaltyCard, penaltyColumns, penaltyCsv } from '@/features/penalties/penaltyColumns';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { fractionDigits, plural } from '@/lib/format';
import { keys } from '@/lib/invalidation';

export default function PenaltiesPage() {
  return (
    <Guard permission="PENALTY_VIEW_ALL" feature="PENALTIES">
      <Penalties />
    </Guard>
  );
}

/** README §7.8. */
function Penalties() {
  const router = useRouter();
  const params = useSearchParams();
  const currency = useCurrency();
  const [member, setMember] = useState<string | null>(params.get('member'));
  const [status, setStatus] = useState<PenaltyStatus | ''>((params.get('status') as PenaltyStatus | null) ?? '');
  const [fining, setFining] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const list = usePaged(['penalties', 'list'], { memberUserId: member ?? undefined, status: status || undefined }, penaltiesApi.list);
  const assess = useApiMutation(() => penaltiesApi.assess(), {
    invalidate: keys('penalty'),
    toastErrors: false,
    success: (created) => (created.length ? `${plural(created.length, 'late penalty', 'late penalties')} added.` : 'No new late penalties.'),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Penalties"
        description="Late-contribution penalties (added automatically) and fines."
        actions={
          <Can permission="PENALTY_RECORD">
            <Button variant="outline" onClick={() => setAssessing(true)}><PlayCircle />Run late-penalty check</Button>
            <Button onClick={() => setFining(true)}><Gavel />Fine a member</Button>
          </Can>
        }
      />
      <DataTable
        columns={penaltyColumns(true)}
        getRowId={(p) => p.id}
        onRowClick={(p) => router.push(`/penalties/${p.id}`)}
        emptyTitle="No penalties"
        csv={{ fileName: 'penalties', columns: penaltyCsv(fractionDigits(currency)) }}
        toolbar={
          <>
            <div className="w-full sm:w-64"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All members" /></div>
            {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>Clear</Button>}
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PenaltyStatus | '')} className="w-40" aria-label="Status">
              <option value="">All statuses</option>
              <option value="OUTSTANDING">Outstanding</option>
              <option value="PAID">Paid</option>
              <option value="WAIVED">Waived</option>
            </NativeSelect>
          </>
        }
        mobileCard={(p) => <PenaltyCard p={p} withMember />}
        {...list.table}
      />
      <FineDialog open={fining} onOpenChange={setFining} />
      <ConfirmDialog
        open={assessing}
        onOpenChange={setAssessing}
        title="Run the late-penalty check now?"
        description="Members who missed a due date past the grace period get their late penalty now. It also runs automatically every day; nobody is charged twice."
        confirmLabel="Run check"
        onConfirm={() => assess.mutateAsync(undefined)}
      />
    </div>
  );
}
