import type { Catalogue } from 'core/entities/Plan';
import type { MatchableIngredient } from './CustomAllergen';
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
  /** Null for a free-text allergy: it excludes an ingredient, not an allergen. */
  readonly allergenId: string | null;
  readonly ingredientId: string;
  readonly ingredientName: string;
  /**
   * `allergy` blocks outright; `intolerance` blocks by default and is
   * user-overridable; `custom_allergen` is a free-text entry that resolved to
   * this exact ingredient and blocks exactly as an allergy does.
   */
  readonly kind: 'allergy' | 'custom_allergen' | 'intolerance';
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
    // A free-text allergy that resolved to a catalogue row excludes that row
    // outright, whatever it is or is not linked to. Same function, same loop,
    // same rejection — the entry is enforced identically to a listed allergen
    // because it goes through the identical gate, not a parallel one.
    if (profile.excludedIngredientIds.has(ingredient.id)) {
      violations.push({
        allergenId: null,
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        kind: 'custom_allergen',
        presence: 'contains'
      });
    }

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
  intolerances: readonly { allergenId: string }[],
  customAllergens: readonly { ingredientId: string | null; label: string }[] = [],
  ingredients: readonly MatchableIngredient[] = []
): SafetyProfile {
  const anchors = customAllergens.map(entry => entry.ingredientId).filter((id): id is string => id !== null);

  return {
    allergenIds: new Set(allergies.map(a => a.allergenId)),
    crossContaminationAllergenIds: new Set(allergies.filter(a => a.crossContaminationSensitive).map(a => a.allergenId)),
    excludedIngredientIds: new Set([...anchors, ...madeOf(anchors, ingredients)]),
    intoleranceAllergenIds: new Set(intolerances.map(i => i.allergenId)),
    // The split is the whole point: what resolved is enforced, what did not is
    // carried separately and labelled as unenforceable all the way to the screen.
    unenforceableLabels: customAllergens.filter(entry => entry.ingredientId === null).map(entry => entry.label)
  };
}

/**
 * Every catalogue row made of an excluded ingredient, by its slug.
 *
 * A free-text allergy resolves to one row — "tomate" to `tomate` — and the
 * catalogue also holds `tomate-frito`, `zumo-de-tomate`, `concentrado-de-tomate`.
 * Excluding the one row while the interface says the allergy is enforced is the
 * failure `CustomAllergen` warns about, in the other direction: narrower than
 * the word the person used. So the anchor's slug, as whole hyphen-separated
 * tokens, is looked for as a run inside every other slug: `tomate` is in
 * `zumo-de-tomate` and not in `tomatillo`; `pan` is in `pan-rallado` and not in
 * `panceta`. Whole tokens, not substrings, and only downstream of an exact
 * match — the matching rule itself is unchanged.
 */
export function madeOf(anchorIds: readonly string[], ingredients: readonly MatchableIngredient[]): readonly string[] {
  if (anchorIds.length === 0 || ingredients.length === 0) {return [];}

  const byId = new Map(ingredients.map(ingredient => [ingredient.id, ingredient]));
  const runs = anchorIds.map(id => byId.get(id)?.slug.split('-') ?? []).filter(tokens => tokens.length > 0);
  const containsRun = (tokens: readonly string[], run: readonly string[]): boolean =>
    tokens.some((_token, start) => run.every((word, offset) => tokens[start + offset] === word));

  return ingredients.filter(ingredient => runs.some(run => containsRun(ingredient.slug.split('-'), run))).map(ingredient => ingredient.id);
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
