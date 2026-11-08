'use client';

import { useParams } from 'next/navigation';
import { memberAccountsApi } from '@/api/endpoints/savings';
import { Guard } from '@/components/shared/Can';
import { AccountStatement } from '@/features/savings/AccountStatement';

export default function MyAccountStatementPage() {
  const { accountId } = useParams<{ accountId: string }>();
  return (
    <Guard feature="CONTRIBUTIONS">
      <AccountStatement
        queryKey={['memberAccounts', 'me', accountId, 'statement']}
        load={(range) => memberAccountsApi.myStatement(accountId, range)}
        back={{ href: '/me/savings', label: 'My savings' }}
      />
    </Guard>
  );
}
