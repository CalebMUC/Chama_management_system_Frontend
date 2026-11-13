'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { loansApi } from '@/api/endpoints/loans';
import { normaliseError } from '@/api/errors';
import type { LoanStatus } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { LoanMobileCard, loanColumns, loanCsv } from '@/features/loans/loanColumns';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { fractionDigits } from '@/lib/format';
import { label } from '@/lib/labels';

const TABS: (LoanStatus | 'ALL')[] = ['PENDING_GUARANTORS', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REPAID', 'REJECTED', 'CANCELLED', 'ALL'];
const TAB_LABEL: Partial<Record<LoanStatus | 'ALL', string>> = { PENDING_GUARANTORS: 'Pending guarantors', PENDING_APPROVAL: 'Pending approval', APPROVED: 'Approved (to disburse)', ALL: 'All' };

export default function LoansPage() {
  return (
    <Guard permission="LOAN_VIEW_ALL" feature="LOANS">
      <LoanBook />
    </Guard>
  );
}

/** README §7.9: the loan book. */
function LoanBook() {
  const router = useRouter();
  const params = useSearchParams();
  const currency = useCurrency();
  const status = (params.get('status') as LoanStatus | 'ALL' | null) ?? 'ACTIVE';
  const [member, setMember] = useState<string | null>(params.get('member'));
  const list = usePaged(['loans', 'list'], { status: status === 'ALL' ? undefined : status, memberUserId: member ?? undefined }, loansApi.list);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Loans"
        description="Every loan application and loan in the chama."
        actions={<SchedulesButton />}
      />
      <Tabs value={status} onValueChange={(v) => router.replace(v === 'ACTIVE' ? '/loans' : `/loans?status=${v}`)}>
        <TabsList className="h-auto flex-wrap">{TABS.map((t) => <TabsTrigger key={t} value={t}>{TAB_LABEL[t] ?? label(t)}</TabsTrigger>)}</TabsList>
      </Tabs>
      <DataTable
        columns={loanColumns(true)}
        getRowId={(l) => l.id}
        onRowClick={(l) => router.push(`/loans/${l.id}`)}
        emptyTitle="No loans here"
        csv={{ fileName: `loans-${status.toLowerCase()}`, columns: loanCsv(fractionDigits(currency)) }}
        toolbar={
          <>
            <div className="w-full sm:w-64"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All borrowers" /></div>
            {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>Clear</Button>}
          </>
        }
        rowClassName={(l) => (l.arrearsMinor > 0 ? 'bg-destructive/5' : undefined)}
        mobileCard={(l) => <LoanMobileCard l={l} />}
        {...list.table}
      />
    </div>
  );
}

/** Every loan being repaid, with its schedule: what each borrower owes, what is overdue and the next instalment. */
function SchedulesButton() {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      await loansApi.schedules();
    } catch (e) {
      toast.error(normaliseError(e).message);
    } finally {
      setBusy(false);
    }
  }
  return <Button variant="outline" onClick={download} loading={busy}><Download />Loan schedules</Button>;
}
