import { describe, expect, it } from 'vitest';

import { GENERATION_STEPS, stepsBehind } from './generation';

describe('stepsBehind', () => {
  it('counts nothing before the job reports a stage', () => {
    expect(stepsBehind(null)).toBe(0);
  });

  it('counts every stage before the one reported', () => {
    expect(stepsBehind('LOADING_PROFILE')).toBe(0);
    expect(stepsBehind('SCHEDULING_MEALS')).toBe(2);
    expect(stepsBehind('SAVING_PLAN')).toBe(GENERATION_STEPS.length - 1);
  });

  it('never runs ahead on a stage it does not know', () => {
    expect(stepsBehind('SOMETHING_NEW')).toBe(0);
  });
});
