'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Result } from '@/api/client';
import { isStaleConflict } from '@/api/errors';
import { toastError } from '@/lib/forms';

interface Options<TData> {
  /** Query-key prefixes to invalidate on success (README §9), e.g. ['contributions', 'ledger', 'dashboard']. */
  invalidate?: string[];
  /** Success toast. Default: the server's `message` ("Approval recorded (1 of 2)"). false = none. */
  success?: string | false | ((data: TData) => string);
  /** Toast errors (default). Turn off when a dialog or form shows them. */
  toastErrors?: boolean;
  onSuccess?: (data: TData, message: string) => void;
}

/**
 * useMutation with the app's conventions: toast the server's message, invalidate the affected data, and on a stale conflict
 * (someone else acted first) refetch so the record's actions re-render.
 */
export function useApiMutation<TVars, TData>(fn: (vars: TVars) => Promise<Result<TData>>, opts: Options<TData> = {}) {
  const qc = useQueryClient();
  const invalidate = () => Promise.all((opts.invalidate ?? []).map((k) => qc.invalidateQueries({ queryKey: [k] })));
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await invalidate();
      const message = typeof opts.success === 'function' ? opts.success(result.data) : opts.success === undefined ? result.message : opts.success;
      if (message) toast.success(message);
      opts.onSuccess?.(result.data, result.message);
    },
    onError: (error) => {
      if (isStaleConflict(error)) void invalidate();
      if (opts.toastErrors !== false) toastError(error);
    },
  });
}
