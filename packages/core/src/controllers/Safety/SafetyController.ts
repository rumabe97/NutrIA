import { allergenKeysForConditions, CONDITION_EXCLUSIONS } from 'core/domain/Health';
import { HealthRepository } from '#repositories/Health';
import { resolveCustomAllergens, toSafetyProfile } from 'core/domain/Safety';
import { SafetyRepository } from '#repositories/Safety';
import type { Allergen, SafetyProfile, SetAllergies } from 'core/entities/Safety';
import type { ResolvedCustomAllergen } from 'core/domain/Safety';

// --- Controller ---------------------------------------------------------------

/**
 * Resolves free text against the catalogue.
 *
 * Exported because two flows save allergies — the onboarding step and the
 * profile screen — and both must resolve identically. The *rule* lives once, in
 * `core/domain/Safety`; this is the one place that feeds it the catalogue.
 */
export async function resolveFreeTextAllergens(labels: readonly string[]): Promise<readonly ResolvedCustomAllergen[]> {
  if (labels.length === 0) {return [];}

  return resolveCustomAllergens(labels, await SafetyRepository.listMatchableIngredients());
}

export const SafetyController = {
  async getRestrictions(userId: string) {
    const [allergies, customAllergens, intolerances] = await Promise.all([
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findCustomAllergens(userId),
      SafetyRepository.findIntolerances(userId)
    ]);

    return { allergies, customAllergens, intolerances };
  },

  /**
   * The set-based profile every generation and replacement path must load before
   * it produces food. **The only place a `SafetyProfile` is assembled** — kept as
   * one named method so the call site is greppable, and so a new source of
   * restriction (free text, and now a signed-off condition) reaches every path at
   * once instead of the ones somebody remembered.
   *
   * Four sources, one set: declared allergies, declared intolerances, free-text
   * allergies that resolved to an ingredient, and the allergens a condition in
   * `CONDITION_EXCLUSIONS` implies. A condition-derived allergen is added at
   * `contains` level only; trace sensitivity stays the user's explicit choice.
   */
  async getSafetyProfile(userId: string): Promise<SafetyProfile> {
    const [allergies, customAllergens, intolerances, health, allergens] = await Promise.all([
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findCustomAllergens(userId),
      SafetyRepository.findIntolerances(userId),
      HealthRepository.findAll(userId),
      SafetyRepository.listAllergens()
    ]);

    const derivedKeys = allergenKeysForConditions(health.conditions, CONDITION_EXCLUSIONS);
    const derived = allergens
      .filter(allergen => derivedKeys.includes(allergen.key))
      .map(allergen => ({ allergenId: allergen.id, crossContaminationSensitive: false }));

    // A free-text allergy that resolved to a row also excludes every row made of
    // it (`madeOf`), which needs the catalogue's slugs — loaded only when there
    // is something to expand, since most profiles have no free-text entry.
    const ingredients = customAllergens.some(entry => entry.ingredientId !== null) ? await SafetyRepository.listMatchableIngredients() : [];

    // Sets, so a user who both declared gluten and recorded coeliac disease is
    // not counted twice — and so their own trace setting survives the merge.
    return toSafetyProfile([...allergies, ...derived], intolerances, customAllergens, ingredients);
  },

  async listAllergens(): Promise<readonly Allergen[]> {
    return SafetyRepository.listAllergens();
  },

  async setRestrictions(userId: string, input: SetAllergies): Promise<void> {
    await SafetyRepository.replaceAll(userId, input, await resolveFreeTextAllergens(input.customAllergens));
  }
};
