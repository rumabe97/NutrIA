import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfileConsentRequiredError } from 'core/entities/Error';

import { SafetyController } from './SafetyController';

const requireProfileConsent = vi.fn<(userId: string) => Promise<void>>(async () => undefined);
const replaceAll = vi.fn(async () => undefined);

vi.mock('core/controllers/Profile', () => ({ requireProfileConsent: (userId: string) => requireProfileConsent(userId) }));
vi.mock('#repositories/Health', () => ({ HealthRepository: {} }));
vi.mock('#repositories/Safety', () => ({
  SafetyRepository: { listMatchableIngredients: async () => Promise.resolve([]), replaceAll: () => replaceAll() }
}));

const INPUT = { allergies: [], customAllergens: [], intolerances: [] };

describe('SafetyController.setRestrictions — the profile consent', () => {
  beforeEach(() => {
    requireProfileConsent.mockClear();
    replaceAll.mockClear();
  });

  it('refuses allergies and intolerances without it, and replaces nothing', async () => {
    requireProfileConsent.mockRejectedValueOnce(new ProfileConsentRequiredError());

    await expect(SafetyController.setRestrictions('usr-1', INPUT)).rejects.toBeInstanceOf(ProfileConsentRequiredError);
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it('replaces them once it is given, for the session’s account', async () => {
    await SafetyController.setRestrictions('usr-1', INPUT);

    expect(requireProfileConsent).toHaveBeenCalledWith('usr-1');
    expect(replaceAll).toHaveBeenCalledOnce();
  });
});
