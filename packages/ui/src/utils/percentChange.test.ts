import { describe, expect, it } from 'vitest';

import { percentChange } from './percentChange';

describe('percentChange', () => {
  it('is the change as a fraction of the previous figure', () => {
    expect(percentChange(112, 100)).toBeCloseTo(0.12);
    expect(percentChange(75, 100)).toBeCloseTo(-0.25);
    expect(percentChange(40, 40)).toBe(0);
  });

  it('is null when there was nothing before', () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
