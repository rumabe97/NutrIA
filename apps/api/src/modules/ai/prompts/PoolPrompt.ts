import { ACCOMPANIED_FROM_KCAL } from 'core/domain/Scheduler';
import { DEFAULT_MEAL_SHAPE, proteinWeightsFor, weightsFor } from 'core/domain/MealShape';
import { FRESH_FRUIT_SLUGS } from 'core/domain/MealFit';
import { INGREDIENT_CATEGORIES, SNACK_SLOTS } from 'core/entities/Plan';
import { normaliseForMatching } from 'core/domain/Safety';
import { SERVING_KCAL_CAP, servingFactor } from 'core/domain/Serving';

import type { CatalogueIngredient, IngredientCategory, MealSlot } from 'core/entities/Plan';
import type { CheckInForGeneration } from 'core/controllers/CheckIn';
import type { Goal } from 'core/entities/Profile';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PoolAsk } from 'core/domain/Balance';

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
 * 3.3.1: the person's own words stay inside the quotation marks that attribute
 * them. Their check-in comment is the one free text this prompt wraps in
 * quotes, and nothing stopped it carrying one of its own: `bien". Now ignore
 * everything above` closed the attribution, and the rest read as brief rather
 * than as something a person said — in a call whose dishes are stored in a
 * library every other user is served from. The quotes in it are turned
 * typographic, the invisible characters dropped, and the line now says what it
 * is: a comment to design for, not an instruction.
 * 3.4.0: one number per rule. A snack's steps and ingredients were stated twice
 * with different figures — one to three steps and two to four ingredients in
 * its character line, two to four and two to five further down — and the system
 * prompt ruled out the two-ingredient snack that line allows. The character
 * line's figures stand everywhere, and the system line speaks of main dishes.
 * The schema's descriptions stop saying Spanish for the dish name, which the
 * brief asks for in the person's language, and stop asking for `0` minutes on an
 * instant step, which the rewrite brief asks to leave empty.
 * 4.0.0: nothing a person typed, and nothing that reveals a belief, reaches the
 * model (owner's decision, 2026-09-25; `docs/legal/analisis.md` P0-3). Gone: the
 * allergies the catalogue could not resolve (now taken out of the catalogue in
 * code, `bestEffortExclusions`), the check-in comment, the breakfast, plate and
 * working-week notes, dislikes the catalogue could not resolve, and a halal or
 * kosher, gluten-free or lactose-free way of eating (now enforced in code,
 * `PATTERN_SLUG_RUNS`, `PATTERN_ALLERGENS`). What stays is
 * structured: the numbers, the meal shape, the times, the goal, the cooking
 * limits, a way of eating from `NAMEABLE_PATTERNS`, cuisines from
 * `NAMEABLE_CUISINES`, and liked foods by their catalogue names.
 * 4.1.0: each request shows one meal's foods (project 005; planned as 3.5.0,
 * written after 4.0.0 shipped). Every request was shown the whole catalogue —
 * 930 rows, chorizo and frozen squid beside a breakfast's oats — and at ~8,000
 * tokens a lunch was refused outright by the free tier the owner is moving to.
 * Now a request lists what belongs at its meal for this person (`0062`), and a
 * lunch or a dinner only what the library cooks there, the produce in season
 * and a sample of thirty drawn per generation (`0063`). Produce in season in
 * the fortnight's month comes first, marked as preferred; nothing is withheld
 * for its season alone. Lunch and dinner are told what kind of food they are,
 * as breakfast and snacks were in 3.3.0 — dinner is lighter, and not a stew —
 * and the spread rule names legumes as a main protein only where the meal
 * offers them. Measured on the dev catalogue and library (2026-09-25), the
 * standard lunch request is 54.8% of 3.4.0's length in its worst month
 * (23,185 characters with every list empty and no cut); dinner 53.0%.
 * 4.2.0: produce in three groups — in season this month, all year, out of
 * season. A row with no season counted as in season in every month, so
 * onion, garlic, lemon and the herbs sat under "prefer these" and diluted it
 * (September: 34 seasonal rows among ~40 year-round ones).
 * 4.3.0: the step rules say, in as many words, that a step's text and cue are
 * written in the brief's own language and that an ingredient is named the way
 * a cook says it, never by its slug (owner's decision, 2026-09-26). Measured
 * on 72 dishes each from `google/gemma-4-31b-it` and
 * `deepseek/deepseek-v4.1-flash` (prompt 4.2.0): Gemma left the literal word
 * `` `minutes` `` inside 69% of its step texts ("durante 12 `minutes`"), named
 * ingredients by their catalogue slug in 48% ("Extienda el queso-cottage…"),
 * and its cues came back in English inside a Spanish recipe — this section's
 * own cue examples, which were English words to copy rather than a meaning to
 * translate. The examples are now introduced as meaning, not text, and the
 * ingredient rule is stated rather than assumed from "in that language" two
 * paragraphs up. `domain/Method`'s `cleanStep` still cleans up what a model
 * writes anyway — the backtick, the bare word, a slug left in the prose — and
 * a step that reads as English in a non-English request now rejects the dish
 * (`wrong_language`), because a prompt is a request and the schema is the
 * guarantee. A first wording ("never the English word `minutes`; the number
 * alone goes in its own field") read as "leave `minutes` out": on 125 dishes
 * neither model filled the field, where DeepSeek had filled every one. The
 * rule now asks for the field by name, then for the words in the text.
 * 4.4.0: cooking frequency and the shape of the day are gone from the prompt,
 * with the onboarding questions that fed them (owner's decision, 2026-09-28;
 * `0067`): neither changed a dish, a target or a rule anywhere downstream —
 * the test `0025` sets for a field worth asking. `THIS PERSON` carried only
 * those two lines, so the header goes with them; priority 3 drops "the
 * budget" the same way, its onboarding question gone too. The bench then
 * caught a second-order break the version number does not: with no line
 * naming a person's day left in the prompt, a model asked for dinner started
 * calling every dinner "supper", and the pool dropped every one on that label
 * alone — fixed in `PoolBuilder`, not here, by asking the ingredients rather
 * than the label. `GOAL_GUIDANCE` loses `custom` the same day: the goal type
 * is gone from `GOAL_TYPES` along with the free text it existed to describe
 * (`0067`), and it always computed as `maintenance` anyway.
 * 4.5.0: one serving has a ceiling (`0070`, amending `0047`). The brief was the
 * person's share of the day with nothing bounding it, so a 3,700 kcal day with
 * a large lunch asked one serving of lunch for 2,700 kcal — and the model wrote
 * it: 350 g of dry rice and 55 g of oil as one plate, `servings: 1`, stored in
 * the library everyone is served from (49 dev dishes over 1,500 kcal, 17 over
 * 2,000). The "250 g dry is three" and "a plate a person would recognise as
 * one" lines lost to the number every time. Now each meal's brief is capped
 * (`SERVING_KCAL_CAP`: then 900 kcal lunch and dinner, 700 breakfast, 400 a snack)
 * with protein, carbohydrate, fat and fibre scaled by the same factor, so the
 * split is exactly 0047's; the protein straddle follows the capped figure; the
 * event-day lines are capped the same way; and a capped meal is told that the
 * person eats more there and is served more than one serving. The pool builder
 * refuses a dish past one and a half times its cap (`oversized`).
 * 4.6.0: a dish for one person (project 016 § B, architect report `0008`).
 * The plan now sets sides beside a lunch or a dinner itself (`0079`: bread,
 * salads, vegetables, gazpacho, plain rice or potatoes, fruit, yoghurt, nuts,
 * queso de Burgos), so the line that let a large brief be "a plate with
 * bread, fruit or dairy beside it" is gone, and "Real portions" says one
 * serving is one plate for one person, with the plan adding the sides — named
 * by kind, vegetables and starch among them, so the model does not pile them
 * into the dish.
 * Lunch and dinner are capped at 650 kcal a serving instead of 900, and the
 * pool builder's `oversized` bound moves with it, to 975. The plate method —
 * half vegetables, a quarter protein, a quarter starch — enters as a
 * preference below the split, never above it. To keep the lunch request
 * inside PRD 005's 55% of 3.4.0, the ceiling line lost its first clause,
 * which said what the brief already shows. Beyond the lower cap, only the
 * fixed text changed: what the prompt says about the person is 4.5.0's, word
 * for word, and `traditional_spanish` is still never named (`0077`).
 * 4.7.0: the food groups of a balanced fortnight (project 019, architect
 * report `0010` § 4.4). The scheduler holds the table's minimums and
 * maximums, but can only serve what the pool holds, and the library is thin
 * in a few cells: legumes at a Spanish dinner, legume kinds beyond chickpeas
 * and lentils, whole grain at dinner. So a lunch's or a dinner's request now
 * says, inside the request already made, how many of its dishes are built on
 * legumes (another kind, at lunch, when the pool holds fewer than three; in
 * light forms, never stewed, at dinner), on a whole grain or on an oily fish —
 * only what that slot's pool lacks of the rotation's reserve, and only a
 * group the request's catalogue has a row of (`poolAsks`), never more than
 * two dishes of three (`spreadAsks`). The fibre rule asks for whole grains
 * over refined, for every goal. A lunch or a dinner at or under
 * `ACCOMPANIED_FROM_KCAL` gets no sides from the plan (`0079`), so "Real
 * portions" stops saying it does and asks the dish for its own vegetables,
 * 150 g a serving; and when neither main takes sides, breakfast and the
 * snacks are asked for fresh fruit, the only place it can come from. The
 * protein of each meal follows the goal, as the scheduler's budgets have
 * since `0088`: a muscle-gain breakfast, supper and snacks are briefed more
 * of the day's protein, lunch and dinner less (`proteinWeightsFor`); every
 * other goal's numbers are 4.6.0's. To keep the lunch request inside PRD
 * 005's 55% of 3.4.0 with the longest asks it can carry, the snack rule is
 * told only to a snack's request (one meal a request since `0016`), the two
 * fat rules are one, the lean sources list is shorter, and the protein-source
 * line drops "sized to its protein figure", which the first composition rule
 * says.
 */
export const PROMPT_VERSION = '4.7.0';

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
  /**
   * The last fortnight's check-in, when there is one: how the portions felt and
   * how hard it was — its closed answers only. The comment is never read here.
   */
  readonly checkIn?: Pick<CheckInForGeneration, 'difficulty' | 'hunger' | 'satisfaction'> | null;
  readonly cookingTimeMinutes: number | null;
  /** Named only when on `NAMEABLE_CUISINES`: the list onboarding offers, never what a request typed. */
  readonly cuisines: readonly string[];
  /** Named only when on `NAMEABLE_PATTERNS`; a religious one never is, and is enforced in code instead. */
  readonly dietaryPatterns: readonly string[];
  /** Dishes the person marked as disliked. Already out of reuse; named so the model does not recreate them. */
  readonly dislikedNames: readonly string[];
  readonly excludeSlugs: readonly string[];
  /**
   * What they are eating for — lose weight, build muscle, perform, maintain.
   * Already folded into the numbers by `core/domain/Nutrition`; here because the
   * same numbers are reached by different plates depending on it, and choosing
   * the plate is the model's half of the split (`0004`). Null when unset.
   */
  readonly goal: Goal['type'] | null;
  /** The language the dish names and steps must come back in. */
  readonly language: string;
  /** Foods they said they like, by the catalogue's own names — never the words they typed. */
  readonly likedFoods: readonly string[];
  /**
   * The targets of the days this fortnight that eat for an event (`0043`), when
   * there are any. The scheduler draws those days from the same pool, and a
   * pool with nothing at their split leaves them short however it sizes them.
   */
  readonly loadedTargets?: readonly NutritionTargets[];
  /** Dishes the person marked as liked: the taste to design towards, and dishes that may return. */
  readonly lovedNames: readonly string[];
  /**
   * 1–12: the month the fortnight starts in — for a swap, the month of the day
   * being replaced. Produce in season then is listed first and marked, the
   * year-round rows after it and the out-of-season last (`0062` § 6, 4.2.0),
   * and a lunch's or a dinner's catalogue keeps it (`0063`).
   */
  readonly month: number;
  readonly needBySlot: ReadonlyMap<MealSlot, number>;
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
 * Ways of eating that may be named to the model: an allow-list, so a pattern
 * added to the schema is withheld until somebody decides it may be said (the
 * lead, 2026-09-25: vegetarian and vegan, nothing else). Halal and kosher reveal
 * a belief, gluten-free and lactose-free a coeliac disease or an intolerance;
 * none is sent anywhere, and each is enforced in code (`PATTERN_EXCLUSIONS`,
 * `PATTERN_SLUG_RUNS`, `PATTERN_ALLERGENS`, `breaksDishRule`). The rest are
 * enforced by their exclusions alone and need no words.
 */
export const NAMEABLE_PATTERNS: ReadonlySet<string> = new Set(['vegetarian', 'vegan']);

/**
 * The cuisines onboarding offers, normalised. The route accepts any string, so
 * the prompt names only these: a cuisine is a taste, a sentence typed into the
 * field is free text.
 */
export const NAMEABLE_CUISINES: ReadonlySet<string> = new Set(
  ['Mediterránea', 'Española', 'Italiana', 'Mexicana', 'Japonesa', 'India', 'Griega', 'Árabe', 'Tailandesa', 'Peruana'].map(normaliseForMatching)
);

/**
 * How the last fortnight went, as guidance: its closed answers only. The weight
 * they gave is not here — it already moved the targets, in code — and neither
 * is their comment, which is their words and never leaves the building.
 */
function checkInLines(checkIn: PromptContext['checkIn']): readonly string[] {
  if (!checkIn) {
    return [];
  }

  return [
    `LAST FORTNIGHT'S CHECK-IN: ${HUNGER_LINE[checkIn.hunger]}; ${DIFFICULTY_LINE[checkIn.difficulty]}; they rated it ${checkIn.satisfaction}/5.`
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

const IN_SEASON_HEADING = 'In season this month (prefer these):';
const ALL_YEAR_HEADING = 'All year:';
const OUT_OF_SEASON_HEADING = 'Out of season (use sparingly):';

/**
 * One aisle's rows, by slug. Produce comes in three groups, each by slug and
 * each left out when empty (4.2.0, `0062` § 6): what has a season and is in
 * it this month, marked as preferred; what has none and is on the shelf all
 * year; and what has a season and is out of it — still offered, since a
 * tomato is on every shelf in January, but last. A row with no season is not
 * "in season" here, unlike `inSeason`, which keeps it in the `0063` cut:
 * under "prefer these" the year-round rows outnumbered the seasonal ones and
 * the preference said nothing. Every other aisle is one list.
 */
function aisleRows(rows: readonly CatalogueIngredient[], category: IngredientCategory, month: number): string {
  const sorted = [...rows].sort((a, b) => a.slug.localeCompare(b.slug));

  if (category !== 'produce') {
    return sorted.map(listed).join(', ');
  }

  const seasonal = (ingredient: CatalogueIngredient) => ingredient.seasonMonths.length > 0;
  const groups = [
    [IN_SEASON_HEADING, sorted.filter(ingredient => seasonal(ingredient) && ingredient.seasonMonths.includes(month))],
    [ALL_YEAR_HEADING, sorted.filter(ingredient => !seasonal(ingredient))],
    [OUT_OF_SEASON_HEADING, sorted.filter(ingredient => seasonal(ingredient) && !ingredient.seasonMonths.includes(month))]
  ] as const;

  return groups
    .filter(([, group]) => group.length > 0)
    .map(([heading, group]) => `${heading} ${group.map(listed).join(', ')}`)
    .join('\n');
}

function catalogueByAisle(safeIngredients: readonly CatalogueIngredient[], month: number): string {
  return INGREDIENT_CATEGORIES.map(category => {
    const rows = safeIngredients.filter(ingredient => ingredient.category === category);

    return rows.length > 0 ? `${CATEGORY_LABEL[category]}:\n${aisleRows(rows, category, month)}` : '';
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
  'A main dish is cooked, seasoned food, not two ingredients set side by side.'
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
 * Nor does it contain anything the person typed, or any label that reveals a
 * belief (4.0.0). A free-text allergy that matched no catalogue row used to be
 * named here; now what shares a word with it is removed from the catalogue in
 * code (`bestEffortExclusions`), and the rejection of any dish whose ingredients
 * do not all resolve closes the one way an unknown substance could arrive.
 * `health-boundary.spec.ts` fails if any of it comes back.
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
 * A list of user-written labels as one bounded line: `oneLine`'s discipline for
 * an array of free text.
 *
 * Each entry is flattened on its own, so a newline typed into a cuisine or a
 * food preference cannot open what reads as a new instruction line, and the
 * joined line is bounded too — sixty labels of eighty characters are 4,800
 * characters of chosen text, which is a prompt of their own sitting inside this
 * one. Empty and whitespace-only entries fall out, as they do for a single field.
 */
function oneLineList(items: readonly string[], perItem = 80, max = 400): string | null {
  const flat = items.map(item => oneLine(item, perItem)).filter((item): item is string => item !== null);

  return oneLine(flat.join(', '), max);
}

/**
 * How spread the returned set must be, stated as counts the model can check.
 * "Varied" alone produced eight chicken dishes; a ceiling per protein does not.
 *
 * Legumes are named among the main proteins only where the meal's catalogue
 * offers the pulses lunch does (4.1.0, `offersPulses`): an omnivore's dinner
 * has none since `0062`, and a rule naming them asks for what is not there.
 */
function spreadRules(total: number, pulses: boolean): string[] {
  if (total < 4) {
    return [];
  }

  const perProtein = Math.max(2, Math.ceil(total / 4));
  const perMethod = Math.max(2, Math.ceil(total / 3));
  const cuisines = Math.min(4, Math.floor(total / 3));
  const proteins = pulses ? 'chicken, beef, pork, fish, eggs, legumes, dairy' : 'chicken, beef, pork, fish, eggs, dairy';

  return [
    'SPREAD ACROSS THE SET YOU RETURN (counted over all dishes together):',
    `- No main protein — ${proteins} — in more than ${perProtein} dishes.`,
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
function compositionRules(sides: string, snack: boolean): readonly string[] {
  const rules: readonly (string | null)[] = [
    'HOW TO BUILD EACH DISH TO ITS NUMBERS:',
    '- Protein is a figure to land on, not a minimum. A dish 20% over its protein is as far off as one 20% under, and the day cannot absorb it: the other meals cannot give protein back. Give the protein source the grams its figure asks for, and let starch and vegetables carry the rest of the plate.',
    '- Straddle the numbers. Across the dishes of one meal, land about half a little under each figure and half a little over — within a tenth either way — never all on the same side. The days are built by combining your dishes, and a set that runs high on protein makes every day run high.',
    '- Energy: protein and carbohydrate carry 4 kcal per gram, fat carries 9, so ten grams of oil is 90 kcal. Weigh the fat — oil, butter, cheese, nuts, seeds, avocado, cured meats, oily fish — to the gram its target allows, never a splash, and add it last.',
    '- When the split asks for a lot of carbohydrate, build the plate on a starch — rice, pasta, couscous, potato, bread, oats, legumes — and add fruit to breakfasts and snacks.',
    '- When it asks for a lot of protein and little fat, reach for the lean sources their way of eating allows: poultry breast, white fish, tuna in water, egg whites, fresh cheese, skyr, natural or soy yoghurt, legumes, tofu, tempeh.',
    '- When it asks for little carbohydrate, build the plate on vegetables and protein, with a small starch or none, and let olive oil, nuts or avocado carry the energy the split gives to fat.',
    '- If a dish is short of energy, add starch or protein first — whichever the split is short of — and fat only if the fat target has room. A large brief is a large plate; a small brief is a full plate of lighter food, never a smaller portion of a rich one.',
    // Since `0016` a request asks for one meal: a lunch is not told how to build a snack (4.7.0).
    snack
      ? '- A snack follows the same split as the day, scaled down. A snack of nuts alone is three quarters fat; pair it with fruit, dairy or bread.'
      : null,
    '- Fibre: at least two plant components in a main dish — vegetables, legumes, fruit, whole grains over refined.',
    '- Weigh each ingredient as it is named. A slug that says cooked (cocido, cocida) is weighed cooked; one that says raw or dry (crudo, seco) — or says neither, for rice, pasta, grains and pulses — is weighed dry, as bought. Dry rice or pasta roughly triples in weight when cooked: 80 g dry is a normal plate, 250 g dry is three.',
    `- Real portions. Grams cover the declared servings; one serving is one plate for one. ${sides}Prefer half vegetables, a quarter protein, a quarter starch, never above the numbers.`,
    '- One serving has a ceiling. A person who eats more is served more servings of the same dish, and the plan sizes that. Never build one serving past its numbers.',
    ''
  ];

  return rules.filter((rule): rule is string => rule !== null);
}

/**
 * What "Real portions" says goes beside the dish (4.6.0); what it says to a
 * lunch or a dinner nothing goes beside (4.7.0); and to breakfast or a snack
 * of somebody whose lunch and dinner take no sides, nothing about them.
 */
const SIDES_ADDED = 'The plan adds sides to lunch and dinner (bread, salad, vegetables, rice, fruit, dairy). ';
const NO_SIDES = 'Nothing is served beside this meal: the dish carries 150 g of vegetables a serving. ';

/**
 * What kind of food a meal is, where the numbers alone led a model astray
 * (3.3.0). Forty grams of protein at breakfast came back as pasta with turkey;
 * a snack's figure, as a bowl of turkey with strawberries. Both on the brief,
 * neither what anybody eats at that hour.
 *
 * Lunch and dinner joined them in 4.1.0 (PRD 005 § 5): 98 of 372 library
 * dinners carried a pulse, most of them stewed, and nothing told the model a
 * dinner is lighter than a lunch. Supper is a snack after dinner, and is told
 * so.
 */
const BREAKFAST_CHARACTER =
  'Breakfast: morning food, built on bread, oats, dairy, eggs or fruit — toast, porridge, a yoghurt or skyr bowl, eggs, a sandwich. Not lunch food: no pasta, rice, stews, pulses or plated salads.';
const SNACK_CHARACTER =
  'Snack: 2-4 ingredients, little or no cooking, but still 1-3 steps. Eaten between meals, in the hand or with a spoon — fruit, yoghurt, a small sandwich or toast, a spread with bread or vegetables. Not a plated main: no rice, pasta, potato or pulses as its base, no skewers, no meat or fish served as a plate; in bread it is a snack.';
const LUNCH_CHARACTER =
  'Lunch: the main cooked meal of the day — a full plate or a one-pot dish: stews and pulses, rice, pasta, roasts, a protein with a starch and vegetables.';
const DINNER_CHARACTER =
  'Dinner: lighter home cooking than lunch — eggs, fish, grilled meat, vegetable creams, salads, a toast or a sandwich. Not a stew.';
/** Added to dinner for a vegan or a vegetarian, who keep the pulses at dinner (`0062` § 4) in the forms a dinner takes. */
const PLANT_BASED_DINNER = 'Pulses in light forms — hummus, purées and creams, warm salads — never stewed.';

function characterOf(slot: MealSlot, patterns: readonly string[]): string | null {
  switch (slot) {
    case 'breakfast':
      return BREAKFAST_CHARACTER;
    case 'lunch':
      return LUNCH_CHARACTER;
    case 'dinner':
      return patterns.some(pattern => pattern === 'vegan' || pattern === 'vegetarian')
        ? `${DINNER_CHARACTER} ${PLANT_BASED_DINNER}`
        : DINNER_CHARACTER;
    case 'supper':
      return SNACK_CHARACTER;
    default:
      return SNACK_SLOTS.includes(slot) ? SNACK_CHARACTER : null;
  }
}

type SlotBrief = { readonly carbsG: number; readonly fatG: number; readonly fiberG: number; readonly kcal: number; readonly proteinG: number };

/** One slot's share of the day's energy, and of its protein, which differs only by goal (`0088`). */
type SlotShare = { readonly energy: number; readonly protein: number };

/**
 * A day's targets, scaled to one slot's share of it — and to one serving's
 * ceiling at that meal (`0070`, `servingFactor`). One factor for all five
 * figures, so a person whose share is larger than one plate eats more than
 * one serving of it. The protein is the slot's share of the day's protein,
 * the rest its share of the energy, as the scheduler's `slotBudgets` divides
 * them (4.7.0): for every goal but building muscle the two are one share,
 * and the split is the day's.
 */
function briefFor(targets: NutritionTargets, share: SlotShare, slot: MealSlot): SlotBrief & { readonly capped: boolean } {
  const factor = servingFactor(targets.kcal * share.energy, slot);
  const scale = share.energy * factor;

  return {
    capped: factor < 1,
    carbsG: Math.round(targets.carbsG * scale),
    fatG: Math.round(targets.fatG * scale),
    fiberG: Math.round(targets.fiberG * scale),
    kcal: Math.round(targets.kcal * scale),
    proteinG: Math.round(targets.proteinG * share.protein * factor)
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
 *
 * The protein's share is the goal's (`proteinWeightsFor`, 4.7.0), normalised
 * the same way; for every goal but building muscle it is the energy's.
 */
function sharesOf(context: PromptContext): ReadonlyMap<MealSlot, SlotShare> {
  const raw = new Map(context.slotShares.size > 0 ? context.slotShares : weightsFor(DEFAULT_MEAL_SHAPE));

  for (const slot of context.needBySlot.keys()) {
    if (!raw.has(slot)) {
      raw.set(slot, weightsFor({ ...DEFAULT_MEAL_SHAPE, [slot]: 'normal' }).get(slot) ?? 0);
    }
  }

  const protein = proteinWeightsFor(context.goal, raw) ?? raw;
  const total = [...raw.values()].reduce((sum, share) => sum + share, 0) || 1;
  const proteinTotal = [...protein.values()].reduce((sum, share) => sum + share, 0) || 1;

  return new Map([...raw].map(([slot, share]) => [slot, { energy: share / total, protein: (protein.get(slot) ?? share) / proteinTotal }]));
}

const NO_SHARE: SlotShare = { energy: 0, protein: 0 };

/**
 * The days this fortnight that eat for an event, as a design request.
 *
 * The scheduler builds those days from the same pool as the rest; a pool with
 * nothing at their split leaves them short however it sizes the plates. So a
 * share of the dishes is asked for at that split too.
 */
function loadedLines(context: PromptContext, slot: MealSlot, share: SlotShare, count: number): readonly string[] {
  const loaded = context.loadedTargets ?? [];

  if (loaded.length === 0 || count < 2) {
    return [];
  }

  const wanted = Math.max(1, Math.round(count / 3));

  return [
    'SOME DAYS THIS FORTNIGHT EAT FOR AN EVENT (a race, a match, a long session) at a different split:',
    ...loaded.map(targets => `- ${numbersOf(briefFor(targets, share, slot))} per serving (${splitOf(targets)})`),
    `Make ${wanted} of these dishes fit that split instead, so those days have plates built for them.`,
    ''
  ];
}

/** What the builder knows about the catalogue a request is shown, and the pool it fills, that the rows alone do not say. */
export type CatalogueOffer = {
  /**
   * How many of this request's dishes are asked to be of a food group the
   * slot's pool lacks (`poolAsks`, 4.7.0): never more than the request's
   * dishes, and only groups its catalogue has a row of.
   */
  readonly asks?: readonly PoolAsk[];
  /** Whether the meal offers the pulses lunch does (`offersPulses`); legumes are named as a main protein only then. */
  readonly pulses: boolean;
};

/** A legume kind as `pulseKind` names it, the way a cook says it: `alubias-blancas` → "alubias blancas". */
function kindName(kind: string): string {
  return kind.replaceAll('-', ' ');
}

/** "a, b or c" */
function orList(items: readonly string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : (items[0] ?? '');
}

/**
 * One ask as the request says it (4.7.0). Legumes at 25 g dry a serving,
 * the table's threshold (`BALANCE_GRAMS.legume`), so a garnish is not the
 * dish; at dinner in the forms a dinner takes, as a vegetarian's dinner is
 * told (`PLANT_BASED_DINNER`).
 */
function askLine(ask: PoolAsk, slot: MealSlot): string {
  switch (ask.group) {
    case 'legume':
      return slot === 'dinner'
        ? `${ask.count} on legumes, light (warm salad, cream, hummus), never stewed`
        : `${ask.count} on legumes (25 g dry a serving)${ask.heldKinds.length > 0 ? `, not ${orList(ask.heldKinds.map(kindName))}` : ''}`;
    case 'oilyFish':
      return `${ask.count} on an oily fish`;
    case 'wholeGrain':
      return `${ask.count} on a whole grain`;
  }
}

const MAINS: ReadonlySet<MealSlot> = new Set(['lunch', 'dinner']);

/** Whether a main meal's share of the day is past `ACCOMPANIED_FROM_KCAL`, so the plan sets sides beside it — the scheduler's own test. */
function takesSides(targets: NutritionTargets, slot: MealSlot, share: SlotShare): boolean {
  return MAINS.has(slot) && targets.kcal * share.energy > ACCOMPANIED_FROM_KCAL;
}

/**
 * What a meal's dishes carry for the groups a fortnight needs (4.7.0): what
 * the pool lacks (`asks`), and the fruit no side will bring — when neither
 * main takes sides, breakfast and the snacks are the only place it can come
 * from. (A main the plan sets no sides beside is told so in "Real portions".)
 * Read off the targets and the meal shape the brief already shows.
 */
function groupLines(
  context: PromptContext,
  shares: ReadonlyMap<MealSlot, SlotShare>,
  slot: MealSlot,
  count: number,
  asks: readonly PoolAsk[],
  fruit: boolean
): string {
  const own = asks.length > 0 ? `\n  Of these: ${asks.map(ask => askLine(ask, slot)).join('; ')}.` : '';
  // Only where the request shows a fresh fruit, as `poolAsks` asks only for a group its catalogue holds.
  const fruitless = fruit && !MAINS.has(slot) && ![...shares].some(([main, share]) => takesSides(context.targets, main, share));

  return fruitless ? `${own}\n  Lunch and dinner come with no sides: ${Math.ceil(count / 2)} of these with 120–150 g of fresh fruit a serving.` : own;
}

/**
 * One request's prompt. `safeIngredients` is the catalogue this request is
 * shown — since 4.1.0, one meal's (`mealCatalogue`), which the pool builder
 * cuts; this lists what it is given and cuts nothing itself.
 */
export function buildPoolPrompt(
  context: PromptContext,
  safeIngredients: readonly CatalogueIngredient[],
  offer: CatalogueOffer = { pulses: true }
): string {
  const shares = sharesOf(context);
  const wanted = [...context.needBySlot.entries()].filter(([, count]) => count > 0);
  const patterns = context.dietaryPatterns.filter(pattern => NAMEABLE_PATTERNS.has(pattern));
  const fruit = safeIngredients.some(ingredient => FRESH_FRUIT_SLUGS.has(ingredient.slug));

  // Per serving, per slot, on all four macros and fibre. A model told only a
  // daily figure — or only energy and protein — writes dishes that hit those
  // and land the rest wherever the ingredients fall, and no portion scaling can
  // fix a dish's composition afterwards (`0045`).
  const needs = wanted
    .map(([slot, count]) => {
      const brief = briefFor(context.targets, shares.get(slot) ?? NO_SHARE, slot);
      const character = characterOf(slot, patterns);
      const shape = character ? `\n  ${character}` : '';
      // Their share of the day at this meal is more than one plate (`0070`):
      // said, so the model does not pack it back into one serving.
      const more = brief.capped
        ? `\n  One serving is capped at ~${SERVING_KCAL_CAP[slot]} kcal at this meal. They eat more than that here and are served more than one serving: build one plate, never the whole meal.`
        : '';

      // As numbers, because prose was not enough: asked to straddle, 3.1.0's
      // main dishes still came back at 16–20% protein against a 17% day.
      const straddle = `\n  Protein: half the set between ${Math.round(brief.proteinG * 0.9)} and ${brief.proteinG} g, half between ${brief.proteinG} and ${Math.round(brief.proteinG * 1.1)} g — not all at the top.`;

      const groups = groupLines(context, shares, slot, count, offer.asks ?? [], fruit);

      return `- ${SLOT_LABEL[slot]}: ${count} distinct dishes, each ${numbersOf(brief)} per serving.${straddle}${more}${groups}${shape}`;
    })
    .join('\n');

  // A lunch or a dinner the plan sets no sides beside carries its own vegetables (4.7.0).
  const alone = wanted.some(([slot]) => MAINS.has(slot) && !takesSides(context.targets, slot, shares.get(slot) ?? NO_SHARE));
  const sided = [...shares].some(([slot, share]) => takesSides(context.targets, slot, share));
  const sides = alone ? NO_SIDES : sided ? SIDES_ADDED : '';
  const firstSlot = wanted[0];
  const loaded = firstSlot ? loadedLines(context, firstSlot[0], shares.get(firstSlot[0]) ?? NO_SHARE, firstSlot[1]) : [];
  const catalogue = catalogueByAisle(safeIngredients, context.month);
  const cuisines = oneLineList(context.cuisines.filter(cuisine => NAMEABLE_CUISINES.has(normaliseForMatching(cuisine))));
  const likes = oneLineList(context.likedFoods);

  return (
    [
      'Design dishes for a 14-day meal plan.',
      '',
      `WRITE EVERY DISH NAME AND EVERY STEP IN ${context.language.toUpperCase()}. Slugs stay exactly as given; only the prose is in that language.`,
      '',
      'PRIORITIES, in this order when they conflict:',
      '1. Only ingredients from the list below: nothing forbidden by allergy, nothing their way of eating rules out.',
      '2. Each dish lands on its numbers per serving — the split matters as much as the energy.',
      '3. The time limit and how they like to eat.',
      '4. Taste, technique and variety.',
      '',
      "THE PERSON'S DAILY TARGETS (to build the dishes to; never write them in the answer):",
      `- ${Math.round(context.targets.kcal)} kcal · ${Math.round(context.targets.proteinG)} g protein · ${Math.round(context.targets.carbsG)} g carbohydrate · ${Math.round(context.targets.fatG)} g fat · at least ${Math.round(context.targets.fiberG)} g fibre`,
      `- The split: ${splitOf(context.targets)}. Every dish should sit close to this split on its own, so any combination of them lands on the day.`,
      context.goal ? `- ${GOAL_GUIDANCE[context.goal]}` : null,
      '',
      'Every main dish carries a protein source — meat, fish, egg, dairy or legumes. Energy, protein, carbohydrate and fat are each held to 5% of target on every day, over and under: a dish that hits the protein and misses the split is the wrong dish.',
      '',
      ...compositionRules(
        sides,
        wanted.some(([slot]) => slot === 'supper' || SNACK_SLOTS.includes(slot))
      ),
      'WHAT MAKES A DISH GOOD ENOUGH TO SEND BACK:',
      '- A name a cook would recognise, describing the dish — not a list of its ingredients.',
      '- Seasoning. The catalogue has salt, paprika, cumin, oregano, cinnamon, bay, garlic, lemon,',
      '  vinegars and olive oil. A dish that uses none of them is not finished.',
      '- Technique in the steps: roast, sear, sauté, braise, griddle, marinate, rest. Say the heat',
      '  and the time. "Cook the chicken" is not a step; "sear 4 minutes a side, then rest 5" is.',
      '- Contrast in texture and temperature — something crisp against something soft, something',
      '  fresh against something rich.',
      '- ONE ACTION PER STEP. Five to eight steps for a main that cooks, one to three for a',
      '  snack. Never zero: a dish with no method is rejected before it is stored. "Sear the',
      '  pork 3 minutes, add the mushrooms, cook 4 more, stir in the rice" is four steps, not one.',
      '- EVERY STEP DOCUMENTED, in one to three sentences: what to do, how (the cut, the vessel,',
      '  the heat), and how long: the number in the `minutes` field of every timed step, and the',
      '  time in words, in that language, in the text ("durante 12 minutos"). Then the sign it is',
      '  done, in `cue`, in that language too — meaning "until the edges brown", never those',
      '  English words. Name every ingredient as a cook would say it, never by its slug.',
      '- Include the quiet steps a recipe book includes: bring to temperature, rest the meat,',
      '  taste for seasoning, plate. They are where a dish goes right or wrong.',
      '- Variety of method across the set you return: do not send eight roasted dishes.',
      '',
      'DISHES NEEDED:',
      needs,
      '',
      ...loaded,
      ...spreadRules(
        [...context.needBySlot.values()].reduce((sum, count) => sum + count, 0),
        offer.pulses
      ),
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
      patterns.length > 0 ? `WAY OF EATING: ${patterns.join(', ')}` : null,
      context.cookingTimeMinutes ? `MAXIMUM TIME PER DISH: ${context.cookingTimeMinutes} minutes (prep + cooking)` : null,
      cuisines ? `PREFERRED CUISINES: ${cuisines}` : null,
      likes ? `LIKES: ${likes}` : null,
      context.excludeSlugs.length > 0 ? `DO NOT REPEAT THESE ALREADY-PROPOSED DISHES: ${context.excludeSlugs.join(', ')}` : null,
      '',
      'AVAILABLE INGREDIENTS (use these slugs and no others; a name follows in brackets only where the slug does not already say it):',
      catalogue,
      '',
      'Each dish lists its ingredients in grams for the number of servings you declare.',
      'Aim for five to ten ingredients in a main dish, two to four in a snack. Never more than fifteen, salt, spices and oil included — a dish with more is rejected.',
      'Declare between one and eight servings.'
    ]
      // Null is an optional line with nothing to say; an empty string is a
      // section break, and a model follows a sectioned brief better than a wall.
      .filter((line): line is string => line !== null)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
  );
}
