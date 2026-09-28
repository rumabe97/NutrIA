import { describe, expect, it } from 'vitest';

import { linearScale } from './linearScale';

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const scale = linearScale([0, 100], [0, 1000]);
    expect(scale(0)).toBe(0);
    expect(scale(25)).toBe(250);
    expect(scale(100)).toBe(1000);
  });

  it('inverts a range that runs backwards, as a y axis does', () => {
    const scale = linearScale([0, 50], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(50)).toBe(0);
    expect(scale(25)).toBe(100);
  });

  it('maps everything to the start of the range when the domain has no width', () => {
    expect(linearScale([5, 5], [10, 90])(5)).toBe(10);
  });
});
