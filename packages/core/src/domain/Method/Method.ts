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
  /** Something goes on the heat and something comes off it: that is two sentences. */
  minStepsCooked: 2,
  /** Even assembly is an instruction — what goes on what, and in what order. */
  minStepsUncooked: 1
} as const;

/** The floor for a dish, given whether it is cooked. */
export function minimumSteps(cookMinutes: number): number {
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
