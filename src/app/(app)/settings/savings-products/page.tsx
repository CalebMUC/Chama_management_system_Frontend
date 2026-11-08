'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { Pencil, Plus, Power } from 'lucide-react';
import { savingsProductsApi } from '@/api/endpoints/savings';
import type { SavingsProductKind, SavingsProductView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { Button } from '@/components/ui/button';
import { Checkbox, Tooltip } from '@/components/ui/overlays';
import { Badge, Input, Label, NativeSelect } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan, useCurrency } from '@/hooks/useSessionInfo';
import { minorToInput } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';
import { intSchema, moneySchema, requiredText } from '@/lib/schemas';

const KINDS: SavingsProductKind[] = ['DEPOSITS', 'SHARE_CAPITAL', 'WELFARE', 'CUSTOM'];
const KIND_FLAGS: Record<SavingsProductKind, { countsTowardLoanLimit: boolean; refundableOnExit: boolean; earnsDividend: boolean }> = {
  DEPOSITS: { countsTowardLoanLimit: true, refundableOnExit: true, earnsDividend: true },
  SHARE_CAPITAL: { countsTowardLoanLimit: false, refundableOnExit: false, earnsDividend: true },
  WELFARE: { countsTowardLoanLimit: false, refundableOnExit: false, earnsDividend: false },
  CUSTOM: { countsTowardLoanLimit: false, refundableOnExit: true, earnsDividend: false },
};
const FLAG_LABELS = { countsTowardLoanLimit: 'Backs loans', refundableOnExit: 'Refundable on exit', earnsDividend: 'Earns dividend' } as const;

export default function SavingsProductsPage() {
  return (
    <Guard feature="CONTRIBUTIONS">
      <SavingsProducts />
    </Guard>
  );
}

/** README §7.7. Everyone can see the products; PRODUCTS_MANAGE edits them. */
function SavingsProducts() {
  const can = useCan();
  const q = useQuery({ queryKey: ['savingsProducts'], queryFn: savingsProductsApi.list });
  const [editing, setEditing] = useState<SavingsProductView | 'new' | null>(null);
  const [toggling, setToggling] = useState<SavingsProductView | null>(null);
  const toggle = useApiMutation((p: SavingsProductView) => (p.active ? savingsProductsApi.deactivate(p.id) : savingsProductsApi.activate(p.id)), { invalidate: keys('savingsProduct'), toastErrors: false });

  const columns: ColumnDef<SavingsProductView, unknown>[] = [
    {
      id: 'name',
      header: 'Product',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span>
          <span className="font-medium">{row.original.name}</span> {row.original.defaultProduct && <Badge variant="outline">Default</Badge>}
          <span className="block text-xs text-muted-foreground">{row.original.code} · {label(row.original.kind)} · ledger {row.original.ledgerAccountCode}</span>
        </span>
      ),
    },
    { id: 'contribution', header: 'Per period', accessorKey: 'contributionMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.contributionMinor} currency={row.original.currency} /> },
    { id: 'priority', header: 'Priority', accessorKey: 'allocationPriority', meta: { align: 'right' } },
    {
      id: 'flags',
      header: 'Rules',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex flex-wrap gap-1">
          {row.original.mandatory && <Badge>Mandatory</Badge>}
          {(Object.keys(FLAG_LABELS) as (keyof typeof FLAG_LABELS)[]).filter((k) => row.original[k]).map((k) => <Badge key={k} variant="outline">{FLAG_LABELS[k]}</Badge>)}
        </span>
      ),
    },
    { id: 'members', header: 'Members', accessorKey: 'members', meta: { align: 'right' } },
    { id: 'balance', header: 'Total balance', accessorKey: 'balanceMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.balanceMinor} currency={row.original.currency} /> },
    { id: 'status', header: 'Status', accessorFn: (p) => (p.active ? 'ACTIVE' : 'CLOSED'), cell: ({ row }) => <StatusChip status={row.original.active ? 'ACTIVE' : 'CLOSED'} text={row.original.active ? 'Active' : 'Inactive'} /> },
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
        title="Savings products"
        description="What members save into each period. Payments clear products with a lower priority number first."
        actions={<Can permission="PRODUCTS_MANAGE"><Button onClick={() => setEditing('new')}><Plus />New product</Button></Can>}
      />
      <DataTable columns={columns} data={q.data} isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} getRowId={(p) => p.id} emptyTitle="No savings products" />
      <ProductDialog product={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(o) => !o && setToggling(null)}
        title={toggling?.active ? `Deactivate ${toggling?.name}?` : `Activate ${toggling?.name}?`}
        description={toggling?.active ? 'No new dues are charged and no new accounts open in it. Existing balances stay.' : 'It starts charging dues from the next period if it is mandatory.'}
        confirmLabel={toggling?.active ? 'Deactivate' : 'Activate'}
        destructive={toggling?.active}
        onConfirm={() => toggling && toggle.mutateAsync(toggling)}
      />
    </div>
  );
}

