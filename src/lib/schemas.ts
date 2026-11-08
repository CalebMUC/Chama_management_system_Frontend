import { z } from 'zod';
import { parseMoney, todayNairobi } from './format';

// Client validation mirroring the server (README §7.1). The server still validates; its field errors are mapped too.

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .refine((v) => !encoder || encoder.encode(v).length <= 72, 'Too long (at most 72 bytes)')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use at least one letter and one digit');

/** 0712345678, 712345678, 254712345678, +254712345678 (spaces/dashes allowed), or any +<country code> number. */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter a phone number')
  .max(20, 'At most 20 characters')
  .refine((v) => {
    const s = v.replace(/[\s-]/g, '');
    return /^(?:\+?254|0)?[17]\d{8}$/.test(s) || /^\+\d{7,15}$/.test(s);
  }, 'Enter a phone number like 0712 345 678');

export const emailSchema = z.string().trim().min(1, 'Enter an email address').max(255).email('Enter a valid email address');

export const requiredText = (max: number, message = 'Required') => z.string().trim().min(1, message).max(max, `At most ${max} characters`);
export const optionalText = (max: number) => z.string().trim().max(max, `At most ${max} characters`).optional().or(z.literal(''));

/** A money field typed as text; the parsed value is integer minor units. */
export function moneySchema(currency: string, opts: { allowZero?: boolean; max?: number; maxMessage?: string } = {}) {
  return z.string().trim().min(1, 'Enter an amount').transform((v, ctx) => {
    try {
      const minor = parseMoney(v, currency);
      if (!opts.allowZero && minor <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be more than 0' });
        return z.NEVER;
      }
      if (opts.max !== undefined && minor > opts.max) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: opts.maxMessage ?? 'Too much' });
        return z.NEVER;
      }
      return minor;
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
      return z.NEVER;
    }
  });
}

/** A percentage typed as text ("12.5"), parsed to basis points (1250). */
export function percentSchema(min = 0, max = 100) {
  return z.string().trim().min(1, 'Enter a percentage').transform((v, ctx) => {
    const n = Number(v);
    if (!/^\d+(\.\d{1,2})?$/.test(v) || n < min || n > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter ${min}–${max}, up to 2 decimals` });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });
}

export const intSchema = (min: number, max: number) =>
  z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Whole numbers only').min(min, `At least ${min}`).max(max, `At most ${max}`);

/** "Not in the future" business dates. */
export const pastDateSchema = z
  .string()
  .min(1, 'Pick a date')
  .refine((v) => v <= todayNairobi(), 'Cannot be in the future');

/** Payment method + reference: the reference is required for Bank and M-Pesa (README §8.2). */
export const paymentShape = {
  method: z.enum(['CASH', 'BANK', 'MPESA']),
  reference: z.string().trim().max(100, 'At most 100 characters').optional().or(z.literal('')),
};

export function requireReference<T extends { method: string; reference?: string }>(v: T, ctx: z.RefinementCtx) {
  if ((v.method === 'BANK' || v.method === 'MPESA') && !v.reference?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reference'], message: v.method === 'MPESA' ? 'Enter the M-Pesa code' : 'Enter the bank slip number' });
  }
}

/** M-Pesa codes are shown uppercase. */
export const normaliseReference = (method: string, ref?: string) => {
  const t = ref?.trim();
  if (!t) return undefined;
  return method === 'MPESA' ? t.toUpperCase() : t;
};
