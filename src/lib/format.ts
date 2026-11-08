// Formatting rules (README §10). Money is integer minor units end to end; business dates are plain "YYYY-MM-DD" days in
// Africa/Nairobi and are never pushed through `new Date()` (which would shift them by the time zone).

export const NAIROBI = 'Africa/Nairobi';

const fractionCache = new Map<string, number>();
/** Fraction digits of a currency (KES 2, UGX 0). */
export function fractionDigits(currency: string): number {
  if (!fractionCache.has(currency)) {
    let digits = 2;
    try {
      digits = new Intl.NumberFormat('en-KE', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    fractionCache.set(currency, digits);
  }
  return fractionCache.get(currency)!;
}

/** 150050, "KES" -> "KES 1,500.50". null -> "—". */
export function formatMoney(minor: number | null | undefined, currency = 'KES', opts: { symbol?: boolean } = {}): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  const digits = fractionDigits(currency);
  const value = minor / 10 ** digits;
  try {
    if (opts.symbol === false) return value.toLocaleString('en-KE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(digits)}`;
  }
}

/** Minor units as a plain editable string: 150050 -> "1500.50", 500000 -> "5000". */
export function minorToInput(minor: number | null | undefined, currency = 'KES'): string {
  if (minor === null || minor === undefined) return '';
  const digits = fractionDigits(currency);
  const whole = Math.trunc(minor / 10 ** digits);
  const frac = Math.abs(minor % 10 ** digits);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(digits, '0').replace(/0+$/, '')}`;
}

/** "1,500.5" -> 150050. String math: no floating-point error. Throws on bad input. */
export function parseMoney(input: string, currency = 'KES'): number {
  const digits = fractionDigits(currency);
  const clean = input.replace(/[,\s]/g, '').replace(new RegExp(`^${currency}`, 'i'), '');
  if (!/^\d+(\.\d+)?$/.test(clean)) throw new Error('Enter an amount like 1500 or 1,500.50');
  const [whole, frac = ''] = clean.split('.');
  if (frac.length > digits) throw new Error(digits === 0 ? 'Whole amounts only' : `At most ${digits} decimal places`);
  return Number(whole) * 10 ** digits + Number(frac.padEnd(digits, '0') || '0');
}

/** 1250 -> "12.5%". */
export function formatBp(bp: number | null | undefined): string {
  if (bp === null || bp === undefined) return '—';
  return `${(bp / 100).toLocaleString('en-KE', { maximumFractionDigits: 2 })}%`;
}
/** "12.5" -> 1250. */
export const parsePercentToBp = (input: string | number) => Math.round(Number(input) * 100);
/** 1250 -> "12.5" for an editable percent field. */
export const bpToPercentInput = (bp: number) => String(bp / 100);

/** Today's date in Nairobi as "YYYY-MM-DD" (defaults and max on date pickers). */
export const todayNairobi = () => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(new Date());

/** Adds days to a "YYYY-MM-DD" without time-zone shifts. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** First day of this month in Nairobi. */
export const startOfMonthNairobi = () => `${todayNairobi().slice(0, 8)}01`;
/** 1 January this year in Nairobi. */
export const startOfYearNairobi = () => `${todayNairobi().slice(0, 4)}-01-01`;

/** "2026-11-08" -> "8 Nov 2026" without time-zone shifts. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Instant -> local date-time ("6 Nov 2026, 12:00"). */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Instant -> local date only. */
export function formatInstantDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Instant -> the Nairobi calendar day "YYYY-MM-DD". */
export const instantToNairobiDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(new Date(iso));

/** A licence valid-until day -> the end of that day in Nairobi as an instant: "2027-12-31" -> "2027-12-31T20:59:59Z". */
export function endOfDayNairobiInstant(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  // Nairobi is UTC+3 all year (no daylight saving).
  return new Date(Date.UTC(y, m - 1, d, 20, 59, 59)).toISOString().replace('.000Z', 'Z');
}

/** "2026-11" -> "Nov 2026"; "2026-W45" -> "Week 45, 2026". */
export function formatPeriodKey(key: string | null | undefined): string {
  if (!key) return '—';
  const week = key.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `Week ${Number(week[2])}, ${week[1]}`;
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-KE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "LOAN_APPROVAL_GIVEN" -> "Loan approval given". */
export const humanize = (code: string | null | undefined) =>
  code ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

export const fullName = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(' ') || null;

/** "#12 Jane Wanjiku" — the way members are shown everywhere (never a raw UUID). */
export function memberLabel(name: string | null | undefined, number: number | null | undefined): string {
  const n = number ? `#${number}` : '';
  return [n, name ?? 'Unknown member'].filter(Boolean).join(' ');
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-KE')} ${n === 1 ? one : many}`;
