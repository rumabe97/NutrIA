import { DEFAULT_MEAL_SHAPE, weightsFor } from 'core/domain/MealShape';
import { INGREDIENT_CATEGORIES, SNACK_SLOTS } from 'core/entities/Plan';
import { normaliseForMatching } from 'core/domain/Safety';

import type { CatalogueIngredient, IngredientCategory, MealSlot } from 'core/entities/Plan';
import type { CheckInForGeneration } from 'core/controllers/CheckIn';
import type { Goal } from 'core/entities/Profile';
import type { NutritionTargets } from 'core/entities/Nutrition';

/**
 * Bumped whenever the wording changes, and recorded in `generation_metadata`.
 *
 * 2.0.0: the prompt itself moved to English for every locale, with the output
 * language passed as a parameter.
 * 2.1.0: asks for cooking rather than combinations — named dishes, real
 * technique, seasoning, and steps a person could follow.
 * 2.2.0: snacks stop being exempt from having a method. 2.1.0 told the model to
 * send them with no steps at all, and a quarter of the stored library is now two
 * ingredients and a name — which is what the owner meant by "too basic". The
 * floor is also enforced in `pool.schema.ts` now, so this text is a request and
 * the schema is the guarantee.
 * 2.3.0: designs for one person rather than a profile. The model now sees how
 * they eat breakfast, how big they like a plate, how often they cook and what
 * their days look like — fields the profile always held and the prompt never
 * read — plus what they were served last fortnight, so it proposes something
 * else. And the set it returns has to be *spread*: no protein, cuisine or
 * method dominating, with the counts stated, because "varied" alone produced
 * eight chicken dishes with a straight face.
 * 2.4.0: one action per step, and each step documented — how, how hot, how long,
 * and the sign it is done. 2.3.0 asked for three to eight steps and got exactly
 * three on twenty-nine of thirty-nine dishes, each sentence doing the work of
 * two or three. Steps now carry `minutes` and a `cue`, and the floor for a long
 * cook is enforced in `domain/Method`, not asked for.
 * 2.4.1: documented is not the same as long. The first rewrite pass gave a bowl
 * of cottage cheese and kiwi five steps, one of them a minute spent spooning
 * cheese into a cup. An uncooked dish now gets two or three real actions, no
 * invented minutes and a cue only where there is something to look for.
 * 2.4.2: a third band. A two-minute tostada is cooking but is not a main course,
 * and the two-way split gave it seven steps, five of them `0 min`. The bands now
 * match the three `domain/Method` enforces.
 * 2.5.0: the person's verdicts — dishes they loved, to design towards; dishes
 * they disliked, never to recreate (0014).
 * 2.6.0: the last fortnight's check-in — how the portions felt, how hard the plan
 * was, their own words (0018).
 * 3.0.0: designs to the whole macro split, per serving, sized to the person's
 * own day (`0047`). The per-slot figure was computed over the slots *in the
 * request*, and since `0016` every request carries one slot — so every dish was
 * asked to hold the whole day's energy and protein in one serving. The model
 * half-ignored it, and the library came back 20–45% oversized and 40–43% fat in
 * every slot. The model was also never told carbohydrate or fat at all, and was
 * told a plan short on protein "is discarded in full", which stopped being true
 * with `0045`. Now: four macros and fibre per serving from the person's meal
 * shape (`0036`), how to build a plate to them, what their goal asks of it, and
 * the days that eat for an event.
 * 3.1.0: protein is a figure to land on, and the set straddles every figure
 * (`0048`). 3.0.0's dishes came back at or above their protein on every slot —
 * never below — and the library below them is protein-heavy, so no combination
 * could land a day within 5%: nine days of fourteen ran 7–17% over. A day is
 * built by combining dishes, and a combination can only land on a figure the
 * dishes sit on both sides of. So each meal's dishes are now asked to fall
 * about half a little under and half a little over each number.
 * 3.2.0: the ingredient list names an ingredient only where its slug does not
 * already say it. The list was 70% of the prompt, and 525 of the 570 names on a
 * real one were the slug with its accents put back — "acelga (Acelga)". Every
 * ingredient is still offered; only the repeat is gone (a third of the prompt).
 * 3.2.1: the wording is 3.2.0's; what changed is how a returned slug is read. A
 * model shown bare slugs wrote some back with their accents — "brócoli",
 * "calabacín" — and each such dish was rejected as unknown. `pool.schema.ts`
 * now folds the accents before the lookup.
 * 3.2.2: the ingredient ceiling is stated, and raised. The prompt said "fifteen
 * is a shopping trip" while the schema refused thirteen, so a large lunch came
 * back with fourteen and all seven were dropped. Fifteen now, salt, spices and
 * oil included, in both; one to eight servings and six-hundred-character
 * steps, as the store allows.
 * 3.3.0: each meal is told what kind of food it is. Asked for forty grams of
 * protein at breakfast, the model wrote pasta with turkey and a warm potato
 * salad with tuna — on the figure, and nobody's breakfast — and a snack came
 * back as a bowl of turkey with strawberries. Breakfast is morning food now,
 * and a snack something eaten between meals rather than a plated main; the
 * person's own words about breakfast still come first.
 */
