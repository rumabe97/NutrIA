import { normaliseForMatching } from 'core/domain/Safety';

/**
 * First-person claims of having changed something, in both languages,
 * normalised the way `normaliseForMatching` writes them.
 */
const CLAIMS: readonly string[] = [
  'he actualizado',
  'he ajustado',
  'he anadido',
  'he cambiado',
  'he eliminado',
  'he generado',
  'he guardado',
  'he modificado',
  'he quitado',
  'he reemplazado',
  'he sustituido',
  'lo he cambiado',
  'queda actualizado',
  'te he preparado un plan',
  'tu nuevo plan',
  'ya esta cambiado',
  'i added',
  'i adjusted',
  'i changed',
  'i have added',
  'i have changed',
  'i have generated',
  'i have removed',
  'i have replaced',
  'i have updated',
  'i removed',
  'i replaced',
  'i updated',
  'i ve added',
  'i ve adjusted',
  'i ve changed',
  'i ve generated',
  'i ve removed',
  'i ve replaced',
  'i ve updated',
  'your new plan'
];

const WEEKDAY = 'lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday';

const WEEKDAYS = new RegExp(`\\b(${WEEKDAY})\\b`, 'g');

const NUMBERED_DAYS = /\b(?:dia|day) (\d{1,2})\b/g;

/** How many distinct days an answer has to **name** before it is a plan whatever it says of them. */
const PLAN_SHAPED = 5;

/** How many distinct meals of a day, laid out with dishes that are not the plan's, make a day's menu. */
const MENU_SLOTS = 3;

/** How many days laid out with dishes that are not the plan's make a menu, one meal each or more. */
const MENU_DAYS = 2;

/**
 * The words a meal of the day is headed with, in both languages, and the meal
 * each one is — «almuerzo» and «comida» are one meal here, so a day written
 * with either counts once.
 */
const MEAL_WORDS: readonly (readonly [string, string])[] = [
  ['media manana', 'morning'],
  ['desayuno', 'breakfast'],
  ['breakfast', 'breakfast'],
  ['almuerzo', 'lunch'],
  ['comida', 'lunch'],
  ['lunch', 'lunch'],
  ['merienda', 'afternoon'],
  ['tentempie', 'snack'],
  ['snack', 'snack'],
  ['recena', 'supper'],
  ['supper', 'supper'],
  ['cena', 'dinner'],
  ['dinner', 'dinner']
];

/** What a heading may open with before its word: list and Markdown marks, a number, «para la», «for». */
const LEAD = String.raw`^[\s#>*_\-•·\d.)(]*(?:(?:para|en|de|for|at|on)\s+)?(?:(?:el|la|the)\s+)?`;

/** What follows the word for it to be a heading: nothing, or a few words and then a colon or a dash. */
const TAIL = String.raw`(?:(?<bare>[\s*_:)(\d.,h]*)$|(?:[^:\n]{0,40}?)(?::|\s[-–—]\s)(?<rest>.*)$)`;

const MEAL_HEADING = new RegExp(`${LEAD}(?<word>${MEAL_WORDS.map(([word]) => word).join('|')})\\b${TAIL}`, 'u');

const DAY_HEADING = new RegExp(`${LEAD}(?<word>(?:${WEEKDAY})|(?:dia|day)\\s\\d{1,2})\\b${TAIL}`, 'u');

/** A share of the day or an amount of energy: what an explanation of the plan says after «Almuerzo:», and a dish does not. */
const EXPLAINS = /%|\bkcal\b|\bcalor/u;

