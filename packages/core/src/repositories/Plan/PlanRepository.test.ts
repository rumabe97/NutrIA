import { describe, expect, it, vi } from 'vitest';

import { refusesProfessionalSave } from './PlanRepository';

vi.mock('database', () => ({ database: () => ({}) }));

/**
 * The save-time rule for a professional's generation (`0060`): it never
 * completes the client's fortnight under way. The SQL around it — the active
 * row read in the plan's own transaction — is covered end to end.
 */
describe('refusesProfessionalSave', () => {
  it('refuses a professional’s plan that would go active over an active plan', () => {
    expect(refusesProfessionalSave({ byProfessional: true, hasActive: true, review: false })).toBe(true);
  });

  it('lets it through when it waits for review, or when there is no active plan to replace', () => {
    expect(refusesProfessionalSave({ byProfessional: true, hasActive: true, review: true })).toBe(false);
    expect(refusesProfessionalSave({ byProfessional: true, hasActive: false, review: false })).toBe(false);
  });

  it('never refuses the client’s own generation', () => {
    expect(refusesProfessionalSave({ byProfessional: false, hasActive: true, review: false })).toBe(false);
  });
});
