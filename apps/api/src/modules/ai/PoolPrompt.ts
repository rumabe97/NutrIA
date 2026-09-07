import { SNACK_SLOTS } from 'core/entities/Plan';

import type { CatalogueIngredient, MealSlot } from 'core/entities/Plan';
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
 */
export const PROMPT_VERSION = '2.2.0';

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
  readonly budget: string | null;
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

  const catalogue = safeIngredients.map(ingredient => `${ingredient.slug} (${ingredient.name})`).join(', ');

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
    '- Three to eight steps for anything cooked; one to three for a snack. Never zero: a dish',
    '  with no method is rejected before it is stored. Even assembly is an instruction — what',
    '  goes on what, toasted or not, dressed with what.',
    '- Variety of method across the set you return: do not send eight roasted dishes.',
    '',
    'DISHES NEEDED:',
    needs,
    '',
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
