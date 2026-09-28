import { describe, expect, it } from 'vitest';

import { isChartEmpty } from './isChartEmpty';

describe('isChartEmpty', () => {
  it('is empty without labels', () => {
    expect(isChartEmpty([], [{ values: [] }])).toBe(true);
  });

  it('is empty without series', () => {
    expect(isChartEmpty(['a'], [])).toBe(true);
  });

  it('is empty when every value is zero', () => {
    expect(isChartEmpty(['a', 'b'], [{ values: [0, 0] }, { values: [0, 0] }])).toBe(true);
  });

  it('is not empty when one value is above zero', () => {
    expect(isChartEmpty(['a', 'b'], [{ values: [0, 0] }, { values: [0, 3] }])).toBe(false);
  });
});
