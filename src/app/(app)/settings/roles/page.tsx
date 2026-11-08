'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { rolesApi } from '@/api/endpoints/chama';
import type { ChamaPermission, ChamaRole, RolePermissionsMap } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Checkbox, Tooltip } from '@/components/ui/overlays';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { refreshMembership } from '@/features/auth/sessionActions';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan } from '@/hooks/useSessionInfo';
import { CHAIR_LOCKED, label, PERMISSION_GROUPS, ROLES } from '@/lib/labels';

export default function RolesPage() {
  return (
    <Guard permission="MEMBER_VIEW">
      <Roles />
    </Guard>
  );
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** README §7.15: the role → permission matrix. Saved per role with the full set. */
function Roles() {
  const editable = useCan()('ROLE_PERMISSIONS_MANAGE');
  const q = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const [draft, setDraft] = useState<RolePermissionsMap | null>(null);
  const [saving, setSaving] = useState<ChamaRole | null>(null);
  useEffect(() => { if (q.data) setDraft(q.data); }, [q.data]);
  const save = useApiMutation((v: { role: ChamaRole; permissions: ChamaPermission[] }) => rolesApi.update(v.role, v.permissions), {
    invalidate: ['roles'],
    toastErrors: false,
    onSuccess: () => void refreshMembership(true),
  });

  const dirty = useMemo(() => (draft && q.data ? ROLES.filter((r) => !sameSet(draft[r] ?? [], q.data![r] ?? [])) : []), [draft, q.data]);

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!draft || !q.data) return <LoadingState />;

  const toggle = (role: ChamaRole, p: ChamaPermission, on: boolean) =>
    setDraft((d) => d && { ...d, [role]: on ? Array.from(new Set([...(d[role] ?? []), p])) : (d[role] ?? []).filter((x) => x !== p) });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Roles & permissions"
        description="What each role can do. A member's permissions are everything their roles grant."
        actions={editable && dirty.length > 0 && <Button variant="outline" onClick={() => setDraft(q.data!)}>Discard changes</Button>}
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[16rem]">Permission</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <span>{label(r)}</span>
                    {editable && dirty.includes(r) && <Button size="sm" className="h-6 px-2 text-xs" onClick={() => setSaving(r)}>Save</Button>}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.area}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={ROLES.length + 1} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.area}</TableCell>
                </TableRow>
                {g.permissions.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>
                      <span className="block text-sm font-medium">{p.unlocks}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{p.key}</span>
                    </TableCell>
                    {ROLES.map((r) => {
                      const locked = r === 'CHAIRPERSON' && CHAIR_LOCKED.includes(p.key);
                      const checked = (draft[r] ?? []).includes(p.key);
                      const box = (
                        <Checkbox
                          checked={checked}
                          disabled={!editable || locked}
                          onCheckedChange={(v) => toggle(r, p.key, v === true)}
                          aria-label={`${label(r)}: ${p.unlocks}`}
                        />
                      );
                      return (
                        <TableCell key={r} className="text-center">
                          {locked ? (
                            <Tooltip content="The chairperson always keeps this, so someone can always manage roles."><span className="inline-flex items-center gap-1">{box}<Lock className="size-3 text-muted-foreground" /></span></Tooltip>
                          ) : box}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog
        open={!!saving}
        onOpenChange={(o) => !o && setSaving(null)}
        title={`Save ${saving ? label(saving) : ''} permissions?`}
        description="Changes apply immediately to everyone with this role."
        confirmLabel="Save"
        onConfirm={() => saving && save.mutateAsync({ role: saving, permissions: draft[saving] ?? [] })}
      />
    </div>
  );
}
