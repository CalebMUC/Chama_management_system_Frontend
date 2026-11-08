import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ApiError, toFormPath } from '@/api/errors';
import { applyApiErrors } from './forms';

describe('toFormPath', () => {
  it('converts API paths to react-hook-form paths', () => {
    expect(toFormPath('lines[1].accountCode')).toBe('lines.1.accountCode');
    expect(toFormPath('chama.admin.email')).toBe('chama.admin.email');
  });
});

describe('applyApiErrors', () => {
  it('puts field errors beside their inputs, including nested and suffixed names', () => {
    const { result } = renderHook(() => useForm({ defaultValues: { amount: '', lines: [{ accountCode: '' }, { accountCode: '' }] } }));
    const error = new ApiError(400, 'VALIDATION_FAILED', 'Check the form.', [
      { field: 'amountMinor', message: 'Must be more than 0' },
      { field: 'lines[1].accountCode', message: 'Unknown account' },
      { field: 'somethingElse', message: 'Not on screen' },
    ]);
    let unmatched: string[] = [];
    act(() => { unmatched = applyApiErrors(result.current, error); });
    expect(result.current.getFieldState('amount').error?.message).toBe('Must be more than 0');
    expect(result.current.getFieldState('lines.1.accountCode').error?.message).toBe('Unknown account');
    expect(unmatched).toEqual(['Not on screen']);
  });

  it('puts a duplicate reference on the reference field (README §8.2)', () => {
    const { result } = renderHook(() => useForm({ defaultValues: { reference: 'QK7H2XY9ZB', method: 'MPESA' } }));
    const error = new ApiError(409, 'LOAN_DUPLICATE_REFERENCE', 'That M-Pesa code was already used.');
    let unmatched: string[] = ['x'];
    act(() => { unmatched = applyApiErrors(result.current, error); });
    expect(unmatched).toEqual([]);
    expect(result.current.getFieldState('reference').error?.message).toBe('That M-Pesa code was already used.');
  });
});
