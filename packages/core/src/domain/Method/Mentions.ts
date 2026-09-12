import { normaliseForMatching } from 'core/domain/Safety';

/**
 * What a written method says about food, against what the dish contains.
 *
 * A method is prose, and prose is where a model adds what the recipe never had:
 * "sprinkle with sesame", "a pinch of salt", "serve with bread". The dish's
 * ingredients were checked against somebody's allergies; the words were not. So
 * a rewritten method is read back before it is stored, and refused if it names a
 * food the dish does not contain, or never says where one of its own goes.
 *
 * Deliberately lenient in one direction and strict in the other. An ingredient
 * counts as used if any of its main words appears — "el pollo" for "Pechuga de
 * pollo", "los tomates" for "Tomate". A food counts as foreign only if its whole
 * catalogue name appears and no ingredient of the dish contains that name — so
 * "el arroz" in a dish of "Arroz integral" is the dish's own rice.
 */
export type MethodMentions = {
  /** Catalogue foods the method names that the dish does not contain. */
  readonly foreign: readonly string[];
  /** Ingredients of the dish the method never names. */
  readonly missing: readonly string[];
};

/**
 * Words a method may use that name no ingredient: what a technique adds
 * (water to boil in, ice to cool with) and the category words a cook uses for
 * something already on the plate — "turn the fish", "rest the meat".
 */
const ALWAYS_ALLOWED: ReadonlySet<string> = new Set([
  'agua',
  'carne',
  'fish',
  'fruit',
  'fruta',
  'hielo',
  'hortalizas',
  'ice',
  'meat',
  'pescado',
  'vegetables',
  'verdura',
  'verduras',
  'water'
]);

/**
 * Catalogue foods whose one-word name is also an ordinary word of a cook's
 * prose, and is far likelier to be that. A real rewrite of a turkey wrap was
 * refused for "dorada por fuera" — golden, not the sea bream — and the food-safety
 * line every method is asked for says "no pink", "sin partes rosadas", which is
 * also a fish. Chosen from the catalogue's single-word names, one by one.
 */
const ALSO_A_WORD: ReadonlySet<string> = new Set([
  'bonito', // pretty
  'cuajada', // set, of an egg — 43 stored methods said "hasta que la clara esté cuajada"
  'dorada', // golden
  'gallo', // "pico de gallo", a salsa
  'mango', // a pan's handle
  'naranja', // the colour
  'orange', // the colour
  'pasas', // "pasa a un plato"
  'raya', // a line
  'rosada', // pink
  'sepia', // the colour
  'sole' // only
]);

/** Words in an ingredient's name that say what state it is in, not what it is. */
const QUALIFIERS: ReadonlySet<string> = new Set([
  'al',
  'and',
  'cocida',
  'cocido',
  'cocidos',
  'con',
  'congelada',
  'congelado',
  'cooked',
  'de',
  'del',
  'desnatado',
  'dried',
  'dulce',
  'en',
  'entero',
  'extra',
  'fresca',
  'fresco',
  'fresh',
  'frozen',
  'ground',
  'gruesa',
  'grueso',
  'integral',
  'la',
  'las',
  'los',
  'magra',
  'magro',
  'molida',
  'molido',
  'natural',
  'of',
  'picada',
  'picado',
  'rallada',
  'rallado',
  'raw',
  'seca',
  'seco',
  'secos',
  'virgen',
  'whole',
  'with',
  'y'
]);

/**
 * Words that name a part of a food rather than another food: the breast or the
 * thigh of the bird on the list, the white of its egg, the juice or the zest of
 * its orange. "Pechuga de pavo" in a dish of "Pavo" is the dish's turkey.
 */
const PARTS: ReadonlySet<string> = new Set([
  'alitas',
  'clara',
  'claras',
  'contramuslo',
  'dientes',
  'filete',
  'filetes',
  'hojas',
  'lomo',
  'loncha',
  'lonchas',
  'muslo',
  'pechuga',
  'piel',
  'pierna',
  'ralladura',
  'solomillo',
  'yema',
  'yemas',
  'zumo'
]);

/**
 * Whether a catalogue food is one of the dish's ingredients under a more
 * particular name: take away the parts and the states, and what is left is all
 * in the ingredient's own name. "Filete de ternera" in a dish of "Ternera
 * magra" is; "Caldo de pollo" in a dish of "Pechuga de pollo" is not — broth is
 * not a part of a chicken breast.
 */
