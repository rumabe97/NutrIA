import { matchCustomAllergen, normaliseForMatching, toMatchIndex } from 'core/domain/Safety';

import type { MatchableIngredient } from 'core/domain/Safety';

/**
 * Turning a cupboard word into a catalogue row.
 *
 * **This is the dislike side of the line, not the allergy side**, and the whole
 * matcher follows from that. `matchCustomAllergen` refuses a group word because
 * narrowing *marisco* to prawns leaves mussels on the plate of somebody who
 * could die of them; `isEnforceableDislike` expands one, because *"the risk
 * runs the other way"*. Here the risk runs the other way too, and further: the
 * failure mode of a wrong match is a shopping row somebody still has to buy, or
 * one they did not need to. Annoying, never harmful. So the matcher may be the
 * generous one.
 *
 * What it may **not** do is claim a safety property. A pantry entry neither
 * adds to nor subtracts from a `SafetyProfile`, it is never read as an
 * intolerance, a dislike, a diet or a condition, and it never removes a dish
 * (PRD 022, criterion 8; `0102`'s rule for a preference, for the same reason).
 * `SafetyController.getSafetyProfile` stays the only place a safety profile is
 * assembled.
 *
 * And it is **not a third normaliser**: the index, the normalisation and the
 * curated synonyms are `core/domain/Safety`'s, reused whole. The only thing
 * this file adds is the coarse-word map below, which is the one question the
 * cupboard asks that neither of its two precedents does.
 */

/**
 * The ordinary answer to a word somebody owns but the catalogue only holds in
 * varieties: *«tengo arroz»* over sixteen rice rows.
 *
 * Without this a coarse word resolves to nothing, and the entry — kept, as an
 * unresolved entry always is — covers no shopping row, which is the whole of
 * what the feature does. The alternative is making the person choose which of
 * sixteen rices is in their cupboard, which is not a question anybody has an
 * answer to, and the raw/cooked distinction (`0078`) is ours to carry rather
 * than theirs (PRD 022 § *Scope*).
 *
 * Two admission rules, and they are the whole of why this list is short:
 *
 *  1. **The word must have exactly one ordinary answer in a Spanish kitchen.**
 *     *queso* has none — thirty-eight cheeses and no default — so it is
 *     deliberately absent and resolves to nothing, which is the honest answer
 *     and the one that reaches `/admin` as a catalogue gap worth a word. Picking
 *     a cheese for somebody would buy them the wrong row and tell them it was
 *     theirs.
 *  2. **The dry or raw form wins where the catalogue holds both.** A fortnight's
 *     list merges cooked and dry into one row *named and slugged after the dry
 *     food* (`shopping.schema.ts`, `0078`), so a cupboard of rice is dry rice or
 *     it covers nothing.
 *
 * No morphology, as in `SYNONYMS`: a plural is listed or it is not matched,
 * because a derivation is right until the day it is not and nobody is watching
 * when it stops being right. The map grows by review, one word at a time, and
 * `Pantry.seed.test.ts` fails if a target ever leaves the catalogue.
 */
const COARSE_LABELS: ReadonlyMap<string, string> = new Map([
  ['aceite', 'aceite-de-oliva-virgen-extra'],
  ['aceite de oliva', 'aceite-de-oliva-virgen-extra'],
  ['arroz', 'arroz-largo-crudo'],
  ['atun', 'atun-al-natural'],
  ['azucar', 'azucar-blanco'],
  ['garbanzos', 'garbanzos-secos'],
  ['harina', 'harina-de-trigo'],
  ['leche', 'leche-entera'],
  ['lentejas', 'lentejas-secas'],
  ['pan', 'pan-blanco'],
  ['pasta', 'macarrones-secos']
]);

/** Every slug the coarse map points at — what `Pantry.seed.test.ts` holds the catalogue to. */
export const COARSE_LABEL_TARGETS: readonly string[] = [...new Set(COARSE_LABELS.values())];

/**
 * The key a cupboard word is stored and compared under.
 *
 * It is `normaliseForMatching` and not a function of its own: the uniqueness of
 * an unresolved entry is a partial unique index on this value
 * (`pantry_items_one_per_unresolved_label`), so *«Arroz»* and *«arroz »* have to
 * be the same key here and in the matcher, and two normalisers that agreed
 * until they did not would make the index disagree with the resolver.
 */
export function pantryKey(label: string): string {
  return normaliseForMatching(label);
}

/**
 * The id of the catalogue row this cupboard word names, or null.
 *
 * Exact name or slug first, through the allergy matcher's own index and its
 * curated synonyms; then the coarse word. **Null is kept, never dropped and
 * never guessed** (PRD 022, criterion 12): the entry stays in the list with the
 * word the person used, and in aggregate those words are the catalogue's own
 * to-do list.
 *
 * The index is built per call, as `resolveCustomAllergens` builds it per save:
 * one entry is written at a time and nine hundred rows of two names cost
 * nothing beside the write.
 */
export function resolvePantryLabel(label: string, ingredients: readonly MatchableIngredient[]): string | null {
  const index = toMatchIndex(ingredients);
  const direct = matchCustomAllergen(label, index);

  if (direct !== null) {
    return direct;
  }

  const coarse = COARSE_LABELS.get(pantryKey(label));

  // The slug is looked up through the same index rather than kept as a second
  // source of ids: `toMatchIndex` already keys every row by its normalised slug,
  // so a target that left the catalogue resolves to nothing instead of to a row
  // that is no longer there.
  return coarse === undefined ? null : (index.get(normaliseForMatching(coarse)) ?? null);
}
