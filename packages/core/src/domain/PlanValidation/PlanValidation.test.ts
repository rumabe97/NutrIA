import { describe, expect, it } from 'vitest';

import { isBlocking, PLAN_TOLERANCE, validatePlan } from 'core/domain/PlanValidation';
import { schedulePlan } from 'core/domain/Scheduler';
import { shapeFor, slotsIn, weightsFor } from 'core/domain/MealShape';
import { makeCatalogue, makePool, TARGETS } from '#test/fixtures';
import type { PlanAssignment } from 'core/entities/Plan';

const catalogue = makeCatalogue();
const slots = slotsIn(shapeFor(3, false));

function scheduled(days = 14) {
  const result = schedulePlan({ catalogue, days, pool: makePool(slots), targets: TARGETS, weights: weightsFor(shapeFor(3, false)) });

  if (!result.ok) {
    throw new Error('fixture pool should schedule');
  }

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

  it('flags a day short of the protein target', () => {
    const assignment = scheduled();
    const broken = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, proteinG: 40 } } : day)) };

    expect(validatePlan({ ...base, assignment: broken }).some(v => v.kind === 'protein_below_target')).toBe(true);
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
    const broken = { days: assignment.days.map((day, index) => (index < 3 ? { ...day, totals: { ...day.totals, kcal: 3500 } } : day)) };

    expect(validatePlan({ ...base, assignment: broken }).filter(v => v.kind === 'kcal_out_of_band')).toHaveLength(3);
  });
});

describe('validatePlan — protein has a band both ways, and only the ceiling blocks (0048)', () => {
  const withProtein = (proteinG: number) => {
    const assignment = scheduled();

    return { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, proteinG } } : day)) };
  };

  const proteinViolations = (proteinG: number) =>
    validatePlan({ ...base, assignment: withProtein(proteinG) }).filter(violation => violation.kind.startsWith('protein_'));
  const kindsAt = (proteinG: number) => proteinViolations(proteinG).map(violation => violation.kind);

  it('rejects a day meaningfully short of the protein target', () => {
    expect(proteinViolations(TARGETS.proteinG * 0.8)).toHaveLength(1);
  });

  it('reports a day over the protein band as guidance, never as a reason to discard the plan', () => {
    // Two real plans were once discarded for a surplus — 204 g and then 233 g
    // against a 171 g target — so a surplus stays advisory. But a day 17% over
    // is not a day on target, and a real plan ran that way on nine days of
    // fourteen with nothing reporting it.
    const over = proteinViolations(TARGETS.proteinG * 1.4);

    expect(over.map(violation => violation.kind)).toEqual(['protein_above_target']);
    expect(over.some(isBlocking)).toBe(false);
  });

  it('holds protein to five per cent on either side of the target', () => {
    expect(kindsAt(TARGETS.proteinG * 1.04)).toEqual([]);
    expect(kindsAt(TARGETS.proteinG * 0.96)).toEqual([]);
    expect(kindsAt(TARGETS.proteinG * 1.06)).toEqual(['protein_above_target']);
    expect(kindsAt(TARGETS.proteinG * 0.94)).toEqual(['protein_below_target']);
  });

  it('blocks only what is implausible for the body it is feeding, and says so once', () => {
    // 75 kg × 3 g/kg = 225 g. Below that is food, over the band; above it is a bug.
    expect(kindsAt(224)).toEqual(['protein_above_target']);
    expect(kindsAt(240)).toEqual(['protein_above_ceiling']);
  });

  it('scales the ceiling with body mass rather than with the target', () => {
    const heavy = { ...base, weightKg: 100 };
    const assignment = withProtein(280);

    expect(validatePlan({ ...base, assignment }).some(v => v.kind === 'protein_above_ceiling')).toBe(true);
    expect(validatePlan({ ...heavy, assignment }).some(v => v.kind === 'protein_above_ceiling')).toBe(false);
  });

  it('accepts a day exactly on target', () => {
    expect(proteinViolations(TARGETS.proteinG)).toEqual([]);
  });

  it('keeps energy symmetric — a calorie goal is missed in both directions', () => {
    const assignment = scheduled();
    const over = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: TARGETS.kcal * 1.2 } } : day)) };
    const under = {
      days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, kcal: TARGETS.kcal * 0.8 } } : day))
    };

    expect(validatePlan({ ...base, assignment: over }).some(v => v.kind === 'kcal_out_of_band')).toBe(true);
    expect(validatePlan({ ...base, assignment: under }).some(v => v.kind === 'kcal_out_of_band')).toBe(true);
  });
});

