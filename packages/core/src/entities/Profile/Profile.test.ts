import { describe, expect, it } from 'vitest';

import { PACE_KG_PER_WEEK, updateGoalSchema } from 'core/entities/Profile';

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
