/**
 * Calendar-date helpers on plain "YYYY-MM-DD" strings. Business dates
 * (due dates, value dates) are calendar dates in the tenant's timezone, so
 * they are handled without times to avoid DST/UTC drift.
 */
export type Frequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly';

export const PERIODS_PER_YEAR: Record<Frequency, number> = {
  daily: 365,
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

function parse(date: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parse(date);
  return fmt(utc(y, m, d + days));
}

/** Adds calendar months, clamping to the last day of shorter months (31 Jan + 1M = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parse(date);
  const targetMonthIndex = m - 1 + months;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return fmt(new Date(Date.UTC(ty, tm, Math.min(d, lastDay))));
}

/** Due date of instalment k (1-based) counted from the value date. */
export function dueDate(start: string, frequency: Frequency, k: number): string {
  switch (frequency) {
    case 'daily':
      return addDays(start, k);
    case 'weekly':
      return addDays(start, 7 * k);
    case 'fortnightly':
      return addDays(start, 14 * k);
    case 'monthly':
      return addMonths(start, k);
  }
}

export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((utc(b.y, b.m, b.d).getTime() - utc(a.y, a.m, a.d).getTime()) / 86_400_000);
}

/** Today's calendar date in an IANA timezone, e.g. Africa/Lusaka. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
