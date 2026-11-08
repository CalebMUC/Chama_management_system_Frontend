'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Pencil, Plus, Power } from 'lucide-react';
import { loanProductsApi } from '@/api/endpoints/loans';
import type { LoanProductView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { Badge, Input } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan, useCurrency } from '@/hooks/useSessionInfo';
import { bpToPercentInput, formatBp, minorToInput } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { intSchema, moneySchema, percentSchema, requiredText } from '@/lib/schemas';

export default function LoanProductsPage() {
  return (
    <Guard feature="LOANS">
      <LoanProducts />
    </Guard>
  );
}

/** README §7.9. The default product mirrors the chama's loan settings: only its name is editable here. */
function LoanProducts() {
  const can = useCan();
  const q = useQuery({ queryKey: ['loanProducts'], queryFn: loanProductsApi.list });
  const [editing, setEditing] = useState<LoanProductView | 'new' | null>(null);
  const [toggling, setToggling] = useState<LoanProductView | null>(null);
  const toggle = useApiMutation((p: LoanProductView) => (p.active ? loanProductsApi.deactivate(p.id) : loanProductsApi.activate(p.id)), { invalidate: keys('loanProduct'), toastErrors: false });

  const columns: ColumnDef<LoanProductView, unknown>[] = [
    {
      id: 'name',
      header: 'Product',
      accessorKey: 'name',
      cell: ({ row }) => <span><span className="font-medium">{row.original.name}</span> {row.original.defaultProduct && <Badge variant="outline">Default</Badge>}<span className="block text-xs text-muted-foreground">{row.original.code}</span></span>,
    },
    { id: 'interest', header: 'Interest', accessorKey: 'interestBasisPoints', cell: ({ row }) => `${formatBp(row.original.interestBasisPoints)} flat` },
    { id: 'term', header: 'Longest term', accessorKey: 'maxTermMonths', cell: ({ row }) => `${row.original.maxTermMonths} months` },
    { id: 'multiplier', header: 'Limit', accessorKey: 'maxMultiplier', cell: ({ row }) => `${row.original.maxMultiplier}× savings` },
    { id: 'minMembership', header: 'Min. membership', accessorKey: 'minMembershipMonths', cell: ({ row }) => `${row.original.minMembershipMonths} months` },
    {
      id: 'guarantors',
      header: 'Guarantors',
      accessorKey: 'guarantorsRequired',
      cell: ({ row }) => (row.original.guarantorsRequired === 0 ? 'None' : <>{row.original.guarantorsRequired} above <MoneyText value={row.original.guarantorThresholdMinor} currency={row.original.currency} /></>),
    },
    { id: 'status', header: 'Status', accessorKey: 'active', cell: ({ row }) => <StatusChip status={row.original.active ? 'ACTIVE' : 'CLOSED'} text={row.original.active ? 'Active' : 'Inactive'} /> },
  ];
  if (can('PRODUCTS_MANAGE')) {
    columns.push({
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}><Pencil /></Button>
          {!row.original.defaultProduct && (
            <Tooltip content={row.original.active ? 'Deactivate' : 'Activate'}>
              <Button variant="ghost" size="icon-sm" onClick={() => setToggling(row.original)} aria-label={row.original.active ? 'Deactivate' : 'Activate'}><Power /></Button>
            </Tooltip>
          )}
        </span>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Loan products"
        description="The kinds of loans members can apply for."
        actions={<Can permission="PRODUCTS_MANAGE"><Button onClick={() => setEditing('new')}><Plus />New product</Button></Can>}
      />
      <DataTable columns={columns} data={q.data} isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} getRowId={(p) => p.id} emptyTitle="No loan products" />
      <LoanProductDialog product={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.active ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={toggling?.active ? 'Members can no longer apply for it. Existing loans continue.' : 'Members can apply for it again.'}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        destructive={toggling?.active}
        onConfirm={() => toggling && toggle.mutateAsync(toggling)}
      />
    </div>
  );
}

function LoanProductDialog({ product, onClose }: { product: LoanProductView | 'new' | null; onClose(): void }) {
  const currency = useCurrency();
  const existing = product && product !== 'new' ? product : null;
  const locked = !!existing?.defaultProduct;
  const schema = z.object({
    code: existing ? z.string().optional() : requiredText(10).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - or _'),
    name: requiredText(60),
    interest: percentSchema(0, 100),
    maxTermMonths: intSchema(1, 36),
    maxMultiplier: intSchema(1, 10),
    minMembershipMonths: intSchema(0, 60),
    guarantorThreshold: moneySchema(currency, { allowZero: true }),
    guarantorsRequired: intSchema(0, 5),
  });
  const save = useApiMutation((v: z.output<typeof schema>) => {
    const body = {
      name: v.name,
      interestBasisPoints: v.interest,
      maxTermMonths: v.maxTermMonths,
      maxMultiplier: v.maxMultiplier,
      minMembershipMonths: v.minMembershipMonths,
      guarantorThresholdMinor: v.guarantorThreshold,
      guarantorsRequired: v.guarantorsRequired,
    };
    return existing ? loanProductsApi.update(existing.id, body) : loanProductsApi.create({ ...body, code: v.code!.trim().toUpperCase() });
  }, { invalidate: keys('loanProduct'), toastErrors: false });

  const defaults = existing
    ? {
        code: existing.code,
        name: existing.name,
        interest: bpToPercentInput(existing.interestBasisPoints),
        maxTermMonths: existing.maxTermMonths,
        maxMultiplier: existing.maxMultiplier,
        minMembershipMonths: existing.minMembershipMonths,
        guarantorThreshold: minorToInput(existing.guarantorThresholdMinor, currency),
        guarantorsRequired: existing.guarantorsRequired,
      }
    : { code: '', name: '', interest: '10', maxTermMonths: 12, maxMultiplier: 3, minMembershipMonths: 3, guarantorThreshold: '0', guarantorsRequired: 0 };

  const hint = locked ? 'Set in chama settings' : undefined;
  return (
    <FormDialog
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit ${existing.name}` : 'New loan product'}
      description={locked ? 'This is the default product: its terms follow the chama settings.' : 'Changes apply to new applications.'}
      schema={schema}
      defaultValues={defaults}
      submitLabel={existing ? 'Save' : 'Create product'}
      size="lg"
      onSubmit={(v) => save.mutateAsync(v)}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required={!existing} error={e.code}><Input {...form.register('code')} disabled={!!existing} maxLength={10} className="uppercase" /></Field>
            <Field label="Name" required error={e.name}><Input {...form.register('name')} maxLength={60} /></Field>
            <Field label="Interest (% flat for the term)" required error={e.interest} hint={hint}><Input inputMode="decimal" {...form.register('interest')} disabled={locked} /></Field>
            <Field label="Longest term (months)" required error={e.maxTermMonths} hint={hint ?? '1–36'}><Input type="number" {...form.register('maxTermMonths')} disabled={locked} /></Field>
            <Field label="Limit (× savings)" required error={e.maxMultiplier} hint={hint ?? '1–10'}><Input type="number" {...form.register('maxMultiplier')} disabled={locked} /></Field>
            <Field label="Minimum membership (months)" required error={e.minMembershipMonths} hint={hint ?? '0–60'}><Input type="number" {...form.register('minMembershipMonths')} disabled={locked} /></Field>
            <Field label="Guarantors needed above" required error={e.guarantorThreshold} hint={hint}><MoneyInput {...form.register('guarantorThreshold')} disabled={locked} /></Field>
            <Field label="Guarantors required" required error={e.guarantorsRequired} hint={hint ?? '0–5'}><Input type="number" {...form.register('guarantorsRequired')} disabled={locked} /></Field>
          </div>
        );
      }}
    </FormDialog>
  );
}
