import { describe, expect, it } from 'vitest';

import { addDays, madridDay } from './madridDay';

describe('madridDay', () => {
  it('counts the day in Spain, not in UTC', () => {
    expect(madridDay(new Date('2026-11-30T22:59:00Z'))).toBe('2026-11-30');
    expect(madridDay(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01');
  });
});

describe('addDays', () => {
  it('moves across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-20', 60)).toBe('2027-01-19');
  });
});
