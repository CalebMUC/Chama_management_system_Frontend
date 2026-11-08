'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Landmark, MailCheck, MailWarning, Plus } from 'lucide-react';
import { reportsApi } from '@/api/endpoints/books';
import { loansApi } from '@/api/endpoints/loans';
import { penaltiesApi } from '@/api/endpoints/penalties';
import { contributionsApi, memberAccountsApi } from '@/api/endpoints/savings';
import { Guard } from '@/components/shared/Can';
import { DataTable } from '@/components/shared/DataTable';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { DetailList, PageHeader, StatusChip } from '@/components/shared/Display';
import { LoadingState, NotFoundState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { Badge, Card, CardContent } from '@/components/ui/primitives';
import { StandingSummary } from '@/features/contributions/StandingSummary';
import { paymentColumns } from '@/features/contributions/paymentColumns';
import { LoanMobileCard, loanColumns } from '@/features/loans/loanColumns';
import { MemberActions } from '@/features/members/MemberActions';
import { FineDialog } from '@/features/penalties/FineDialog';
import { PenaltyCard, penaltyColumns } from '@/features/penalties/penaltyColumns';
import { MemberStatementBody } from '@/features/reports/MemberStatementBody';
import { AccountMobileCard, accountColumns } from '@/features/savings/accountColumns';
import { OpenAccountDialog } from '@/features/savings/OpenAccountDialog';
import { memberName, useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useHasFeature, useMyUserId } from '@/hooks/useSessionInfo';
import { usePaged } from '@/hooks/usePaged';
import { formatInstantDate, startOfYearNairobi, todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';

export default function MemberDetailPage() {
  return (
    <Guard permission="MEMBER_VIEW">
      <MemberDetail />
    </Guard>
  );
}

/** README §7.5. No single-member endpoint: the member comes from the cached directory. */
function MemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const directory = useMemberDirectory();
  const can = useCan();
  const has = useHasFeature();
  const me = useMyUserId();
  const [fining, setFining] = useState(false);
  const [opening, setOpening] = useState(false);
  const m = directory.byUserId.get(userId);

  if (directory.isLoading) return <LoadingState />;
  if (!m) return <NotFoundState title="Member not found" action={<Button variant="outline" asChild><Link href="/members">All members</Link></Button>} />;

  const tabs = [
    can('MEMBER_ACCOUNTS_VIEW_ALL') && has('CONTRIBUTIONS') && { value: 'accounts', label: 'Accounts' },
    can('CONTRIBUTION_VIEW_ALL') && has('CONTRIBUTIONS') && { value: 'contributions', label: 'Contributions' },
    can('LOAN_VIEW_ALL') && has('LOANS') && { value: 'loans', label: 'Loans' },
    can('PENALTY_VIEW_ALL') && has('PENALTIES') && { value: 'penalties', label: 'Penalties' },
    can('REPORT_VIEW_ALL') && has('REPORTS') && { value: 'statement', label: 'Statement' },
  ].filter(Boolean) as { value: string; label: string }[];
  const seated = m.status === 'ACTIVE' || m.status === 'SUSPENDED';
  const self = m.userId === me;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/members', label: 'Members' }}
        title={<span className="flex flex-wrap items-center gap-2">{m.memberNumber && <span className="text-muted-foreground">#{m.memberNumber}</span>}{memberName(m)}<StatusChip status={m.status} /></span>}
        actions={
          <>
            {seated && !self && can('CONTRIBUTION_RECORD') && has('CONTRIBUTIONS') && (
              <Button size="sm" onClick={() => router.push(`/contributions/new?member=${m.userId}`)}><Plus />Record contribution</Button>
            )}
            {seated && !self && can('PENALTY_RECORD') && has('PENALTIES') && <Button size="sm" variant="outline" onClick={() => setFining(true)}><Gavel />Fine</Button>}
            {m.status === 'ACTIVE' && can('MEMBER_ACCOUNTS_MANAGE') && has('CONTRIBUTIONS') && <Button size="sm" variant="outline" onClick={() => setOpening(true)}><Landmark />Open account</Button>}
          </>
        }
      />
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <DetailList
            columns={4}
            items={[
              { label: 'Email', value: <span className="flex items-center gap-1.5">{m.emailVerified ? <MailCheck className="size-4 text-success" aria-label="Verified" /> : <MailWarning className="size-4 text-warning" aria-label="Not verified" />}{m.email}</span> },
              { label: 'Phone', value: m.phoneNumber },
              { label: 'Roles', value: <span className="flex flex-wrap gap-1">{m.roles.map((r) => <Badge key={r} variant="outline">{label(r)}</Badge>)}</span> },
              { label: m.joinedAt ? 'Joined' : 'Applied', value: formatInstantDate(m.joinedAt ?? m.appliedAt) },
              m.suspensionReason ? { label: 'Suspension reason', value: m.suspensionReason } : null,
            ]}
          />
          <MemberActions member={m} inline />
        </CardContent>
      </Card>

      {tabs.length > 0 && (
        <Tabs defaultValue={tabs[0].value}>
          <TabsList className="h-auto flex-wrap">{tabs.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}</TabsList>
          <TabsContent value="accounts"><AccountsTab userId={userId} /></TabsContent>
          <TabsContent value="contributions"><ContributionsTab userId={userId} /></TabsContent>
          <TabsContent value="loans"><LoansTab userId={userId} /></TabsContent>
          <TabsContent value="penalties"><PenaltiesTab userId={userId} /></TabsContent>
          <TabsContent value="statement"><StatementTab userId={userId} /></TabsContent>
        </Tabs>
      )}
      <FineDialog open={fining} onOpenChange={setFining} memberUserId={m.userId} />
      <OpenAccountDialog open={opening} onOpenChange={setOpening} memberUserId={m.userId} />
    </div>
  );
}

function AccountsTab({ userId }: { userId: string }) {
  const router = useRouter();
  const q = useQuery({ queryKey: ['memberAccounts', { memberUserId: userId }], queryFn: () => memberAccountsApi.list({ memberUserId: userId }) });
  return (
    <DataTable
      columns={accountColumns(false)}
      data={q.data}
      isLoading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      getRowId={(a) => a.id}
      onRowClick={(a) => router.push(`/member-accounts/${a.id}`)}
      emptyTitle="No accounts"
      mobileCard={(a) => <AccountMobileCard a={a} />}
    />
  );
}

function ContributionsTab({ userId }: { userId: string }) {
  const standings = useQuery({ queryKey: ['contributions', 'standings', false], queryFn: () => contributionsApi.standings(false) });
  const standing = standings.data?.find((s) => s.memberUserId === userId);
  const payments = usePaged(['contributions', 'list'], { memberUserId: userId }, contributionsApi.list);
  return (
    <div className="space-y-4">
      {standing && <StandingSummary standing={standing} />}
      <DataTable columns={paymentColumns(false)} getRowId={(p) => p.id} emptyTitle="No payments" {...payments.table} />
    </div>
  );
}

function LoansTab({ userId }: { userId: string }) {
  const router = useRouter();
  const loans = usePaged(['loans', 'list'], { memberUserId: userId }, loansApi.list);
  return (
    <DataTable
      columns={loanColumns(false)}
      getRowId={(l) => l.id}
      onRowClick={(l) => router.push(`/loans/${l.id}`)}
      emptyTitle="No loans"
      mobileCard={(l) => <LoanMobileCard l={l} />}
      {...loans.table}
    />
  );
}

function PenaltiesTab({ userId }: { userId: string }) {
  const router = useRouter();
  const penalties = usePaged(['penalties', 'list'], { memberUserId: userId }, penaltiesApi.list);
  return (
    <DataTable
      columns={penaltyColumns(false)}
      getRowId={(p) => p.id}
      onRowClick={(p) => router.push(`/penalties/${p.id}`)}
      emptyTitle="No penalties"
      mobileCard={(p) => <PenaltyCard p={p} />}
      {...penalties.table}
    />
  );
}

function StatementTab({ userId }: { userId: string }) {
  const [range, setRange] = useState<DateRangeValue>({ from: startOfYearNairobi(), to: todayNairobi() });
  const q = useQuery({ queryKey: ['reports', 'memberStatement', userId, range], queryFn: () => reportsApi.memberStatement(userId, range) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={setRange} />
        <Button variant="outline" size="sm" asChild><Link href={`/reports/member-statement?member=${userId}`}>Open as report</Link></Button>
      </div>
      {q.isLoading ? <LoadingState /> : q.data ? <MemberStatementBody s={q.data} /> : null}
    </div>
  );
}