function isPartOf(food: readonly string[], ingredient: readonly string[]): boolean {
  const core = food.filter(word => !PARTS.has(word) && !QUALIFIERS.has(word));

  return core.length > 0 && core.every(word => ingredient.some(own => sameWord(own, word)));
}

function words(text: string): string[] {
  return normaliseForMatching(text).split(' ').filter(Boolean);
}

/** The same word, or one its plural: "tomate"/"tomates", "limon"/"limones". */
function sameWord(a: string, b: string): boolean {
  return a === b || `${a}s` === b || `${a}es` === b || `${b}s` === a || `${b}es` === a;
}

/** Whether `needle` appears in `haystack` as a run of whole words. */
function containsRun(haystack: readonly string[], needle: readonly string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    if (needle.every((word, offset) => sameWord(haystack[start + offset] as string, word))) {
      return true;
    }
  }

  return false;
}

export function methodMentions(input: {
  /** The dish's ingredients, by the names the method is written in. */
  readonly dish: readonly string[];
  /**
   * The dish's own name. A method that calls the dish what it is — "el arroz
   * negro", "el guacamole" of a bowl named for it — adds no food; the stored
   * library had three such.
   */
  readonly name?: string;
  readonly steps: readonly { readonly cue?: string; readonly text: string }[];
  /** Every food the catalogue knows, in the same language. */
  readonly vocabulary: readonly string[];
}): MethodMentions {
  const text = words(input.steps.map(step => `${step.text} ${step.cue ?? ''}`).join(' '));
  const dishWords = input.dish.map(words);
  const title = words(input.name ?? '');

  const missing = input.dish.filter((name, index) => {
    const all = dishWords[index] ?? [];
    const main = all.filter(word => word.length >= 3 && !QUALIFIERS.has(word));

    return !(main.length > 0 ? main : all).some(word => text.some(said => sameWord(said, word)));
  });

  const foreign = [
    ...new Set(
      input.vocabulary.filter(name => {
        const food = words(name);

        if (food.join('').length < 3 || (food.length === 1 && (ALWAYS_ALLOWED.has(food[0] as string) || ALSO_A_WORD.has(food[0] as string)))) {
          return false;
        }

        // The dish's own ingredient under a shorter name, or under a more
        // particular one, is not a foreign food.
        return (
          !dishWords.some(ingredient => containsRun(ingredient, food) || isPartOf(food, ingredient)) &&
          !containsRun(title, food) &&
          containsRun(text, food)
        );
      })
    )
  ];

  return { foreign, missing };
}

/**
 * Whether a step talks about its brief instead of the dish.
 *
 * Told that every rewrite is read back, a model once closed a cottage-cheese cup
 * with a third step certifying that "all three listed ingredients are named, with
 * no extra foods and no quantities". A cook's method never mentions "the list";
 * packet instructions, which a cook's method may, are not caught.
 */
export function isAboutTheBrief(text: string): boolean {
  const said = words(text);

  return (
    containsRun(said, ['la', 'lista']) ||
    containsRun(said, ['the', 'list']) ||
    // "Este paso es de preparación": a sentence about the step, not the dish.
    containsRun(said, ['este', 'paso', 'es']) ||
    containsRun(said, ['this', 'step', 'is']) ||
    said.some(word => word.startsWith('listad') || word === 'listed' || word.startsWith('validat'))
  );
}

/**
 * An ingredient's name as a sentence carries it: its capital kept where a
 * sentence starts, dropped inside one — "pela el boniato", not "pela el Boniato".
 *
 * Asked to name each ingredient exactly as written, a model copied the
 * catalogue's capital letters into the middle of every sentence. Only the first
 * letter of a listed name is touched, and only where it is not the first word.
 */
export function lowerIngredientNames(text: string, names: readonly string[]): string {
  let result = text;

  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    const first = name.charAt(0);

    if (first === first.toLowerCase()) {
      continue;
    }

    let from = 0;

    for (let at = result.indexOf(name, from); at !== -1; at = result.indexOf(name, from)) {
      const before = result.slice(0, at).trimEnd();
      const startsSentence = before === '' || /[.!?¡¿:]$/.test(before);

      if (!startsSentence) {
        result = `${result.slice(0, at)}${first.toLowerCase()}${result.slice(at + 1)}`;
      }

      from = at + name.length;
    }
  }

  return result;
}
