import { describe, expect, it } from 'vitest';

import { MINIMUM_DAILY_KCAL } from 'core/entities/Nutrition';
import { ageInYears, basalMetabolicRate, nutritionTargets, totalDailyEnergyExpenditure } from 'core/domain/Nutrition';
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
    expect(targets.wasClamped).toBe(false);
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
    expect(targets.wasClamped).toBe(true);
  });

  it('reports the clamp so the caller can tell the user, rather than silently ignoring the request', () => {
    expect(nutritionTargets({ ...base, goal: 'weight_loss', paceKgPerWeek: -0.25 }).wasClamped).toBe(false);
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
    expect(aggressive.wasClamped).toBe(true);
  });

  it('caps a surplus too, so a gain goal cannot ask for anything', () => {
    const aggressive = nutritionTargets({ ...ruben, goal: 'muscle_gain', paceKgPerWeek: 1 });

    expect(aggressive.kcal).toBeLessThanOrEqual(Math.round(totalDailyEnergyExpenditure(ruben) * 1.2) + 1);
    expect(aggressive.wasClamped).toBe(true);
  });

  it('does not clamp an ordinary pace', () => {
    expect(nutritionTargets({ ...ruben, paceKgPerWeek: 0.5 }).wasClamped).toBe(false);
  });
});
