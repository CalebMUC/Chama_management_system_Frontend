'use client';

import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { ChamaSettings } from '@/api/types';
import { Field } from '@/components/shared/Field';
import { MoneyInput } from '@/components/shared/MoneyFields';
import { Input, NativeSelect } from '@/components/ui/primitives';
import { bpToPercentInput, minorToInput } from '@/lib/format';
import { intSchema, moneySchema, percentSchema } from '@/lib/schemas';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The chama rules as a form (money as text, rates as percentages), mirroring the server ranges. */
export function settingsSchema(currency: string) {
  return z
    .object({
      contributionAmount: moneySchema(currency),
      contributionFrequency: z.enum(['MONTHLY', 'WEEKLY']),
      contributionDueDay: intSchema(1, 28),
      lateGraceDays: intSchema(0, 31),
      latePenalty: percentSchema(0, 100),
      loanMaxMultiplier: intSchema(1, 10),
      loanInterest: percentSchema(0, 100),
      loanMinMembershipMonths: intSchema(0, 60),
      loanGuarantorThreshold: moneySchema(currency, { allowZero: true }),
      loanGuarantorsRequired: intSchema(0, 5),
      approvalQuorum: intSchema(1, 10),
    })
    .refine((v) => v.contributionFrequency === 'MONTHLY' || v.contributionDueDay <= 7, { path: ['contributionDueDay'], message: 'Pick a weekday' });
}

export type SettingsInput = z.input<ReturnType<typeof settingsSchema>>;
export type SettingsOutput = z.output<ReturnType<typeof settingsSchema>>;

export function settingsToForm(s: ChamaSettings, currency: string): SettingsInput {
  return {
    contributionAmount: minorToInput(s.contributionAmountMinor, currency),
    contributionFrequency: s.contributionFrequency,
    contributionDueDay: s.contributionDueDay,
    lateGraceDays: s.lateGraceDays,
    latePenalty: bpToPercentInput(s.latePenaltyBasisPoints),
    loanMaxMultiplier: s.loanMaxMultiplier,
    loanInterest: bpToPercentInput(s.loanInterestBasisPoints),
    loanMinMembershipMonths: s.loanMinMembershipMonths,
    loanGuarantorThreshold: minorToInput(s.loanGuarantorThresholdMinor, currency),
    loanGuarantorsRequired: s.loanGuarantorsRequired,
    approvalQuorum: s.approvalQuorum,
  };
}

export function formToSettings(v: SettingsOutput): ChamaSettings {
  return {
    contributionAmountMinor: v.contributionAmount,
    contributionFrequency: v.contributionFrequency,
    contributionDueDay: v.contributionDueDay,
    lateGraceDays: v.lateGraceDays,
    latePenaltyBasisPoints: v.latePenalty,
    loanMaxMultiplier: v.loanMaxMultiplier,
    loanInterestBasisPoints: v.loanInterest,
    loanMinMembershipMonths: v.loanMinMembershipMonths,
    loanGuarantorThresholdMinor: v.loanGuarantorThreshold,
    loanGuarantorsRequired: v.loanGuarantorsRequired,
    approvalQuorum: v.approvalQuorum,
  };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </fieldset>
  );
}

/**
 * The grouped rules fields (README §7.15). `prefix` nests them (e.g. "settings." in onboarding). `disabled` makes them read-only.
 */
export function SettingsFields<T extends FieldValues>({ form, prefix = '', disabled, currency, quorumWarning }: { form: UseFormReturn<T, any, any>; prefix?: string; disabled?: boolean; currency: string; quorumWarning?: string | null }) {
  const name = (k: string) => `${prefix}${k}` as Path<T>;
  const errs = (prefix ? (form.formState.errors as Record<string, unknown>)[prefix.replace(/\.$/, '')] ?? {} : form.formState.errors) as Record<string, { message?: string } | undefined>;
  const frequency = form.watch(name('contributionFrequency')) as string;
  const reg = (k: string) => form.register(name(k));
  return (
    <fieldset disabled={disabled} className="space-y-6">
      <Group title="Contributions">
        <Field label="Amount per period" required error={errs.contributionAmount}><MoneyInput currency={currency} {...reg('contributionAmount')} /></Field>
        <Field label="Frequency" required error={errs.contributionFrequency}>
          <NativeSelect {...form.register(name('contributionFrequency'), { onChange: (e) => { if (e.target.value === 'WEEKLY' && Number(form.getValues(name('contributionDueDay'))) > 7) form.setValue(name('contributionDueDay'), 1 as never); } })}>
            <option value="MONTHLY">Monthly</option>
            <option value="WEEKLY">Weekly</option>
          </NativeSelect>
        </Field>
        <Field label={frequency === 'WEEKLY' ? 'Due weekday' : 'Due day of month'} required error={errs.contributionDueDay} hint={frequency === 'WEEKLY' ? undefined : '1–28'}>
          {frequency === 'WEEKLY' ? (
            <NativeSelect {...reg('contributionDueDay')}>{WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</NativeSelect>
          ) : (
            <Input type="number" min={1} max={28} {...reg('contributionDueDay')} />
          )}
        </Field>
        <Field label="Grace days" required error={errs.lateGraceDays} hint="0–31 days after the due date"><Input type="number" min={0} max={31} {...reg('lateGraceDays')} /></Field>
        <Field label="Late penalty (%)" required error={errs.latePenalty} hint="Of the amount still owed"><Input inputMode="decimal" {...reg('latePenalty')} /></Field>
      </Group>
      <Group title="Loans (default loan product)">
        <Field label="Limit (× savings)" required error={errs.loanMaxMultiplier} hint="1–10"><Input type="number" min={1} max={10} {...reg('loanMaxMultiplier')} /></Field>
        <Field label="Interest (% flat)" required error={errs.loanInterest} hint="For the whole term"><Input inputMode="decimal" {...reg('loanInterest')} /></Field>
        <Field label="Minimum membership (months)" required error={errs.loanMinMembershipMonths} hint="0–60"><Input type="number" min={0} max={60} {...reg('loanMinMembershipMonths')} /></Field>
        <Field label="Guarantors needed above" required error={errs.loanGuarantorThreshold}><MoneyInput currency={currency} {...reg('loanGuarantorThreshold')} /></Field>
        <Field label="Guarantors required" required error={errs.loanGuarantorsRequired} hint="0–5"><Input type="number" min={0} max={5} {...reg('loanGuarantorsRequired')} /></Field>
      </Group>
      <Group title="Approvals">
        <Field label="Approvals needed (quorum)" required error={errs.approvalQuorum} hint={quorumWarning ? <span className="text-warning">{quorumWarning}</span> : 'Distinct officials who must approve each loan, expense and investment'}>
          <Input type="number" min={1} max={10} {...reg('approvalQuorum')} />
        </Field>
      </Group>
    </fieldset>
  );
}