/** Lower case, no accents — and the line breaks and punctuation kept, which `normaliseForMatching` drops and a heading is read from. */
function plain(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** The words of a dish's name worth looking for: four letters or more, so «con» and «de» decide nothing. */
function wordsOf(name: string): readonly string[] {
  return normaliseForMatching(name)
    .split(' ')
    .filter(word => word.length >= 4);
}

/**
 * Whether what follows a heading is a dish that is **not** the plan's.
 *
 * Nothing after it, a share or an amount of energy, or a dish of the plan — by
 * its name, or by every word of its name in any order — is not one. Everything
 * else is, which is the cautious reading: a paraphrase of the plan's own dish
 * that drops a word is withheld, and the person is told where their plan is.
 */
function isNewDish(content: string, planDishes: readonly (readonly string[])[]): boolean {
  if (EXPLAINS.test(content)) {
    return false;
  }

  const words = new Set(normaliseForMatching(content).split(' '));

  if (![...words].some(word => word.length >= 3 && !/^\d+$/u.test(word))) {
    return false;
  }

  return !planDishes.some(dish => dish.every(word => words.has(word)));
}

/**
 * Whether an answer lays out a menu of its own: a day of meals, or two days or
 * more — `0109`.
 *
 * Read from **headings**, because that is what a menu is written with and a
 * mention is not: «Desayuno: avena», «**Cena** — merluza», «### Martes». The
 * answer is cut into pieces at line breaks and sentence ends; a piece that
 * opens with a meal or a day is a heading, and what follows it — to the next
 * heading — is what it holds.
 *
 * **The plan read back is not a menu.** «¿Qué como el jueves?» is answered with
 * Thursday's own breakfast, lunch and dinner, and that is the first thing this
 * assistant is for: a heading whose dish is the plan's counts for nothing, and
 * neither does one followed by a share of the day («Almuerzo: 45 %»).
 *
 * A net, like every screen here that reads spelling: a menu written with no
 * heading («primero avena, luego lentejas y de noche merluza») passes it, and
 * a sentence is released as soon as it passes — so two meals of a three-meal
 * menu are already on screen when the third stops it.
 */
function writesAMenu(answer: string, planDishNames: readonly string[]): boolean {
  const planDishes = planDishNames.map(wordsOf).filter(words => words.length > 0);
  const pieces = plain(answer)
    .split(/\n|(?<=[.;!?])\s+|,\s+(?=\S)/u)
    .map(piece => piece.trim())
    .filter(piece => piece !== '');

  const meals = new Map<string, string>();
  const days = new Map<string, string>();
  let meal: string | null = null;
  let day: string | null = null;
  let segment = 0;

  for (const piece of pieces) {
    const dayHeading = DAY_HEADING.exec(piece);
    const mealHeading = dayHeading ? null : MEAL_HEADING.exec(piece);
    const heading = dayHeading ?? mealHeading;
    const rest = heading ? (heading.groups?.rest ?? '') : piece;

    if (dayHeading) {
      segment += 1;
      day = `${dayHeading.groups?.word ?? ''}`;
      meal = null;
    } else if (mealHeading) {
      segment += 1;
      // One key per heading, so the same meal on two days is read as two contents.
      meal = `${MEAL_WORDS.find(([word]) => word === mealHeading.groups?.word)?.[1] ?? ''}#${String(segment)}`;
    }

    if (meal !== null) {
      meals.set(meal, `${meals.get(meal) ?? ''} ${rest}`);
    }

    if (day !== null) {
      days.set(day, `${days.get(day) ?? ''} ${rest}`);
    }
  }

  const newMeals = new Set([...meals].filter(([, content]) => isNewDish(content, planDishes)).map(([key]) => key.split('#')[0]));
  const newDays = [...days].filter(([, content]) => isNewDish(content, planDishes));

  return newMeals.size >= MENU_SLOTS || newDays.length >= MENU_DAYS;
}

/**
 * Whether an answer claims to have acted, or writes a plan — `0104` clause 1
 * as `0109` narrows it, as a tested expectation of the answer and not only an
 * instruction to the model.
 *
 * Three shapes, all withheld:
 *
 * - **A claim of a change.** «He cambiado la cena del jueves» changes nothing —
 *   the assistant has no route that could — and the person would believe it,
 *   then cook from a plan that still says the old dish.
 * - **A menu of its own** (`writesAMenu`): a day of meals, or two days or more,
 *   of dishes that are not the plan's — with a plan or without one. It is the
 *   thing the product makes, written in prose outside every check a real plan
 *   goes through: the scheduler, the allergy gate, the ±5 %. And it is the way
 *   round the plan's own allowances.
 * - **Five or more distinct days named** (`lunes`, `martes`…, or `día 1`,
 *   `día 2`…), whatever is said of them. Naming one day — «el jueves tienes
 *   lentejas» — is not that.
 *
 * `planDishNames` are the dishes of the person's active plan, as the context
 * carries them; empty when they have none.
 */
export function claimsToAct(answer: string, planDishNames: readonly string[]): boolean {
  const text = ` ${normaliseForMatching(answer)} `;

  if (CLAIMS.some(claim => text.includes(` ${claim} `))) {
    return true;
  }

  const weekdays = new Set([...text.matchAll(WEEKDAYS)].map(match => match[1]));
  const numbered = new Set([...text.matchAll(NUMBERED_DAYS)].map(match => match[1]));

  return weekdays.size >= PLAN_SHAPED || numbered.size >= PLAN_SHAPED || writesAMenu(answer, planDishNames);
}
