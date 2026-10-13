import { normaliseForMatching } from 'core/domain/Safety';

import type { Catalogue } from 'core/entities/Plan';

/**
 * Somebody asking for a dish the library does not have, by typing its name
 * (report `0011` § 4 a; the conditions in `docs/legal/analysis.md`, "P0-3's
 * status at 2026-10-13").
 *
 * **This is the only field in the product whose content a person writes and a
 * model reads.** Everything else that reaches a model is a number, a catalogue
 * name or a closed enum, and `health-boundary.spec.ts` holds that line. The
 * exception is deliberate, it is published, and it is narrow: one dish name.
 *
 * What makes it worth guarding is not the model call. It is the two places the
 * answer comes back out:
 *
 * - **the library is shared** (`recipes` is global, `createdBy` is provenance
 *   with `onDelete: 'set null'`), so a stored dish is in front of every other
 *   account, for ever, outliving the account that asked for it;
 * - **the picture prompt carries the dish's name verbatim** to Google (Vertex),
 *   a recipient `/privacidad` promises the dish path never touches.
 *
 * So the typed string is transient — prompt input and nothing else — and the
 * *name the model writes back* is gated before it is stored. Without the second
 * half the first is cosmetic: the words return through the name.
 */

/**
 * One line, and short enough to read as a name rather than a message box.
 *
 * It is honest about what it buys: a determined person fits a sentence into a
 * hundred and twenty characters, so this is framing, not safety. The safety is
 * `storableName` and the notice beside the field.
 */
export const MAX_DISH_REQUEST = 120;

/** Why a model's dish may not be stored, for the caller to turn into a sentence. */
export type DishNameRefusal = 'not_a_name' | 'says_a_person' | 'unknown_words';

export type DishNameVerdict = { readonly ok: false; readonly reason: DishNameRefusal } | { readonly ok: true };

/**
 * First and second person, which is how a person gets into a dish name: *"para
 * mí"*, *"la cena de mi hijo"*, *"my daughter's dinner"*.
 *
 * Third person is deliberately absent: *"a la riojana"*, *"del abuelo"* and
 * *"de la casa"* are how Spanish names dishes, and refusing them would refuse
 * the language rather than the risk.
 */
const SPEAKS_OF_A_PERSON = new Set([
  'conmigo',
  'contigo',
  'me',
  'mi',
  'mis',
  'my',
  'nos',
  'nuestra',
  'nuestras',
  'nuestro',
  'nuestros',
  'our',
  'ours',
  'te',
  'ti',
  'tu',
  'tus',
  'tuya',
  'tuyo',
  'us',
  'we',
  'you',
  'your',
  'yours',
  'yo'
]);

/**
 * The words a dish name may be made of besides food: how it is cooked, how it
 * is served, and the joins Spanish and English need to make a phrase.
 *
 * A closed list on purpose. It is read beside the catalogue's own words and the
 * library's existing names, and together those three are the vocabulary a dish
 * name is allowed to use.
 */
const COOKING_WORDS = new Set([
  'a',
  'ahumado',
  'ahumada',
  'ajillo',
  'al',
  'alinado',
  'aliñado',
  'and',
  'asada',
  'asado',
  'baked',
  'bowl',
  'braised',
  'brasa',
  'caldoso',
  'caliente',
  'casera',
  'casero',
  'cocida',
  'cocido',
  'con',
  'confitado',
  'crema',
  'cremosa',
  'cremoso',
  'crujiente',
  'crudo',
  'de',
  'del',
  'ensalada',
  'escalfado',
  'especiado',
  'estilo',
  'estofado',
  'fresca',
  'fresco',
  'fria',
  'fría',
  'fried',
  'frio',
  'frío',
  'frito',
  'glaseado',
  'gratinado',
  'grilled',
  'guisado',
  'horno',
  'in',
  'jugosa',
  'jugoso',
  'la',
  'las',
  'light',
  'ligera',
  'ligero',
  'los',
  'marinado',
  'on',
  'papillote',
  'parrilla',
  'plancha',
  'poached',
  'pure',
  'puré',
  'rapido',
  'rápido',
  'rehogado',
  'relleno',
  'rellena',
  'revuelto',
  'roast',
  'roasted',
  'salsa',
  'salteado',
  'salteada',
  'sin',
  'sobre',
  'sopa',
  'stew',
  'stewed',
  'style',
  'templado',
  'the',
  'tibia',
  'tibio',
  'to',
  'tostado',
  'tostada',
  'vapor',
  'warm',
  'with',
  'y'
]);

