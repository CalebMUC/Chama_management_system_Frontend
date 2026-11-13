'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IdCard, Pencil } from 'lucide-react';
import { membersApi } from '@/api/endpoints/chama';
import type { KycRequest, MemberKycView, MemberView } from '@/api/types';
import { DetailList } from '@/components/shared/Display';
import { FormDialog } from '@/components/shared/FormDialog';
import { Panel } from '@/components/shared/Panel';
import { LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan } from '@/hooks/useSessionInfo';
import { formatDate, formatInstantDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { KycFields, kycDefaults, kycSchema } from './kyc';

/** A member's KYC details (GET /members/{id}/kyc), editable with MEMBER_INVITE. */
export function KycPanel({ member }: { member: MemberView }) {
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ['members', 'kyc', member.membershipId], queryFn: () => membersApi.kyc(member.membershipId) });
  const kyc = q.data;
  const editable = can('MEMBER_INVITE');

  return (
    <Panel
      title="KYC details"
      actions={editable && !q.isLoading ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{kyc ? <><Pencil />Edit</> : <><IdCard />Add KYC details</>}</Button> : undefined}
    >
      {q.isLoading ? (
        <LoadingState />
      ) : kyc ? (
        <KycDetails kyc={kyc} />
      ) : (
        <p className="text-sm text-muted-foreground">No identification or address recorded for this member yet.</p>
      )}
      <KycDialog open={editing} onOpenChange={setEditing} membershipId={member.membershipId} current={kyc ?? null} />
    </Panel>
  );
}

function KycDetails({ kyc }: { kyc: MemberKycView }) {
  return (
    <div className="space-y-3">
      <DetailList
        columns={4}
        items={[
          { label: label(kyc.idType), value: <span className="ident">{kyc.idNumber}</span> },
          { label: 'Date of birth', value: formatDate(kyc.dateOfBirth) },
          { label: 'Gender', value: label(kyc.gender) },
          { label: 'County', value: kyc.county },
          { label: 'Town', value: kyc.town ?? '—' },
          { label: 'Physical address', value: kyc.physicalAddress ?? '—' },
        ]}
      />
      <p className="text-xs text-muted-foreground">Last updated {formatInstantDate(kyc.updatedAt)}</p>
    </div>
  );
}

function KycDialog({ open, onOpenChange, membershipId, current }: { open: boolean; onOpenChange(o: boolean): void; membershipId: string; current: MemberKycView | null }) {
  const save = useApiMutation((body: KycRequest) => membersApi.updateKyc(membershipId, body), { invalidate: ['members'] });
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={current ? 'Edit KYC details' : 'Add KYC details'}
      description="Copy the details from the member's identity document."
      size="lg"
      schema={kycSchema}
      defaultValues={kycDefaults(current)}
      submitLabel="Save"
      onSubmit={(v) => save.mutateAsync(v)}
    >
      {(form) => <KycFields form={form} prefix="" />}
    </FormDialog>
  );
}
