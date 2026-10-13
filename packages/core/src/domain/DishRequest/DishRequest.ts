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

/**
 * Whether what somebody typed is the shape of a request at all — one line,
 * within the bound, and without the quotes the prompt wraps it in.
 *
 * The quote is not cosmetic. The request is interpolated into the prompt inside
 * double quotes, and the comment there leans on that quoting to say the model is
 * reading somebody's words rather than an instruction of ours — so a request
 * ending the quote is an instruction (`invariant-reviewer`, 2026-10-13). The
 * prompt strips them as well; this is the half that can say so to the person.
 *
 * One definition, read by the route's schema and by the service, because two
 * places deciding what a request may look like is how they come to disagree.
 */
export function typedName(text: string): boolean {
  const trimmed = text.trim();

  return trimmed.length > 0 && trimmed.length <= MAX_DISH_REQUEST && !/["\n\r`]/.test(trimmed);
}

/** Why a model's dish may not be stored, for the caller to turn into a sentence. */
export type DishNameRefusal = 'not_a_name' | 'says_a_person' | 'unknown_words';

/**
 * What a dish name may be written with: Latin letters and the accents Spanish
 * and English need, digits, and the few marks a name uses to join them.
 *
 * Without it the vocabulary is blind to everything `normaliseForMatching` folds
 * away — it flattens every character outside `[a-z0-9]` to a space, so a name
 * carrying a telephone number, a line of Han or Cyrillic, or a row of emoji
 * passed word by word and was **stored with those characters intact** and sent
 * verbatim to Google in the picture prompt. The gate's whole principle is that
 * it never trusts what the model wrote; this is where that stopped being true
 * (`invariant-reviewer`, 2026-10-13).
 *
 * A closed set rather than a list of what to refuse: the two recipients are a
 * shared library and a picture prompt, and both are better served by a name
 * this product can read.
 */
const NAME_CHARACTERS = /^[\p{Script=Latin}0-9 ,&'’-]+$/u;

/**
 * The most digits a number in a dish name may have, and the most numbers.
 *
 * A name counts what is in it — *tortilla de 3 huevos*, *ensalada de 4 quesos*
 * — and that is the whole of what a number does in one. Two numbers, or one
 * past three digits, is a telephone, a date or an identifier.
 */
const NAME_DIGITS = 3;

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
 * The first person alone, for prose — the half of `SPEAKS_OF_A_PERSON` a method
 * has no reason to use. The second person is left out on purpose: *"a tu
 * gusto"* is how a recipe talks to whoever is cooking it.
 */
const SPEAKS_OF_THEIR_OWN = new Set(['conmigo', 'mi', 'mis', 'my', 'nuestra', 'nuestras', 'nuestro', 'nuestros', 'our', 'ours', 'yo']);

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
  // looks like a way to reach somebody, and nothing written in characters this
  // product does not serve food in.
  if (trimmed.length === 0 || trimmed.length > MAX_DISH_REQUEST || /[\n\r?!¿¡@]|https?:/i.test(trimmed) || !NAME_CHARACTERS.test(trimmed)) {
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

  const numbers = said.filter(word => /^[0-9]+$/.test(word));
  const counts = numbers.length === 1 && (numbers[0]?.length ?? 0) <= NAME_DIGITS;

  return said.every(word => vocabulary.has(stem(word)) || (counts && /^[0-9]+$/.test(word)))
    ? { ok: true }
    : { ok: false, reason: 'unknown_words' };
}

/**
 * Whether the **prose** a model wrote for a requested dish may be stored: its
 * steps, their cues and its cuisine.
 *
 * `storableName` was the whole gate, and it covered a tenth of what is stored.
 * A recipe is up to ten steps of six hundred characters, written by a model
 * under a prompt that quotes the person's words — and stored verbatim in the
 * same shared table, serving every account in that locale for ever. A request
 * reading *"tortilla para mi madre, que toma metformina"* came back with a
 * gated name and a method that could say it (`invariant-reviewer`, 2026-10-13).
 *
 * **The vocabulary is deliberately not applied here.** A method legitimately
 * says *"a tu gusto"*, *"si te gusta más jugoso"* — second person is how a
 * recipe speaks to whoever cooks it — and a word-for-word vocabulary would
 * refuse half the library's methods. What is checked instead is what cannot be
 * innocent in a method: this account's own words, a way to reach somebody, a
 * number long enough to be a telephone, and letters from a script this product
 * does not write recipes in.
 *
 * First person is included and second person is not, and that is the line: a
 * method may address its cook, it has no reason to speak of *mi* anybody.
 */
export function storableProse(texts: readonly string[], person: { readonly health: readonly string[]; readonly name: string }): DishNameVerdict {
  const theirs = new Set([...words(person.name), ...person.health.flatMap(entry => words(entry))].filter(word => word.length > 2));

  for (const text of texts) {
    if (/[@]|https?:/i.test(text) || /[0-9]{5,}/.test(text)) {
      return { ok: false, reason: 'not_a_name' };
    }

    // Any letter left once the Latin ones are taken out is a script no recipe
    // of ours is written in.
    if (/\p{Letter}/u.test(text.replace(/\p{Script=Latin}/gu, ''))) {
      return { ok: false, reason: 'not_a_name' };
    }

    for (const word of words(text)) {
      if (SPEAKS_OF_THEIR_OWN.has(word) || theirs.has(word)) {
        return { ok: false, reason: 'says_a_person' };
      }
    }
  }

  return { ok: true };
}
