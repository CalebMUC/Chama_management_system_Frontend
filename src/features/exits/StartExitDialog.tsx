'use client';

import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { exitsApi } from '@/api/endpoints/exits';
import { isApiError, normaliseError } from '@/api/errors';
import type { ExitView } from '@/api/types';
import { ErrorState, FormAlert, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Label, Textarea } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { keys } from '@/lib/invalidation';
import { blockerHints, blockerText, type BlockerHint } from './exitRules';
import { SettlementStatement } from './SettlementStatement';

const MAX_REASON = 300;

/**
 * Start a member's exit (MEMBER_EXIT_REQUEST): GET /member-exits/preview shows the settlement and anything that stops them; with
 * no blockers, a reason sends it for approval.
 */
export function StartExitDialog({ open, onOpenChange, memberUserId, memberName, onStarted }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  memberUserId: string;
  memberName: string;
  onStarted(exit: ExitView): void;
}) {
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const preview = useQuery({
    queryKey: ['memberExits', 'preview', memberUserId],
    queryFn: () => exitsApi.preview(memberUserId),
    enabled: open,
    staleTime: 0,
  });
  const start = useApiMutation((r: string) => exitsApi.start({ memberUserId, reason: r }), { invalidate: keys('memberExit'), toastErrors: false });

  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
      setError(null);
    }
  }, [open]);

  const p = preview.data;
  const blocked = !p || p.blockers.length > 0 || !p.canExit;
  const text = reason.trim();
  const reasonError = touched && !text ? 'Give a reason' : null;

  async function submit() {
    setTouched(true);
    if (blocked || !text) return;
    setError(null);
    try {
      const res = await start.mutateAsync(text);
      onOpenChange(false);
      onStarted(res.data);
    } catch (e) {
      setError(e);
      // Something changed since the preview (a new loan, a guarantee): show the current blockers.
      if (isApiError(e, 'EXIT_BLOCKED')) void preview.refetch();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !start.isPending && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Start {memberName}&apos;s exit</DialogTitle>
          <DialogDescription>
            The settlement if they left today. Once started it goes to the officials for approval, then the treasurer pays it out.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {preview.error ? (
            <PreviewError error={preview.error} onRetry={() => preview.refetch()} />
          ) : !p ? (
            <LoadingState label="Working out the settlement…" />
          ) : (
            <>
              {p.blockers.length > 0 && <Blockers blockers={p.blockers} />}
              <SettlementStatement settlement={p.settlement} />
              {!blocked && (
                <div className="space-y-1.5">
                  <Label htmlFor={reasonId}>Reason for leaving<span className="ml-0.5 text-destructive">*</span></Label>
                  <Textarea
                    id={reasonId}
                    value={reason}
                    maxLength={MAX_REASON}
                    onChange={(e) => setReason(e.target.value)}
                    onBlur={() => setTouched(true)}
                    aria-invalid={!!reasonError}
                    placeholder="e.g. Relocating to Mombasa"
                  />
                  <div className="flex justify-between text-xs">
                    <span className="text-destructive">{reasonError}</span>
                    <span className="text-muted-foreground">{reason.length}/{MAX_REASON}</span>
                  </div>
                </div>
              )}
            </>
          )}
          <FormAlert error={error} />
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" disabled={start.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={blocked} loading={start.isPending} onClick={submit}>Start exit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HINTS: Record<BlockerHint, string> = {
  guarantee:
    'A guarantee must be transferred to another member first. Find the loan in Loans by the borrower and purpose named above, open it, and on its Approvals tab use Transfer beside this member’s guarantee. The new guarantor must accept before the exit can start. A request they haven’t answered must be declined (or accepted and transferred).',
  application: 'A loan application still in progress must be cancelled by the borrower or rejected by the officials.',
  shortfall: 'A shortfall must be paid first: the member owes more than their refundable savings can clear.',
};

/** What stops the member leaving, and how to clear each kind. The server's sentences carry no loan ids. */
function Blockers({ blockers }: { blockers: unknown[] }) {
  const hints = blockerHints(blockers);
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>This member can&apos;t leave yet</AlertTitle>
      <AlertDescription className="space-y-2">
        <ul className="list-disc space-y-1 pl-4">
          {blockers.map((b, i) => <li key={i}>{blockerText(b)}</li>)}
        </ul>
        {hints.length > 0 && (
          <div className="space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">What to do</p>
            <ul className="list-disc space-y-1 pl-4">
              {hints.map((h) => <li key={h}>{HINTS[h]}</li>)}
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

function PreviewError({ error, onRetry }: { error: unknown; onRetry(): void }) {
  // EXIT_NOT_A_MEMBER: not active or suspended any more. The server's message says so; retrying won't help.
  if (isApiError(error, 'EXIT_NOT_A_MEMBER')) return <FormAlert messages={[normaliseError(error).message]} />;
  return <ErrorState error={error} onRetry={onRetry} />;
}
