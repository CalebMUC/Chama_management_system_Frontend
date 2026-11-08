'use client';

import { CheckCircle2 } from 'lucide-react';
import { formatInstant } from '@/lib/format';
import { Progress } from './Display';

interface Approval {
  approverUserId: string;
  name: string | null;
  note: string | null;
  approvedAt: string;
}

/** "Approvals: 1 of 2" with the approvers and their notes (README §8.1: quorum of distinct officials). */
export function ApprovalProgress({ approvals, required, compact }: { approvals: Approval[]; required: number; compact?: boolean }) {
  const n = approvals.length;
  if (compact) return <span className="tabular text-sm">{n} of {required}</span>;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Approvals: {n} of {required}</span>
        {n >= required && <span className="text-xs text-success">Quorum reached</span>}
      </div>
      <Progress value={n} max={required} tone={n >= required ? 'success' : 'warning'} />
      {approvals.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {approvals.map((a) => (
            <li key={a.approverUserId} className="flex gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                <span className="font-medium">{a.name ?? 'An official'}</span>
                <span className="text-muted-foreground"> · {formatInstant(a.approvedAt)}</span>
                {a.note && <span className="block text-muted-foreground">“{a.note}”</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
