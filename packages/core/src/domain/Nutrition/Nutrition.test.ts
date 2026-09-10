import { describe, expect, it } from 'vitest';

import { MINIMUM_DAILY_KCAL } from 'core/entities/Nutrition';
import {
  ageInYears,
  basalMetabolicRate,
  macrosForKcal,
  nutritionTargets,
  resolveTargets,
  targetBounds,
  targetViolations,
  totalDailyEnergyExpenditure
} from 'core/domain/Nutrition';
import type { TargetInput } from 'core/domain/Nutrition';

const base: TargetInput = {
  activityLevel: 'moderate',
  ageYears: 32,
  goal: 'maintenance',
  heightCm: 168,
  paceKgPerWeek: null,
  sex: 'female',
  weightKg: 72
};

describe('basalMetabolicRate', () => {
  it('matches Mifflin-St Jeor for a woman', () => {
    // 10*72 + 6.25*168 - 5*32 - 161 = 1449
    expect(basalMetabolicRate(base)).toBeCloseTo(1449, 0);
  });

  it('matches Mifflin-St Jeor for a man', () => {
    // 10*72 + 6.25*168 - 5*32 + 5 = 1615
    expect(basalMetabolicRate({ ...base, sex: 'male' })).toBeCloseTo(1615, 0);
  });

  it('uses the midpoint for unstated sex rather than defaulting to male', () => {
    const unstated = basalMetabolicRate({ ...base, sex: 'prefer_not_to_say' });

    expect(unstated).toBeGreaterThan(basalMetabolicRate(base));
    expect(unstated).toBeLessThan(basalMetabolicRate({ ...base, sex: 'male' }));
  });
});

describe('totalDailyEnergyExpenditure', () => {
  it('scales with activity', () => {
    const sedentary = totalDailyEnergyExpenditure({ ...base, activityLevel: 'sedentary' });
    const athlete = totalDailyEnergyExpenditure({ ...base, activityLevel: 'athlete' });

    expect(athlete).toBeGreaterThan(sedentary);
  });
});

