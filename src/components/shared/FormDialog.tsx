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
  children(form: UseFormReturn<TIn>): ReactNode;
}

/** A dialog holding one react-hook-form + zod form, with the API's errors mapped onto it. */
export function FormDialog<TIn extends FieldValues, TOut>(props: FormDialogProps<TIn, TOut>) {
  const formId = useId();
  const [messages, setMessages] = useState<string[]>([]);
  const form = useForm<TIn, unknown, TOut>({ resolver: zResolver(props.schema), defaultValues: props.defaultValues });

  useEffect(() => {
    if (props.open) {
      form.reset(props.defaultValues);
      setMessages([]);
    }
    // Reset only when opening; defaultValues is usually a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  async function submit(values: TOut) {
    setMessages([]);
    try {
      await props.onSubmit(values);
      props.onOpenChange(false);
    } catch (e) {
      const unmatched = applyApiErrors(form as unknown as UseFormReturn<FieldValues>, e);
      const apiError = normaliseError(e);
      const onField = apiError.hasFieldErrors() || !!form.getFieldState('reference' as never).error;
      setMessages(unmatched.length ? unmatched : onField ? [] : [apiError.message]);
    }
  }

  const submitting = form.formState.isSubmitting;
  return (
    <Dialog open={props.open} onOpenChange={(o) => !submitting && props.onOpenChange(o)}>
      <DialogContent size={props.size ?? 'md'}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? <DialogDescription>{props.description}</DialogDescription> : <DialogDescription className="sr-only">{props.title}</DialogDescription>}
        </DialogHeader>
        <form id={formId} onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <FormAlert messages={messages} />
          {props.children(form as unknown as UseFormReturn<TIn>)}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" disabled={submitting} onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form={formId} loading={submitting} variant={props.destructive ? 'destructive' : 'default'}>{props.submitLabel ?? 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