describe('validatePlan — carbs and fat have bands too (0045)', () => {
  const withTotals = (totals: Partial<PlanAssignment['days'][number]['totals']>) => {
    const assignment = scheduled();

    return { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, ...totals } } : day)) };
  };

  const kinds = (assignment: PlanAssignment) => validatePlan({ ...base, assignment }).map(violation => violation.kind);

  /*
   * The gap this closes: a real plan missed carbohydrate by 46% and overshot fat
   * by 75% on every day of a fortnight and passed, because nothing here asked.
   */
  it('flags a day whose carbohydrate is out of band, in both directions', () => {
    expect(kinds(withTotals({ carbsG: TARGETS.carbsG * 0.8 }))).toContain('carbs_out_of_band');
    expect(kinds(withTotals({ carbsG: TARGETS.carbsG * 1.2 }))).toContain('carbs_out_of_band');
  });

  it('flags a day whose fat is out of band, in both directions', () => {
    expect(kinds(withTotals({ fatG: TARGETS.fatG * 0.8 }))).toContain('fat_out_of_band');
    expect(kinds(withTotals({ fatG: TARGETS.fatG * 1.2 }))).toContain('fat_out_of_band');
  });

  it('holds every band to the same five per cent', () => {
    // Just inside on every macro at once: nothing to report.
    const inside = withTotals({
      carbsG: TARGETS.carbsG * 1.04,
      fatG: TARGETS.fatG * 0.96,
      kcal: TARGETS.kcal * 1.04,
      proteinG: TARGETS.proteinG * 0.96
    });
    // Just outside on one: exactly one report, and it names the right macro.
    const outside = withTotals({ fatG: TARGETS.fatG * 1.06 });

    expect(kinds(inside).filter(kind => kind.endsWith('_out_of_band') || kind === 'protein_below_target' || kind === 'protein_above_target')).toEqual(
      []
    );
    expect(kinds(outside).filter(kind => kind.endsWith('_out_of_band'))).toEqual(['fat_out_of_band']);
    expect(PLAN_TOLERANCE).toEqual({ carbs: 0.05, fat: 0.05, kcal: 0.05, proteinOver: 0.05, proteinUnder: 0.05 });
  });

  it('reports them as guidance, never as a reason to discard the plan', () => {
    const violations = validatePlan({ ...base, assignment: withTotals({ carbsG: TARGETS.carbsG * 0.5, fatG: TARGETS.fatG * 2 }) });

    expect(violations.some(violation => violation.kind === 'carbs_out_of_band')).toBe(true);
    expect(violations.some(violation => violation.kind === 'fat_out_of_band')).toBe(true);
    expect(violations.filter(isBlocking)).toEqual([]);
  });

  it("judges a loaded day against its own carbs and fat, not the plan's", () => {
    const assignment = scheduled();
    const first = assignment.days[0];

    if (!first) {
      throw new Error('fixture has days');
    }

    // A day built to eat a fifth more carbohydrate, and that did.
    const loaded = { ...TARGETS, carbsG: Math.round(TARGETS.carbsG * 1.2) };
    const hit = { days: assignment.days.map((day, index) => (index === 0 ? { ...day, totals: { ...day.totals, carbsG: loaded.carbsG } } : day)) };
    const dayTargets = new Map([[first.dayIndex, loaded]]);

    expect(validatePlan({ ...base, assignment: hit, dayTargets }).filter(v => v.kind === 'carbs_out_of_band')).toEqual([]);
    expect(validatePlan({ ...base, assignment: hit }).filter(v => v.kind === 'carbs_out_of_band')).toHaveLength(1);
  });
});

