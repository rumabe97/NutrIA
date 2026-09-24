import { describe, expect, it, vi } from 'vitest';

import { refusesProfessionalSave } from './PlanRepository';

vi.mock('database', () => ({ database: () => ({}) }));

/**
 * The save-time rule for a professional's generation (`0060`): it never
 * completes the client's fortnight under way. The SQL around it — the active
 * row read in the plan's own transaction — is covered end to end.
 */
describe('refusesProfessionalSave', () => {
  it('refuses a professional’s plan that would go active over a fortnight still running', () => {
    expect(refusesProfessionalSave({ byProfessional: true, review: false, running: true })).toBe(true);
  });

  it('lets it through when it waits for review, or when nothing runs on its first day — no plan, or one that has ended', () => {
    expect(refusesProfessionalSave({ byProfessional: true, review: true, running: true })).toBe(false);
    expect(refusesProfessionalSave({ byProfessional: true, review: false, running: false })).toBe(false);
  });

  it('never refuses the client’s own generation', () => {
    expect(refusesProfessionalSave({ byProfessional: false, review: false, running: true })).toBe(false);
  });
});
