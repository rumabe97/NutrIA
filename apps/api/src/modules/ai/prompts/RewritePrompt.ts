import { METHOD_RULES } from 'core/domain/Method';

import type { UndocumentedRecipe } from 'core/controllers/Recipe';

/**
 * Rewrites the method of a dish that already exists.
 *
 * A separate prompt from `PoolPrompt`, because it is a different job: nothing is
 * being invented here. The dish, its ingredients, its times and its portions are
 * fixed and given; only the writing changes. Saying so plainly is what stops the
 * model "improving" the recipe into a different one.
 *
 * English instructions for every locale, as everywhere else — only the requested
 * output language varies.
 *
 * Written to the standard of the generation prompt: a professional's method, not
 * a summary of one. And one rule outranks every rule of style — the ingredient
 * list is the whole kitchen. The model's first rewrites added what the dish never
 * had, a pinch of salt here, "serve with bread" there; the list was checked
 * against somebody's allergies and those words were not. So the prompt says why,
 * and `methodMentions` reads every answer back before it is stored.
 */
export const REWRITE_SYSTEM_PROMPT = [
  'You are a professional chef and recipe editor.',
  'You rewrite the method of a recipe that already exists, so that a home cook who has never made it gets it right the first time.',
  'You never change the dish, its ingredients, their amounts or its timings.',
  'You never add a food, a seasoning, a garnish or a serving suggestion that is not on its ingredient list: the people who eat it have allergies, and the list is what was checked against them.'
].join(' ');

export function buildRewritePrompt(recipe: UndocumentedRecipe, language: string): string {
  const ingredients = recipe.ingredients.map(item => `- ${item.name} — ${Math.round(item.grams)} g`);
  const current = recipe.steps.map((step, index) => `${index + 1}. ${step.text}`).join('\n');

  return [
    'Rewrite the method of a dish that already exists. Do not invent a different dish.',
    '',
    `WRITE EVERY STEP IN ${language.toUpperCase()}. Call each ingredient by its name as written below, in lower case inside a sentence — "pela el boniato", not "pela el Boniato".`,
    '',
    `DISH: ${recipe.name}`,
    `FIXED: ${recipe.servings} serving(s) · ${recipe.prepMinutes} minutes preparation · ${recipe.cookMinutes} minutes cooking.`,
    '',
    `INGREDIENTS — the complete list, for ${recipe.servings} serving(s); nothing else exists:`,
    ...(ingredients.length > 0 ? ingredients : ['(none recorded)']),
    '',
    'THE LIST IS THE WHOLE KITCHEN:',
    '- Use every ingredient on it, and name each one in the step where it goes in. A method that never says where an ingredient goes leaves it on the counter.',
    '- Use nothing else: no salt, pepper, oil, herb, spice, sauce, garnish, topping or side that is not listed — not "to taste", not "optional", not "to serve". Water to boil, blanch or loosen is the one exception.',
    '- The people who eat this have food allergies, and the list is what was checked against them. A sprinkle of seeds or "serve with bread" that is not on it is a risk to them, not a flourish. Every rewrite is read back, and one that names a food outside the list is thrown away.',
    '- No quantities in the steps: the list shown beside the method is scaled to each person\'s portion, so a figure in the text would be wrong for most of them. Say "the rice", "half of the oil", "the rest of the yoghurt".',
    '',
    'HOW A PROFESSIONAL WRITES IT:',
    '- Preparation first, where there is any: what to wash, peel and cut, and how — the cut named (dice, julienne, thin slices, wedges), the size where it matters.',
    '- Technique in the steps: sear, sauté, roast, simmer, blanch, fold, rest — with the vessel, the heat (low, medium or high; the oven in °C) and the time in minutes, never "the time indicated".',
    '- Food safety where it depends on it: poultry and minced meat cooked through, no pink, 75 °C at the thickest part; fish until it turns opaque and flakes; eggs until set when the dish needs them set.',
    '- Season with what the list has, at the moment it does the most, and taste before serving.',
    '- End with how it is plated or assembled, in one step, without inventing a garnish.',
    '',
    'THE METHOD AS IT STANDS — keep what it does; rewrite how it is told:',
    current || '(none recorded)',
    '',
    'WHAT TO RETURN:',
    '- The same dish, the same ingredients and the same total time.',
    '- Only the method a cook reads. No step about these instructions, no check of your own work, no summary of what you changed — a step that talks about "the list" is thrown away with the rest.',
    ...guidanceFor(recipe.cookMinutes)
  ].join('\n');
}

