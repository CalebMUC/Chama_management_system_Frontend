'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Plus, Power, Users } from 'lucide-react';
import { ledgerApi } from '@/api/endpoints/books';
import type { LedgerAccountView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { Badge, Input, NativeSelect, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan } from '@/hooks/useSessionInfo';
import { downloadCsv, csvMoney } from '@/lib/csv';
import { fractionDigits } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { ACCOUNT_TYPES } from '@/lib/labels';
import { requiredText } from '@/lib/schemas';

export default function ChartOfAccountsPage() {
  return (
    <Guard permission="LEDGER_VIEW">
      <ChartOfAccounts />
    </Guard>
  );
}

/** README §7.12. */
function ChartOfAccounts() {
  const router = useRouter();
  const manage = useCan()('LEDGER_ACCOUNTS_MANAGE');
  const q = useQuery({ queryKey: ['ledger', 'accounts'], queryFn: ledgerApi.accounts });
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<LedgerAccountView | null>(null);
  const toggle = useApiMutation((a: LedgerAccountView) => ledgerApi.setAccountActive(a.id, !a.active), { invalidate: keys('ledger'), toastErrors: false });

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const accounts = [...q.data].sort((a, b) => a.code.localeCompare(b.code));
  const currency = accounts[0]?.currency ?? 'KES';

  function exportCsv() {
    const digits = fractionDigits(currency);
    downloadCsv('chart-of-accounts', accounts, [
      { header: 'Code', value: (a) => a.code },
      { header: 'Name', value: (a) => a.name },
      { header: 'Type', value: (a) => a.type },
      { header: 'Member ledger', value: (a) => (a.memberLedger ? 'yes' : 'no') },
      { header: 'Active', value: (a) => (a.active ? 'yes' : 'no') },
      { header: 'Balance', value: (a) => csvMoney(a.balanceMinor, digits) },
    ]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of accounts"
        description="Balances are on each account's normal side: positive assets are held, positive liabilities are owed."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv}>CSV</Button>
            <Can permission="LEDGER_ACCOUNTS_MANAGE"><Button onClick={() => setAdding(true)}><Plus />Add account</Button></Can>
          </>
        }
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              {manage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ACCOUNT_TYPES.map((g) => {
              const rows = accounts.filter((a) => a.type === g.type);
              if (!rows.length) return null;
              const total = rows.reduce((s, a) => s + a.balanceMinor, 0);
              return (
                <Fragment key={g.type}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={3} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</TableCell>
                    <TableCell className="py-1.5 text-right text-xs font-semibold"><MoneyText value={total} currency={currency} /></TableCell>
                    {manage && <TableCell />}
                  </TableRow>
                  {rows.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(`/ledger/accounts/${a.id}`)}>
                      <TableCell className="font-mono">{a.code}</TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {a.name}
                          {a.memberLedger && <Tooltip content="Kept per member"><Badge variant="outline"><Users className="size-3" />Member ledger</Badge></Tooltip>}
                          {a.systemKey && <Badge variant="secondary">System</Badge>}
                        </span>
                      </TableCell>
                      <TableCell><StatusChip status={a.active ? 'ACTIVE' : 'CLOSED'} text={a.active ? 'Active' : 'Inactive'} /></TableCell>
                      <TableCell className="text-right"><MoneyText value={a.balanceMinor} currency={a.currency} /></TableCell>
                      {manage && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!a.systemKey && (
                            <Tooltip content={a.active ? 'Deactivate' : 'Activate'}>
                              <Button variant="ghost" size="icon-sm" onClick={() => setToggling(a)} aria-label={`${a.active ? 'Deactivate' : 'Activate'} ${a.name}`}><Power /></Button>
                            </Tooltip>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AddAccountDialog open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={`${toggling?.active ? 'Deactivate' : 'Activate'} ${toggling?.code} ${toggling?.name}?`}
        description={toggling?.active ? 'No new entries can be posted to it. Its history stays.' : 'It can be used in entries again.'}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        destructive={toggling?.active}
        onConfirm={() => toggling && toggle.mutateAsync(toggling)}
      />
    </div>
  );
}

const schema = z.object({
  code: requiredText(10).regex(/^[0-9A-Za-z-]+$/, 'Letters, digits or -'),
  name: requiredText(100),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
});

function AddAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const create = useApiMutation((v: z.output<typeof schema>) => ledgerApi.createAccount(v), { invalidate: keys('ledger'), toastErrors: false });
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add a ledger account" schema={schema} defaultValues={{ code: '', name: '', type: 'EXPENSE' }} submitLabel="Add account" onSubmit={(v) => create.mutateAsync(v)}>
      {(form) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Code" required error={form.formState.errors.code} hint="e.g. 5100"><Input {...form.register('code')} maxLength={10} /></Field>
            <Field label="Name" required error={form.formState.errors.name}><Input {...form.register('name')} maxLength={100} /></Field>
          </div>
          <Field label="Type" required error={form.formState.errors.type}>
            <NativeSelect {...form.register('type')}>{ACCOUNT_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</NativeSelect>
          </Field>
        </>
      )}
    </FormDialog>
  );
}
