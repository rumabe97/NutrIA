import { normaliseForMatching, synonymsOf } from 'core/domain/Safety';

import type { IngredientAllergenLink } from 'core/domain/Safety';
import type { SafetyProfile } from 'core/entities/Safety';

/** A catalogue ingredient, by every name it has in every locale the service loaded. */
export type NetIngredient = { readonly id: string; readonly allergens: readonly IngredientAllergenLink[]; readonly names: readonly string[] };

/** An allergen, by every name it has in every locale the service loaded. */
export type NetAllergen = { readonly id: string; readonly names: readonly string[] };

/**
 * One food this person cannot eat, as the net looks for it.
 *
 * `told` marks a food the catalogue resolved (true) apart from a free-text
 * allergy that matched no row (false). **Neither is sent to a model** since
 * 2026-11-10 (`docs/decisions/LOG.md`): the profile consent says the model
 * never receives allergies, so the net searches answers for them here, after
 * the model has answered, and withholds rather than promises.
 */
export type ForbiddenFood = { readonly display: string; readonly terms: readonly string[]; readonly told: boolean };

/** Shorter than this, a word is part of too many others to search for safely as one. */
const SHORTEST_TERM = 3;

/**
 * The forms a word is searched in: as written, and its plural or singular.
 *
 * **This is morphology, and `CustomAllergen.ts` refuses morphology on purpose.**
 * The two are opposite questions. There, a derived form turns somebody's words
 * into a promise that a food is excluded, so a wrong form is a person eating
 * what the screen said was gone. Here, a derived form widens what an answer is
 * searched for, so a wrong form withholds an answer that was safe. Over-matching
 * is the safe direction of this file and the dangerous direction of that one.
 *
 * Multi-word terms vary their first word, which is the one that carries the
 * number in both languages: «nuez de macadamia» → «nueces de macadamia».
 */
function forms(term: string): readonly string[] {
  const [first = '', ...rest] = term.split(' ');
  const tail = rest.length > 0 ? ` ${rest.join(' ')}` : '';
  const variants = new Set<string>([first]);

  if (first.endsWith('z')) {
    variants.add(`${first.slice(0, -1)}ces`);
  } else if (first.endsWith('ces')) {
    variants.add(`${first.slice(0, -3)}z`);
  } else if (first.endsWith('es')) {
    variants.add(first.slice(0, -2));
    variants.add(first.slice(0, -1));
  } else if (first.endsWith('s')) {
    variants.add(first.slice(0, -1));
  } else {
    variants.add(`${first}s`);
    variants.add(`${first}es`);
  }

  return [...variants].map(variant => `${variant}${tail}`);
}

function termsOf(names: readonly string[]): readonly string[] {
  const terms = new Set<string>();

  for (const name of names) {
    for (const written of [name, ...synonymsOf(name)]) {
      const normalised = normaliseForMatching(written);

      if (normalised.length >= SHORTEST_TERM) {
        forms(normalised).forEach(form => terms.add(form));
      }
    }
  }

  return [...terms].sort();
}

/**
 * Every food this person cannot eat, built once from their safety profile and
 * the catalogue — pure; reading the catalogue is the service's (phase 4).
 *
 * **The same two tiers as `findSafetyViolations`**, because a net that drew the
 * line somewhere else would withhold answers the plate gate allows, or allow
 * what it withholds:
 *
 * - every declared allergen and intolerance, by its own names;
 * - every ingredient that **contains** one of them;
 * - every ingredient that **may contain** one, only for an allergen the person
 *   said they react to in traces (`crossContaminationAllergenIds`);
 * - every ingredient their free-text allergies resolved to (`excludedIngredientIds`);
 * - and, searched but never told, every free-text allergy that resolved to
 *   nothing (`unenforceableLabels`).
 */
