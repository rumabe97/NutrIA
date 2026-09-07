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