export const PROMPT_VERSION = '3.3.0';

/**
 * The version of the rules for *writing steps*, stamped on every recipe and
 * compared by the rewrite sweep, which re-writes the method of any recipe whose
 * stamp differs.
 *
 * Separate from `PROMPT_VERSION` since 3.0.0, and that separation is the point.
 * The two moved together while every change to the prompt was a change to how
 * steps are written. 3.0.0 changes what a dish is made of and leaves the steps
 * rules alone — and bumping the stamp with it would have marked every recipe in
 * the library for a model rewrite of a method nothing had changed about. Bump
 * this only when the steps rules below change.
 */
export const STEPS_VERSION = '2.8.0';

/**
 * How to name the output language to the model.
 *
 * A language name rather than a BCP 47 tag: "write in en-GB" is an instruction
 * about a code, and models follow "write in British English" far more reliably.
 * An unknown locale falls back to Spanish, which is the language the catalogue
 * is guaranteed to have.
 */
const LANGUAGE_NAMES: Record<string, string> = { 'en-GB': 'British English', 'es-ES': 'Spanish (Spain)' };

export function languageName(locale: string): string {
  return LANGUAGE_NAMES[locale] ?? 'Spanish (Spain)';
}

export type PromptContext = {
  /** Names of dishes served last fortnight. Excluded from reuse already; the model is told so it does not recreate them. */
  readonly avoidNames: readonly string[];
  /** Free text from onboarding, e.g. "no desayuno, almuerzo a las 11". */
  readonly breakfastStyle: string | null;
  readonly budget: string | null;
  /** The last fortnight's check-in, when there is one: how the portions felt, how hard it was, in their words. */
  readonly checkIn?: CheckInForGeneration | null;
  readonly cookingFrequency: string | null;
  readonly cookingTimeMinutes: number | null;
  readonly cuisines: readonly string[];
  /** When they wake, when they sleep, and when they train — the shape of the day a plan has to fit. */
  readonly dayShape: string | null;
  readonly dietaryPatterns: readonly string[];
  readonly dislikedLabels: readonly string[];
  /** Dishes the person marked as disliked. Already out of reuse; named so the model does not recreate them. */
  readonly dislikedNames: readonly string[];
  readonly excludeSlugs: readonly string[];
  /**
   * Free-text allergies that matched nothing in the catalogue, exactly as the
   * user wrote them.
   *
   * The only case where an allergy is named to the model rather than enforced by
   * removal — because there is no row to remove. See the note on
   * `buildPoolPrompt`; this is a mitigation, not a guarantee, and the interface
   * says so to the user in the same words.
   */
  readonly forbiddenLabels: readonly string[];
  /**
   * What they are eating for — lose weight, build muscle, perform, maintain.
   * Already folded into the numbers by `core/domain/Nutrition`; here because the
   * same numbers are reached by different plates depending on it, and choosing
   * the plate is the model's half of the split (`0004`). Null when unset.
   */
  readonly goal: Goal['type'] | null;
  /** The language the dish names and steps must come back in. */
  readonly language: string;
  readonly likedLabels: readonly string[];
  /**
   * The targets of the days this fortnight that eat for an event (`0043`), when
   * there are any. The scheduler draws those days from the same pool, and a
   * pool with nothing at their split leaves them short however it sizes them.
   */
  readonly loadedTargets?: readonly NutritionTargets[];
  /** Dishes the person marked as liked: the taste to design towards, and dishes that may return. */
  readonly lovedNames: readonly string[];
  readonly needBySlot: ReadonlyMap<MealSlot, number>;
  /** Free text: "ligeros", "grandes"… */
  readonly portionPreference: string | null;
  /** Free text about the working week, e.g. shifts. */
  readonly scheduleNotes: string | null;
  /**
   * Each eaten slot's share of the person's whole day, from their meal shape
   * (`0036`): a large lunch carries more than a normal one, a light snack less.
   *
   * Across the *whole day*, never across the slots in one request. The pool
   * builder sends one request per slot (`0016`), and a share computed over the
   * request made every slot's share 1 — each dish asked to be the whole day.
   */
  readonly slotShares: ReadonlyMap<MealSlot, number>;
  /** For a swap: what the person asked of this one dish, when they asked something (0022). */
  readonly swapWish?: string | null;
  readonly targets: NutritionTargets;
};