function ProductDialog({ product, onClose }: { product: SavingsProductView | 'new' | null; onClose(): void }) {
  const currency = useCurrency();
  const isNew = product === 'new';
  const existing = product && product !== 'new' ? product : null;
  const schema = z.object({
    code: isNew ? requiredText(10).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - or _') : z.string().optional(),
    name: requiredText(60),
    kind: z.enum(['DEPOSITS', 'SHARE_CAPITAL', 'WELFARE', 'CUSTOM']),
    ledgerAccountCode: z.string().trim().max(10).optional(),
    contribution: moneySchema(currency, { allowZero: true }),
    allocationPriority: intSchema(1, 99),
    mandatory: z.boolean(),
    countsTowardLoanLimit: z.boolean(),
    refundableOnExit: z.boolean(),
    earnsDividend: z.boolean(),
  });
  const save = useApiMutation((v: z.output<typeof schema>) => {
    const flags = { countsTowardLoanLimit: v.countsTowardLoanLimit, refundableOnExit: v.refundableOnExit, earnsDividend: v.earnsDividend };
    if (existing) return savingsProductsApi.update(existing.id, { name: v.name, contributionMinor: v.contribution, allocationPriority: v.allocationPriority, mandatory: v.mandatory, ...flags });
    return savingsProductsApi.create({ code: v.code!.trim().toUpperCase(), name: v.name, kind: v.kind, ledgerAccountCode: v.ledgerAccountCode || undefined, contributionMinor: v.contribution, allocationPriority: v.allocationPriority, mandatory: v.mandatory, ...flags });
  }, { invalidate: keys('savingsProduct'), toastErrors: false });

  const defaults = existing
    ? { code: existing.code, name: existing.name, kind: existing.kind, ledgerAccountCode: existing.ledgerAccountCode, contribution: minorToInput(existing.contributionMinor, currency), allocationPriority: existing.allocationPriority as unknown as number, mandatory: existing.mandatory, countsTowardLoanLimit: existing.countsTowardLoanLimit, refundableOnExit: existing.refundableOnExit, earnsDividend: existing.earnsDividend }
    : { code: '', name: '', kind: 'CUSTOM' as const, ledgerAccountCode: '', contribution: '0', allocationPriority: 10, mandatory: false, ...KIND_FLAGS.CUSTOM };

  return (
    <FormDialog
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? `Edit ${existing.name}` : 'New savings product'}
      description={existing ? 'Changes apply to future periods.' : 'A mandatory product opens an account for every member and is owed from the next period.'}
      schema={schema}
      defaultValues={defaults}
      submitLabel={existing ? 'Save' : 'Create product'}
      size="lg"
      onSubmit={(v) => save.mutateAsync(v)}
    >
      {(form) => {
        const e = form.formState.errors;
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" required={isNew} error={e.code} hint={isNew ? 'Short, permanent, e.g. WEL' : undefined}>
                <Input {...form.register('code')} disabled={!isNew} maxLength={10} className="uppercase" />
              </Field>
              <Field label="Name" required error={e.name}><Input {...form.register('name')} maxLength={60} /></Field>
              <Field label="Kind" error={e.kind}>
                <NativeSelect
                  {...form.register('kind', {
                    onChange: (ev) => {
                      const flags = KIND_FLAGS[ev.target.value as SavingsProductKind];
                      (Object.keys(flags) as (keyof typeof flags)[]).forEach((k) => form.setValue(k, flags[k]));
                    },
                  })}
                  disabled={!isNew}
                >
                  {KINDS.map((k) => <option key={k} value={k}>{label(k)}</option>)}
                </NativeSelect>
              </Field>
              {isNew && (
                <Field label="Ledger account code" error={e.ledgerAccountCode} hint="Optional; the next free code is used">
                  <Input {...form.register('ledgerAccountCode')} maxLength={10} />
                </Field>
              )}
              <Field label="Contribution per period" required error={e.contribution} hint={existing?.defaultProduct ? 'Set in chama settings' : '0 for a voluntary product'}>
                <MoneyInput {...form.register('contribution')} disabled={existing?.defaultProduct} />
              </Field>
              <Field label="Allocation priority" required error={e.allocationPriority} hint="1–99. Lower is paid first; Deposits is 50.">
                <Input type="number" min={1} max={99} {...form.register('allocationPriority')} disabled={existing?.defaultProduct} />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(['mandatory', 'countsTowardLoanLimit', 'refundableOnExit', 'earnsDividend'] as const).map((k) => (
                <Controller
                  key={k}
                  control={form.control}
                  name={k}
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox id={`sp-${k}`} checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={existing?.defaultProduct && k === 'mandatory'} />
                      <Label htmlFor={`sp-${k}`} className="font-normal">{k === 'mandatory' ? 'Mandatory for every member' : FLAG_LABELS[k]}</Label>
                    </div>
                  )}
                />
              ))}
            </div>
          </>
        );
      }}
    </FormDialog>
  );
}
