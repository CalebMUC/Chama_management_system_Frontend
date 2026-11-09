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

const NBSP = ' ';
const MINUS = '−';

/** The figure without currency or sign: 150050 -> "1,500.50" (KES), 5000 -> "5,000" (UGX). */
export function formatFigure(minor: number, currency = 'KES'): string {
  const digits = fractionDigits(currency);
  return (Math.abs(minor) / 10 ** digits).toLocaleString('en-KE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * 150050, "KES" -> "KES 1,500.50" (ISO code, as on bank statements; a no-break space keeps it on one line). Negative amounts
 * take a minus sign. null -> "—". `symbol: false` gives the figure alone.
 */
export function formatMoney(minor: number | null | undefined, currency = 'KES', opts: { symbol?: boolean } = {}): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  const sign = minor < 0 ? MINUS : '';
  if (opts.symbol === false) return `${sign}${formatFigure(minor, currency)}`;
  return `${sign}${currency}${NBSP}${formatFigure(minor, currency)}`;
}

/** 2_099_450 (major units) -> "2.10M"; under 100,000 the whole figure with separators. Rounded half away from zero. */
export function compactFigure(major: number): string {
  const abs = Math.abs(major);
  if (abs < 100_000) return abs.toLocaleString('en-KE', { maximumFractionDigits: 0 });
  const units: [number, string, number][] = [[1e3, 'K', 1], [1e6, 'M', 2], [1e9, 'B', 2], [1e12, 'T', 2]];
  for (let i = 0; i < units.length; i++) {
    const [size, suffix, decimals] = units[i];
    const next = units[i + 1];
    if (next && abs >= next[0]) continue;
    const scaled = (abs / size).toFixed(decimals);
    // 999,999.6 would round to "1000.0K": promote it to the next unit ("1.00M").
    if (next && Number(scaled) >= 1000) continue;
    return `${scaled}${suffix}`;
  }
  return abs.toLocaleString('en-KE', { maximumFractionDigits: 0 });
}

/**
 * KPI tiles: 209945000, "KES" -> "KES 2.10M". Under 100,000 the exact amount is short enough to show in full ("KES 9,250.00").
 * Pair it with the exact amount in a tooltip and aria-label (the Amount component does).
 */
export function formatCompactMoney(minor: number | null | undefined, currency = 'KES'): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '—';
  const major = Math.abs(minor) / 10 ** fractionDigits(currency);
  const figure = major < 100_000 ? formatFigure(minor, currency) : compactFigure(major);
  return `${minor < 0 ? MINUS : ''}${currency}${NBSP}${figure}`;
}

/** "UMJ-DEP-000007" -> "•••• 0007": the last four characters, for account numbers on shared screens. */
export function maskIdentifier(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  const tail = value.replace(/[^A-Za-z0-9]/g, '').slice(-visible);
  return `••••${NBSP}${tail}`;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = (n: number) => String(n).padStart(2, '0');

/**
 * The one display format for dates: "09 Nov 2026". Built by hand so every browser shows the same thing (locales disagree on
 * "Sep" and "Sept" and on day padding).
 */
const dayText = (y: number, m: number, d: number) => `${two(d)} ${MONTHS[m - 1]} ${y}`;

/** "2026-11-08" -> "08 Nov 2026" without time-zone shifts. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d || m > 12) return iso;
  return dayText(y, m, d);
}

/** An instant's parts in the browser's time zone (as before), as numbers. */
function localParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), min: d.getMinutes() };
}

/** Instant -> local date and 24-hour time: "09 Nov 2026, 13:15". */
export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = localParts(iso);
  return p ? `${dayText(p.y, p.m, p.d)}, ${two(p.h)}:${two(p.min)}` : iso;
}

/** Instant -> local date only: "09 Nov 2026". */
export function formatInstantDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = localParts(iso);
  return p ? dayText(p.y, p.m, p.d) : iso;
}

/** Instant -> local 24-hour time only: "13:15". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const p = localParts(iso);
  return p ? `${two(p.h)}:${two(p.min)}` : iso;
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
  if (!y || !m || m > 12) return key;
  return `${MONTHS[m - 1]} ${y}`;
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

/** Whole days from one business date to another ("YYYY-MM-DD"), without time-zone shifts: daysBetween('2026-11-09', '2026-11-30') = 21. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** "in 21 days", "tomorrow", "today", "3 days overdue" for a due date, counted from today in Nairobi. */
export function dueIn(iso: string, today = todayNairobi()): string {
  const n = daysBetween(today, iso);
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  if (n > 1) return `in ${n} days`;
  return `${-n} day${n === -1 ? '' : 's'} overdue`;
}
