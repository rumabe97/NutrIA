import { describe, expect, it } from 'vitest';

import { DEFAULT_PERIOD, periodQuerySchema, PERIODS } from 'core/entities/Period';

import {
  fillDays,
  fillWeeks,
  madridDayKey,
  madridDayKeys,
  madridMidnight,
  madridWeekKeys,
  parsePeriod,
  personDayKey,
  weekKey,
  windowFor
} from './Period';

describe('parsePeriod', () => {
  it('is 30 when nothing is asked for', () => {
    expect(parsePeriod(undefined)).toBe(30);
    expect(DEFAULT_PERIOD).toBe(30);
  });

  it('reads 7, 30 and 90', () => {
    expect(parsePeriod('7')).toBe(7);
    expect(parsePeriod('30')).toBe(30);
    expect(parsePeriod('90')).toBe(90);
    expect(PERIODS).toEqual([7, 30, 90]);
  });

  it.each([['14'], ['0'], ['-7'], ['7.0'], [' 7'], ['seven'], [''], ['1e1'], [7], [null], [['7', '30']]])('refuses %j', raw => {
    expect(parsePeriod(raw)).toBeNull();
  });

  it('is the grammar the query DTO enforces, answering a number', () => {
    expect(periodQuerySchema.parse({})).toEqual({ period: 30 });
    expect(periodQuerySchema.parse({ period: '90' })).toEqual({ period: 90 });
    expect(periodQuerySchema.safeParse({ period: '14' }).success).toBe(false);
  });
});

describe('madridDayKey', () => {
  it('is the day in Madrid, not in UTC', () => {
    // 23:30 UTC on the 14th is 01:30 on the 15th in Madrid in summer.
    expect(madridDayKey(new Date('2026-07-14T23:30:00Z'))).toBe('2026-07-15');
    // 22:59 UTC is still the 14th: 00:59 would be the 15th, 23:59 is not.
    expect(madridDayKey(new Date('2026-07-14T21:59:59Z'))).toBe('2026-07-14');
    // In winter the line is at 23:00 UTC.
    expect(madridDayKey(new Date('2026-01-14T22:59:59Z'))).toBe('2026-01-14');
    expect(madridDayKey(new Date('2026-01-14T23:00:00Z'))).toBe('2026-01-15');
  });
});

describe('personDayKey', () => {
  it("is the person's day, not UTC's, in the hours after Madrid's midnight", () => {
    // 22:30 UTC on the 2nd is 00:30 on the 3rd in Madrid in summer: day one of
    // a plan laid out on the 3rd is today, not tomorrow.
    expect(personDayKey(new Date('2026-10-02T22:30:00Z'), 'Europe/Madrid')).toBe('2026-10-03');
    expect(personDayKey(new Date('2026-10-02T21:59:59Z'), 'Europe/Madrid')).toBe('2026-10-02');
  });

  it("is Madrid's day when the profile keeps no zone", () => {
    expect(personDayKey(new Date('2026-10-02T22:30:00Z'), null)).toBe('2026-10-03');
    expect(personDayKey(new Date('2026-10-02T22:30:00Z'), undefined)).toBe('2026-10-03');
  });

  it('reads any zone the profile keeps', () => {
    expect(personDayKey(new Date('2026-10-02T22:30:00Z'), 'America/New_York')).toBe('2026-10-02');
    expect(personDayKey(new Date('2026-10-02T22:30:00Z'), 'UTC')).toBe('2026-10-02');
  });
});

