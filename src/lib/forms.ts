import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Path, Resolver, UseFormReturn } from 'react-hook-form';
import type { ZodType, ZodTypeDef } from 'zod';
import { toast } from 'sonner';
import { normaliseError } from '@/api/errors';

/**
 * Puts the API's `error.fields` beside their inputs, including nested paths like `lines.1.accountCode`. Returns the messages
 * that matched no field on screen, for the form's error summary.
 */
export function applyApiErrors<T extends FieldValues>(form: UseFormReturn<T, any, any>, error: unknown, knownFields?: readonly string[]): string[] {
  const apiError = normaliseError(error);
  const unmatched: string[] = [];
  const registered = knownFields ?? Object.keys(form.getValues() ?? {});
  // README §8.2: a reference already used on another record belongs on the reference field.
  if (apiError.code.endsWith('_DUPLICATE_REFERENCE') && registered.includes('reference') && !apiError.hasFieldErrors()) {
    form.setError('reference' as Path<T>, { type: 'server', message: apiError.message }, { shouldFocus: true });
    return [];
  }
  let focused = false;
  for (const [apiPath, message] of Object.entries(apiError.fieldErrors)) {
    // Forms name money and percentage inputs without the API's unit suffix: amountMinor -> amount, interestBasisPoints -> interest.
    const segments = apiPath.split('.');
    const alias = segments[0].replace(/(Minor|BasisPoints)$/, '');
    if (!registered.includes(segments[0]) && registered.includes(alias)) segments[0] = alias;
    const path = segments.join('.');
    if (registered.includes(segments[0])) {
      form.setError(path as Path<T>, { type: 'server', message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmatched.push(message);
    }
  }
  return unmatched;
}

/** Shows an error as a toast. */
export function toastError(error: unknown, fallback = 'Something went wrong.') {
  const apiError = normaliseError(error);
  if (apiError.code === 'CANCELLED') return;
  toast.error(apiError.message || fallback);
}

/** zodResolver typed for schemas whose output differs from their input (money text -> minor units). */
export function zResolver<TIn extends FieldValues, TOut>(schema: ZodType<TOut, ZodTypeDef, TIn>): Resolver<TIn, unknown, TOut> {
  return zodResolver(schema as never) as unknown as Resolver<TIn, unknown, TOut>;
}
