import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { addDays, todayNairobi } from './format';
import { moneySchema, normaliseReference, passwordSchema, pastDateSchema, paymentShape, percentSchema, phoneSchema, requireReference } from './schemas';

describe('passwordSchema', () => {
  it('needs 8–72 characters with a letter and a digit', () => {
    expect(passwordSchema.safeParse('abcdefg1').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('a1').success).toBe(false);
    expect(passwordSchema.safeParse(`a1${'x'.repeat(71)}`).success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it.each(['0712345678', '712345678', '254712345678', '+254712345678', '0712 345 678', '0712-345-678', '+447911123456'])('accepts %s', (p) => {
    expect(phoneSchema.safeParse(p).success).toBe(true);
  });
  it.each(['12345', 'abc', '07123'])('rejects %s', (p) => {
    expect(phoneSchema.safeParse(p).success).toBe(false);
  });
});

describe('moneySchema', () => {
  it('outputs minor units', () => {
    expect(moneySchema('KES').parse('1,500.50')).toBe(150050);
  });
  it('rejects zero unless allowed, and amounts over the maximum', () => {
    expect(moneySchema('KES').safeParse('0').success).toBe(false);
    expect(moneySchema('KES', { allowZero: true }).parse('0')).toBe(0);
    const r = moneySchema('KES', { max: 1000, maxMessage: 'Too much' }).safeParse('10.01');
    expect(r.success).toBe(false);
  });
});

describe('percentSchema', () => {
  it('outputs basis points within range', () => {
    expect(percentSchema().parse('12.5')).toBe(1250);
    expect(percentSchema().safeParse('101').success).toBe(false);
    expect(percentSchema().safeParse('1.234').success).toBe(false);
  });
});

describe('pastDateSchema', () => {
  it('allows today and refuses tomorrow (Nairobi)', () => {
    expect(pastDateSchema.safeParse(todayNairobi()).success).toBe(true);
    expect(pastDateSchema.safeParse(addDays(todayNairobi(), 1)).success).toBe(false);
  });
});

describe('payment reference (README §8.2)', () => {
  const schema = z.object(paymentShape).superRefine(requireReference);
  it('is required for Bank and M-Pesa only', () => {
    expect(schema.safeParse({ method: 'CASH', reference: '' }).success).toBe(true);
    expect(schema.safeParse({ method: 'MPESA', reference: '' }).success).toBe(false);
    expect(schema.safeParse({ method: 'BANK', reference: ' ' }).success).toBe(false);
    expect(schema.safeParse({ method: 'BANK', reference: 'SLIP-1' }).success).toBe(true);
  });
  it('uppercases M-Pesa codes and drops empty references', () => {
    expect(normaliseReference('MPESA', ' qk7h2xy9zb ')).toBe('QK7H2XY9ZB');
    expect(normaliseReference('BANK', 'slip-9')).toBe('slip-9');
    expect(normaliseReference('CASH', '  ')).toBeUndefined();
  });
});
