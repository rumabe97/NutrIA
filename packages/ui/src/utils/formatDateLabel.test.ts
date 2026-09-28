import { describe, expect, it } from 'vitest';

import { formatDateLabel } from './formatDateLabel';

describe('formatDateLabel', () => {
  it('formats a day in the locale given', () => {
    expect(formatDateLabel('2026-09-28', 'en-GB')).toBe('28 Sept');
    expect(formatDateLabel('2026-09-28', 'es-ES')).toBe('28 sept');
  });

  it('takes other formatting options', () => {
    expect(formatDateLabel('2026-09-28', 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })).toBe('28 September 2026');
  });

  it('keeps the calendar day whatever the zone the code runs in', () => {
    // Formatting is pinned to UTC, so the day is the same here as in Madrid or New York.
    const inNewYork = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'America/New_York' }).format(
      Date.parse('2026-09-28T00:00:00Z')
    );
    expect(inNewYork).toBe('27 Sept');
    expect(formatDateLabel('2026-09-28', 'en-GB')).toBe('28 Sept');
  });

  it('returns anything that is not an ISO day unchanged', () => {
    expect(formatDateLabel('Semana 3', 'es-ES')).toBe('Semana 3');
    expect(formatDateLabel('2026-13-45', 'es-ES')).toBe('2026-13-45');
  });
});
