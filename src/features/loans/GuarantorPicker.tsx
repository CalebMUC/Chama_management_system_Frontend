'use client';

import { forwardRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loansApi } from '@/api/endpoints/loans';
import type { GuarantorCandidate } from '@/api/types';
import { OptionPicker } from '@/components/shared/OptionPicker';
import { memberLabel } from '@/lib/format';

/**
 * Who may stand surety: GET /loans/guarantor-candidates (every active member except the caller, by member number). Plain
 * members don't hold MEMBER_VIEW, so the guarantor pickers use this rather than the member directory.
 */
export function useGuarantorCandidates() {
  const query = useQuery({ queryKey: ['loans', 'guarantorCandidates'], queryFn: loansApi.guarantorCandidates, staleTime: 60_000 });
  const byUserId = useMemo(() => new Map((query.data ?? []).map((c) => [c.userId, c])), [query.data]);
  return { ...query, candidates: query.data ?? [], byUserId };
}

export const candidateLabel = (c: GuarantorCandidate | undefined) => (c ? memberLabel(c.name, c.memberNumber) : 'Member');

/** Picks one guarantor. `exclude`: guarantors already chosen or already asked. */
export const GuarantorPicker = forwardRef<HTMLButtonElement, {
  value: string | null | undefined;
  onChange(userId: string | null): void;
  exclude?: (string | null | undefined)[];
  placeholder?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean;
}>(function GuarantorPicker({ value, onChange, exclude = [], placeholder = 'Choose a member', ...rest }, ref) {
  const { candidates, byUserId, isLoading, error } = useGuarantorCandidates();
  const options = useMemo(() => {
    const ex = new Set(exclude.filter(Boolean));
    return candidates
      .filter((c) => !ex.has(c.userId))
      .map((c) => ({ id: c.userId, label: candidateLabel(c), keywords: c.memberNumber ? String(c.memberNumber) : undefined }));
  }, [candidates, exclude]);
  if (error) return <p className="rounded-md border border-dashed p-2 text-sm text-muted-foreground">Couldn&apos;t load the members you can ask. Try again shortly.</p>;
  return (
    <OptionPicker
      ref={ref}
      value={value}
      onChange={onChange}
      options={options}
      selectedLabel={value ? candidateLabel(byUserId.get(value)) : undefined}
      loading={isLoading}
      placeholder={placeholder}
      searchPlaceholder="Name or member number…"
      searchLabel="Search members"
      emptyText="No members match."
      {...rest}
    />
  );
});
