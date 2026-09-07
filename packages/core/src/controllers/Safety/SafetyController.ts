import { SafetyRepository } from '#repositories/Safety';
import { toSafetyProfile } from 'core/domain/Safety';
import type { Allergen, SafetyProfile, SetAllergies } from 'core/entities/Safety';

// --- Controller ---------------------------------------------------------------

export const SafetyController = {
  async getRestrictions(userId: string) {
    const [allergies, intolerances] = await Promise.all([SafetyRepository.findAllergies(userId), SafetyRepository.findIntolerances(userId)]);

    return { allergies, intolerances };
  },

  /**
   * The set-based profile every generation and replacement path must load before
   * it produces food. Kept as its own method so the call site is greppable —
   * a code path that never calls this is a code path with no allergy check.
   */
  async getSafetyProfile(userId: string): Promise<SafetyProfile> {
    const [allergies, intolerances] = await Promise.all([SafetyRepository.findAllergies(userId), SafetyRepository.findIntolerances(userId)]);

    return toSafetyProfile(allergies, intolerances);
  },

  async listAllergens(): Promise<readonly Allergen[]> {
    return SafetyRepository.listAllergens();
  },

  async setRestrictions(userId: string, input: SetAllergies): Promise<void> {
    await SafetyRepository.replaceAll(userId, input);
  }
};
