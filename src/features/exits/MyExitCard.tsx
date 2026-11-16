'use client';

import { useQuery } from '@tanstack/react-query';
import { exitsApi } from '@/api/endpoints/exits';
import type { ExitView } from '@/api/types';
import { DetailList } from '@/components/shared/Display';
import { Panel } from '@/components/shared/Panel';
import { formatDate, formatInstantDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { currentExit } from './exitRules';
import { ExitStatusChip, SettlementStatement } from './SettlementStatement';

const STAGE: Record<string, string> = {
  PENDING_APPROVAL: 'Your officials are reviewing your exit settlement.',
  APPROVED: 'Your exit settlement is approved. The treasurer will pay it out.',
  SETTLED: 'Your exit is settled and your accounts are closed.',
};

/** GET /member-exits/mine: the member's own exit in progress or settled, read-only (officials act on it). */
export function MyExitCard() {
  const q = useQuery({ queryKey: ['memberExits', 'mine'], queryFn: exitsApi.mine });
  const exit = q.data ? currentExit(q.data) : null;
  if (!exit) return null;
  return <MyExit e={exit} />;
}

function MyExit({ e }: { e: ExitView }) {
  return (
    <Panel
      title="Leaving the chama"
      description={STAGE[e.status]}
      actions={<ExitStatusChip status={e.status} />}
    >
      <div className="space-y-4">
        <DetailList
          columns={3}
          items={[
            { label: 'Reason', value: e.reason },
            { label: 'Started', value: formatInstantDate(e.requestedAt) },
            e.status === 'PENDING_APPROVAL' ? { label: 'Approvals', value: `${e.approvals.length} of ${e.requiredApprovals}` } : null,
            e.settledOn ? { label: 'Paid out', value: <>{formatDate(e.settledOn)}{e.paymentMethod && ` · ${label(e.paymentMethod)}`}{e.paymentReference && ` ${e.paymentReference}`}</> } : null,
          ]}
        />
        <SettlementStatement settlement={e.settlement} />
      </div>
    </Panel>
  );
}
