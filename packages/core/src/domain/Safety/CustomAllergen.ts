/**
 * Resolving free-text allergies against the ingredient catalogue.
 *
 * The rule this file exists to hold: **a near-match that is wrong is worse than
 * no match at all.** An unmatched entry is shown to the user as something we
 * cannot guarantee, which is an honest answer they can act on. A wrong match is
 * shown as *enforced*, and someone eats it.
 *
 * So: normalised exact comparison, plus a hand-curated synonym list, and
 * nothing else. No stemming, no substring search, no edit distance, no "did you
 * mean". Every one of those turns a typo into a promise.
 */

export type MatchableIngredient = { readonly id: string; readonly name: string; readonly slug: string };

export type ResolvedCustomAllergen = {
  /** Null when the text matched nothing — best-effort, never presented as enforced. */
  readonly ingredientId: string | null;
  /** Exactly as the user typed it, trimmed. Shown back to them, never compared. */
  readonly label: string;
};

/** Keyed by normalised name and slug; the value is the ingredient id. */
export type MatchIndex = ReadonlyMap<string, string>;

/**
 * Accents stripped, case folded, punctuation and hyphens flattened to single
 * spaces. `Brócoli`, `brocoli` and the slug `brocoli` all land on the same key,
 * which is what makes an exact comparison usable on text a person typed.
 */
export function normaliseForMatching(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Curated equivalences, normalised on both sides: what someone types → what the
 * catalogue calls it.
 *
 * Two admission rules, and they are the whole of the safety argument here:
 *
 *  1. **One name, one ingredient.** A word naming a *group* — `marisco`,
 *     `frutos secos`, `lácteos`, `pescado`, `gluten`, `soja` — is deliberately
 *     absent. Mapping `marisco` to `gambas` would exclude gambas and leave
 *     mejillón, almeja, calamar and pulpo on the plate while the interface said
 *     the allergy was enforced. Narrower than the words the user used is the
 *     same failure as matching the wrong thing.
 *  2. **No morphology.** Plurals and regionalisms are listed one by one rather
 *     than derived by chopping an `s`, because the derivation is right until the
 *     day it is not and nobody is watching when it stops being right.
 */
const SYNONYMS: ReadonlyMap<string, string> = new Map([
  ['ajonjoli', 'sesamo'],
  ['almejas', 'almeja'],
  ['almendra', 'almendras'],
  ['anacardo', 'anacardos'],
  ['avellana', 'avellanas'],
  ['banana', 'platano'],
  ['bananas', 'platano'],
  ['cacahuate', 'cacahuetes'],
  ['cacahuete', 'cacahuetes'],
  ['castana de caju', 'anacardos'],
  ['cebollas', 'cebolla'],
  ['champinones', 'champinon'],
  ['durazno', 'melocoton'],
  ['duraznos', 'melocoton'],
  ['fresas', 'fresa'],
  ['gamba', 'gambas'],
  ['huevos', 'huevo'],
  ['kiwis', 'kiwi'],
  ['limones', 'limon'],
  ['mani', 'cacahuetes'],
  ['manzanas', 'manzana'],
  ['mejillones', 'mejillon'],
  ['melocotones', 'melocoton'],
  ['naranjas', 'naranja'],
  ['papa', 'patata'],
  ['papas', 'patata'],
  ['patatas', 'patata'],
  ['pepinos', 'pepino'],
  ['peras', 'pera'],
  ['pistacho', 'pistachos'],
  ['platanos', 'platano'],
  ['sardinas', 'sardina'],
  ['semillas de sesamo', 'sesamo'],
  ['tomates', 'tomate'],
  ['uvas', 'uva'],
  ['zanahorias', 'zanahoria']
]);

/**
 * Builds the lookup once per save.
 *
 * A key that two different ingredients claim is dropped rather than resolved to
 * whichever came first. The catalogue has no such collision today; it grows, and
 * the day it does the honest answer is "we could not tell", not a coin toss.
 */
export function toMatchIndex(ingredients: readonly MatchableIngredient[]): MatchIndex {
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();

  for (const ingredient of ingredients) {
    for (const key of [normaliseForMatching(ingredient.name), normaliseForMatching(ingredient.slug)]) {
      if (key === '') {
        continue;
      }

      const existing = index.get(key);

      if (existing !== undefined && existing !== ingredient.id) {
        ambiguous.add(key);
        continue;
      }

      index.set(key, ingredient.id);
    }
  }

  for (const key of ambiguous) {
    index.delete(key);
  }

  return index;
}

/** The id of the ingredient this text names, or null. Never a guess. */
export function matchCustomAllergen(label: string, index: MatchIndex): string | null {
  const normalised = normaliseForMatching(label);

  if (normalised === '') {
    return null;
  }

  const direct = index.get(normalised);

  if (direct !== undefined) {
    return direct;
  }

  const synonym = SYNONYMS.get(normalised);

  return synonym === undefined ? null : (index.get(synonym) ?? null);
}

/**
 * Resolves a whole list, dropping blanks and keeping the first of any duplicate
 * text so a user cannot end up with the same allergy twice from one save.
 */
export function resolveCustomAllergens(labels: readonly string[], ingredients: readonly MatchableIngredient[]): readonly ResolvedCustomAllergen[] {
  const index = toMatchIndex(ingredients);
  const seen = new Set<string>();
  const resolved: ResolvedCustomAllergen[] = [];

  for (const raw of labels) {
    const label = raw.trim();
    const key = normaliseForMatching(label);

    if (key === '' || seen.has(key)) {
      continue;
    }

    seen.add(key);
    resolved.push({ ingredientId: matchCustomAllergen(label, index), label });
  }

  return resolved;
}
