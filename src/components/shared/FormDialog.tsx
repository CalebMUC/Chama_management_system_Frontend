'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { ZodType, ZodTypeDef } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { normaliseError } from '@/api/errors';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { FormAlert } from './States';

interface FormDialogProps<TIn extends FieldValues, TOut> {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: ReactNode;
  /** Inputs are text (money, percentages); the schema transforms them to API values. */
  schema: ZodType<TOut, ZodTypeDef, TIn>;
  /** Re-applied every time the dialog opens. */
  defaultValues: DefaultValues<TIn>;
  /** Throw to keep the dialog open; field errors from the API land beside their inputs. */
  onSubmit(values: TOut): Promise<unknown>;
  submitLabel?: string;
  destructive?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * A review step: once the values pass validation, show this summary and wait for Confirm before onSubmit runs (money
   * movements). API errors send the user back to the fields with the errors in place.
   */
  review?: (values: TOut) => ReactNode;
  children(form: UseFormReturn<TIn>): ReactNode;
}

/** A dialog holding one react-hook-form + zod form, with the API's errors mapped onto it. */
export function FormDialog<TIn extends FieldValues, TOut>(props: FormDialogProps<TIn, TOut>) {
  const formId = useId();
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<TIn, unknown, TOut>({ resolver: zResolver(props.schema), defaultValues: props.defaultValues });
  const [pending, setPending] = useState<TOut | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (props.open) {
      form.reset(props.defaultValues);
      setMessages([]);
      setPending(null);
    }
    // Reset only when opening; defaultValues is usually a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function submit(values: TOut) {
    setMessages([]);
    if (props.review && pending === null) {
      setPending(values);
      return;
    }
    try {
      await props.onSubmit(values);
      props.onOpenChange(false);
    } catch (e) {
      setPending(null);
      const unmatched = applyApiErrors(form as unknown as UseFormReturn<FieldValues>, e);
      const apiError = normaliseError(e);
      const onField = apiError.hasFieldErrors() || !!form.getFieldState('reference' as never).error;
      setMessages(unmatched.length ? unmatched : onField ? [] : [apiError.message]);
    }
  }

  const confirm = async () => {
    if (pending === null) return;
    setConfirming(true);
    try {
      await submit(pending);
    } finally {
      setConfirming(false);
    }
  };
  const reviewing = pending !== null && !!props.review;
  const submitting = form.formState.isSubmitting || confirming;
  return (
    <Dialog open={props.open} onOpenChange={(o) => !submitting && props.onOpenChange(o)}>
      <DialogContent size={props.size ?? 'md'}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? <DialogDescription>{props.description}</DialogDescription> : <DialogDescription className="sr-only">{props.title}</DialogDescription>}
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(submit)} className={reviewing ? 'hidden' : 'space-y-4'} noValidate>
          <FormAlert messages={messages} />
          {props.children(form as unknown as UseFormReturn<TIn>)}
        </form>
        {reviewing && (
          <div className="space-y-3" aria-live="polite">
            <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Review before you confirm</p>
            {props.review!(pending as TOut)}
          </div>
        )}
        <DialogFooter>
          {reviewing ? (
            <>
              <Button variant="outline" type="button" disabled={submitting} onClick={() => setPending(null)}>Back</Button>
              <Button type="button" onClick={confirm} loading={submitting} variant={props.destructive ? 'destructive' : 'default'}>Confirm · {props.submitLabel ?? 'Save'}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" type="button" disabled={submitting} onClick={() => props.onOpenChange(false)}>Cancel</Button>
              <Button type="submit" form={formId} loading={submitting} variant={props.destructive ? 'destructive' : 'default'}>{props.review ? 'Review' : props.submitLabel ?? 'Save'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
