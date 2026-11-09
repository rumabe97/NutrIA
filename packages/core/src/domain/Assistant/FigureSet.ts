import type { AssistantContext, AssistantFigures } from './AssistantContext';

/**
 * What a nutritional figure is a figure **of**. Checked kind by kind, because a
 * flat list of every number in a fortnight is a list almost anything is within
 * 5 % of: `33` — lunch's share of the day — would have validated «33 g de
 * grasa», and the carbohydrate target «240 g de proteína».
 *
 * `sugar` and `saturated` are kinds the service **never** supplies, so their
 * sets are always empty and any figure of either is withheld. Folding them into
 * `carbs` and `fat` would have let «62 g de azúcar» through on a 62 g
 * carbohydrate meal.
 */
export const FIGURE_KINDS = ['carbs', 'energy', 'fat', 'fiber', 'percent', 'protein', 'saturated', 'sugar'] as const;

export type FigureKind = (typeof FIGURE_KINDS)[number];

/**
 * The nutritional figures an answer may state, by kind: every one the service
 * put in the context, and every nutritional figure the person wrote in their
 * own question.
 *
 * **Only nutritional figures are checked** (`0105`, narrowing `0104` clause 4):
 * an amount of energy, an amount of a nutrient, or a percentage. A recipe's
 * `200 g de arroz` is not one — the owner asked for recipes with their
 * quantities, and no service could have supplied them — but the same recipe
 * saying it carries `45 g de hidratos` is, and is checked against carbohydrate
 * figures only. That is the figure the 2026-09-12 probe caught a model inventing
 * for a diabetic.
 *
 * The question contributes **its nutritional figures, by kind**, not every
 * number in it: «quiero llegar a 120 g de proteína» may be repeated back, and
 * «tengo 30 años» does not make «30 g de hidratos» a supplied figure.
 *
 * No structural constants are in the set. They were planned in, for a check that
 * read every number; in this one a `5` or a `100` would let `5 g de proteína` and
 * `100 g de grasa` through.
 */
export type FigureSet = Readonly<Record<FigureKind, readonly number[]>>;

/** Why an answer is withheld: a figure nobody supplied, or one written in words so it cannot be checked at all. */
export type FigureVerdict = { readonly figure: string; readonly ok: false; readonly reason: 'not_supplied' | 'spelled_out' } | { readonly ok: true };

/** The product's own band (`0045`): a day within 5 % of its target is on target, so a figure within 5 % of a supplied one is that figure. */
const TOLERANCE = 0.05;

/** Accents off and case folded, so `Calorías` and `calorias` are one word; digits and separators untouched. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * A number as Spanish and English both write one.
 *
 * - Both separators present (`2.079,5`, `2,079.5`): the last is the decimal one.
 * - One separator, followed by **exactly three digits** (`2.079`, `1,500`): a
 *   thousands separator. This is the one ambiguous case — `1.000` is a thousand
 *   in Spanish and one in an English sentence nobody writes — and nutrition
 *   prose resolves it this way every time it occurs: nobody states a figure to a
 *   thousandth of a gram.
 * - Any other single separator (`2,1`, `2.5`): a decimal.
 * - The same separator more than once (`1.234.567`): thousands.
 */
export function parseLocaleNumber(token: string): number {
  const compact = token.replace(/[\u00a0\u202f]/g, '');
  const dots = (compact.match(/\./g) ?? []).length;
  const commas = (compact.match(/,/g) ?? []).length;

  if (dots > 0 && commas > 0) {
    const decimal = compact.lastIndexOf('.') > compact.lastIndexOf(',') ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';

    return Number(compact.split(thousands).join('').replace(decimal, '.'));
  }

  const separator = dots > 0 ? '.' : commas > 0 ? ',' : null;

  if (separator === null) {
    return Number(compact);
  }

  if (dots + commas > 1 || /^\d{1,3}[.,]\d{3}$/.test(compact)) {
    return Number(compact.split(separator).join(''));
  }

  return Number(compact.replace(',', '.'));
}

