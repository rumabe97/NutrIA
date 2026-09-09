import { describe, expect, it } from 'vitest';

import { addDays, daysAway, daysToGiveBack, isAway, overlaps, problemWith } from './Vacation';

const TODAY = '2026-09-09';

describe('daysAway — both ends count', () => {
  it('counts the day of leaving and the day of coming back', () => {
    expect(daysAway({ endsOn: '2026-09-19', startsOn: '2026-09-12' })).toBe(8);
  });

  it('is one day for a trip that starts and ends the same day', () => {
    expect(daysAway({ endsOn: '2026-09-12', startsOn: '2026-09-12' })).toBe(1);
  });

  it('counts across a month, and across the end of a year', () => {
    expect(daysAway({ endsOn: '2026-11-02', startsOn: '2026-10-30' })).toBe(4);
    expect(daysAway({ endsOn: '2027-01-02', startsOn: '2026-12-30' })).toBe(4);
  });
});

describe('addDays — the shift the plan takes', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
  });

  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
  });

  it('goes backwards for a cancelled trip', () => {
    expect(addDays('2026-10-03', -5)).toBe('2026-09-28');
  });
});

describe('isAway / overlaps', () => {
  const trip = { endsOn: '2026-09-19', startsOn: '2026-09-12' };

  it('includes both ends and excludes the days either side', () => {
    expect([isAway(trip, '2026-09-11'), isAway(trip, '2026-09-12'), isAway(trip, '2026-09-19'), isAway(trip, '2026-09-20')]).toEqual([false, true, true, false]);
  });

  it('counts a single shared day as an overlap', () => {
    expect(overlaps(trip, { endsOn: '2026-09-25', startsOn: '2026-09-19' })).toBe(true);
    expect(overlaps(trip, { endsOn: '2026-09-25', startsOn: '2026-09-20' })).toBe(false);
  });
});

describe('problemWith — what a trip is refused for', () => {
  it('accepts a trip starting today', () => {
    expect(problemWith({ endsOn: '2026-09-16', startsOn: TODAY }, TODAY, [])).toBeNull();
  });

  it('refuses one that starts before today, because the past cannot be moved', () => {
    expect(problemWith({ endsOn: '2026-09-16', startsOn: '2026-09-08' }, TODAY, [])).toBe('starts-in-the-past');
  });

  it('refuses one that ends before it starts', () => {
    expect(problemWith({ endsOn: '2026-09-10', startsOn: '2026-09-12' }, TODAY, [])).toBe('ends-before-it-starts');
  });

  it('refuses a season and a day', () => {
    expect(problemWith({ endsOn: addDays(TODAY, 90), startsOn: TODAY }, TODAY, [])).toBe('too-long');
    expect(problemWith({ endsOn: addDays(TODAY, 89), startsOn: TODAY }, TODAY, [])).toBeNull();
  });

  it('refuses one that overlaps a trip already planned — two shifts for one absence', () => {
    const planned = [{ endsOn: '2026-09-19', startsOn: '2026-09-12' }];

    expect(problemWith({ endsOn: '2026-09-22', startsOn: '2026-09-18' }, TODAY, planned)).toBe('overlaps');
    expect(problemWith({ endsOn: '2026-09-22', startsOn: '2026-09-20' }, TODAY, planned)).toBeNull();
  });
});

describe('daysToGiveBack — cancelling gives back only what is unspent', () => {
  const trip = { endsOn: '2026-09-19', startsOn: '2026-09-12' };

  it('gives back the whole trip when it has not started', () => {
    expect(daysToGiveBack(trip, '2026-09-09')).toBe(8);
  });

  it('gives back only the rest when cancelled from the beach', () => {
    expect(daysToGiveBack(trip, '2026-09-15')).toBe(5);
  });

  it('gives back the last day when cancelled on it', () => {
    expect(daysToGiveBack(trip, '2026-09-19')).toBe(1);
  });

  it('gives back nothing for a trip already over', () => {
    expect(daysToGiveBack(trip, '2026-09-20')).toBe(0);
  });
});
