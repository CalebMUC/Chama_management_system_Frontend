'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Ban, CalendarClock, Layers, NotebookPen, RotateCcw, Users } from 'lucide-react';
import { platformApi } from '@/api/endpoints/platform';
import { PLAN_DEFAULTS, type LicenseFeature, type LicensePlan, type PlatformChamaView, type UpdateLicenseRequest } from '@/api/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader, Section, StatusChip } from '@/components/shared/Display';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/overlays';
import { Alert, AlertDescription, Badge, Input, Label, NativeSelect, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { addDays, endOfDayNairobiInstant, formatBp, formatInstantDate, instantToNairobiDate, todayNairobi } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { FEATURE_LABELS, label } from '@/lib/labels';

type Dialog = 'renew' | 'plan' | 'limit' | 'features' | 'suspend' | 'reactivate' | 'notes' | null;
const PLANS: LicensePlan[] = ['TRIAL', 'BASIC', 'STANDARD', 'PREMIUM'];
const FEATURES = Object.keys(FEATURE_LABELS) as LicenseFeature[];

/** README §7.16: chama info (read-only) and licence management. Each action sends only the fields it changes. */
export default function PlatformChamaPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['platform', 'chama', id], queryFn: () => platformApi.get(id) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  return <ChamaView v={q.data} />;
}

function ChamaView({ v }: { v: PlatformChamaView }) {
  const { chama: c, license: l } = v;
  const [dialog, setDialog] = useState<Dialog>(null);
  const update = useApiMutation((body: UpdateLicenseRequest) => platformApi.updateLicence(c.id, body), { invalidate: keys('platform'), toastErrors: false });
  const shut = (o: boolean) => !o && setDialog(null);
  const s = c.settings;

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/platform', label: 'Chamas' }} title={c.name} description={<span className="font-mono">{c.code}</span>} />
      <Section
        title={<span className="flex items-center gap-2">Licence · {label(l.plan)} <StatusChip status={l.state} /></span>}
        actions={
          <>
            <Button size="sm" onClick={() => setDialog('renew')}><CalendarClock />Renew</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('plan')}><Layers />Change plan</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('limit')}><Users />Member limit</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('features')}>Features</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('notes')}><NotebookPen />Notes</Button>
            {l.state === 'SUSPENDED' ? (
              <Button size="sm" variant="outline" onClick={() => setDialog('reactivate')}><RotateCcw />Reactivate</Button>
            ) : (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDialog('suspend')}><Ban />Suspend</Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <DetailList
            columns={4}
            items={[
              { label: 'Valid from', value: formatInstantDate(l.validFrom) },
              { label: 'Valid until', value: formatInstantDate(l.validUntil) },
              { label: 'Days remaining', value: l.daysRemaining },
              { label: 'Max members', value: l.maxMembers },
              { label: 'Licence key', value: <span className="font-mono text-xs">{l.licenseKey}</span> },
              l.notes ? { label: 'Notes', value: l.notes } : null,
            ]}
          />
          <div className="flex flex-wrap gap-1.5">{l.features.map((f) => <Badge key={f} variant="outline">{FEATURE_LABELS[f] ?? f}</Badge>)}</div>
        </div>
      </Section>
      <Section title="Chama">
        <DetailList
          columns={3}
          items={[
            { label: 'Status', value: <StatusChip status={c.status} /> },
            { label: 'Currency', value: c.currency },
            { label: 'Created', value: formatInstantDate(c.createdAt) },
            c.description ? { label: 'Description', value: c.description } : null,
          ]}
        />
      </Section>
      <Section title="Rules" description="Read-only. The chairperson changes these in the chama.">
        <DetailList
          columns={4}
          items={[
            { label: 'Contribution', value: <><MoneyText value={s.contributionAmountMinor} currency={c.currency} /> {s.contributionFrequency.toLowerCase()}, due day {s.contributionDueDay}</> },
            { label: 'Grace / late penalty', value: `${s.lateGraceDays} days · ${formatBp(s.latePenaltyBasisPoints)}` },
            { label: 'Loan limit', value: `${s.loanMaxMultiplier}× savings · ${formatBp(s.loanInterestBasisPoints)} flat` },
            { label: 'Min. membership', value: `${s.loanMinMembershipMonths} months` },
            { label: 'Guarantors', value: <>{s.loanGuarantorsRequired} above <MoneyText value={s.loanGuarantorThresholdMinor} currency={c.currency} /></> },
            { label: 'Approval quorum', value: s.approvalQuorum },
          ]}
        />
      </Section>

      <RenewDialog open={dialog === 'renew'} onOpenChange={shut} current={l.validUntil} onSave={(validUntil) => update.mutateAsync({ validUntil })} />
      <PlanDialog open={dialog === 'plan'} onOpenChange={shut} current={l.plan} onSave={(plan) => update.mutateAsync({ plan })} />
      <LimitDialog open={dialog === 'limit'} onOpenChange={shut} current={l.maxMembers} onSave={(maxMembers) => update.mutateAsync({ maxMembers })} />
      <FeaturesDialog open={dialog === 'features'} onOpenChange={shut} current={l.features} onSave={(features) => update.mutateAsync({ features })} />
      <NotesDialog open={dialog === 'notes'} onOpenChange={shut} current={l.notes ?? ''} onSave={(notes) => update.mutateAsync({ notes })} />
      <ReasonDialog
        open={dialog === 'suspend'}
        onOpenChange={shut}
        title={`Suspend ${c.name}?`}
        description="Every member is blocked until you reactivate the licence. Their records stay."
        confirmLabel="Suspend"
        fieldLabel="Notes (shown to the chama)"
        maxLength={500}
        onConfirm={(notes) => update.mutateAsync({ status: 'SUSPENDED', notes })}
      />
      <ConfirmDialog open={dialog === 'reactivate'} onOpenChange={shut} title={`Reactivate ${c.name}?`} description="Members can use the chama again (if the licence hasn't expired)." confirmLabel="Reactivate" onConfirm={() => update.mutateAsync({ status: 'ACTIVE' })} />
    </div>
  );
}

function RenewDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange(o: boolean): void; current: string; onSave(validUntil: string): Promise<unknown> }) {
  const [date, setDate] = useState('');
  useEffect(() => {
    if (!open) return;
    const base = instantToNairobiDate(current) > todayNairobi() ? instantToNairobiDate(current) : todayNairobi();
    setDate(addDays(base, 365));
  }, [open, current]);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Renew the licence"
      description="The licence is valid until the end of this day, Nairobi time."
      confirmLabel="Renew"
      onConfirm={() => {
        if (!date || date <= todayNairobi()) throw new Error('Pick a date in the future.');
        return onSave(endOfDayNairobiInstant(date));
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="renew-date">Valid until</Label>
        <Input id="renew-date" type="date" min={addDays(todayNairobi(), 1)} value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex flex-wrap gap-2 pt-1">
          {[30, 90, 365].map((d) => <Button key={d} type="button" size="sm" variant="ghost" onClick={() => setDate(addDays(instantToNairobiDate(current) > todayNairobi() ? instantToNairobiDate(current) : todayNairobi(), d))}>+{d} days</Button>)}
        </div>
      </div>
    </ConfirmDialog>
  );
}

function PlanDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange(o: boolean): void; current: LicensePlan; onSave(plan: LicensePlan): Promise<unknown> }) {
  const [plan, setPlan] = useState<LicensePlan>(current);
  useEffect(() => { if (open) setPlan(current); }, [open, current]);
  const d = PLAN_DEFAULTS[plan];
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change plan"
      confirmLabel="Change plan"
      onConfirm={() => (plan === current ? undefined : onSave(plan))}
    >
      <div className="space-y-3">
        <NativeSelect value={plan} onChange={(e) => setPlan(e.target.value as LicensePlan)} aria-label="Plan">{PLANS.map((p) => <option key={p} value={p}>{label(p)}</option>)}</NativeSelect>
        <Alert variant="warning">
          <AlertDescription>The member limit and features reset to the plan&apos;s defaults: {d.maxMembers} members, {d.features.map((f) => FEATURE_LABELS[f]).join(', ')}. Edit them afterwards if needed.</AlertDescription>
        </Alert>
      </div>
    </ConfirmDialog>
  );
}

function LimitDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange(o: boolean): void; current: number; onSave(n: number): Promise<unknown> }) {
  const [value, setValue] = useState(String(current));
  useEffect(() => { if (open) setValue(String(current)); }, [open, current]);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Member limit"
      confirmLabel="Save"
      onConfirm={() => {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error('Enter a whole number of at least 1.');
        return n === current ? undefined : onSave(n);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="max-members">Most active members allowed</Label>
        <Input id="max-members" type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    </ConfirmDialog>
  );
}

function FeaturesDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange(o: boolean): void; current: LicenseFeature[]; onSave(f: LicenseFeature[]): Promise<unknown> }) {
  const [value, setValue] = useState<LicenseFeature[]>(current);
  useEffect(() => { if (open) setValue(current); }, [open, current]);
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title="Licensed features" description="Members lose access to screens for features you turn off." confirmLabel="Save features" onConfirm={() => onSave(value)}>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f} className="flex items-center gap-2">
            <Checkbox id={`pf-${f}`} checked={value.includes(f)} onCheckedChange={(on) => setValue((v) => (on ? [...v, f] : v.filter((x) => x !== f)))} />
            <Label htmlFor={`pf-${f}`} className="font-normal">{FEATURE_LABELS[f]}</Label>
          </div>
        ))}
      </div>
    </ConfirmDialog>
  );
}

function NotesDialog({ open, onOpenChange, current, onSave }: { open: boolean; onOpenChange(o: boolean): void; current: string; onSave(n: string): Promise<unknown> }) {
  const [value, setValue] = useState(current);
  useEffect(() => { if (open) setValue(current); }, [open, current]);
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title="Licence notes" description="Shown to the chama's officials on their licence screen." confirmLabel="Save notes" onConfirm={() => onSave(value.trim())}>
      <Textarea value={value} maxLength={500} onChange={(e) => setValue(e.target.value)} aria-label="Notes" />
    </ConfirmDialog>
  );
}
