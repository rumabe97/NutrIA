import type { ConditionKey, HealthCondition, Medication, Supplement } from 'core/entities/Health';

/**
 * What a recorded condition is allowed to change about a plan, automatically.
 *
 * The contents are a clinical judgement rather than an engineering one and are
 * signed off outside the code — see
 * [`0008`](../../../../../docs/decisions/0008-condition-exclusions.md) and the
 * assembled evidence in
 * `docs/projects/003-trust-depth-and-polish/condition-exclusions.md`. **Do not
 * add a row here without that sign-off**; the test that asserts this map's exact
 * contents exists to make an unreviewed addition fail loudly.
 *
 * The values are allergen **keys**, not ingredient slugs, so an approved mapping
 * enters the profile through the existing allergen machinery and the safety gate
 * gains nothing new to go wrong.
 *
 * Admission rule, and it is narrow on purpose: a mapping belongs here only if
 * avoiding the substance *is* the definition of managing the condition, not one
 * therapeutic strategy among several. Carbohydrate management in diabetes,
 * sodium in hypertension, protein in kidney disease and purines in gout are all
 * individualised prescriptions. This product does not write prescriptions.
 *
 * An unmapped condition — and every free-text one — produces no dietary
 * inference at all, only the supervision recommendation.
 */
export const CONDITION_EXCLUSIONS: ReadonlyMap<ConditionKey, readonly string[]> = new Map([
  // Coeliac disease. The treatment *is* a strict, lifelong gluten-free diet —
  // there is no version of managing it that includes gluten — so this is
  // definitional rather than therapeutic, which is the bar above. Approved
  // 2026-09-07; see docs/decisions/0008-condition-exclusions.md.
  //
  // Applied at `contains` level only. Coeliac disease does warrant avoiding
  // cross-contamination, but *how strictly* is a matter of individual
  // sensitivity, and deciding it for someone is the grading this layer refuses
  // to do. The user turns on trace sensitivity in the allergy step, where every
  // other trace decision lives.
  ['coeliac', ['gluten']]
]);

/**
 * Mappings that are **offered and not applied**.
 *
 * Same shape, different force, and the difference is the clinical one: where
 * avoiding the substance is a matter of degree rather than a definition, the
 * product says what it could do and lets the person decide. Accepting a
 * suggestion adds an ordinary intolerance, so it lands in the list the user
 * already manages and can be removed the same way — nothing here becomes a
 * restriction they cannot see or undo.
 */
export const CONDITION_SUGGESTIONS: ReadonlyMap<ConditionKey, readonly string[]> = new Map([
  // Most people with lactose intolerance tolerate some lactose. A hard,
  // automatic exclusion would be stricter than most clinicians advise and would
  // silently narrow every plan. Approved as a suggestion 2026-09-07.
  ['lactose_intolerance', ['lactose']]
]);

export type ConditionImplication = {
  readonly allergenKey: string;
  /** The condition that caused it, so a screen can say *why* without guessing. */
  readonly conditionLabel: string;
};

/**
 * What a set of conditions implies under a given map, each paired with the
 * condition responsible.
 *
 * The map is a parameter rather than a closed-over constant for two reasons: the
 * rule can be tested independently of what is currently signed off, and the same
 * function serves both the automatic map and the suggested one. One traversal,
 * two forces.
 */
export function conditionImplications(
  conditions: readonly Pick<HealthCondition, 'conditionKey' | 'label'>[],
  exclusions: ReadonlyMap<ConditionKey, readonly string[]>
): readonly ConditionImplication[] {
  const implications: ConditionImplication[] = [];

  for (const condition of conditions) {
    // A free-text condition has no key, and a key with no signed-off mapping has
    // no consequence. Both fall through to nothing, which is the safe default:
    // inventing a restriction from an unrecognised word is exactly the kind of
    // reasoning this layer exists to refuse.
    if (condition.conditionKey === null) {
      continue;
    }

    for (const allergenKey of exclusions.get(condition.conditionKey) ?? []) {
      implications.push({ allergenKey, conditionLabel: condition.label });
    }
  }

  return implications;
}

/** The deduplicated allergen keys, for the safety profile, which cares about the set and not the cause. */
export function allergenKeysForConditions(
  conditions: readonly Pick<HealthCondition, 'conditionKey' | 'label'>[],
  exclusions: ReadonlyMap<ConditionKey, readonly string[]>
): readonly string[] {
  return [...new Set(conditionImplications(conditions, exclusions).map(implication => implication.allergenKey))];
}

/**
 * Whether to show the professional-supervision notice.
 *
 * Conditions **or** medications, and nothing about which ones: the product does
 * not grade how serious something is, because grading is the medical reasoning
 * it must not do. Anything recorded raises the notice equally.
 */
export function supervisionRecommended(conditions: readonly HealthCondition[], medications: readonly Medication[]): boolean {
  return conditions.length > 0 || medications.length > 0;
}

/**
 * Protein per day from supplements.
 *
 * Reported, never subtracted from the target a plan is built against. Quietly
 * lowering the protein the food must supply would change a figure the user
 * reads as theirs, on the strength of a number they typed and nothing verifies —
 * and it would do it invisibly. The dashboard shows both and says which is which.
 */
export function supplementProteinG(supplements: readonly Supplement[]): number {
  return Math.round(supplements.reduce((total, supplement) => total + (supplement.proteinGPerServing ?? 0) * supplement.servingsPerDay, 0));
}
