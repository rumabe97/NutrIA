import { CONSOLE_TIME_ZONE, periodSchema } from 'core/entities/Period';

import type { Period, PeriodWindow } from 'core/entities/Period';

/**
 * What a console period means (`0068`), with no I/O: the window it covers, the
 * period before it, the calendar days in `Europe/Madrid`, and a day with nothing
 * in it as a zero rather than a missing point.
 *
 * No timezone library. `Intl` already knows Madrid's rules, and Madrid's
 * midnight is never skipped nor repeated: both changeovers happen at 01:00 UTC
 * (02:00 → 03:00 in late March, 03:00 → 02:00 in late October), so every
 * calendar day has exactly one first instant — 23 hours long in March and
 * 25 in October, which is why days are walked as dates and never as 24-hour steps.
 */

/** One day and how many things happened in it, as a grouped query returns it. */
export type DayCount = { readonly day: string; readonly n: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const madridDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: CONSOLE_TIME_ZONE,
  year: 'numeric'
});

/** The wall-clock fields of an instant in Madrid. */
function madridFields(instant: Date): { day: number; hour: number; minute: number; month: number; second: number; year: number } {
  const parts = Object.fromEntries(madridDate.formatToParts(instant).map(part => [part.type, part.value]));

  return {
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    second: Number(parts.second),
    year: Number(parts.year)
  };
}

/** How far ahead of UTC Madrid's clock is at an instant, in milliseconds: one hour or two. */
function madridOffset(instant: Date): number {
  const { day, hour, minute, month, second, year } = madridFields(instant);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);

  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** A calendar day moved by a number of days, as `YYYY-MM-DD`. Date arithmetic only, so no DST. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * `?period=` read into a period: absent is the default (30), and anything but
 * `7`, `30` or `90` is null. The same grammar the API's query DTO enforces,
 * so a page reading its own URL agrees with the route it calls.
 */
export function parsePeriod(raw: unknown): Period | null {
  const parsed = periodSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
}

/** The Madrid calendar day an instant falls on, as `YYYY-MM-DD`. */
export function madridDayKey(instant: Date): string {
  const { day, month, year } = madridFields(instant);

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The first instant of a Madrid calendar day.
 *
 * Midnight UTC minus the offset in force at that midnight. The offset is read
 * twice because the first guess is taken at the wrong instant; on a changeover
 * day the second read is the one in force at 00:00, which is always before the
 * 01:00 UTC switch.
 */
export function madridMidnight(day: string): Date {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  const guess = utcMidnight - madridOffset(new Date(utcMidnight));

  return new Date(utcMidnight - madridOffset(new Date(guess)));
}

/**
 * The window a period covers at `now`, and the one before it.
 *
 * The current period is today and the `period − 1` days before it, from the
 * first of those days' midnight up to `now`. The previous period is the
 * `period` whole days before that. Days, not multiples of 24 hours: a period
 * across a changeover is an hour shorter or longer, and still 7, 30 or 90 days.
 */
export function windowFor(period: Period, now: Date): PeriodWindow {
  const today = madridDayKey(now);

  return { from: madridMidnight(shiftDay(today, 1 - period)), previousFrom: madridMidnight(shiftDay(today, 1 - 2 * period)), to: now };
}

/**
 * Every Madrid calendar day that has an instant in `[from, to)`, oldest first.
 * The keys the SQL groups by, so a chart's axis is the period's days whether
 * or not anything happened on them.
 */
export function madridDayKeys(from: Date, to: Date): readonly string[] {
  if (to.getTime() <= from.getTime()) {
    return [];
  }

  const last = madridDayKey(new Date(to.getTime() - 1));
  const keys: string[] = [];

  for (let day = madridDayKey(from); day <= last; day = shiftDay(day, 1)) {
    keys.push(day);
  }

  return keys;
}

/**
 * A grouped query's rows laid on the period's days: one value per key, in the
 * keys' order, zero where no row names the day. A row for a day outside the
 * keys is dropped — the window decides what is shown, not what the query found.
 */
export function fillDays(keys: readonly string[], rows: readonly DayCount[]): readonly number[] {
  const byDay = new Map<string, number>();

  for (const row of rows) {
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.n);
  }

  return keys.map(key => byDay.get(key) ?? 0);
}

/**
 * The ISO week a calendar day belongs to, named by its Monday as `YYYY-MM-DD`.
 * Date arithmetic on the day's own key, so no zone and no DST enters: a Madrid
 * day is already a Madrid day.
 */
export function weekKey(day: string): string {
  // Sunday is 0 and Saturday 6, so Monday is 0 days back and Sunday 6.
  const back = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;

  return shiftDay(day, -back);
}

/**
 * Every ISO week with a Madrid day in `[from, to)`, by its Monday, oldest
 * first. The first week can start before `from` and the last runs past `to`:
 * a week is named whole and counted only over the period's days.
 */
export function madridWeekKeys(from: Date, to: Date): readonly string[] {
  return [...new Set(madridDayKeys(from, to).map(weekKey))];
}

/**
 * A per-day grouped query folded into weeks: one value per week key, in the
 * keys' order, zero where nothing happened. A day outside the weeks is dropped,
 * as `fillDays` drops one outside the days.
 */
export function fillWeeks(weeks: readonly string[], rows: readonly DayCount[]): readonly number[] {
  return fillDays(
    weeks,
    rows.map(row => ({ day: weekKey(row.day), n: row.n }))
  );
}