/**
 * How much method the dish actually has, in the same three bands `domain/Method`
 * enforces — nothing cooked, briefly cooked, properly cooked. One set of
 * thresholds for what is asked for and what is required, or the prompt asks for
 * what the schema then rejects.
 */
function guidanceFor(cookMinutes: number): string[] {
  if (cookMinutes === 0) {
    return assembledGuidance();
  }

  return cookMinutes < METHOD_RULES.longCookMinutes ? brieflyCookedGuidance() : cookedGuidance();
}

/** A dish that meets heat has stages, and each one is worth its own line. */
function cookedGuidance(): string[] {
  return [
    '- ONE ACTION PER STEP, five to eight in all. Split what is currently folded together:',
    '  "sear the pork 3 minutes, add the mushrooms, cook 4 more, stir in the rice" is four',
    '  steps, not one.',
    '- EVERY STEP DOCUMENTED, in one to three sentences: what to do, how (the cut, the',
    "  vessel, the heat), and how long in minutes — and give the same number in the step's",
    "  minutes field. The text is what a cook reads: never write the field's name into it.",
    '- A step that takes no time — preparing, plating — says no time at all. Never "for 0',
    '  minutes", and never a sentence about the step itself ("this step is preparation").',
    '- Then the sign it is done, in `cue`: "until the edges brown", "until the liquid has',
    '  halved", "until it no longer sticks". A cook who has never made this follows it',
    '  without guessing.',
    '- Include the quiet steps that change the result: bring to temperature, rest the meat,',
    '  taste for seasoning, plate.',
    "- The per-step minutes should add up to roughly the dish's cooking time, never exceed it."
  ];
}

/**
 * A dish that is only assembled has two or three real actions, and inflating it
 * is worse than leaving it alone.
 *
 * The first pass gave a bowl of cottage cheese and kiwi five steps, one of them a
 * full minute spent spooning cheese into a cup, each with a cue. Documented is
 * not the same as long: what a cook needs here is the order, the cut and the
 * finish, and nothing else.
 */
function assembledGuidance(): string[] {
  return [
    '- Nothing here is cooked, so keep it to TWO OR THREE steps: the order things go in,',
    '  how anything is cut or prepared, and how it is finished.',
    '- Say each one properly — the cut, the vessel, the way it is arranged — but do NOT',
    '  invent ceremony. Spooning yoghurt into a bowl is not a step of its own, and',
    '  "arrange attractively" tells a cook nothing.',
    '- Leave the minutes field empty unless a step genuinely takes time (soaking, chilling, toasting).',
    '  An action that takes seconds has no minutes.',
    '- Use `cue` only where there is something real to look for. Most steps here have none.'
  ];
}

/**
 * Toasting bread is cooking, but it is not a main course.
 *
 * Given the full treatment, a two-minute tostada came back as seven steps, five
 * of them `0 min`, ending "until it is plated and ready to eat". The heat is real
 * and belongs in the method; the ceremony around it does not.
 */
function brieflyCookedGuidance(): string[] {
  return [
    '- THREE TO FIVE steps. There is real heat here, so say how hot and how long for the',
    '  part that cooks — but the rest is assembly and should read like it.',
    '- Give the minutes field only to the steps that take time. A step that takes seconds has',
    '  none; do not write `0`.',
    '- Give a cue where there is something to look for — the toast browning, the cheese',
    '  melting. Plating and serving need no cue.',
    '- Combine the trivial preparations into one step rather than one line each.'
  ];
}