/*
 * A plan was discarded for coming in at 141 g of protein against a 185 g target
 * on two days out of fourteen. The owner's instruction was plain: the nutrition
 * figures are guidance, and generation must never fail on them. What must still
 * fail is a plan that is not a plan, or one that breaks a bound rather than
 * missing a target.
 */
describe('isBlocking — what is worth discarding fourteen days of food for', () => {
  const day = (totals: Partial<PlanAssignment['days'][number]['totals']>) => {
    const assignment = scheduled();

    return { days: assignment.days.map((d, index) => (index === 0 ? { ...d, totals: { ...d.totals, ...totals } } : d)) };
  };

  it('delivers a plan that merely drifts from its targets', () => {
    const short = validatePlan({ ...base, assignment: day({ proteinG: TARGETS.proteinG * 0.76 }) });

    expect(short.some(violation => violation.kind === 'protein_below_target')).toBe(true);
    expect(short.filter(isBlocking)).toEqual([]);
  });

  it('delivers a plan outside the calorie band', () => {
    const over = validatePlan({ ...base, assignment: day({ kcal: TARGETS.kcal * 1.2 }) });

    expect(over.some(violation => violation.kind === 'kcal_out_of_band')).toBe(true);
    expect(over.filter(isBlocking)).toEqual([]);
  });

  it('discards a plan that would underfeed someone', () => {
    const starved = validatePlan({ ...base, assignment: day({ kcal: 900 }) });

    expect(starved.filter(isBlocking).some(violation => violation.kind === 'below_minimum_kcal')).toBe(true);
  });

  it('discards a plan whose protein is implausible for the body it feeds', () => {
    const heavy = validatePlan({ ...base, assignment: day({ proteinG: 300 }) });

    expect(heavy.filter(isBlocking).some(violation => violation.kind === 'protein_above_ceiling')).toBe(true);
  });

  it('discards a plan that is structurally not a plan', () => {
    const assignment = scheduled();
    const empty = { days: assignment.days.map((d, index) => (index === 0 ? { ...d, meals: [] } : d)) };

    expect(
      validatePlan({ ...base, assignment: empty })
        .filter(isBlocking)
        .some(violation => violation.kind === 'empty_day')
    ).toBe(true);
    expect(
      validatePlan({ ...base, assignment: { days: assignment.days.slice(0, 13) } })
        .filter(isBlocking)
        .some(v => v.kind === 'wrong_day_count')
    ).toBe(true);
  });
});

/*
 * A day that eats for something (`0043`) is aiming somewhere else on purpose.
 * Judged against the plan's targets it would be recorded as drift on every plan
 * with an event in it — and the record would be wrong, not the day.
 */
describe('validatePlan — a day that eats for something is judged against its own targets', () => {
  const loaded = { ...TARGETS, carbsG: Math.round(TARGETS.carbsG * 1.2), kcal: Math.round(TARGETS.kcal * 1.2) };

  const withLoadedDay = () => {
    const assignment = scheduled();

    return { days: assignment.days.map((day, index) => (index === 2 ? { ...day, totals: { ...day.totals, kcal: loaded.kcal } } : day)) };
  };

  it('reports no drift on a loaded day that hit its own targets', () => {
    const violations = validatePlan({ ...base, assignment: withLoadedDay(), dayTargets: new Map([[3, loaded]]) });

    expect(violations.some(violation => violation.kind === 'kcal_out_of_band')).toBe(false);
  });

  it("is the same day reported as drift when judged against the plan's alone", () => {
    const violations = validatePlan({ ...base, assignment: withLoadedDay() });

    expect(violations.some(violation => violation.kind === 'kcal_out_of_band' && violation.dayIndex === 3)).toBe(true);
  });
});
