import type { Catalogue } from 'core/entities/Plan';
import type { SafetyProfile } from 'core/entities/Safety';

export type IngredientAllergenLink = {
  readonly allergenId: string;
  readonly presence: 'contains' | 'may_contain';
};

export type CheckedIngredient = {
  readonly id: string;
  readonly allergens: readonly IngredientAllergenLink[];
  readonly name: string;
};

export type SafetyViolation = {
  readonly allergenId: string;
  readonly ingredientId: string;
  readonly ingredientName: string;
  /** `allergy` blocks outright; `intolerance` blocks by default and is user-overridable. */
  readonly kind: 'allergy' | 'intolerance';
  readonly presence: 'contains' | 'may_contain';
};

/**
 * The allergy gate.
 *
 * Every meal, replacement and shopping list passes through here before it can be
 * stored or shown. It compares allergen **ids** — never names, never model
 * output — so nothing depends on how a substance was spelled or on a prompt
 * being obeyed.
 *
 * Two tiers:
 *   - `contains`     blocks anyone who declared that allergy or intolerance.
 *   - `may_contain`  blocks only users who set `crossContaminationSensitive`.
 *     A trace warning is not the same claim as an ingredient, and treating it as
 *     one would empty the catalogue for everyone with a gluten allergy.
 *
 * Returns every violation rather than the first: a rejection message that names
 * one of three unsafe ingredients sends the user round the loop three times.
 */
export function findSafetyViolations(ingredients: readonly CheckedIngredient[], profile: SafetyProfile): readonly SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  for (const ingredient of ingredients) {
    for (const link of ingredient.allergens) {
      const isAllergy = profile.allergenIds.has(link.allergenId);
      const isIntolerance = profile.intoleranceAllergenIds.has(link.allergenId);

      if (!isAllergy && !isIntolerance) {continue;}

      // A trace warning only disqualifies the ingredient for users who said
      // traces affect them.
      if (link.presence === 'may_contain' && !profile.crossContaminationAllergenIds.has(link.allergenId)) {continue;}

      violations.push({
        allergenId: link.allergenId,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        kind: isAllergy ? 'allergy' : 'intolerance',
        presence: link.presence
      });
    }
  }

  return violations;
}

/** Convenience predicate. Prefer `findSafetyViolations` when you need to explain the rejection. */
export function isSafe(ingredients: readonly CheckedIngredient[], profile: SafetyProfile): boolean {
  return findSafetyViolations(ingredients, profile).length === 0;
}

/**
 * Builds the set-based profile the checks above consume.
 *
 * Sets, not arrays: validation runs per ingredient per meal per day — 14 days of
 * meals is thousands of lookups, and a linear scan through the allergy list for
 * each one is the difference between a check that always runs and one someone
 * later decides to skip "for performance".
 */
export function toSafetyProfile(
  allergies: readonly { allergenId: string; crossContaminationSensitive: boolean }[],
  intolerances: readonly { allergenId: string }[]
): SafetyProfile {
  return {
    allergenIds: new Set(allergies.map(a => a.allergenId)),
    crossContaminationAllergenIds: new Set(allergies.filter(a => a.crossContaminationSensitive).map(a => a.allergenId)),
    intoleranceAllergenIds: new Set(intolerances.map(i => i.allergenId))
  };
}

export type DishSafety =
  | { readonly kind: 'safe' }
  | { readonly kind: 'unknown_ingredients'; readonly slugs: readonly string[] }
  | { readonly kind: 'unsafe'; readonly violations: readonly SafetyViolation[] };

/**
 * The single gate for a dish, whichever direction it came from.
 *
 * Generated dishes and dishes reused from the library run through *this* function
 * — not through two similar-looking checks that can drift apart. A recipe already
 * existing in the database is not evidence that it is safe for a particular
 * person, so reuse is gated exactly as generation is
 * ([`0006`](../../../../../docs/decisions/0006-reuse-before-generating.md)).
 *
 * Resolution failure is reported separately from a safety failure: an unknown slug
 * means the dish cannot be costed or checked at all, which is a different problem
 * from a dish that resolves and is unsafe.
 */
export function dishSafety(ingredients: readonly { readonly slug: string }[], catalogue: Catalogue, profile: SafetyProfile): DishSafety {
  const resolved: CheckedIngredient[] = [];
  const slugs: string[] = [];

  for (const item of ingredients) {
    const ingredient = catalogue.get(item.slug);

    if (!ingredient) {
      slugs.push(item.slug);
      continue;
    }

    resolved.push({ id: ingredient.id, allergens: ingredient.allergens, name: ingredient.name });
  }

  if (slugs.length > 0) {return { kind: 'unknown_ingredients', slugs: [...new Set(slugs)] };}

  const violations = findSafetyViolations(resolved, profile);

  return violations.length > 0 ? { kind: 'unsafe', violations } : { kind: 'safe' };
}
