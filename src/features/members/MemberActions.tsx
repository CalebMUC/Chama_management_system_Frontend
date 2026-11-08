'use client';

import { useEffect, useState } from 'react';
import { Ban, Check, MoreHorizontal, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { membersApi } from '@/api/endpoints/chama';
import type { ChamaRole, MemberView } from '@/api/types';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/overlays';
import { Label } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { memberName } from '@/hooks/useMembers';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { memberLabel } from '@/lib/format';
import { label, OFFICIAL_ROLES } from '@/lib/labels';

type Action = 'approve' | 'reject' | 'suspend' | 'reactivate' | 'roles';
const INVALIDATE = ['members', 'dashboard'];

/** Which actions the user may take on this member (README §7.5). Never on their own membership. */
export function useMemberActions(m: MemberView): Action[] {
  const can = useCan();
  const me = useMyUserId();
  if (m.userId === me) return [];
  const out: Action[] = [];
  if (m.status === 'PENDING_APPROVAL' && can('MEMBER_APPROVE')) out.push('approve', 'reject');
  if (m.status === 'ACTIVE' && can('MEMBER_ROLES_MANAGE')) out.push('roles');
  if (m.status === 'ACTIVE' && can('MEMBER_SUSPEND')) out.push('suspend');
  if (m.status === 'SUSPENDED' && can('MEMBER_SUSPEND')) out.push('reactivate');
  return out;
}

const ICONS: Record<Action, React.ReactNode> = {
  approve: <Check />, reject: <X />, suspend: <Ban />, reactivate: <RotateCcw />, roles: <ShieldCheck />,
};
const TEXT: Record<Action, string> = {
  approve: 'Approve', reject: 'Reject', suspend: 'Suspend', reactivate: 'Reactivate', roles: 'Change roles',
};

/** Row menu or inline buttons with their dialogs. */
export function MemberActions({ member, inline }: { member: MemberView; inline?: boolean }) {
  const actions = useMemberActions(member);
  const [open, setOpen] = useState<Action | null>(null);
  const name = memberLabel(memberName(member), member.memberNumber);
  const id = member.membershipId;
  const approve = useApiMutation(() => membersApi.approve(id), { invalidate: INVALIDATE, toastErrors: false });
  const reject = useApiMutation(() => membersApi.reject(id), { invalidate: INVALIDATE, toastErrors: false });
  const suspend = useApiMutation((reason: string) => membersApi.suspend(id, reason), { invalidate: INVALIDATE, toastErrors: false });
  const reactivate = useApiMutation(() => membersApi.reactivate(id), { invalidate: INVALIDATE, toastErrors: false });

  if (actions.length === 0) return null;
  const close = (o: boolean) => !o && setOpen(null);

  return (
    <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap justify-end gap-2">
      {inline ? (
        actions.map((a) => (
          <Button key={a} size="sm" variant={a === 'approve' ? 'default' : a === 'reject' || a === 'suspend' ? 'outline' : 'outline'} onClick={() => setOpen(a)}>
            {ICONS[a]}{TEXT[a]}
          </Button>
        ))
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${name}`}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => (
              <DropdownMenuItem key={a} onSelect={() => setOpen(a)} className={a === 'reject' || a === 'suspend' ? 'text-destructive' : undefined}>
                {ICONS[a]}{TEXT[a]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={open === 'approve'}
        onOpenChange={close}
        title={`Approve ${name}?`}
        description="They become an active member with a member number, and accounts open in the mandatory savings products. If your licence's member limit is reached, the approval is refused."
        confirmLabel="Approve"
        onConfirm={() => approve.mutateAsync(undefined)}
      />
      <ConfirmDialog
        open={open === 'reject'}
        onOpenChange={close}
        title={`Reject ${name}'s application?`}
        description="They will not be able to use the chama. They can be told why by an official."
        confirmLabel="Reject"
        destructive
        onConfirm={() => reject.mutateAsync(undefined)}
      />
      <ReasonDialog
        open={open === 'suspend'}
        onOpenChange={close}
        title={`Suspend ${name}?`}
        description="They are signed out of everything except a screen showing your reason. Their records stay; you can reactivate them later."
        confirmLabel="Suspend"
        maxLength={500}
        onConfirm={(reason) => suspend.mutateAsync(reason)}
      />
      <ConfirmDialog
        open={open === 'reactivate'}
        onOpenChange={close}
        title={`Reactivate ${name}?`}
        description="They regain access with their previous roles."
        confirmLabel="Reactivate"
        onConfirm={() => reactivate.mutateAsync(undefined)}
      />
      <RolesDialog member={member} open={open === 'roles'} onOpenChange={close} />
    </div>
  );
}

function RolesDialog({ member, open, onOpenChange }: { member: MemberView; open: boolean; onOpenChange(o: boolean): void }) {
  const [roles, setRoles] = useState<ChamaRole[]>(member.roles);
  useEffect(() => { if (open) setRoles(member.roles); }, [open, member.roles]);
  const save = useApiMutation((r: ChamaRole[]) => membersApi.changeRoles(member.membershipId, r), { invalidate: INVALIDATE, toastErrors: false });
  const toggle = (r: ChamaRole, on: boolean) => setRoles((cur) => (on ? Array.from(new Set([...cur, r])) : cur.filter((x) => x !== r)));
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Roles for ${memberLabel(memberName(member), member.memberNumber)}`}
      description="Roles grant permissions (see Settings → Roles & permissions). The chama must always keep one chairperson."
      confirmLabel="Save roles"
      onConfirm={() => save.mutateAsync(Array.from(new Set<ChamaRole>(['MEMBER', ...roles])))}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 opacity-70">
          <Checkbox id="role-MEMBER" checked disabled />
          <Label htmlFor="role-MEMBER" className="font-normal">Member <span className="text-xs text-muted-foreground">(always)</span></Label>
        </div>
        {OFFICIAL_ROLES.map((r) => (
          <div key={r} className="flex items-center gap-2">
            <Checkbox id={`role-${r}`} checked={roles.includes(r)} onCheckedChange={(v) => toggle(r, v === true)} />
            <Label htmlFor={`role-${r}`} className="font-normal">{label(r)}</Label>
          </div>
        ))}
      </div>
    </ConfirmDialog>
  );
}
