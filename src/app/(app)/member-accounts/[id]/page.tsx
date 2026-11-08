'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, RotateCcw } from 'lucide-react';
import { memberAccountsApi } from '@/api/endpoints/savings';
import type { MemberAccountView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MoneyText } from '@/components/shared/Display';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { AccountStatement } from '@/features/savings/AccountStatement';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan } from '@/hooks/useSessionInfo';
import { memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';

export default function MemberAccountPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Guard permission="MEMBER_ACCOUNTS_VIEW_ALL" feature="CONTRIBUTIONS">
      <AccountStatement
        queryKey={['memberAccounts', id, 'statement']}
        load={(range) => memberAccountsApi.statement(id, range)}
        back={{ href: '/member-accounts', label: 'Member accounts' }}
        showMember
        actions={(s) => <AccountActions account={s.account} />}
      />
    </Guard>
  );
}

/** README §7.7: close (zero balance only, with a reason) or reopen. */
function AccountActions({ account }: { account: MemberAccountView }) {
  const can = useCan();
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const close = useApiMutation((reason: string) => memberAccountsApi.close(account.id, reason), { invalidate: keys('memberAccount'), toastErrors: false });
  const reopen = useApiMutation(() => memberAccountsApi.reopen(account.id), { invalidate: keys('memberAccount'), toastErrors: false });
  if (!can('MEMBER_ACCOUNTS_MANAGE')) return null;
  const name = memberLabel(account.memberName, account.memberNumber);
  return (
    <>
      {account.status === 'ACTIVE' && (account.balanceMinor === 0 ? (
        <Button variant="outline" size="sm" onClick={() => setClosing(true)}><Lock />Close</Button>
      ) : (
        <Tooltip content={<>Only an empty account can be closed. Balance: <MoneyText value={account.balanceMinor} currency={account.currency} /></>}>
          <span><Button variant="outline" size="sm" disabled><Lock />Close</Button></span>
        </Tooltip>
      ))}
      {account.status === 'CLOSED' && <Button variant="outline" size="sm" onClick={() => setReopening(true)}><RotateCcw />Reopen</Button>}
      <ReasonDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${account.accountNumber}?`}
        description={`${name}'s ${account.productName} account stops taking payments. You can reopen it later.`}
        confirmLabel="Close account"
        onConfirm={(reason) => close.mutateAsync(reason)}
      />
      <ConfirmDialog
        open={reopening}
        onOpenChange={setReopening}
        title={`Reopen ${account.accountNumber}?`}
        description={`${name}'s ${account.productName} account takes payments again.`}
        confirmLabel="Reopen"
        onConfirm={() => reopen.mutateAsync(undefined)}
      />
    </>
  );
}
