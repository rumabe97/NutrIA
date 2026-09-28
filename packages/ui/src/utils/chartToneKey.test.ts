import { describe, expect, it } from 'vitest';

import { chartToneKey } from './chartToneKey';

describe('chartToneKey', () => {
  it('gives a series the categorical slot of its position', () => {
    expect(chartToneKey(undefined, 0)).toBe('tone1');
    expect(chartToneKey(undefined, 5)).toBe('tone6');
  });

  it('never cycles: a seventh series is neutral', () => {
    expect(chartToneKey(undefined, 6)).toBe('toneNeutral');
    expect(chartToneKey(undefined, 11)).toBe('toneNeutral');
  });

  it('lets a pinned slot win over the position', () => {
    expect(chartToneKey(3, 0)).toBe('tone3');
  });

  it('maps the outcomes to their own tones', () => {
    expect(chartToneKey('success', 0)).toBe('toneSuccess');
    expect(chartToneKey('failure', 1)).toBe('toneFailure');
    expect(chartToneKey('neutral', 2)).toBe('toneNeutral');
  });
});
