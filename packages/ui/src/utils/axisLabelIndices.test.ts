import { describe, expect, it } from 'vitest';

import { axisLabelIndices } from './axisLabelIndices';

describe('axisLabelIndices', () => {
  it('prints nothing for no labels and the one label there is', () => {
    expect(axisLabelIndices(0)).toEqual([]);
    expect(axisLabelIndices(1)).toEqual([{ index: 0, minor: false }]);
  });

  it('prints every label when there are few', () => {
    expect(axisLabelIndices(3).map(entry => entry.index)).toEqual([0, 1, 2]);
    expect(axisLabelIndices(3).every(entry => !entry.minor)).toBe(true);
  });

  it('always keeps the first and the last, evenly spaced between', () => {
    const indices = axisLabelIndices(90).map(entry => entry.index);
    expect(indices).toEqual([0, 15, 30, 45, 59, 74, 89]);
  });

  it('keeps only the first, the middle and the last out of the minor ones', () => {
    const labels = axisLabelIndices(30);
    expect(labels.filter(entry => !entry.minor).map(entry => entry.index)).toEqual([0, 15, 29]);
    expect(labels[0]?.minor).toBe(false);
    expect(labels.at(-1)?.minor).toBe(false);
  });

  it('picks by position when given one, so a skewed time axis keeps its labels apart', () => {
    // Four days together, then a gap: by order the middle label would sit beside the first.
    const positions = [0, 0.1, 0.2, 0.9, 1];
    const labels = axisLabelIndices(5, 3, positions);
    expect(labels.map(entry => entry.index)).toEqual([0, 4]);
    expect(axisLabelIndices(5, 5, positions).map(entry => entry.index)).toEqual([0, 2, 4]);
  });

  it('lets a phone drop a middle label that sits near an end of a time axis', () => {
    const labels = axisLabelIndices(5, 7, [0, 1 / 7, 2 / 7, 6 / 7, 1]);
    expect(labels.filter(entry => !entry.minor).map(entry => entry.index)).toEqual([0, 4]);
  });
});
