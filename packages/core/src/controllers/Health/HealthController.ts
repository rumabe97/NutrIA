import { CONDITION_EXCLUSIONS, CONDITION_SUGGESTIONS, conditionImplications, supervisionRecommended, supplementProteinG } from 'core/domain/Health';
import { HEALTH_CONSENT_VERSION } from 'core/entities/Health';
import { HealthRepository } from '#repositories/Health';
import { SafetyRepository } from '#repositories/Safety';
import type { Allergen } from 'core/entities/Safety';
import type { ConditionKey, HealthCondition, Medication, SetHealthData, Supplement } from 'core/entities/Health';
import type { StoredHealthData } from '#repositories/Health';

// --- Presenters ---------------------------------------------------------------

export type ConditionEffect = { readonly allergenLabel: string; readonly conditionLabel: string };

export interface HealthView {
  conditions: readonly HealthCondition[];
  /** False when consent is absent *or* was given to an older notice. */
  consentIsCurrent: boolean;
  /**
   * Restrictions a recorded condition applies **automatically**, each named with
   * the condition responsible. Shown because a restriction the user cannot see
   * the reason for is one they cannot argue with.
   */
  derivedExclusions: readonly ConditionEffect[];
  medications: readonly Medication[];
  /**
   * Restrictions we could apply and deliberately have not, because avoiding the
   * substance is a matter of degree rather than a definition. Offered, never
   * imposed; accepting one means adding an ordinary intolerance, in the list the
   * user already manages. Already-accepted ones drop off this list.
   */
  suggestedExclusions: readonly ConditionEffect[];
  /**
   * Whether to show the supervision notice. Raised by anything recorded, never
   * graded by what — grading is the medical reasoning this product does not do.
   */
  supervisionRecommended: boolean;
  /**
   * Protein per day from supplements, for display beside the targets.
   *
   * **Not** deducted from the target a plan is built against. See the note on
   * `supplementProteinG` in `core/domain/Health`.
   */
  supplementProteinG: number;
  supplements: readonly Supplement[];
}

function effects(
  conditions: readonly HealthCondition[],
  map: ReadonlyMap<ConditionKey, readonly string[]>,
  allergens: readonly Allergen[],
  skipAllergenIds: ReadonlySet<string> = new Set()
): readonly ConditionEffect[] {
  return conditionImplications(conditions, map).flatMap(implication => {
    const allergen = allergens.find(candidate => candidate.key === implication.allergenKey);

    // An allergen key with no catalogue row is a seeding gap, not a restriction
    // to invent a label for.
    if (!allergen || skipAllergenIds.has(allergen.id)) {
      return [];
    }

    return [{ allergenLabel: allergen.labelEs, conditionLabel: implication.conditionLabel }];
  });
}

// --- Controller ---------------------------------------------------------------

export const HealthController = {
  async get(userId: string): Promise<HealthView> {
    const [data, allergens, allergies, intolerances] = await Promise.all([
      HealthRepository.findAll(userId),
      SafetyRepository.listAllergens(),
      SafetyRepository.findAllergies(userId),
      SafetyRepository.findIntolerances(userId)
    ]);

    return present(data, allergens, new Set([...allergies.map(a => a.allergenId), ...intolerances.map(i => i.allergenId)]));
  },

  /**
   * Replaces the whole section. The schema requires the current consent version,
   * so a client cannot submit health data while agreeing to nothing.
   */
  async replace(userId: string, input: SetHealthData): Promise<HealthView> {
    await HealthRepository.replaceAll(userId, input);

    return HealthController.get(userId);
  },

  /** Withdrawal: the data and the consent go together, or neither does. */
  async withdraw(userId: string): Promise<HealthView> {
    await HealthRepository.deleteAll(userId);

    return HealthController.get(userId);
  }
};

function present(data: StoredHealthData, allergens: readonly Allergen[], declaredAllergenIds: ReadonlySet<string>): HealthView {
  return {
    conditions: data.conditions,
    consentIsCurrent: data.consentVersion === HEALTH_CONSENT_VERSION,
    derivedExclusions: effects(data.conditions, CONDITION_EXCLUSIONS, allergens),
    medications: data.medications,
    // A suggestion the user has already acted on is not a suggestion. Filtering
    // by what they have declared keeps the panel from nagging about a decision
    // they made.
    suggestedExclusions: effects(data.conditions, CONDITION_SUGGESTIONS, allergens, declaredAllergenIds),
    supervisionRecommended: supervisionRecommended(data.conditions, data.medications),
    supplementProteinG: supplementProteinG(data.supplements),
    supplements: data.supplements
  };
}
