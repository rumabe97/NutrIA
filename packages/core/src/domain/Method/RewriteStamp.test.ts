import { describe, expect, it } from 'vitest';

import { baseStepsVersion, needsRewrite, nextRewriteStamp, REWRITE_ATTEMPT_BOUND, stepsVersionAttempts } from 'core/domain/Method';

const CURRENT = '2.8.0';

const COMPLETE = {
  cookMinutes: 20,
  steps: [{ cue: 'until browned', minutes: 3, text: 'Sear' }, { minutes: 4, text: 'Simmer' }, { text: 'Plate' }, { text: 'Serve' }]
};
const INCOMPLETE = { cookMinutes: 20, steps: [{ minutes: 3, text: 'Sear' }, { minutes: 4, text: 'Simmer' }, { text: 'Plate' }, { text: 'Serve' }] };

describe('baseStepsVersion', () => {
  it('is the whole stamp when there is no attempt suffix', () => {
    expect(baseStepsVersion('2.8.0')).toBe('2.8.0');
    expect(baseStepsVersion(null)).toBeNull();
  });

  it('drops the attempt count', () => {
    expect(baseStepsVersion('2.8.0+2')).toBe('2.8.0');
  });
});

describe('stepsVersionAttempts', () => {
  it('is zero for a bare stamp, a null one, or one naming a different version', () => {
    expect(stepsVersionAttempts('2.8.0', CURRENT)).toBe(0);
    expect(stepsVersionAttempts(null, CURRENT)).toBe(0);
    expect(stepsVersionAttempts('2.7.0+2', CURRENT)).toBe(0);
  });

  it('reads the count once the base matches', () => {
    expect(stepsVersionAttempts('2.8.0+2', CURRENT)).toBe(2);
  });
});

describe('nextRewriteStamp', () => {
  it('starts a fresh count against the current version', () => {
    expect(nextRewriteStamp(null, CURRENT)).toBe('2.8.0+1');
    expect(nextRewriteStamp('2.7.0', CURRENT)).toBe('2.8.0+1');
  });

  it('advances the count while it is already against the current version', () => {
    expect(nextRewriteStamp('2.8.0', CURRENT)).toBe('2.8.0+1');
    expect(nextRewriteStamp('2.8.0+1', CURRENT)).toBe('2.8.0+2');
  });
});

/**
 * A recipe that keeps failing stops being claimed once it reaches
 * `REWRITE_ATTEMPT_BOUND` refusals against the current version — the bound
 * that closes the endless daily retry an unbounded claim would otherwise be.
 */
describe('needsRewrite — the retry bound', () => {
  it('keeps claiming an incomplete current-version recipe, up to the bound', () => {
    let stamp: string | null = CURRENT;

    for (let attempt = 0; attempt < REWRITE_ATTEMPT_BOUND; attempt += 1) {
      expect(needsRewrite(INCOMPLETE, stamp, CURRENT)).toBe(true);
      stamp = nextRewriteStamp(stamp, CURRENT);
    }

    // One refusal per attempt, `REWRITE_ATTEMPT_BOUND` of them recorded — the
    // sweep gives up rather than asking again tomorrow.
    expect(needsRewrite(INCOMPLETE, stamp, CURRENT)).toBe(false);
  });

  it('reopens an exhausted recipe once the standard itself moves', () => {
    const exhausted = `${CURRENT}+${REWRITE_ATTEMPT_BOUND}`;

    expect(needsRewrite(INCOMPLETE, exhausted, CURRENT)).toBe(false);
    expect(needsRewrite(INCOMPLETE, exhausted, '2.9.0')).toBe(true);
  });
});

describe('needsRewrite — what belongs in the sweep', () => {
  it('claims a recipe an older prompt wrote, or nothing did, whatever its content', () => {
    expect(needsRewrite(COMPLETE, null, CURRENT)).toBe(true);
    expect(needsRewrite(COMPLETE, '2.7.0', CURRENT)).toBe(true);
  });

  it('claims a recipe stamped with the current version if its method is still incomplete', () => {
    expect(needsRewrite(INCOMPLETE, CURRENT, CURRENT)).toBe(true);
  });

  it('never re-claims a complete recipe stamped with the current version', () => {
    expect(needsRewrite(COMPLETE, CURRENT, CURRENT)).toBe(false);
  });
});
