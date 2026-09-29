import { describe, expect, it } from 'vitest';

import { planQuality } from 'core/domain/PlanValidation';
import { TARGETS } from '#test/fixtures';
import type { PlanQualityInput, PlanViolation } from 'core/domain/PlanValidation';

const FORTNIGHT = Array.from({ length: 14 }, (_, index) => index + 1);

type BandKind = 'carbs_out_of_band' | 'fat_out_of_band' | 'kcal_out_of_band' | 'protein_above_target' | 'protein_below_target';

function band(kind: BandKind, dayIndex: number): PlanViolation {
  return { actual: 1, dayIndex, kind, target: 2, tolerance: 0.05 };
}

const base: PlanQualityInput = {
  dayIndexes: FORTNIGHT,
  dayTargets: new Map(),
  fallback: null,
  loadsRefused: 0,
  minimumKcal: 1200,
  targets: TARGETS,
  violations: []
};

const NO_ADVISORIES = { carbs_out_of_band: 0, fat_out_of_band: 0, kcal_out_of_band: 0, protein_above_target: 0, protein_below_target: 0, variety: 0 };

describe('planQuality', () => {
  it('says every day is in band, with every count present at zero, for a plan with nothing to say', () => {
    expect(planQuality(base)).toEqual({
      advisoriesByKind: NO_ADVISORIES,
      days: 14,
      daysFloorNarrowed: 0,
      daysFloorNarrowedOutOfBand: 0,
      daysInBand: 14,
      eventDays: 0,
      eventDaysInBand: 0,
      fallback: null,
      loadsRefused: 0,
      missesByMacro: { carbs: 0, fat: 0, kcal: 0, protein: 0 }
    });
  });

  it('takes its length from the days given, not from a constant', () => {
    expect(planQuality({ ...base, dayIndexes: [1, 2, 3] }).days).toBe(3);
  });

  it('counts a day missing several macros once against the bar, and once per macro it missed', () => {
    const violations: PlanViolation[] = [
      band('kcal_out_of_band', 2),
      band('fat_out_of_band', 2),
      band('carbs_out_of_band', 5),
      band('protein_below_target', 7),
      band('protein_above_target', 9)
    ];
    const quality = planQuality({ ...base, violations });

    expect(quality.daysInBand).toBe(10);
    expect(quality.missesByMacro).toEqual({ carbs: 1, fat: 1, kcal: 1, protein: 2 });
    expect(quality.advisoriesByKind).toEqual({
      ...NO_ADVISORIES,
      carbs_out_of_band: 1,
      fat_out_of_band: 1,
      kcal_out_of_band: 1,
      protein_above_target: 1,
      protein_below_target: 1
    });
  });

  it('counts variety as advice without taking a day out of its band', () => {
    const violations: PlanViolation[] = [
      { kind: 'variety', violation: { dayIndex: 3, dishSlug: 'lentejas', kind: 'repeated_too_soon', slot: 'lunch' } },
      { kind: 'variety', violation: { dayIndex: 4, dishSlug: 'lentejas', kind: 'repeated_too_soon', slot: 'lunch' } }
    ];
    const quality = planQuality({ ...base, violations });

    expect(quality.advisoriesByKind.variety).toBe(2);
    expect(quality.daysInBand).toBe(14);
  });

  it('never counts a blocking violation as advice, and a protein ceiling breach as a protein miss', () => {
    const violations: PlanViolation[] = [
      { actual: 300, ceiling: 225, dayIndex: 4, kind: 'protein_above_ceiling' },
      { actual: 1100, dayIndex: 6, kind: 'below_minimum_kcal', minimum: 1200 },
      { dayIndex: 8, kind: 'missing_slot', slot: 'dinner' },
      { actual: 13, expected: 14, kind: 'wrong_day_count' }
    ];
    const quality = planQuality({ ...base, violations });

    expect(quality.advisoriesByKind).toEqual(NO_ADVISORIES);
    expect(quality.missesByMacro).toEqual({ carbs: 0, fat: 0, kcal: 0, protein: 1 });
    expect(quality.daysInBand).toBe(13);
  });

  it('ignores a violation naming a day the plan does not have', () => {
    const quality = planQuality({ ...base, violations: [band('kcal_out_of_band', 15)] });

    expect(quality.daysInBand).toBe(14);
    expect(quality.missesByMacro.kcal).toBe(0);
  });

  it('judges event days on their own, and counts only the event days the plan holds', () => {
    const loaded = { ...TARGETS, carbsG: 300, kcal: 2400 };
    const dayTargets = new Map([
      [9, loaded],
      [10, loaded],
      [20, loaded]
    ]);
    const quality = planQuality({ ...base, dayTargets, violations: [band('carbs_out_of_band', 10), band('fat_out_of_band', 3)] });

    expect(quality.eventDays).toBe(2);
    expect(quality.eventDaysInBand).toBe(1);
    expect(quality.daysInBand).toBe(12);
  });

  it('counts the days the energy floor narrows the band, by each day’s own target, and of those the days out of band', () => {
    const low = { ...TARGETS, kcal: 1500 };
    // 1500 × 0.95 = 1425 < 1500 narrows; 1600 × 0.95 = 1520 does not; 1578 × 0.95 = 1499.1 narrows too, and that day is in band.
    const dayTargets = new Map([
      [2, low],
      [3, { ...TARGETS, kcal: 1600 }],
      [4, { ...TARGETS, kcal: 1578 }]
    ]);
    const quality = planQuality({
      ...base,
      dayTargets,
      minimumKcal: 1500,
      targets: { ...TARGETS, kcal: 1900 },
      violations: [band('kcal_out_of_band', 2), band('fat_out_of_band', 9)]
    });

    expect(quality.daysFloorNarrowed).toBe(2);
    expect(quality.daysFloorNarrowedOutOfBand).toBe(1);
  });

  it('counts a plan whose every day sits above the floor as narrowed nowhere', () => {
    const quality = planQuality({ ...base, minimumKcal: 1500, violations: [band('kcal_out_of_band', 2)] });

    expect(quality.daysFloorNarrowed).toBe(0);
    expect(quality.daysFloorNarrowedOutOfBand).toBe(0);
  });

  it('carries the fallback and the refused loads as they came', () => {
    const quality = planQuality({ ...base, fallback: 'wider_rotation', loadsRefused: 2 });

    expect(quality.fallback).toBe('wider_rotation');
    expect(quality.loadsRefused).toBe(2);
  });

  it('holds counts only: no target, figure or name travels out', () => {
    const quality = planQuality({
      ...base,
      dayTargets: new Map([[9, { ...TARGETS, kcal: 2400 }]]),
      violations: [{ actual: 2150, dayIndex: 3, kind: 'kcal_out_of_band', target: 2000, tolerance: 0.05 }]
    });
    const text = JSON.stringify(quality);

    expect(text).not.toMatch(/2000|2150|2400|"target"|"actual"/);
  });
});