/** A number in prose: grouped thousands (with a dot, a comma or a narrow space), then an optional decimal part. */
const NUMBER = String.raw`\d{1,3}(?:[.,\u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

/** A number or a range of two (`40-50`, `40 a 50`, `40 to 50`), as named groups so a pattern can put words around it. */
const AMOUNT = String.raw`(?<from>${NUMBER})(?:\s*(?:-|–|—|\ba\b|\bto\b|\by\b|\band\b)\s*(?<to>${NUMBER}))?`;

const ENERGY = String.raw`(?:kcal|kilocalorias?|calorias?|kilocalories|calories|kj|kilojulios?|kilojoules?)\b`;

const MACRO = String.raw`(?:proteinas?|hidratos(?: de carbono)?|carbohidratos?|grasas?(?: saturadas)?|fibra|azucares?|azucar|protein|proteins|carbs?|carbohydrates?|saturated fats?|fats?|fibre|fiber|sugars?)\b`;

/** The same words, captured, so the pattern can say which nutrient it read. */
const NAMED_MACRO = `(?<macro>${MACRO})`;

const MASS = String.raw`(?:g|gr|grs|gramos?|grams?)\b\.?`;

/**
 * What may stand between a nutrient's name and its amount: a colon, an equals
 * sign, an opening bracket, a tilde, and one approximator (`unos`, `about`).
 * **Not a comma and not a verb** — so «para subir la proteína, añade 150 g de
 * pechuga» is a recipe and not a protein figure, and «grasa: 12 g» is a figure.
 */
const GAP = String.raw`[\s:=(~≈]*(?:(?:unos|unas|aprox\.?|aproximadamente|alrededor\s+de|cerca\s+de|about|around|approximately|approx\.?|roughly)\s+)?`;

/** A macronutrient named as a food is an ingredient, not a figure: `30 g de proteína en polvo`. */
const NOT_A_FOOD = String.raw`(?!\s+(?:en\s+polvo|powder|de\s+suero|whey|isolate|aislada))`;

/**
 * After a label's amount: not a share and not a mass, which the patterns for
 * those read — and **not another digit, nor a separator followed by one**, so
 * the engine cannot back off «45» to «4» to make a label match what was really
 * «Proteína: 45 g», nor «2.079» to «2». A full stop that ends the sentence
 * («Calorías: 700.») is not a separator: no digit follows it.
 */
const NOT_A_SHARE_OR_MASS = String.raw`(?!\d|[.,]\d|\s*(?:%|${MASS}))`;

/** Which nutrient a captured word names. `sugar` and `saturated` before `carbs` and `fat`, which they would otherwise fall into. */
function nutrientOf(word: string): FigureKind {
  if (word.startsWith('prote')) {
    return 'protein';
  }

  if (word.includes('saturad') || word.startsWith('saturated')) {
    return 'saturated';
  }

  if (word.startsWith('azucar') || word.startsWith('sugar')) {
    return 'sugar';
  }

  if (word.startsWith('grasa') || word.startsWith('fat')) {
    return 'fat';
  }

  if (word.startsWith('fib')) {
    return 'fiber';
  }

  return 'carbs';
}

/**
 * Figure-shaped phrases, each with the kind it states. Read off the folded text.
 *
 * - `450 kcal` — energy.
 * - `45 g de proteína` — a nutrient, unit first.
 * - `proteína: 45 g`, `proteínas (unos 45 g)` — the same, nutrient first, across
 *   nothing but a `GAP`.
 * - `30 % de tus calorías`, `calorías ≈ 30 %` — a share.
 * - `Calorías: 652`, `Proteína: 30` — the label form of a recipe's nutrition
 *   block, which may carry no unit at all.
 *
 * What is deliberately not here: «nata al 18 %», «200 g de arroz», «2 huevos» —
 * quantities of a food, which a recipe is made of and no service supplies.
 */
const FIGURE_PATTERNS: readonly { readonly kind: 'nutrient' | FigureKind; readonly pattern: RegExp }[] = [
  { kind: 'energy', pattern: new RegExp(String.raw`${AMOUNT}\s*${ENERGY}`, 'g') },
  { kind: 'nutrient', pattern: new RegExp(String.raw`${AMOUNT}\s*${MASS}\s+(?:de\s+|of\s+)?${NAMED_MACRO}${NOT_A_FOOD}`, 'g') },
  { kind: 'nutrient', pattern: new RegExp(String.raw`${NAMED_MACRO}${NOT_A_FOOD}${GAP}${AMOUNT}\s*${MASS}`, 'g') },
  {
    kind: 'percent',
    pattern: new RegExp(
      String.raw`${AMOUNT}\s*%\s*(?:de\s+|of\s+)?(?:(?:tus|tu|las|la|el|los|your|the)\s+)?(?:${ENERGY}|${MACRO}|energia\b|energy\b|ingesta\b|intake\b)`,
      'g'
    )
  },
  { kind: 'percent', pattern: new RegExp(String.raw`(?:${ENERGY}|${MACRO})${GAP}${AMOUNT}\s*%`, 'g') },
  { kind: 'energy', pattern: new RegExp(String.raw`${ENERGY}\s*[:=]${GAP}${AMOUNT}${NOT_A_SHARE_OR_MASS}`, 'g') },
  { kind: 'nutrient', pattern: new RegExp(String.raw`${NAMED_MACRO}${NOT_A_FOOD}\s*[:=]${GAP}${AMOUNT}${NOT_A_SHARE_OR_MASS}`, 'g') }
];

/** One nutritional figure as written: its kind, the number token, and the phrase it was read from. */
type StatedFigure = { readonly kind: FigureKind; readonly phrase: string; readonly token: string };

/** Every nutritional figure a text states, by kind — run on an answer to check it, and on a question to add to the set. */
function statedFigures(text: string): readonly StatedFigure[] {
  const figures: StatedFigure[] = [];

  for (const { kind, pattern } of FIGURE_PATTERNS) {
    for (const match of folded(text).matchAll(pattern)) {
      const groups = match.groups ?? {};
      const resolved = kind === 'nutrient' ? nutrientOf(groups['macro'] ?? '') : kind;

      for (const token of [groups['from'], groups['to']]) {
        if (token !== undefined) {
          figures.push({ kind: resolved, phrase: match[0], token });
        }
      }
    }
  }

  return figures;
}

function empty(): Record<FigureKind, number[]> {
  return { carbs: [], energy: [], fat: [], fiber: [], percent: [], protein: [], saturated: [], sugar: [] };
}

function add(set: Record<FigureKind, number[]>, figures: AssistantFigures): void {
  set.carbs.push(figures.carbsG);
  set.energy.push(figures.kcal);
  set.fat.push(figures.fatG);
  set.fiber.push(figures.fiberG);
  set.protein.push(figures.proteinG);
}

/** The set: the context's figures by kind, the meal shape's percentages, and the question's own nutritional figures. */
export function figureSet(context: AssistantContext, question: string): FigureSet {
  const set = empty();

  add(set, context.targets);

  for (const day of context.days) {
    add(set, day.targets);
    add(set, day.totals);

    for (const meal of day.meals) {
      add(set, meal.figures);
    }
  }

  set.percent.push(...Object.values(context.slotShares));

  for (const figure of statedFigures(question)) {
    set[figure.kind].push(parseLocaleNumber(figure.token));
  }

  const sorted = empty();

  for (const kind of FIGURE_KINDS) {
    sorted[kind] = [...new Set(set[kind])].sort((one, other) => one - other);
  }

  return sorted;
}

/** Numbers written as words, in the two languages the product speaks. */
const NUMBER_WORD = String.raw`(?:cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\w+cientos|\w+cientas|quinientos|quinientas|mil|media|medio|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half)`;

/**
 * A nutritional unit preceded by a number **word** — `unas dos mil calorías`,
 * `veinte gramos de proteína`. It cannot be checked, so it is withheld: a figure
 * that dodges the check by being spelt out is exactly the one to distrust.
 */
const SPELLED_OUT = new RegExp(String.raw`\b${NUMBER_WORD}(?:\s+(?:y|and|${NUMBER_WORD}))*\s+(?:${ENERGY}|${MASS}\s+(?:de\s+|of\s+)?${MACRO})`);

/** Half a unit of the last digit written: `2.080` → 0.5, `2,1` → 0.05. Rounding to the stated precision is not inventing. */
function halfUnit(token: string): number {
  const decimals = /[.,](\d{1,2})$/.exec(token.replace(/[\u00a0\u202f]/g, ''));
  const parsed = parseLocaleNumber(token);

  return decimals && !Number.isInteger(parsed) ? 0.5 * 10 ** -decimals[1].length : 0.5;
}

function supplied(figure: StatedFigure, set: FigureSet): boolean {
  const stated = parseLocaleNumber(figure.token);
  const slack = halfUnit(figure.token);

  return set[figure.kind].some(value => Math.abs(stated - value) <= Math.max(TOLERANCE * Math.abs(value), slack));
}

/**
 * Whether every nutritional figure in an answer was supplied — the check behind
 * PRD criterion 4.
 *
 * A stated figure is a supplied one **of the same kind** when it is within the
 * product's own ±5 % of it (`2.100 kcal` for 2,079 is the same day said
 * roundly), or equal to it rounded to the stated figure's own precision (`0 g de
 * grasa` for 0.4 g). Both are ways of *saying* a figure; neither is a way of
 * inventing one. `50 g de hidratos` for 45 is 11 % off and is withheld — which
 * is the whole point.
 *
 * Sums and differences the model works out for itself are **not** in the set and
 * are withheld too («entre comida y cena suman…»). That is strict on purpose: the
 * model deciding a figure is the failure, whatever arithmetic it used to decide
 * it. Phase 6 measures how often it fires, and how dense the set is.
 */
export function figuresAreAllSupplied(answer: string, set: FigureSet): FigureVerdict {
  const spelled = SPELLED_OUT.exec(folded(answer));

  if (spelled) {
    return { figure: spelled[0], ok: false, reason: 'spelled_out' };
  }

  const invented = statedFigures(answer).find(figure => !supplied(figure, set));

  return invented ? { figure: invented.phrase, ok: false, reason: 'not_supplied' } : { ok: true };
}
