import { describe, expect, it } from 'vitest';

import { niceTicks } from './niceTicks';

describe('niceTicks', () => {
  it('covers the range with round steps from zero', () => {
    expect(niceTicks(0, 87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(0, 9)).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceTicks(0, 1234)).toEqual([0, 500, 1000, 1500]);
  });

  it('ends on a tick at or above the maximum, so the last tick is the top of the scale', () => {
    for (const max of [1, 3, 7, 19, 42, 99, 101, 950, 12_345]) {
      const ticks = niceTicks(0, max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });

  it('spaces the ticks evenly', () => {
    const ticks = niceTicks(0, 640);
    const steps = ticks.slice(1).map((tick, index) => tick - (ticks[index] ?? 0));
    expect(new Set(steps).size).toBe(1);
  });

  it('keeps small decimal steps exact', () => {
    expect(niceTicks(0, 0.3)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('still gives a scale when every value is zero', () => {
    expect(niceTicks(0, 0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(0, 0, 4, true)).toEqual([0, 1]);
  });

  it('keeps whole steps for counts', () => {
    expect(niceTicks(0, 1, 4, true)).toEqual([0, 1]);
    expect(niceTicks(0, 3, 4, true)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(0, 9, 4, true)).toEqual([0, 3, 6, 9]);
  });

  it('honours a minimum other than zero', () => {
    expect(niceTicks(20, 80, 3)).toEqual([20, 40, 60, 80]);
  });
});
