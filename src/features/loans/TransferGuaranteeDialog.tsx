'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { loansApi } from '@/api/endpoints/loans';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Label } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { keys } from '@/lib/invalidation';
import { GuarantorPicker } from './GuarantorPicker';

/**
 * Ask another member to take over a guarantee. The new member is emailed and must accept; until then the outgoing guarantor
 * stays liable. Errors (LOAN_GUARANTEE_TRANSFER_NOT_ALLOWED, LOAN_WRONG_STATUS, LOAN_INVALID, LOAN_MEMBER_NOT_FOUND) show the
 * server's message in the dialog.
 */
export function TransferGuaranteeDialog({ open, onOpenChange, loanId, guarantorUserId, guarantorName, borrowerName, exclude, mine }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  loanId: string;
  guarantorUserId: string;
  guarantorName: string;
  borrowerName: ReactNode;
  /** The borrower and current guarantors: they can't take over. */
  exclude: (string | null | undefined)[];
  /** The signed-in user is the guarantor handing over. */
  mine?: boolean;
}) {
  const [newGuarantor, setNewGuarantor] = useState<string | null>(null);
  useEffect(() => { if (open) setNewGuarantor(null); }, [open]);
  const transfer = useApiMutation(
    (userId: string) => loansApi.replaceGuarantor(loanId, guarantorUserId, { newGuarantorUserId: userId }),
    { invalidate: keys('guaranteeTransfer'), toastErrors: false },
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Transfer this guarantee"
      description={
        <>
          Ask another member to take over {mine ? 'your' : `${guarantorName}'s`} guarantee of {borrowerName}&apos;s loan. They are emailed and must accept;
          until then {mine ? 'you stay' : `${guarantorName} stays`} liable.
        </>
      }
      confirmLabel="Ask to take over"
      onConfirm={() => {
        if (!newGuarantor) throw new Error('Choose the member who will take over.');
        return transfer.mutateAsync(newGuarantor);
      }}
    >
      <div className="space-y-1.5">
        <Label>New guarantor<span className="ml-0.5 text-destructive">*</span></Label>
        <GuarantorPicker value={newGuarantor} onChange={setNewGuarantor} exclude={[...exclude, guarantorUserId]} />
      </div>
    </ConfirmDialog>
  );
}