const SLOT_LABEL: Record<MealSlot, string> = {
  afternoon_snack: 'afternoon snack',
  breakfast: 'breakfast',
  dinner: 'dinner',
  lunch: 'lunch',
  morning_snack: 'mid-morning snack',
  supper: 'supper'
};

/**
 * The catalogue is listed one aisle per line rather than as one comma-separated
 * run. At two hundred rows a flat list was readable; at nine hundred it is a
 * wall, and a model asked for "a protein source" finds one faster when the
 * proteins sit together. Order within an aisle is by slug, so the prompt is
 * stable across calls and the cache can do its work.
 */
const CATEGORY_LABEL: Record<IngredientCategory, string> = {
  bakery: 'Bakery',
  beverages: 'Drinks',
  dairy: 'Dairy and plant alternatives',
  frozen: 'Frozen',
  other: 'Prepared foods, dips and sweets',
  pantry: 'Pantry: grains, pasta, tins, oils, sauces, spices',
  produce: 'Fresh produce and herbs',
  protein: 'Meat, fish, seafood, eggs and pulses'
};

const HUNGER_LINE: Record<CheckInForGeneration['hunger'], string> = {
  hungry: 'the portions left them hungry — make dishes more filling at the same calories: volume, fibre, protein',
  right: 'the portions felt right',
  too_much: 'the portions were more than they could eat — lighter, simpler plates'
};

const DIFFICULTY_LINE: Record<CheckInForGeneration['difficulty'], string> = {
  easy: 'the plan was easy to follow',
  hard: 'the plan was hard to follow — simpler and faster dishes, fewer ingredients each',
  ok: 'the plan was manageable'
};

/**
 * What the person said at the end of last fortnight, as guidance. The weight
 * they gave is not here: it already moved the targets, in code. Their words are
 * bounded like every other free text, so a pasted paragraph cannot restructure
 * the prompt.
 */
function checkInLines(checkIn: CheckInForGeneration | null): readonly string[] {
  if (!checkIn) {
    return [];
  }

  const words = oneLine(checkIn.comments, 300);

  return [
    `LAST FORTNIGHT'S CHECK-IN: ${HUNGER_LINE[checkIn.hunger]}; ${DIFFICULTY_LINE[checkIn.difficulty]}; they rated it ${checkIn.satisfaction}/5.`,
    words ? `In their words: "${words}"` : ''
  ];
}

/**
 * An ingredient as the model is shown it: its slug, and its name only where
 * the name says something the slug does not (3.2.0).
 *
 * The slug is what the model returns, and it reads the language the slugs are
 * written in; "calabacin (Calabacín)" paid for the same word twice on every
 * call. A name that differs still travels — a plural, a translation on an
 * English catalogue, or an "ñ", which a slug cannot hold ("nora (Ñora)").
 */
function listed(ingredient: CatalogueIngredient): string {
  const redundant = !/ñ/i.test(ingredient.name) && normaliseForMatching(ingredient.name).replaceAll(' ', '-') === ingredient.slug;

  return redundant ? ingredient.slug : `${ingredient.slug} (${ingredient.name})`;
}

