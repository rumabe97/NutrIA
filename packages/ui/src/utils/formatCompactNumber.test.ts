import { describe, expect, it } from 'vitest';

import { formatCompactNumber } from './formatCompactNumber';

// Intl separates some units with a no-break space; compare on plain spaces.
function plain(text: string) {
  return text.replace(/\s/g, ' ');
}

describe('formatCompactNumber', () => {
  it('leaves small numbers alone', () => {
    expect(formatCompactNumber(0, 'en-GB')).toBe('0');
    expect(formatCompactNumber(640, 'en-GB')).toBe('640');
    expect(formatCompactNumber(2.25, 'en-GB')).toBe('2.3');
  });

  it('shortens thousands and millions in the locale given', () => {
    // ICU versions disagree on the case of the suffix in en-GB.
    expect(formatCompactNumber(1200, 'en-GB')).toMatch(/^1\.2k$/i);
    expect(formatCompactNumber(3_000_000, 'en-GB')).toMatch(/^3m$/i);
    expect(plain(formatCompactNumber(1200, 'es-ES'))).toBe('1,2 mil');
    expect(plain(formatCompactNumber(3_000_000, 'es-ES'))).toBe('3 M');
  });
});