export function forbiddenFoods(
  profile: SafetyProfile,
  ingredients: readonly NetIngredient[],
  allergens: readonly NetAllergen[]
): readonly ForbiddenFood[] {
  const declared = new Set([...profile.allergenIds, ...profile.intoleranceAllergenIds]);
  const foods: ForbiddenFood[] = [];

  for (const allergen of allergens) {
    if (declared.has(allergen.id) && allergen.names.length > 0) {
      foods.push({ display: allergen.names[0] ?? '', terms: termsOf(allergen.names), told: true });
    }
  }

  for (const ingredient of ingredients) {
    const excluded =
      profile.excludedIngredientIds.has(ingredient.id) ||
      ingredient.allergens.some(
        link => declared.has(link.allergenId) && (link.presence === 'contains' || profile.crossContaminationAllergenIds.has(link.allergenId))
      );

    if (excluded && ingredient.names.length > 0) {
      foods.push({ display: ingredient.names[0] ?? '', terms: termsOf(ingredient.names), told: true });
    }
  }

  for (const label of profile.unenforceableLabels) {
    foods.push({ display: label, terms: termsOf([label]), told: false });
  }

  return foods.filter(food => food.terms.length > 0);
}

/**
 * The words before a food that say it is being **left out**, normalised as
 * `normaliseForMatching` writes them, each with an optional article after it.
 * A closed list, and only these: «sin huevo», «en vez de huevo», «sustituir el
 * huevo», «without egg», «instead of egg». Not «no lleva huevo» or «egg-free»:
 * those **claim** a dish lacks the food, and a wrong claim is what this net is
 * for. A word that puts the food in — «usa huevo», «por huevo» — never excuses.
 */
const LEAVING_OUT = new RegExp(
  `(?:^| )(?:${[
    'sin',
    'en vez de',
    'en vez del',
    'en lugar de',
    'en lugar del',
    'sustituir',
    'sustituye',
    'sustituyes',
    'reemplazar',
    'reemplaza',
    'without',
    'instead of',
    'replace',
    'substitute'
  ].join('|')})(?: (?:el|la|los|las|lo|tu|tus|the|your|a|an|un|una))?$`
);

/** Where `term` stands in `text` (both padded with spaces), every time. */
function positions(text: string, term: string): readonly number[] {
  const found: number[] = [];
  const needle = ` ${term} `;

  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    found.push(at);
  }

  return found;
}

/**
 * The first food an answer names that this person cannot eat, or null — the
 * allergen net (PRD criterion 7).
 *
 * **The plate is protected by ids; this is protected by spelling.** Everywhere
 * else in this product, a model's suggestion becomes something a person eats
 * only after `findSafetyViolations` has compared allergen ids against a
 * structured catalogue, and nothing there depends on how a word is written.
 * Here the model's own words reach a person directly, and the assistant **does**
 * propose food — an idea, a dish, a recipe — so this is the one net in the
 * product with nothing stronger behind it. A hit withholds the whole answer;
 * it never edits one, because an answer with a word taken out is an answer
 * nobody reviewed.
 *
 * It is strict on purpose, with **one narrow exception** (owner, 2026-11-11,
 * after the model measurement withheld two safe egg-free tortillas): a food
 * the person **named in their own question** may be named back when it is
 * being left out — right after a word in `LEAVING_OUT`. «¿Qué le pongo en vez
 * de huevo?» → «Para sustituir el huevo, usa harina de garbanzo» is shown.
 * **Every** mention must be excused: one more «huevo» anywhere else, a food
 * the question never named, or a question that is not given, and the answer is
 * withheld as before. The model is still not told the foods (they are health
 * data, and the consent says it never receives them).
 */
export function answerNamesAnAllergen(answer: string, forbidden: readonly ForbiddenFood[], question = ''): ForbiddenFood | null {
  const text = ` ${normaliseForMatching(answer)} `;
  const asked = ` ${normaliseForMatching(question)} `;

  return (
    forbidden.find(food => {
      const named = food.terms.some(term => asked.includes(` ${term} `));

      return food.terms.some(term => positions(text, term).some(at => !named || !LEAVING_OUT.test(text.slice(0, at))));
    }) ?? null
  );
}
