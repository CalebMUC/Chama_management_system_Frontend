'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { chamaApi, rolesApi } from '@/api/endpoints/chama';
import { normaliseError } from '@/api/errors';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, PageHeader, Section, StatusChip } from '@/components/shared/Display';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/features/members/InviteDialog';
import { formToSettings, SettingsFields, settingsSchema, settingsToForm, type SettingsInput, type SettingsOutput } from '@/features/settings/SettingsFields';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan } from '@/hooks/useSessionInfo';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { formatInstantDate } from '@/lib/format';
import { INVALIDATE } from '@/lib/invalidation';
import { useSession } from '@/stores/session';

export default function ChamaSettingsPage() {
  return (
    <Guard permission="CHAMA_VIEW">
      <ChamaSettings />
    </Guard>
  );
}

/** README §7.15. Read-only without CHAMA_SETTINGS_MANAGE. */
function ChamaSettings() {
  const can = useCan();
  const qc = useQueryClient();
  const editable = can('CHAMA_SETTINGS_MANAGE');
  const q = useQuery({ queryKey: ['chama'], queryFn: chamaApi.get });
  const roles = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list, enabled: editable && can('MEMBER_VIEW') });
  const directory = useMemberDirectory();
  const currency = q.data?.currency ?? 'KES';
  const schema = useMemo(() => settingsSchema(currency), [currency]);
  const form = useForm<SettingsInput, unknown, SettingsOutput>({ resolver: zResolver(schema) });
  const [pending, setPending] = useState<SettingsOutput | null>(null);
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => { if (q.data) form.reset(settingsToForm(q.data.settings, q.data.currency)); }, [q.data, form]);

  // Warn when the quorum is more than the officials who can approve (README §7.15).
  const quorum = Number(form.watch('approvalQuorum'));
  const roleMap = roles.data;
  const approvers = useMemo(() => {
    if (!roleMap) return null;
    const approverRoles = (Object.keys(roleMap) as (keyof typeof roleMap)[]).filter((r) => roleMap[r].some((p) => p === 'LOAN_APPROVE' || p === 'EXPENSE_APPROVE' || p === 'INVESTMENT_APPROVE'));
    return directory.members.filter((m) => m.status === 'ACTIVE' && m.roles.some((r) => approverRoles.includes(r))).length;
  }, [roleMap, directory.members]);
  const quorumWarning = approvers !== null && quorum > approvers ? `Only ${approvers} active member${approvers === 1 ? '' : 's'} can approve, so nothing could reach this quorum.` : null;

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const c = q.data;

  async function save(v: SettingsOutput) {
    setMessages([]);
    try {
      const res = await chamaApi.updateSettings(formToSettings(v));
      await Promise.all(INVALIDATE.chamaSettings.map((k) => qc.invalidateQueries({ queryKey: [k] })));
      useSession.getState().setContext({ chama: res.data });
      toast.success(res.message || 'Settings saved.');
    } catch (e) {
      const unmatched = applyApiErrors(form, e);
      const err = normaliseError(e);
      setMessages(unmatched.length ? unmatched : err.hasFieldErrors() ? [] : [err.message]);
      throw e;
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Chama profile & rules" />
      <Section title="Profile">
        <DetailList
          columns={3}
          items={[
            { label: 'Name', value: c.name },
            { label: 'Chama code', value: <span className="flex items-center gap-2"><span className="font-mono font-semibold">{c.code}</span><CopyButton text={c.code} /></span> },
            { label: 'Currency', value: c.currency },
            { label: 'Status', value: <StatusChip status={c.status} /> },
            { label: 'Created', value: formatInstantDate(c.createdAt) },
            c.description ? { label: 'Description', value: c.description } : null,
          ]}
        />
      </Section>
      <Section title="Rules" description={editable ? 'Changes apply to future contribution periods and new loan applications.' : 'Only the chairperson can change these.'}>
        <form onSubmit={form.handleSubmit((v) => setPending(v))} className="space-y-5" noValidate>
          <FormAlert messages={messages} />
          <SettingsFields form={form} disabled={!editable} currency={c.currency} quorumWarning={quorumWarning} />
          {editable && (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => form.reset(settingsToForm(c.settings, c.currency))} disabled={!form.formState.isDirty}>Discard</Button>
              <Button type="submit" disabled={!form.formState.isDirty}>Save rules</Button>
            </div>
          )}
        </form>
      </Section>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Save the chama rules?"
        description="Changes apply to future contribution periods and new loan applications. The default loan product follows these loan rules."
        confirmLabel="Save rules"
        onConfirm={() => pending && save(pending)}
      />
    </div>
  );
}