describe('nutritionTargets', () => {
  it('sits at maintenance when the goal is not directional', () => {
    const targets = nutritionTargets(base);

    expect(targets.kcal).toBe(Math.round(totalDailyEnergyExpenditure(base)));
    expect(targets.derivation.clampedBy).toBe(null);
  });

  it('subtracts a deficit for weight loss', () => {
    const targets = nutritionTargets({ ...base, goal: 'weight_loss', paceKgPerWeek: -0.5 });

    // 0.5 kg/week ≈ 550 kcal/day
    expect(targets.kcal).toBeLessThan(Math.round(totalDailyEnergyExpenditure(base)) - 500);
  });

  it('adds a surplus for muscle gain', () => {
    const targets = nutritionTargets({ ...base, goal: 'muscle_gain', paceKgPerWeek: 0.25 });

    expect(targets.kcal).toBeGreaterThan(Math.round(totalDailyEnergyExpenditure(base)));
  });

  it('never goes below the safety floor, however aggressive the requested pace', () => {
    const targets = nutritionTargets({ ...base, activityLevel: 'sedentary', goal: 'weight_loss', paceKgPerWeek: -1, weightKg: 45 });

    expect(targets.kcal).toBeGreaterThanOrEqual(MINIMUM_DAILY_KCAL.female);
    expect(targets.derivation.clampedBy).toBe('floor');
  });

  it('reports the clamp so the caller can tell the user, rather than silently ignoring the request', () => {
    expect(nutritionTargets({ ...base, goal: 'weight_loss', paceKgPerWeek: -0.25 }).derivation.clampedBy).toBe(null);
  });

  it('raises protein for muscle gain relative to healthy eating', () => {
    const gain = nutritionTargets({ ...base, goal: 'muscle_gain' });
    const healthy = nutritionTargets({ ...base, goal: 'healthy_eating' });

    expect(gain.proteinG).toBeGreaterThan(healthy.proteinG);
  });

  it('produces macros whose energy adds up to the calorie target', () => {
    const t = nutritionTargets(base);
    const fromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;

    expect(Math.abs(fromMacros - t.kcal)).toBeLessThanOrEqual(5);
  });

  it('never returns a negative carbohydrate target when protein and fat already fill the budget', () => {
    const targets = nutritionTargets({ ...base, activityLevel: 'sedentary', goal: 'weight_loss', paceKgPerWeek: -1, weightKg: 150 });

    expect(targets.carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe('ageInYears', () => {
  it('counts whole years', () => {
    expect(ageInYears('1994-03-11', new Date('2026-09-06T00:00:00Z'))).toBe(32);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageInYears('1994-12-31', new Date('2026-09-06T00:00:00Z'))).toBe(31);
  });

  it('counts the birthday itself', () => {
    expect(ageInYears('1994-09-06', new Date('2026-09-06T00:00:00Z'))).toBe(32);
  });
});

describe('nutritionTargets — the goal decides direction, not the sign', () => {
  /** A real profile: 29, male, 180 cm, 95 kg, moderate activity, losing weight. */
  const ruben: TargetInput = {
    activityLevel: 'moderate',
    ageYears: 29,
    goal: 'weight_loss',
    heightCm: 180,
    paceKgPerWeek: null,
    sex: 'male',
    weightKg: 95
  };

  it('puts a weight-loss goal below maintenance', () => {
    expect(nutritionTargets(ruben).kcal).toBeLessThan(Math.round(totalDailyEnergyExpenditure(ruben)));
  });

  it('treats a positive pace on a weight-loss goal as a deficit, not a surplus', () => {
    // This shipped inverted: entering "1" kg per week produced 4,099 kcal against
    // a 2,999 maintenance — a surplus, for someone asking to lose weight.
    const signed = nutritionTargets({ ...ruben, paceKgPerWeek: 1 });

    expect(signed.kcal).toBeLessThan(Math.round(totalDailyEnergyExpenditure(ruben)));
  });

  it('gives the same answer whichever sign the pace carries', () => {
    expect(nutritionTargets({ ...ruben, paceKgPerWeek: 1 }).kcal).toBe(nutritionTargets({ ...ruben, paceKgPerWeek: -1 }).kcal);
  });

  it('treats a negative pace on a muscle-gain goal as a surplus', () => {
    const gaining = { ...ruben, goal: 'muscle_gain' as const, paceKgPerWeek: -0.5 };

    expect(nutritionTargets(gaining).kcal).toBeGreaterThan(Math.round(totalDailyEnergyExpenditure(ruben)));
  });

  it('ignores the pace entirely for a non-directional goal', () => {
    const maintenance = Math.round(totalDailyEnergyExpenditure(ruben));

    expect(nutritionTargets({ ...ruben, goal: 'maintenance', paceKgPerWeek: 1 }).kcal).toBe(maintenance);
    expect(nutritionTargets({ ...ruben, goal: 'healthy_eating', paceKgPerWeek: -1 }).kcal).toBe(maintenance);
  });

  it('caps a deficit at a share of maintenance, which an absolute floor alone would miss', () => {
    // 1,899 kcal clears the 1,500 floor and is still a 37% deficit.
    const aggressive = nutritionTargets({ ...ruben, paceKgPerWeek: 1 });

    expect(aggressive.kcal).toBeGreaterThanOrEqual(Math.round(totalDailyEnergyExpenditure(ruben) * 0.75) - 1);
    expect(aggressive.derivation.clampedBy).toBe('floor');
  });

  it('caps a surplus too, so a gain goal cannot ask for anything', () => {
    const aggressive = nutritionTargets({ ...ruben, goal: 'muscle_gain', paceKgPerWeek: 1 });

    expect(aggressive.kcal).toBeLessThanOrEqual(Math.round(totalDailyEnergyExpenditure(ruben) * 1.2) + 1);
    expect(aggressive.derivation.clampedBy).toBe('ceiling');
  });

  it('does not clamp an ordinary pace', () => {
    expect(nutritionTargets({ ...ruben, paceKgPerWeek: 0.5 }).derivation.clampedBy).toBe(null);
  });
});

describe('the derivation, so a number is never shown as a bare fact', () => {
  const ruben: TargetInput = {
    activityLevel: 'moderate',
    ageYears: 29,
    goal: 'weight_loss',
    heightCm: 180,
    paceKgPerWeek: 0.5,
    sex: 'male',
    weightKg: 95
  };

  it('reports every input the figure was built from', () => {
    const { derivation } = nutritionTargets(ruben);

    expect(derivation.equation).toBe('mifflin-st-jeor');
    expect(derivation.activityFactor).toBe(1.55);
    expect(derivation.basalMetabolicRateKcal).toBe(Math.round(basalMetabolicRate(ruben)));
    expect(derivation.maintenanceKcal).toBe(Math.round(totalDailyEnergyExpenditure(ruben)));
    expect(derivation.goal).toBe('weight_loss');
  });

  it('reports the pace as a magnitude, whatever sign arrived', () => {
    expect(nutritionTargets({ ...ruben, paceKgPerWeek: -0.5 }).derivation.paceKgPerWeek).toBe(0.5);
  });

  it('shows what was asked for next to what was granted, when a bound moved it', () => {
    const { derivation, kcal } = nutritionTargets({ ...ruben, paceKgPerWeek: 1 });

    expect(derivation.requestedKcal).toBeLessThan(derivation.floorKcal);
    expect(kcal).toBe(derivation.floorKcal);
    expect(derivation.clampedBy).toBe('floor');
  });

  it('defaults the pace rather than leaving it unstated', () => {
    expect(nutritionTargets({ ...ruben, paceKgPerWeek: null }).derivation.paceKgPerWeek).toBe(0.5);
    expect(nutritionTargets({ ...ruben, goal: 'muscle_gain', paceKgPerWeek: null }).derivation.paceKgPerWeek).toBe(0.25);
  });
});

describe('targetViolations — the one place a target set is judged', () => {
  const input: TargetInput = {
    activityLevel: 'moderate',
    ageYears: 29,
    goal: 'weight_loss',
    heightCm: 180,
    paceKgPerWeek: 0.5,
    sex: 'male',
    weightKg: 95
  };
  const bounds = targetBounds(input);

  it('accepts what the calculator produces', () => {
    const { derivation: _derivation, ...targets } = nutritionTargets(input);

    expect(targetViolations(targets, bounds)).toEqual([]);
  });

  it('names the floor rather than saying only "invalid"', () => {
    const violations = targetViolations({ carbsG: 100, fatG: 30, fiberG: 14, kcal: 1000, proteinG: 90 }, bounds);

    expect(violations.map(violation => violation.kind)).toContain('kcal_below_floor');
  });

  it('catches macros that do not add up to the calorie figure', () => {
    // 200 g protein + 400 g carbs + 100 g fat is 3,300 kcal, not 2,000.
    const violations = targetViolations({ carbsG: 400, fatG: 100, fiberG: 28, kcal: 2000, proteinG: 200 }, bounds);

    expect(violations.map(violation => violation.kind)).toContain('macros_do_not_sum');
  });

  it('applies the same protein ceiling a finished plan is held to', () => {
    const violations = targetViolations({ carbsG: 0, fatG: 44, fiberG: 34, kcal: 2400, proteinG: 400 }, bounds);

    expect(violations.map(violation => violation.kind)).toContain('protein_above_ceiling');
  });

  it('returns every violation, not the first', () => {
    expect(targetViolations({ carbsG: 0, fatG: 0, fiberG: 0, kcal: 800, proteinG: 400 }, bounds).length).toBeGreaterThan(2);
  });
});

describe('macrosForKcal', () => {
  it('always sums to the calorie figure, whatever the body mass', () => {
    // The hole this closes: carbohydrate used to be `max(remaining, 0)`, so a
    // heavy person on a floored calorie target lost the shortfall into a clamp
    // and the macros quietly stopped describing the same day as the kcal.
    for (const weightKg of [45, 72, 95, 150, 220]) {
      for (const kcal of [1200, 1800, 2449, 3600]) {
        const targets = macrosForKcal(kcal, weightKg, 'weight_loss');
        const fromMacros = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;

        expect(Math.abs(fromMacros - kcal), `${weightKg} kg at ${kcal} kcal`).toBeLessThanOrEqual(kcal * 0.03);
        expect(targets.carbsG, `${weightKg} kg at ${kcal} kcal`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('caps protein at a share of energy rather than letting it exceed the budget', () => {
    const targets = macrosForKcal(1500, 220, 'muscle_gain');

    expect(targets.proteinG * 4).toBeLessThanOrEqual(1500 * 0.35 + 1);
  });
});

describe('every goal, pace and body produces a reachable target', () => {
  // The regression net for PRD criterion 15. Generation must never be the place
  // an impossible target is discovered; if one exists, `nutritionTargets` throws
  // here and this fails, three stages earlier than a user would have seen it.
  it('never throws TargetsUnreachableError across the input space', () => {
    const goals = ['weight_loss', 'maintenance', 'muscle_gain', 'performance', 'healthy_eating', 'custom'] as const;
    const activities = ['sedentary', 'light', 'moderate', 'high', 'athlete'] as const;
    const sexes = ['female', 'male', 'other', 'prefer_not_to_say'] as const;

    for (const goal of goals) {
      for (const activityLevel of activities) {
        for (const sex of sexes) {
          for (const weightKg of [40, 60, 95, 140, 200]) {
            for (const paceKgPerWeek of [null, -1, -0.25, 0.25, 1]) {
              for (const ageYears of [16, 35, 80]) {
                const input: TargetInput = { activityLevel, ageYears, goal, heightCm: 170, paceKgPerWeek, sex, weightKg };

                expect(() => nutritionTargets(input), JSON.stringify(input)).not.toThrow();
              }
            }
          }
        }
      }
    }
  });
});

describe('resolveTargets — computed, corrected, and which is in effect', () => {
  const input: TargetInput = {
    activityLevel: 'moderate',
    ageYears: 29,
    goal: 'weight_loss',
    heightCm: 180,
    paceKgPerWeek: 0.5,
    sex: 'male',
    weightKg: 95
  };

  function override(fields: Partial<Record<'carbsG' | 'fatG' | 'kcal' | 'proteinG', number | null>>) {
    return { carbsG: null, fatG: null, kcal: null, overriddenAt: new Date(), proteinG: null, ...fields };
  }

  it('uses the computed targets when there is no override', () => {
    const resolved = resolveTargets(input, null);

    expect(resolved.overrideStatus).toBe('none');
    expect(resolved.effective).toEqual(resolved.computed);
  });

  it('treats an all-null override as no override', () => {
    expect(resolveTargets(input, override({})).overrideStatus).toBe('none');
  });

  it('applies a correction and keeps the computed figure alongside it', () => {
    const resolved = resolveTargets(input, override({ kcal: 2600 }));

    expect(resolved.overrideStatus).toBe('applied');
    expect(resolved.effective.kcal).toBe(2600);
    expect(resolved.computed.kcal).not.toBe(2600);
  });

  it('re-derives the macros from a corrected calorie figure, so the set stays coherent', () => {
    const { effective } = resolveTargets(input, override({ kcal: 2600 }));
    const fromMacros = effective.proteinG * 4 + effective.carbsG * 4 + effective.fatG * 9;

    expect(Math.abs(fromMacros - 2600)).toBeLessThanOrEqual(2600 * 0.03);
  });

  it('keeps a named macro and lets carbohydrate absorb the difference', () => {
    const { effective } = resolveTargets(input, override({ kcal: 2400, proteinG: 200 }));

    expect(effective.proteinG).toBe(200);
    expect(effective.proteinG * 4 + effective.carbsG * 4 + effective.fatG * 9).toBeCloseTo(2400, -2);
  });

  it('sets aside an override that the profile has since moved out of bounds', () => {
    // 2,400 kcal is fine at 95 kg and moderate activity. Drop to sedentary and
    // 60 kg and the same figure is now above the surplus ceiling.
    const lighter: TargetInput = { ...input, activityLevel: 'sedentary', weightKg: 60 };
    const resolved = resolveTargets(lighter, override({ kcal: 2400 }));

    expect(resolved.overrideStatus).toBe('stale');
    expect(resolved.effective).toEqual(resolved.computed);
    expect(resolved.overrideViolations.map(violation => violation.kind)).toContain('kcal_above_ceiling');
  });

  it('refuses an override below the floor rather than clamping it into range', () => {
    const resolved = resolveTargets(input, override({ kcal: 900 }));

    expect(resolved.overrideStatus).toBe('stale');
    expect(resolved.effective.kcal).toBe(resolved.computed.kcal);
  });

  it('holds a hand-typed target to exactly the bounds the calculator obeys', () => {
    const { bounds, computed } = resolveTargets(input, null);

    expect(computed.kcal).toBeGreaterThanOrEqual(Math.floor(bounds.floorKcal));
    expect(resolveTargets(input, override({ kcal: Math.round(bounds.floorKcal) })).overrideStatus).toBe('applied');
    expect(resolveTargets(input, override({ kcal: Math.round(bounds.floorKcal) - 50 })).overrideStatus).toBe('stale');
  });
});
