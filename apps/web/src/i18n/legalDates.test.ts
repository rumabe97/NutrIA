import { describe, expect, it } from 'vitest';

import { practicesOpenAhead } from './legalDates';

describe('practicesOpenAhead', () => {
  it('shows no line while no day is set', () => {
    expect(practicesOpenAhead(null, new Date('2026-11-20T10:00:00Z'))).toBeNull();
  });

  it('shows the line while the day is ahead', () => {
    expect(practicesOpenAhead('2026-12-01', new Date('2026-11-20T10:00:00Z'))).toBe('2026-12-01');
    expect(practicesOpenAhead('2026-12-01', new Date('2026-11-30T22:59:00Z'))).toBe('2026-12-01');
  });

  it('shows no line from that day on, by the day in Spain', () => {
    // 23:30 UTC on 30 November is already 1 December in Madrid.
    expect(practicesOpenAhead('2026-12-01', new Date('2026-11-30T23:30:00Z'))).toBeNull();
    expect(practicesOpenAhead('2026-12-01', new Date('2026-12-01T10:00:00Z'))).toBeNull();
    expect(practicesOpenAhead('2026-12-01', new Date('2027-01-15T10:00:00Z'))).toBeNull();
  });
});
