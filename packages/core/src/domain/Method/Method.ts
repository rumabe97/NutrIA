/**
 * How much method a dish must carry before it counts as a recipe.
 *
 * This exists because "ask the model for three to eight steps" was tried and did
 * not hold: prompt 2.1.0 said exactly that, and a quarter of the library came back
 * with none at all — because the same prompt exempted snacks, and nothing anywhere
 * checked. Twelve of forty-eight stored recipes are two ingredients and a name.
 * That is the owner's "the recipes seem too basic", in the database, measurable.
 *
 * So the floor moves out of the prompt and into code, where a rule can be relied
 * on rather than hoped for — the same reason the allergy gate is not a sentence in
 * a prompt either.
 *
 * The numbers are deliberately low. This is a floor, not a target: it exists to
 * reject an empty method, not to force padding onto a bowl of yoghurt. Asking a
 * three-ingredient snack for three steps buys "take a bowl", which is worse than
 * one honest sentence.
 */
export const METHOD_RULES = {
  /**
   * A main that cooks for a quarter of an hour or more has stages — prepare,
   * start the heat, add, turn or reduce, finish, plate. Three steps for that
   * means three actions folded into each sentence, which is what the owner read
   * as "too simple": every dish came back with exactly three, and the median
   * step was a hundred characters doing the work of two.
   */
  longCookMinutes: 15,
  /** Something goes on the heat and something comes off it: that is two sentences. */
  minStepsCooked: 2,
  minStepsCookedLong: 4,
  /** Even assembly is an instruction — what goes on what, and in what order. */
  minStepsUncooked: 1
} as const;

/** The floor for a dish, given how long it cooks. */
export function minimumSteps(cookMinutes: number): number {
  if (cookMinutes >= METHOD_RULES.longCookMinutes) {
    return METHOD_RULES.minStepsCookedLong;
  }

  return cookMinutes > 0 ? METHOD_RULES.minStepsCooked : METHOD_RULES.minStepsUncooked;
}

/**
 * Whether a dish tells the reader how to make it.
 *
 * One predicate, used by three callers that would otherwise each have their own
 * idea: the generated-dish schema (so a new dish without method is rejected), the
 * reuse pool (so a stored one is not served for ever), and the tests. Two sources
 * of truth for one question has already cost this project three separate defects.
 */
export function hasUsableMethod(dish: { readonly cookMinutes: number; readonly steps: readonly unknown[] }): boolean {
  return dish.steps.length >= minimumSteps(dish.cookMinutes);
}

/**
 * Whether a dish's method actually documents itself, not merely carries
 * enough steps (`hasUsableMethod`). Nothing further is asked of an assembled
 * dish — no heat, no cue and no minutes to give (`RewritePrompt`'s own
 * `assembledGuidance`) — but anything that meets heat needs a cue somewhere
 * ("the sign it is done") and a duration recorded somewhere, or a home cook
 * reading it has no way to tell either.
 *
 * A floor, like `hasUsableMethod`, not a target: it does not ask that every
 * step carry a cue or a duration, only that the method carries at least one
 * of each once there is any cooking to speak of. Eleven library recipes wore
 * the current prompt's own stamp with zero cues between them, and a
 * stamp-only check (`RewriteStamp`) never saw it — this is the second half of
 * what a rewrite is now judged against, alongside the existing content checks
 * (`RecipeRewriter.rewrite`).
 */
export function isMethodComplete(dish: {
  readonly cookMinutes: number;
  readonly steps: readonly { readonly cue?: string; readonly minutes?: number }[];
}): boolean {
  if (!hasUsableMethod(dish)) {
    return false;
  }

  if (dish.cookMinutes <= 0) {
    return true;
  }

  return dish.steps.some(step => (step.cue ?? '').trim().length > 0) && dish.steps.some(step => typeof step.minutes === 'number' && step.minutes > 0);
}