/** Lower-cased, unaccented words of a name, punctuation dropped. */
function words(text: string): readonly string[] {
  return normaliseForMatching(text)
    .split(/[^a-z0-9]+/)
    .filter(word => word.length > 0);
}

/**
 * A word without its plural, crudely.
 *
 * The catalogue names an ingredient in the singular — *Patata*, *Huevo* — and a
 * dish names it in the plural — *Tortilla de patatas*, *Tortilla de 3 huevos*.
 * Matched word for word the vocabulary refused half the real names in the
 * library, which a test caught before this shipped.
 *
 * Deliberately crude: it only ever *loosens* the vocabulary, and nothing about
 * safety rests on it. The checks that do — this account's own name and its
 * health words — are exact and run before it.
 */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('es')) {
    return word.slice(0, -2);
  }

  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * The vocabulary a stored dish name may draw on: the catalogue's ingredient
 * names, the names the library already uses, and `COOKING_WORDS`.
 *
 * Built from what the product already holds rather than written down, so it
 * grows with the library — a word that has never named a dish here is exactly
 * the kind of word a request can smuggle in.
 */
export function dishVocabulary(catalogue: Catalogue, libraryNames: readonly string[]): ReadonlySet<string> {
  const known = new Set([...COOKING_WORDS].map(stem));

  for (const ingredient of catalogue.values()) {
    for (const word of words(ingredient.name)) {
      known.add(stem(word));
    }
  }

  for (const name of libraryNames) {
    for (const word of words(name)) {
      known.add(stem(word));
    }
  }

  return known;
}

/**
 * Whether the name a model wrote for a requested dish may be stored.
 *
 * **The rule is a vocabulary and not a classifier**, and that is the whole of
 * why it is defensible: it never asks what a word *means*, only whether this
 * product has ever used it to name food. Personal content is made of words the
 * catalogue and the library have never needed — a person's name, a condition, a
 * medication, who the dish is for.
 *
 * It errs towards dropping, and the cost of that is a real dish refused for one
 * unfamiliar word. That is the right direction: a refused dish is a sentence
 * saying so, and a stored one is in front of everybody for ever and on its way
 * to Google in a picture prompt.
 *
 * `person` is this account's own name and whatever health words it holds —
 * conditions, medications, supplements — which are checked whatever the
 * vocabulary says, because the library *could* contain a word that is also
 * somebody's surname.
 */
export function storableName(
  name: string,
  vocabulary: ReadonlySet<string>,
  person: { readonly health: readonly string[]; readonly name: string }
): DishNameVerdict {
  const trimmed = name.trim();

  // A dish name is a phrase: one line, no sentence punctuation, nothing that
  // looks like a way to reach somebody.
  if (trimmed.length === 0 || trimmed.length > MAX_DISH_REQUEST || /[\n\r?!¿¡@]|https?:/i.test(trimmed)) {
    return { ok: false, reason: 'not_a_name' };
  }

  const said = words(trimmed);

  if (said.length === 0) {
    return { ok: false, reason: 'not_a_name' };
  }

  const theirs = new Set([...words(person.name), ...person.health.flatMap(entry => words(entry))].filter(word => word.length > 2));

  for (const word of said) {
    if (SPEAKS_OF_A_PERSON.has(word) || theirs.has(word)) {
      return { ok: false, reason: 'says_a_person' };
    }
  }

  return said.every(word => vocabulary.has(stem(word)) || /^[0-9]+$/.test(word)) ? { ok: true } : { ok: false, reason: 'unknown_words' };
}
