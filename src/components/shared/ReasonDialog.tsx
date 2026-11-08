'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Label, Textarea } from '@/components/ui/primitives';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * A confirmation that asks for a reason (or an optional note). Money records are reversed, rejected, cancelled or waived with a
 * reason, never deleted (README §1).
 */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, destructive = true, optional = false, fieldLabel, maxLength = 300, onConfirm, children }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** An optional note (approvals) instead of a required reason. */
  optional?: boolean;
  fieldLabel?: string;
  maxLength?: number;
  onConfirm(reason: string): Promise<unknown>;
  children?: ReactNode;
}) {
  const id = useId();
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      onConfirm={() => {
        const text = reason.trim();
        if (!optional && !text) throw new Error('Give a reason.');
        return onConfirm(text);
      }}
    >
      {children}
      <div className="space-y-1.5">
        <Label htmlFor={id}>{fieldLabel ?? (optional ? 'Note (optional)' : 'Reason')}{!optional && <span className="ml-0.5 text-destructive">*</span>}</Label>
        <Textarea id={id} value={reason} maxLength={maxLength} onChange={(e) => setReason(e.target.value)} />
        <p className="text-right text-xs text-muted-foreground">{reason.length}/{maxLength}</p>
      </div>
    </ConfirmDialog>
  );
}
