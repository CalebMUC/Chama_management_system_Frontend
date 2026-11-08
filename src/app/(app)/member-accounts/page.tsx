'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { memberAccountsApi, savingsProductsApi } from '@/api/endpoints/savings';
import type { MemberAccountStatus } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { AccountMobileCard, accountColumns, accountCsv } from '@/features/savings/accountColumns';
import { OpenAccountDialog } from '@/features/savings/OpenAccountDialog';
import { useCurrency } from '@/hooks/useSessionInfo';
import { fractionDigits } from '@/lib/format';

export default function MemberAccountsPage() {
  return (
    <Guard permission="MEMBER_ACCOUNTS_VIEW_ALL" feature="CONTRIBUTIONS">
      <MemberAccounts />
    </Guard>
  );
}

/** README §7.7. Not paged by the API: filtered and paged here. */
function MemberAccounts() {
  const router = useRouter();
  const params = useSearchParams();
  const currency = useCurrency();
  const [member, setMember] = useState<string | null>(params.get('member'));
  const [productId, setProductId] = useState(params.get('product') ?? '');
  const [status, setStatus] = useState<MemberAccountStatus | ''>('ACTIVE');
  const [opening, setOpening] = useState(false);
  const products = useQuery({ queryKey: ['savingsProducts'], queryFn: savingsProductsApi.list });
  const filters = { memberUserId: member ?? undefined, productId: productId || undefined, status: status || undefined };
  const q = useQuery({ queryKey: ['memberAccounts', filters], queryFn: () => memberAccountsApi.list(filters) });
  const total = (q.data ?? []).reduce((s, a) => s + a.balanceMinor, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Member accounts"
        description={q.data && <>{q.data.length} accounts · total <MoneyText value={total} className="font-medium" /></>}
        actions={<Can permission="MEMBER_ACCOUNTS_MANAGE"><Button onClick={() => setOpening(true)}><Plus />Open account</Button></Can>}
      />
      <DataTable
        columns={accountColumns(true)}
        data={q.data}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(a) => a.id}
        onRowClick={(a) => router.push(`/member-accounts/${a.id}`)}
        searchable
        searchPlaceholder="Account number or member"
        pageSize={50}
        emptyTitle="No accounts match"
        csv={{ fileName: 'member-accounts', columns: accountCsv(fractionDigits(currency)) }}
        toolbar={
          <>
            <div className="w-full sm:w-60"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All members" /></div>
            {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>Clear</Button>}
            <NativeSelect value={productId} onChange={(e) => setProductId(e.target.value)} className="w-44" aria-label="Product">
              <option value="">All products</option>
              {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as MemberAccountStatus | '')} className="w-32" aria-label="Status">
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </NativeSelect>
          </>
        }
        mobileCard={(a) => <AccountMobileCard a={a} />}
      />
      <OpenAccountDialog open={opening} onOpenChange={setOpening} memberUserId={member ?? undefined} />
    </div>
  );
}
