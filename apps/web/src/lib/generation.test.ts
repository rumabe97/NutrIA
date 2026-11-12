import { describe, expect, it } from 'vitest';

import { GENERATION_DONE, GENERATION_STEPS, stagesBetween, stepsBehind } from './generation';

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

  it('counts all of them once the job has succeeded', () => {
    expect(stepsBehind(GENERATION_DONE)).toBe(GENERATION_STEPS.length);
  });
});

describe('stagesBetween', () => {
  it('names every stage passed since the last answer, the new one included', () => {
    expect(stagesBetween('CHOOSING_RECIPES', 'BUILDING_LIST')).toEqual(['SCHEDULING_MEALS', 'VALIDATING_PLAN', 'BUILDING_LIST']);
  });

  it('runs through to the end when the job succeeded', () => {
    expect(stagesBetween('CHOOSING_RECIPES', GENERATION_DONE)).toEqual([
      'SCHEDULING_MEALS',
      'VALIDATING_PLAN',
      'BUILDING_LIST',
      'SAVING_PLAN',
      GENERATION_DONE
    ]);
    expect(stagesBetween(null, GENERATION_DONE)).toEqual([...GENERATION_STEPS, GENERATION_DONE]);
  });

  it('is one stage for the next stage, and nothing for the same one, an earlier one or an unknown one', () => {
    expect(stagesBetween(null, 'LOADING_PROFILE')).toEqual(['LOADING_PROFILE']);
    expect(stagesBetween('SAVING_PLAN', 'SAVING_PLAN')).toEqual([]);
    expect(stagesBetween('SAVING_PLAN', 'CHOOSING_RECIPES')).toEqual([]);
    expect(stagesBetween('CHOOSING_RECIPES', 'SOMETHING_NEW')).toEqual([]);
  });
});
