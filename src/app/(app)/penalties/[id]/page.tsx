'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Ban, HandCoins } from 'lucide-react';
import { penaltiesApi } from '@/api/endpoints/penalties';
import { Guard } from '@/components/shared/Can';
import { DetailList, EntryLink, MoneyText, PageHeader, Section, StatusChip } from '@/components/shared/Display';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, formatMoney, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function PenaltyDetailPage() {
  return (
    <Guard permission="PENALTY_VIEW_ALL" feature="PENALTIES">
      <PenaltyDetail />
    </Guard>
  );
}

function PenaltyDetail() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const [paying, setPaying] = useState(false);
  const [waiving, setWaiving] = useState(false);
  const q = useQuery({ queryKey: ['penalties', 'detail', id], queryFn: () => penaltiesApi.get(id) });
  const pay = useApiMutation((body: Parameters<typeof penaltiesApi.pay>[1]) => penaltiesApi.pay(id, body), { invalidate: keys('penalty'), toastErrors: false });
  const waive = useApiMutation((reason: string) => penaltiesApi.waive(id, reason), { invalidate: keys('penalty'), toastErrors: false });

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const { penalty: p, payments } = q.data;
  const own = p.memberUserId === me;
  const open = p.status === 'OUTSTANDING';
  const ownHint = 'This is your own penalty; another official must handle it.';

  const payButton = <Button onClick={() => setPaying(true)} disabled={own}><HandCoins />Record payment</Button>;
  const waiveButton = <Button variant="outline" onClick={() => setWaiving(true)} disabled={own}><Ban />Waive</Button>;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/penalties', label: 'Penalties' }}
        title={<span className="flex flex-wrap items-center gap-2">{label(p.kind)} · {memberLabel(p.memberName, p.memberNumber)}<StatusChip status={p.status} /></span>}
        actions={open && (
          <>
            {can('PENALTY_RECORD') && (own ? <Tooltip content={ownHint}><span>{payButton}</span></Tooltip> : payButton)}
            {can('PENALTY_WAIVE') && (own ? <Tooltip content={ownHint}><span>{waiveButton}</span></Tooltip> : waiveButton)}
          </>
        )}
      />
      <Card>
        <CardContent className="p-4 sm:p-6">
          <DetailList
            columns={4}
            items={[
              { label: 'Amount', value: <MoneyText value={p.amountMinor} currency={p.currency} /> },
              { label: 'Paid', value: <MoneyText value={p.paidMinor} currency={p.currency} /> },
              { label: 'Waived', value: <MoneyText value={p.waivedMinor} currency={p.currency} /> },
              { label: 'Outstanding', value: <MoneyText value={p.outstandingMinor} currency={p.currency} className={p.outstandingMinor > 0 ? 'font-semibold text-destructive' : 'font-semibold'} /> },
              { label: 'Assessed', value: `${formatDate(p.assessedOn)} · ${p.assessedBy ? directory.nameOf(p.assessedBy) : 'automatically'}` },
              { label: 'Description', value: p.description },
              p.waivedAt ? { label: 'Waived', value: `${formatInstant(p.waivedAt)} by ${directory.nameOf(p.waivedBy)}` } : null,
              p.waiverReason ? { label: 'Waiver reason', value: p.waiverReason } : null,
            ]}
          />
        </CardContent>
      </Card>
      <Section title="Payments">
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Paid on</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Recorded by</TableHead>
                  <TableHead>Entry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{formatDate(x.paidOn)}</TableCell>
                    <TableCell className="text-right"><MoneyText value={x.amountMinor} currency={p.currency} /></TableCell>
                    <TableCell>{label(x.method)}{x.reference && <span className="ml-1 font-mono text-xs text-muted-foreground">{x.reference}</span>}</TableCell>
                    <TableCell>{directory.nameOf(x.recordedBy)}</TableCell>
                    <TableCell><EntryLink id={x.ledgerEntryId} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
      <PaymentDialog
        open={paying}
        onOpenChange={setPaying}
        title="Record a penalty payment"
        description={memberLabel(p.memberName, p.memberNumber)}
        amount={{ max: p.outstandingMinor, hint: `Outstanding ${formatMoney(p.outstandingMinor, p.currency)}`, defaultMinor: p.outstandingMinor }}
        dateField="paidOn"
        dateLabel="Date paid"
        submitLabel="Record payment"
        onSubmit={(v) => pay.mutateAsync({ amountMinor: v.amountMinor!, method: v.method, reference: v.reference, paidOn: v.date })}
      />
      <ReasonDialog
        open={waiving}
        onOpenChange={setWaiving}
        title="Waive this penalty?"
        description={<>This waives <MoneyText value={p.outstandingMinor} currency={p.currency} /> still outstanding for {memberLabel(p.memberName, p.memberNumber)}.</>}
        confirmLabel="Waive"
        onConfirm={(reason) => waive.mutateAsync(reason)}
      />
    </div>
  );
}