describe('madridMidnight', () => {
  it('is 23:00 UTC the day before in winter and 22:00 in summer', () => {
    expect(madridMidnight('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(madridMidnight('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('is right on both sides of the March changeover (29 March 2026, 02:00 → 03:00)', () => {
    expect(madridMidnight('2026-03-29').toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(madridMidnight('2026-03-30').toISOString()).toBe('2026-03-29T22:00:00.000Z');
  });

  it('is right on both sides of the October changeover (25 October 2026, 03:00 → 02:00)', () => {
    expect(madridMidnight('2026-10-25').toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(madridMidnight('2026-10-26').toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('round-trips with the day key', () => {
    for (const day of ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26', '2026-12-31']) {
      expect(madridDayKey(madridMidnight(day))).toBe(day);
      expect(madridDayKey(new Date(madridMidnight(day).getTime() - 1))).not.toBe(day);
    }
  });
});

describe('windowFor', () => {
  it('covers today and the days before it, and the same number of whole days before that', () => {
    const now = new Date('2026-09-28T10:00:00Z');
    const window = windowFor(7, now);

    expect(window.to).toBe(now);
    expect(window.from.toISOString()).toBe('2026-09-21T22:00:00.000Z');
    expect(window.previousFrom.toISOString()).toBe('2026-09-14T22:00:00.000Z');
    expect(madridDayKeys(window.from, window.to)).toEqual([
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28'
    ]);
    expect(madridDayKeys(window.previousFrom, window.from)).toHaveLength(7);
  });

  it('starts at Madrid midnight when UTC is still on the day before', () => {
    // 23:30 UTC on the 27th is already the 28th in Madrid.
    const window = windowFor(7, new Date('2026-09-27T23:30:00Z'));

    expect(madridDayKeys(window.from, window.to).at(-1)).toBe('2026-09-28');
    expect(madridDayKeys(window.from, window.to)).toHaveLength(7);
  });

  it('keeps whole days across the March changeover: one 23-hour day inside', () => {
    const window = windowFor(7, new Date('2026-04-01T12:00:00Z'));
    const keys = madridDayKeys(window.from, window.to);

    expect(keys).toEqual(['2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01']);
    // The window starts on winter time.
    expect(window.from.toISOString()).toBe('2026-03-25T23:00:00.000Z');
    expect(madridDayKeys(window.previousFrom, window.from)).toEqual([
      '2026-03-19',
      '2026-03-20',
      '2026-03-21',
      '2026-03-22',
      '2026-03-23',
      '2026-03-24',
      '2026-03-25'
    ]);
  });

  it('keeps whole days across the October changeover: one 25-hour day inside', () => {
    const window = windowFor(7, new Date('2026-10-28T12:00:00Z'));

    expect(madridDayKeys(window.from, window.to)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28'
    ]);
    // The window starts on summer time; the previous one ends where it starts.
    expect(window.from.toISOString()).toBe('2026-10-21T22:00:00.000Z');
    expect(madridDayKeys(window.previousFrom, window.from)).toHaveLength(7);
  });

  it('gives 30 and 90 days, on the changeover day itself too', () => {
    for (const period of [30, 90] as const) {
      for (const now of ['2026-03-29T01:30:00Z', '2026-10-25T01:30:00Z', '2026-10-25T00:30:00Z']) {
        const window = windowFor(period, new Date(now));

        expect(madridDayKeys(window.from, window.to)).toHaveLength(period);
        expect(madridDayKeys(window.previousFrom, window.from)).toHaveLength(period);
        expect(madridDayKeys(window.from, window.to).at(-1)).toBe(madridDayKey(new Date(now)));
      }
    }
  });
});

describe('madridDayKeys', () => {
  it('is empty for an empty or reversed window', () => {
    const at = new Date('2026-09-28T10:00:00Z');

    expect(madridDayKeys(at, at)).toEqual([]);
    expect(madridDayKeys(at, new Date(at.getTime() - 1))).toEqual([]);
  });

  it('does not count the day a window ends exactly at the midnight of', () => {
    expect(madridDayKeys(madridMidnight('2026-09-27'), madridMidnight('2026-09-28'))).toEqual(['2026-09-27']);
  });
});

describe('fillDays', () => {
  const keys = ['2026-09-26', '2026-09-27', '2026-09-28'];

  it('lays rows on the keys, zero where nothing happened', () => {
    expect(fillDays(keys, [{ day: '2026-09-27', n: 4 }])).toEqual([0, 4, 0]);
    expect(fillDays(keys, [])).toEqual([0, 0, 0]);
  });

  it('adds rows naming the same day, and drops days outside the keys', () => {
    expect(
      fillDays(keys, [
        { day: '2026-09-26', n: 1 },
        { day: '2026-09-26', n: 2 },
        { day: '2026-09-25', n: 9 },
        { day: '2026-09-28', n: 5 }
      ])
    ).toEqual([3, 0, 5]);
  });
});

describe('weekKey', () => {
  it('names a week by its Monday', () => {
    expect(weekKey('2026-09-28')).toBe('2026-09-28');
    expect(weekKey('2026-09-27')).toBe('2026-09-21');
    expect(weekKey('2026-09-23')).toBe('2026-09-21');
  });

  it('crosses a year and a changeover as dates, not hours', () => {
    expect(weekKey('2027-01-03')).toBe('2026-12-28');
    expect(weekKey('2026-10-25')).toBe('2026-10-19');
    expect(weekKey('2026-03-29')).toBe('2026-03-23');
  });
});

describe('madridWeekKeys', () => {
  const now = new Date('2026-09-28T10:00:00Z');

  it('names every week with a day in the period, the partial ones at each end included', () => {
    const week = windowFor(7, now);
    const month = windowFor(30, now);

    expect(madridWeekKeys(week.from, week.to)).toEqual(['2026-09-21', '2026-09-28']);
    expect(madridWeekKeys(month.from, month.to)).toEqual(['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
  });

  it('is empty for an empty window', () => {
    expect(madridWeekKeys(now, now)).toEqual([]);
  });
});

describe('fillWeeks', () => {
  const weeks = ['2026-09-14', '2026-09-21', '2026-09-28'];

  it('adds each day into its week, zero where nothing happened', () => {
    expect(
      fillWeeks(weeks, [
        { day: '2026-09-21', n: 1 },
        { day: '2026-09-27', n: 2 },
        { day: '2026-09-28', n: 4 }
      ])
    ).toEqual([0, 3, 4]);
    expect(fillWeeks(weeks, [])).toEqual([0, 0, 0]);
  });

  it('drops a day whose week is not in the keys', () => {
    expect(fillWeeks(weeks, [{ day: '2026-09-13', n: 9 }])).toEqual([0, 0, 0]);
  });
});
