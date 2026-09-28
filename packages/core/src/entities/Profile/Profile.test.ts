import { describe, expect, it } from 'vitest';

import { goalSchema, PACE_KG_PER_WEEK, preferencesSchema, updateGoalSchema } from 'core/entities/Profile';

/**
 * The columns behind these ten fields are not migrated away in this change
 * (`0067`) — an unmigrated production row still holds whatever a person
 * typed into `breakfast_style`, `portion_preference`, `work_schedule_notes`
 * or `custom_goal`. Nothing reads them any more, but "nothing reads them"
 * today rests entirely on Zod's default strip-unknown-keys behaviour
 * (invariant-reviewer-2): one `.passthrough()` or `.loose()` added later, or
 * a caller that returns the raw row instead of the parsed one, and a typed
 * sentence a person wrote reappears with nothing failing to say so. This
 * pins the exact key set both schemas may parse to, so a schema that grows
 * one of those keys back fails here first.
 */
describe('goalSchema — a legacy row still carrying `custom_goal` (`0067`)', () => {
  const LEGACY_ROW = {
    id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    customGoal: 'SENTINEL-CUSTOM-GOAL texto libre de la persona',
    paceKgPerWeek: 0.5,
    startingWeightKg: 72,
    targetWeightKg: 66,
    type: 'weight_loss',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: 'usr-1'
  };

  it('parses without `customGoal`, whatever the stored row still carries', () => {
    const parsed = goalSchema.parse(LEGACY_ROW);

    expect(Object.keys(parsed).sort()).toEqual([
      'createdAt',
      'id',
      'paceKgPerWeek',
      'startingWeightKg',
      'targetWeightKg',
      'type',
      'updatedAt',
      'userId'
    ]);
    expect(JSON.stringify(parsed)).not.toContain('SENTINEL-CUSTOM-GOAL');
  });
});

describe('preferencesSchema — a legacy row still carrying the removed lifestyle and cooking columns (`0067`)', () => {
  const LEGACY_ROW = {
    id: 'd4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70',
    activityLevel: 'moderate',
    breakfastStyle: 'SENTINEL-BREAKFAST desayuno tras la insulina',
    budget: 'medium',
    cookingFrequency: 'often',
    cookingTimeMinutes: 30,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    mealShape: { afternoon_snack: 'off', breakfast: 'normal', dinner: 'normal', lunch: 'normal', morning_snack: 'off', supper: 'off' },
    portionPreference: 'SENTINEL-PORTION poco por la gastritis',
    sleepEnd: '07:00',
    sleepStart: '23:00',
    trainingDaysPerWeek: 3,
    trainingTime: '18:00',
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    userId: 'usr-1',
    workScheduleNotes: 'SENTINEL-SCHEDULE turnos en la mezquita'
  };

  it('parses without any of the removed fields, whatever the stored row still carries', () => {
    const parsed = preferencesSchema.parse(LEGACY_ROW);

    expect(Object.keys(parsed).sort()).toEqual(['activityLevel', 'cookingTimeMinutes', 'createdAt', 'id', 'mealShape', 'updatedAt', 'userId']);

    const serialised = JSON.stringify(parsed);

    for (const sentinel of ['SENTINEL-BREAKFAST', 'SENTINEL-PORTION', 'SENTINEL-SCHEDULE']) {
      expect(serialised).not.toContain(sentinel);
    }
  });
});

describe('updateGoalSchema pace', () => {
  it('accepts the bound itself', () => {
    const parsed = updateGoalSchema.parse({ paceKgPerWeek: PACE_KG_PER_WEEK.max, type: 'weight_loss' });

    expect(parsed.paceKgPerWeek).toBe(PACE_KG_PER_WEEK.max);
  });

  it('refuses a pace past the bound, naming the field and the range', () => {
    const result = updateGoalSchema.safeParse({ paceKgPerWeek: PACE_KG_PER_WEEK.max + 0.5, type: 'weight_loss' });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const issue = result.error.issues.find(candidate => candidate.path.join('.') === 'paceKgPerWeek');

    expect(issue?.message).toBe('El ritmo tiene que estar entre 0 y 1 kg por semana');
  });

  it('keeps a signed pace from an older client as a magnitude, with the same bound', () => {
    expect(updateGoalSchema.parse({ paceKgPerWeek: -0.5, type: 'weight_loss' }).paceKgPerWeek).toBe(0.5);
    expect(updateGoalSchema.safeParse({ paceKgPerWeek: -1.5, type: 'weight_loss' }).success).toBe(false);
  });
});

/**
 * `'custom'` is gone from `GOAL_TYPES` along with the free text it existed to
 * describe (`0067`) — it always computed as `maintenance` anyway. A request
 * naming it is refused, the same as any value the enum has never offered,
 * which is what turns into 422 `INVALID_INPUT` at the route (`@ZodBody`).
 */
describe('updateGoalSchema — the `custom` goal type is gone (`0067`)', () => {
  it('refuses `custom`', () => {
    expect(updateGoalSchema.safeParse({ type: 'custom' }).success).toBe(false);
  });
});
