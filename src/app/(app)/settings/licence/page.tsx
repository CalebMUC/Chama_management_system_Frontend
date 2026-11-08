'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MinusCircle } from 'lucide-react';
import { chamaApi } from '@/api/endpoints/chama';
import { dashboardApi } from '@/api/endpoints/books';
import type { LicenseFeature } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DetailList, PageHeader, Progress, Section, StatusChip } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { usePermission } from '@/hooks/useSessionInfo';
import { formatInstantDate } from '@/lib/format';
import { FEATURE_LABELS, label } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function LicencePage() {
  return (
    <Guard permission="CHAMA_VIEW">
      <Licence />
    </Guard>
  );
}

/** README §7.15: plan, validity, member limit vs active members, features. */
function Licence() {
  const q = useQuery({ queryKey: ['chama', 'licence'], queryFn: chamaApi.licence });
  const canDash = usePermission('REPORT_VIEW_ALL');
  const dash = useQuery({ queryKey: ['dashboard', 'chama'], queryFn: dashboardApi.chama, enabled: canDash });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const l = q.data;
  const active = dash.data?.members.active;
  const soon = l.state === 'ACTIVE' && l.daysRemaining <= 14;
  return (
    <div className="space-y-5">
      <PageHeader title="Licence" description="Your chama's plan with the platform provider." />
      <Section title={<span className="flex items-center gap-2">{label(l.plan)} plan <StatusChip status={l.state} /></span>}>
        <div className="space-y-5">
          <DetailList
            columns={4}
            items={[
              { label: 'Valid from', value: formatInstantDate(l.validFrom) },
              { label: 'Valid until', value: formatInstantDate(l.validUntil) },
              { label: 'Days remaining', value: <span className={cn(soon && 'font-semibold text-warning', l.daysRemaining === 0 && 'text-destructive')}>{l.daysRemaining}</span> },
              { label: 'Licence key', value: <span className="font-mono text-xs">{l.licenseKey}</span> },
              l.notes ? { label: 'Notes', value: l.notes } : null,
            ]}
          />
          <div className="max-w-md space-y-1">
            <div className="flex justify-between text-sm">
              <span>Members</span>
              <span className="tabular">{active !== undefined ? `${active} of ${l.maxMembers}` : `Up to ${l.maxMembers}`}</span>
            </div>
            {active !== undefined && <Progress value={active} max={l.maxMembers} tone={active >= l.maxMembers ? 'destructive' : active / l.maxMembers > 0.9 ? 'warning' : 'default'} />}
          </div>
        </div>
      </Section>
      <Section title="Features">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(FEATURE_LABELS) as LicenseFeature[]).map((f) => {
            const on = l.features.includes(f);
            return (
              <li key={f} className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-sm', !on && 'text-muted-foreground')}>
                {on ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <MinusCircle className="size-4" aria-hidden />}
                {FEATURE_LABELS[f]}
                <span className="sr-only">{on ? 'included' : 'not included'}</span>
                {(f === 'MPESA' || f === 'SMS_NOTIFICATIONS') && on && <span className="ml-auto text-xs text-muted-foreground">coming soon</span>}
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
