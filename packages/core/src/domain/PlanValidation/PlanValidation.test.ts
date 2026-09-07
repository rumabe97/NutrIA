import { describe, expect, it } from 'vitest';

import { PLAN_TOLERANCE, validatePlan } from 'core/domain/PlanValidation';
import { schedulePlan, slotsFor } from 'core/domain/Scheduler';
import { makeCatalogue, makePool, TARGETS } from '#test/fixtures';

const catalogue = makeCatalogue();
const slots = slotsFor(3, false);

function scheduled(days = 14) {
  const result = schedulePlan({ catalogue, days, includesSnacks: false, mealsPerDay: 3, pool: makePool(slots), targets: TARGETS });

  if (!result.ok) {throw new Error('fixture pool should schedule');}

  return result.assignment;
}

/** 75 kg gives a ceiling of 225 g, comfortably above the 120 g target. */
const base = { expectedDays: 14, expectedSlots: slots, sex: 'female' as const, targets: TARGETS, weightKg: 75 };

describe('validatePlan', () => {
  it('passes a plan the scheduler produced', () => {
    expect(validatePlan({ ...base, assignment: scheduled() })).toEqual([]);
  });

  it('flags the wrong number of days', () => {
    const violations = validatePlan({ ...base, assignment: scheduled(10) });

    expect(violations).toContainEqual({ actual: 10, expected: 14, kind: 'wrong_day_count' });
  });

  it('flags a day whose energy is out of band', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: 3000 } } : day)) };

    expect(validatePlan({ ...base, assignment: broken })).toContainEqual(
      expect.objectContaining({ dayIndex: 1, kind: 'kcal_out_of_band', tolerance: PLAN_TOLERANCE.kcal })
    );
  });

  it('flags a day below the calorie floor, separately from the band', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: 900 } } : day)) };
    const kinds = validatePlan({ ...base, assignment: broken }).map(violation => violation.kind);

    expect(kinds).toContain('below_minimum_kcal');
    expect(kinds).toContain('kcal_out_of_band');
  });

  it('uses the higher floor for men', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: 1300 } } : day)) };

    expect(validatePlan({ ...base, assignment: broken, sex: 'female' }).some(v => v.kind === 'below_minimum_kcal')).toBe(false);
    expect(validatePlan({ ...base, assignment: broken, sex: 'male' }).some(v => v.kind === 'below_minimum_kcal')).toBe(true);
  });

  it('flags protein out of band', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, proteinG: 40 } } : day)) };

    expect(validatePlan({ ...base, assignment: broken }).some(v => v.kind === 'protein_out_of_band')).toBe(true);
  });

  it('flags a missing slot', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, meals: day.meals.slice(0, 1) } : day)) };

    expect(validatePlan({ ...base, assignment: broken }).some(v => v.kind === 'missing_slot')).toBe(true);
  });

  it('flags an empty day without also reporting every slot missing', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, meals: [] } : day)) };
    const forDayOne = validatePlan({ ...base, assignment: broken }).filter(v => 'dayIndex' in v && v.dayIndex === 1);

    expect(forDayOne).toEqual([{ dayIndex: 1, kind: 'empty_day' }]);
  });

  it('reports every violation rather than stopping at the first', () => {
    const assignment = scheduled();
    const broken = {
      days: assignment.days.map((day, index) => (index < 3 ? { ...day, totals: { ...day.totals, kcal: 3500 } } : day))
    };

    expect(validatePlan({ ...base, assignment: broken }).filter(v => v.kind === 'kcal_out_of_band')).toHaveLength(3);
  });
});

describe('validatePlan — protein has a floor, not a symmetric band', () => {
  const withProtein = (proteinG: number) => {
    const assignment = scheduled();

    return { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, proteinG } } : day)) };
  };

  const proteinViolations = (proteinG: number) =>
    validatePlan({ ...base, assignment: withProtein(proteinG) }).filter(violation => violation.kind === 'protein_out_of_band');

  it('rejects a day meaningfully short of the protein target', () => {
    expect(proteinViolations(TARGETS.proteinG * 0.8)).toHaveLength(1);
  });

  it('accepts a day well over the protein target — a surplus is not a nutritional failure', () => {
    // Two real plans were discarded this way: 204 g and then 233 g against a 171 g
    // target, both nutritionally unremarkable for the person they were built for.
    expect(proteinViolations(TARGETS.proteinG * 1.4)).toEqual([]);
  });

  it('rejects only what is implausible for the body it is feeding', () => {
    // 75 kg × 3 g/kg = 225 g. Below that is food; above it is a bug.
    expect(proteinViolations(224)).toEqual([]);
    expect(proteinViolations(240)).toHaveLength(1);
  });

  it('scales the ceiling with body mass rather than with the target', () => {
    const heavy = { ...base, weightKg: 100 };
    const assignment = withProtein(280);

    expect(validatePlan({ ...base, assignment }).some(v => v.kind === 'protein_out_of_band')).toBe(true);
    expect(validatePlan({ ...heavy, assignment }).some(v => v.kind === 'protein_out_of_band')).toBe(false);
  });

  it('accepts a day exactly on target', () => {
    expect(proteinViolations(TARGETS.proteinG)).toEqual([]);
  });

  it('keeps energy symmetric — a calorie goal is missed in both directions', () => {
    const assignment = scheduled();
    const over = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: TARGETS.kcal * 1.2 } } : day)) };
    const under = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: TARGETS.kcal * 0.8 } } : day)) };

    expect(validatePlan({ ...base, assignment: over }).some(v => v.kind === 'kcal_out_of_band')).toBe(true);
    expect(validatePlan({ ...base, assignment: under }).some(v => v.kind === 'kcal_out_of_band')).toBe(true);
  });
});
