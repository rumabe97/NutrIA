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
 */
export function buildRewritePrompt(recipe: UndocumentedRecipe, language: string): string {
  const ingredients = recipe.ingredients.map(item => `${item.name} ${Math.round(item.grams)} g`).join(', ');
  const current = recipe.steps.map((step, index) => `${index + 1}. ${step.text}`).join('\n');

  return [
    'Rewrite the method for a dish that already exists. Do not invent a different dish.',
    '',
    `WRITE EVERY STEP IN ${language.toUpperCase()}.`,
    '',
    `DISH: ${recipe.name}`,
    `INGREDIENTS (fixed — use all of them, add none, change no quantity): ${ingredients || '(none recorded)'}`,
    `TIMES (fixed): ${recipe.prepMinutes} minutes preparation, ${recipe.cookMinutes} minutes cooking, ${recipe.servings} serving(s).`,
    '',
    'THE METHOD AS IT STANDS — too compressed, each line doing the work of two or three:',
    current || '(none recorded)',
    '',
    'WHAT TO RETURN:',
    '- The same dish, the same ingredients, the same quantities and the same total time.',
    ...guidanceFor(recipe.cookMinutes),
    '- Do not mention any ingredient that is not in the list above.'
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
    '  vessel, the heat), and how long — put that time in `minutes` as well as in the text.',
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
    '- Leave `minutes` out unless a step genuinely takes time (soaking, chilling, toasting).',
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
    '- Give `minutes` only to the steps that take time. A step that takes seconds has none;',
    '  do not write `0`.',
    '- Give `cue` where there is something to look for — the toast browning, the cheese',
    '  melting. Plating and serving need no cue.',
    '- Combine the trivial preparations into one step rather than one line each.'
  ];
}
