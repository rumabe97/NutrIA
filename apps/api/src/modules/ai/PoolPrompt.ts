import { INGREDIENT_CATEGORIES, SNACK_SLOTS } from 'core/entities/Plan';

import type { CatalogueIngredient, IngredientCategory, MealSlot } from 'core/entities/Plan';
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
 */
export const PROMPT_VERSION = '2.4.2';

/** Share of the day each slot carries; mirrors the scheduler's own weights. */
const SLOT_SHARE: Record<MealSlot, number> = {
  afternoon_snack: 0.09,
  breakfast: 0.25,
  dinner: 0.3,
  lunch: 0.33,
  morning_snack: 0.08,
  supper: 0.1
};

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
  readonly cookingFrequency: string | null;
  readonly cookingTimeMinutes: number | null;
  readonly cuisines: readonly string[];
  readonly dietaryPatterns: readonly string[];
  readonly dislikedLabels: readonly string[];
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
  /** The language the dish names and steps must come back in. */
  readonly language: string;
  readonly likedLabels: readonly string[];
  readonly needBySlot: ReadonlyMap<MealSlot, number>;
  /** Free text: "ligeros", "grandes"… */
  readonly portionPreference: string | null;
  /** Free text about the working week, e.g. shifts. */
  readonly scheduleNotes: string | null;
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

function catalogueByAisle(safeIngredients: readonly CatalogueIngredient[]): string {
  return INGREDIENT_CATEGORIES.map(category => {
    const rows = safeIngredients
      .filter(ingredient => ingredient.category === category)
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(ingredient => `${ingredient.slug} (${ingredient.name})`);

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
  'You are a working cook designing dishes for personalised meal plans.',
  'You only return dishes composed of ingredients from the catalogue you are given.',
  'You never invent an ingredient or a slug: if something is not on the list, it does not exist.',
  'You never state calories or macronutrients: the system computes those from the catalogue.',
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
  if (total < 4) {return [];}

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

export function buildPoolPrompt(context: PromptContext, safeIngredients: readonly CatalogueIngredient[]): string {
  const active = [...context.needBySlot.keys()];
  const totalShare = active.reduce((sum, slot) => sum + SLOT_SHARE[slot], 0) || 1;

  // Per-slot targets, not just a daily figure. A model told only "2000 kcal,
  // 120 g protein" produces dishes that hit the calories and miss the protein,
  // and no amount of portion scaling can fix a dish's composition afterwards.
  const needs = [...context.needBySlot.entries()]
    .filter(([, count]) => count > 0)
    .map(([slot, count]) => {
      const share = SLOT_SHARE[slot] / totalShare;
      const kcal = Math.round(context.targets.kcal * share);
      const protein = Math.round(context.targets.proteinG * share);
      const shape = SNACK_SLOTS.includes(slot) ? ' — snack: 2-4 ingredients, little or no cooking, but still 1-3 steps' : '';

      return `- ${SLOT_LABEL[slot]}: ${count} distinct dishes of ~${kcal} kcal and ~${protein} g protein per serving${shape}`;
    })
    .join('\n');

  const catalogue = catalogueByAisle(safeIngredients);

  return [
    'Design dishes for a 14-day meal plan.',
    '',
    `WRITE EVERY DISH NAME AND EVERY STEP IN ${context.language.toUpperCase()}. Slugs stay exactly as given; only the prose is in that language.`,
    '',
    "THE USER'S DAILY TARGETS (to size the dishes; do not state them in the response):",
    `- ${Math.round(context.targets.kcal)} kcal and ${Math.round(context.targets.proteinG)} g of protein per day`,
    '',
    'IMPORTANT: every main dish must carry a protein source (meat, fish, egg, dairy or pulses).',
    'A plan that meets the calories but falls short on protein is discarded in full.',
    '',
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
    ...spreadRules([...context.needBySlot.values()].reduce((sum, count) => sum + count, 0)),
    'THIS PERSON (design for them, not for a profile):',
    oneLine(context.breakfastStyle) ? `- Breakfast, in their words: ${oneLine(context.breakfastStyle)}` : '',
    oneLine(context.portionPreference) ? `- Plates they like: ${oneLine(context.portionPreference)}` : '',
    context.cookingFrequency ? `- Cooks: ${context.cookingFrequency}` : '',
    oneLine(context.scheduleNotes) ? `- Their week: ${oneLine(context.scheduleNotes)}` : '',
    '',
    context.avoidNames.length > 0
      ? `SERVED TO THEM LAST FORTNIGHT — propose different dishes, not these or close variations of them: ${context.avoidNames.slice(0, 60).join('; ')}`
      : '',
    context.dietaryPatterns.length > 0 ? `WAY OF EATING: ${context.dietaryPatterns.join(', ')}` : 'WAY OF EATING: no restriction declared',
    context.cookingTimeMinutes ? `MAXIMUM TIME PER DISH: ${context.cookingTimeMinutes} minutes (prep + cooking)` : '',
    context.budget ? `BUDGET: ${context.budget}` : '',
    context.cuisines.length > 0 ? `PREFERRED CUISINES: ${context.cuisines.join(', ')}` : '',
    context.likedLabels.length > 0 ? `LIKES: ${context.likedLabels.join(', ')}` : '',
    context.dislikedLabels.length > 0 ? `DISLIKES: ${context.dislikedLabels.join(', ')}` : '',
    context.forbiddenLabels.length > 0
      ? `FORBIDDEN BY ALLERGY (do not use it, and do not mention it in names, steps or garnishes): ${context.forbiddenLabels.join(', ')}`
      : '',
    context.excludeSlugs.length > 0 ? `DO NOT REPEAT THESE ALREADY-PROPOSED DISHES: ${context.excludeSlugs.join(', ')}` : '',
    '',
    'AVAILABLE INGREDIENTS (use these slugs and no others):',
    catalogue,
    '',
    'Each dish lists its ingredients in grams for the number of servings you declare.',
    'Aim for four to eight ingredients in a main dish, two to four in a snack; fifteen is a shopping trip.'
  ]
    .filter(Boolean)
    .join('\n');
}