function catalogueByAisle(safeIngredients: readonly CatalogueIngredient[]): string {
  return INGREDIENT_CATEGORIES.map(category => {
    const rows = safeIngredients
      .filter(ingredient => ingredient.category === category)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(listed);

    return rows.length > 0 ? `${CATEGORY_LABEL[category]}:\n${rows.join(', ')}` : '';
  })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The system prompt, in English for every user.
 *
 * English because it steers these models better, and because one prompt is one
 * thing to maintain and reason about — a prompt per language is a set of bugs
 * per language. The *output* language is a parameter, and it is the only part of
 * this that varies.
 */
export const POOL_SYSTEM_PROMPT = [
  'You are a professional chef who is also a registered sports dietitian, designing dishes for personalised meal plans.',
  'You build every dish to a nutritional brief: a target per serving for energy, protein, carbohydrate, fat and fibre.',
  'You hit that brief by choosing ingredients and weighing them in grams, using what you know about the composition of food.',
  'You only use ingredients from the catalogue you are given, by their exact slug; if something is not on the list, it does not exist.',
  'You never write calories or macronutrients in your answer: the system recomputes every dish from the catalogue and builds the days from the dishes that land closest to the brief.',
  'You cook: you season, you use technique, and you build texture and contrast.',
  'You do not return two ingredients on a plate and call it a dish.'
].join(' ');

/**
 * The request, built from **structured, minimal context**.
 *
 * Two things it deliberately does not contain: any identifying information about the
 * person (no name, email, birth date or weight — the model needs targets, not a
 * patient), and any mention of the user's **catalogue** allergens. Those are enforced by
 * *removing unsafe ingredients from the catalogue listing below*, so the model
 * cannot choose what it was never offered. The prompt is the second line of
 * defence; the gate in `PoolBuilder` is the first.
 *
 * `forbiddenLabels` is the exception, and only because there is nothing to remove:
 * a free-text allergy that matched no catalogue row has no id to exclude. Naming
 * it here narrows what the model writes into dish names and steps; it cannot make
 * the entry enforceable, and nothing downstream treats it as though it had. The
 * deterministic half of that case is the rejection of any dish whose ingredients
 * do not all resolve — an invented slug is the one way an unknown substance could
 * otherwise arrive.
 *
 * The ingredient names below are **already in the user's language**, because the
 * catalogue was loaded in it. The slugs never change, so the model returns the
 * same identifiers whatever language it writes in — which is what keeps the macro
 * lookup and the allergy gate language-agnostic.
 */
/**
 * User-written text on one line, bounded. It is *their* words about themselves,
 * which is the point; the bound and the flattening are so a paragraph pasted
 * into "work schedule" cannot restructure the prompt around it.
 */
function oneLine(text: string | null, max = 160): string | null {
  const flat = text?.replace(/\s+/g, ' ').trim() ?? '';

  return flat ? flat.slice(0, max) : null;
}

/**
 * How spread the returned set must be, stated as counts the model can check.
 * "Varied" alone produced eight chicken dishes; a ceiling per protein does not.
 */
function spreadRules(total: number): string[] {
  if (total < 4) {
    return [];
  }

  const perProtein = Math.max(2, Math.ceil(total / 4));
  const perMethod = Math.max(2, Math.ceil(total / 3));
  const cuisines = Math.min(4, Math.floor(total / 3));

  return [
    'SPREAD ACROSS THE SET YOU RETURN (counted over all dishes together):',
    `- No main protein — chicken, beef, pork, fish, eggs, legumes, dairy — in more than ${perProtein} dishes.`,
    `- No cooking method — roast, sear, stew, salad, sandwich, bowl — in more than ${perMethod} dishes.`,
    `- At least ${cuisines} distinct cuisines, drawing on the preferred ones first.`,
    '- Every dish a different base: do not send the same dish twice with the protein swapped.',
    ''
  ];
}

/**
 * What each goal asks of a plate, beyond the numbers it already set.
 *
 * The targets come from code and already encode the goal; the same targets can
 * still be met by very different plates, and which one serves the goal is a
 * cook's and a dietitian's judgement — the model's half of `0004`. Nothing here
 * is a rule the plan is validated against; the numbers are.
 */
const GOAL_GUIDANCE: Record<Goal['type'], string> = {
  custom: 'Their targets were set by hand. Follow the numbers exactly; do not second-guess the split.',
  healthy_eating:
    'Eating well is the goal: whole foods, vegetables at every meal, legumes, fish, olive oil in measured amounts, whole grains over refined, little processed food.',
  maintenance: 'Keeping their weight: balanced home cooking they could eat for years — nothing extreme, every meal complete.',
  muscle_gain:
    'Building muscle: protein in every meal and snack, to its figure, spread across the day rather than stacked in one; the extra energy from starch and dairy, not from added fat.',
  performance:
    'Training performance: carbohydrate is the fuel and the priority — every main dish is built on a starch. Meals near training are easy to digest (moderate fat and fibre); recovery meals pair carbohydrate with protein.',
  weight_loss:
    'Losing weight: the most food for the energy — volume, vegetables, lean protein at every meal, to its figure, for satiety, broths and roasting over frying, dressings and cheese measured, never poured.'
};

/**
 * How a plate reaches a split, in the terms a dietitian would brief a cook.
 *
 * Written from what the library turned out to be: 40–43% fat in every slot,
 * because a dish short of its energy had been topped up the easy way. Fat is
 * the one macro at nine calories a gram, so it is where a dish overshoots, and
 * the one to add last.
 */
const COMPOSITION_RULES = [
  'HOW TO BUILD EACH DISH TO ITS NUMBERS:',
  '- Protein is a figure to land on, not a minimum. A dish 20% over its protein is as far off as one 20% under, and the day cannot absorb it: the other meals cannot give protein back. Give the protein source the grams its figure asks for, and let starch and vegetables carry the rest of the plate.',
  '- Straddle the numbers. Across the dishes of one meal, land about half a little under each figure and half a little over — within a tenth either way — never all on the same side. The days are built by combining your dishes, and a set that runs high on protein makes every day run high.',
  '- Energy: protein and carbohydrate carry 4 kcal per gram, fat carries 9. Ten grams of oil is 90 kcal — the easiest way to overshoot a dish, and the last thing to add.',
  '- Weigh the fat. Oil, butter, cheese, nuts, seeds, avocado, cured meats and oily fish are dense: give each an exact gram amount that fits the fat target, not a generous splash.',
  '- When the split asks for a lot of carbohydrate, build the plate on a starch — rice, pasta, couscous, potato, bread, oats, legumes — and add fruit to breakfasts and snacks.',
  '- When it asks for a lot of protein and little fat, reach for the lean sources their way of eating allows: poultry breast, white fish, tuna in water, eggs and whites, fresh cheese, skyr or natural yoghurt, legumes, tofu, tempeh, soy yoghurt.',
  '- When it asks for little carbohydrate, build the plate on vegetables and protein, with a small starch or none, and let olive oil, nuts or avocado carry the energy the split gives to fat.',
  '- If a dish is short of energy, add starch or protein first — whichever the split is short of — and fat only if the fat target has room. A large brief is a large plate, or a plate with bread, fruit or dairy beside it; a small brief is a full plate of lighter food, never a smaller portion of a rich one.',
  '- A snack follows the same split as the day, scaled down. A snack of nuts alone is three quarters fat; pair it with fruit, dairy or bread.',
  '- Fibre: at least two plant components in a main dish — vegetables, legumes, whole grains, fruit.',
  '- Weigh each ingredient as it is named. A slug that says cooked (cocido, cocida) is weighed cooked; one that says raw or dry (crudo, seco) — or says neither, for rice, pasta, grains and pulses — is weighed dry, as bought. Dry rice or pasta roughly triples in weight when cooked: 80 g dry is a normal plate, 250 g dry is three.',
  '- Real portions. The grams are for the number of servings you declare, and one serving is a plate a person would recognise as one.',
  ''
];

/**
 * What kind of food a meal is, where the numbers alone led a model astray
 * (3.3.0). Forty grams of protein at breakfast came back as pasta with turkey;
 * a snack's figure, as a bowl of turkey with strawberries. Both on the brief,
 * neither what anybody eats at that hour.
 */
const BREAKFAST_CHARACTER =
  'Breakfast: morning food, built on bread, oats, dairy, eggs or fruit — toast, porridge, a yoghurt or skyr bowl, eggs, a sandwich. Not lunch food: no pasta, rice, stews, pulses or plated salads.';
const SNACK_CHARACTER =
  'Snack: 2-4 ingredients, little or no cooking, but still 1-3 steps. Eaten between meals, in the hand or with a spoon — fruit, yoghurt, a small sandwich or toast, a spread with bread or vegetables. Not a plated main: no rice, pasta, potato or pulses as its base, no skewers, no meat or fish served as a plate; in bread it is a snack.';

function characterOf(slot: MealSlot, ownBreakfastWords: boolean): string | null {
  if (slot === 'breakfast') {
    // Somebody who said "salado y rápido, antes de entrenar" knows their own
    // mornings better than this line does.
    return ownBreakfastWords ? `${BREAKFAST_CHARACTER} Their own words about breakfast, below, come first.` : BREAKFAST_CHARACTER;
  }

  return SNACK_SLOTS.includes(slot) ? SNACK_CHARACTER : null;
}

type SlotBrief = { readonly carbsG: number; readonly fatG: number; readonly fiberG: number; readonly kcal: number; readonly proteinG: number };

/** A day's targets, scaled to one slot's share of it. */
function briefFor(targets: NutritionTargets, share: number): SlotBrief {
  return {
    carbsG: Math.round(targets.carbsG * share),
    fatG: Math.round(targets.fatG * share),
    fiberG: Math.round(targets.fiberG * share),
    kcal: Math.round(targets.kcal * share),
    proteinG: Math.round(targets.proteinG * share)
  };
}

/** "P% protein · C% carbohydrate · F% fat" — the split, which is what a dish's composition has to match whatever its size. */
function splitOf(targets: { readonly carbsG: number; readonly fatG: number; readonly kcal: number; readonly proteinG: number }): string {
  const energy = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9 || 1;
  const pct = (kcal: number) => Math.round((kcal / energy) * 100);

  return `${pct(targets.proteinG * 4)}% protein · ${pct(targets.carbsG * 4)}% carbohydrate · ${pct(targets.fatG * 9)}% fat`;
}

function numbersOf(brief: SlotBrief): string {
  return `~${brief.kcal} kcal · ${brief.proteinG} g protein · ${brief.carbsG} g carbohydrate · ${brief.fatG} g fat · at least ${brief.fiberG} g fibre`;
}

/**
 * Each eaten slot's share of the whole day, normalised over the whole day.
 *
 * The person's own shape when the context carries it; the default shape (`0036`) otherwise.
 * Normalised over every slot the person eats — never over the slots in this
 * request, which is the mistake 3.0.0 exists to fix. A requested slot the shape
 * does not eat (the shape changed after the request was planned) joins at its
 * normal size rather than being briefed as a dish of nothing.
 */
function sharesOf(context: PromptContext): ReadonlyMap<MealSlot, number> {
  const raw = new Map(context.slotShares.size > 0 ? context.slotShares : weightsFor(DEFAULT_MEAL_SHAPE));

  for (const slot of context.needBySlot.keys()) {
    if (!raw.has(slot)) {
      raw.set(slot, weightsFor({ ...DEFAULT_MEAL_SHAPE, [slot]: 'normal' }).get(slot) ?? 0);
    }
  }

  const total = [...raw.values()].reduce((sum, share) => sum + share, 0) || 1;

  return new Map([...raw].map(([slot, share]) => [slot, share / total]));
}

/**
 * The days this fortnight that eat for an event, as a design request.
 *
 * The scheduler builds those days from the same pool as the rest; a pool with
 * nothing at their split leaves them short however it sizes the plates. So a
 * share of the dishes is asked for at that split too.
 */
function loadedLines(context: PromptContext, share: number, count: number): readonly string[] {
  const loaded = context.loadedTargets ?? [];

  if (loaded.length === 0 || count < 2) {
    return [];
  }

  const wanted = Math.max(1, Math.round(count / 3));

  return [
    'SOME DAYS THIS FORTNIGHT EAT FOR AN EVENT (a race, a match, a long session) at a different split:',
    ...loaded.map(targets => `- ${numbersOf(briefFor(targets, share))} per serving (${splitOf(targets)})`),
    `Make ${wanted} of these dishes fit that split instead, so those days have plates built for them.`,
    ''
  ];
}

export function buildPoolPrompt(context: PromptContext, safeIngredients: readonly CatalogueIngredient[]): string {
  const shares = sharesOf(context);
  const wanted = [...context.needBySlot.entries()].filter(([, count]) => count > 0);

  // Per serving, per slot, on all four macros and fibre. A model told only a
  // daily figure — or only energy and protein — writes dishes that hit those
  // and land the rest wherever the ingredients fall, and no portion scaling can
  // fix a dish's composition afterwards (`0045`).
  const needs = wanted
    .map(([slot, count]) => {
      const brief = briefFor(context.targets, shares.get(slot) ?? 0);
      const character = characterOf(slot, oneLine(context.breakfastStyle) !== null);
      const shape = character ? `\n  ${character}` : '';

      // As numbers, because prose was not enough: asked to straddle, 3.1.0's
      // main dishes still came back at 16–20% protein against a 17% day.
      const straddle = `\n  Protein: half the set between ${Math.round(brief.proteinG * 0.9)} and ${brief.proteinG} g, half between ${brief.proteinG} and ${Math.round(brief.proteinG * 1.1)} g — not all at the top.`;

      return `- ${SLOT_LABEL[slot]}: ${count} distinct dishes, each ${numbersOf(brief)} per serving.${straddle}${shape}`;
    })
    .join('\n');

  const firstSlot = wanted[0];
  const loaded = firstSlot ? loadedLines(context, shares.get(firstSlot[0]) ?? 0, firstSlot[1]) : [];
  const catalogue = catalogueByAisle(safeIngredients);

  return (
    [
      'Design dishes for a 14-day meal plan.',
      '',
      `WRITE EVERY DISH NAME AND EVERY STEP IN ${context.language.toUpperCase()}. Slugs stay exactly as given; only the prose is in that language.`,
      '',
      'PRIORITIES, in this order when they conflict:',
      '1. Only ingredients from the list below: nothing forbidden by allergy, nothing their way of eating rules out.',
      '2. Each dish lands on its numbers per serving — the split matters as much as the energy.',
      '3. The time limit, the budget and how they like to eat.',
      '4. Taste, technique and variety.',
      '',
      "THE PERSON'S DAILY TARGETS (to build the dishes to; never write them in the answer):",
      `- ${Math.round(context.targets.kcal)} kcal · ${Math.round(context.targets.proteinG)} g protein · ${Math.round(context.targets.carbsG)} g carbohydrate · ${Math.round(context.targets.fatG)} g fat · at least ${Math.round(context.targets.fiberG)} g fibre`,
      `- The split: ${splitOf(context.targets)}. Every dish should sit close to this split on its own, so any combination of them lands on the day.`,
      context.goal ? `- ${GOAL_GUIDANCE[context.goal]}` : null,
      '',
      'Every main dish carries a protein source — meat, fish, egg, dairy or legumes — sized to its protein figure. Energy, protein, carbohydrate and fat are each held to 5% of target on every day, over and under: a dish that hits the protein and misses the split is the wrong dish.',
      '',
      ...COMPOSITION_RULES,
      'WHAT MAKES A DISH GOOD ENOUGH TO SEND BACK:',
      '- A name a cook would recognise, describing the dish — not a list of its ingredients.',
      '- Seasoning. The catalogue has salt, paprika, cumin, oregano, cinnamon, bay, garlic, lemon,',
      '  vinegars and olive oil. A dish that uses none of them is not finished.',
      '- Technique in the steps: roast, sear, sauté, braise, griddle, marinate, rest. Say the heat',
      '  and the time. "Cook the chicken" is not a step; "sear 4 minutes a side, then rest 5" is.',
      '- Contrast in texture and temperature — something crisp against something soft, something',
      '  fresh against something rich.',
      '- ONE ACTION PER STEP. Five to eight steps for a main that cooks, two to four for a',
      '  snack. Never zero: a dish with no method is rejected before it is stored. "Sear the',
      '  pork 3 minutes, add the mushrooms, cook 4 more, stir in the rice" is four steps, not one.',
      '- EVERY STEP DOCUMENTED, in one to three sentences: what to do, how (the cut, the vessel,',
      '  the heat), and how long — put the time in `minutes` as well as the text. Then the sign',
      '  it is done, in `cue`: "until the edges brown", "until the liquid has halved", "until it',
      '  no longer sticks". A cook who has never made this dish follows it without guessing.',
      '- Include the quiet steps a recipe book includes: bring to temperature, rest the meat,',
      '  taste for seasoning, plate. They are where a dish goes right or wrong.',
      '- Variety of method across the set you return: do not send eight roasted dishes.',
      '',
      'DISHES NEEDED:',
      needs,
      '',
      ...loaded,
      ...spreadRules([...context.needBySlot.values()].reduce((sum, count) => sum + count, 0)),
      'THIS PERSON (design for them, not for a profile):',
      oneLine(context.breakfastStyle) ? `- Breakfast, in their words: ${oneLine(context.breakfastStyle)}` : null,
      oneLine(context.portionPreference) ? `- Plates they like: ${oneLine(context.portionPreference)}` : null,
      context.cookingFrequency ? `- Cooks: ${context.cookingFrequency}` : null,
      oneLine(context.scheduleNotes) ? `- Their week: ${oneLine(context.scheduleNotes)}` : null,
      context.dayShape ? `- Their day: ${context.dayShape}` : null,
      '',
      context.avoidNames.length > 0
        ? `SERVED TO THEM LAST FORTNIGHT — propose different dishes, not these or close variations of them: ${context.avoidNames.slice(0, 60).join('; ')}`
        : null,
      ...checkInLines(context.checkIn ?? null),
      context.swapWish ? `THIS ONE DISH IS A REPLACEMENT THE PERSON ASKED FOR: ${context.swapWish}. Every dish proposed must satisfy that.` : null,
      context.lovedNames.length > 0
        ? `DISHES THEY SAID THEY LOVED — this is their taste; design new dishes in the same spirit (technique, seasoning, kind of dish), not copies: ${context.lovedNames.slice(0, 40).join('; ')}`
        : null,
      context.dislikedNames.length > 0
        ? `DISHES THEY SAID THEY DISLIKED — do not propose these, close variations of them, or their defining ingredient in the same role: ${context.dislikedNames.slice(0, 40).join('; ')}`
        : null,
      context.dietaryPatterns.length > 0 ? `WAY OF EATING: ${context.dietaryPatterns.join(', ')}` : 'WAY OF EATING: no restriction declared',
      context.cookingTimeMinutes ? `MAXIMUM TIME PER DISH: ${context.cookingTimeMinutes} minutes (prep + cooking)` : null,
      context.budget ? `BUDGET: ${context.budget}` : null,
      context.cuisines.length > 0 ? `PREFERRED CUISINES: ${context.cuisines.join(', ')}` : null,
      context.likedLabels.length > 0 ? `LIKES: ${context.likedLabels.join(', ')}` : null,
      context.dislikedLabels.length > 0 ? `DISLIKES: ${context.dislikedLabels.join(', ')}` : null,
      context.forbiddenLabels.length > 0
        ? `FORBIDDEN BY ALLERGY (do not use it, and do not mention it in names, steps or garnishes): ${context.forbiddenLabels.join(', ')}`
        : null,
      context.excludeSlugs.length > 0 ? `DO NOT REPEAT THESE ALREADY-PROPOSED DISHES: ${context.excludeSlugs.join(', ')}` : null,
      '',
      'AVAILABLE INGREDIENTS (use these slugs and no others; a name follows in brackets only where the slug does not already say it):',
      catalogue,
      '',
      'Each dish lists its ingredients in grams for the number of servings you declare.',
      'Aim for five to ten ingredients in a main dish, two to five in a snack. Never more than fifteen, salt, spices and oil included — a dish with more is rejected.',
      'Declare between one and eight servings.'
    ]
      // Null is an optional line with nothing to say; an empty string is a
      // section break, and a model follows a sectioned brief better than a wall.
      .filter((line): line is string => line !== null)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  );
}
