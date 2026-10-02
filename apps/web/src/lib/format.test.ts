import { describe, expect, it } from 'vitest';

import { formatUsd, localIsoDate } from './format';

// Intl separates the amount from the symbol with a no-break space; compare on plain ones.
function plain(text: string): string {
  return text.replace(/\s/g, ' ');
}

describe('formatUsd', () => {
  it('shows cents for a dollar or more, with the narrow symbol', () => {
    expect(plain(formatUsd(12.345, 'es-ES'))).toBe('12,35 $');
    expect(plain(formatUsd(3, 'en-GB'))).toBe('$3.00');
  });

  it('keeps up to four decimals under a dollar, so a fraction of a cent never reads as free', () => {
    expect(plain(formatUsd(0.0034, 'es-ES'))).toBe('0,0034 $');
    expect(plain(formatUsd(0.5, 'en-GB'))).toBe('$0.50');
  });

  it('shows nothing spent as zero with cents', () => {
    expect(plain(formatUsd(0, 'es-ES'))).toBe('0,00 $');
  });
});

describe('localIsoDate', () => {
  it('is the day in the given time zone, not the UTC one', () => {
    const justAfterMidnightInSpain = new Date('2026-10-01T22:30:00Z');

    expect(localIsoDate(justAfterMidnightInSpain, 'Europe/Madrid')).toBe('2026-10-02');
    expect(localIsoDate(justAfterMidnightInSpain, 'UTC')).toBe('2026-10-01');
  });
});
