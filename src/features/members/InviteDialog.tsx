'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { z } from 'zod';
import { membersApi } from '@/api/endpoints/chama';
import { Field } from '@/components/shared/Field';
import { FormDialog } from '@/components/shared/FormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { emailSchema } from '@/lib/schemas';
import { useSession } from '@/stores/session';

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => undefined)}
      aria-label={`${label}: ${text}`}
    >
      {copied ? <Check /> : <Copy />}{copied ? 'Copied' : label}
    </Button>
  );
}

const schema = z.object({ email: emailSchema });

/** README §7.5: invite by email, and share the chama code / join link. */
export function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange(o: boolean): void }) {
  const code = useSession((s) => s.user?.chamaCode ?? '');
  const invite = useApiMutation((email: string) => membersApi.invite(email), { invalidate: ['members'], toastErrors: false });
  const joinLink = typeof window !== 'undefined' ? `${window.location.origin}/join?chama=${encodeURIComponent(code)}` : '';
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite a member"
      description="We email them a link to join. They still need an official's approval."
      schema={schema}
      defaultValues={{ email: '' }}
      submitLabel="Send invitation"
      onSubmit={(v) => invite.mutateAsync(v.email)}
    >
      {(form) => (
        <>
          <Field label="Email" required error={form.formState.errors.email}><Input type="email" {...form.register('email')} autoFocus /></Field>
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            <p className="text-muted-foreground">Or share your chama code and join link:</p>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold">{code}</span>
              <CopyButton text={code} label="Copy code" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-xs">{joinLink}</span>
              <CopyButton text={joinLink} label="Copy link" />
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}
