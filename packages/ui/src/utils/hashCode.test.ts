import { describe, expect, it } from 'vitest';

import { hashCode } from './hashCode';

describe('hashCode', () => {
  it('returns 0 for an empty string', () => {
    expect(hashCode('')).toBe(0);
  });

  it('is deterministic — same input always yields the same output', () => {
    expect(hashCode('Pablo')).toBe(hashCode('Pablo'));
    expect(hashCode('the quick brown fox')).toBe(hashCode('the quick brown fox'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashCode('a')).not.toBe(hashCode('b'));
    expect(hashCode('Pablo')).not.toBe(hashCode('pablo'));
  });

  it('always returns a non-negative integer', () => {
    const samples = ['', 'a', 'Pablo', '###', 'a very long string with spaces and 🚀 unicode', '\\n\\t'];

    for (const s of samples) {
      const result = hashCode(s);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it('handles unicode characters without throwing', () => {
    expect(() => hashCode('🚀✨')).not.toThrow();
    expect(hashCode('🚀')).not.toBe(hashCode('✨'));
  });
});
