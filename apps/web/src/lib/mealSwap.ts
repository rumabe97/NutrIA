/**
 * Whether «Cambiar plato» is offered for one meal — on the dish's page and on the plan's
 * rows alike (project 024, the owner's decision of 2026-11-12), so the two places can
 * never disagree about the same meal.
 *
 * - **Only a meal of the plan being lived** (`0021`): an earlier plan is shown as it was,
 *   a plan waiting for its day is read, not changed (the API refuses either).
 * - **Not while the plan is paused** (`0032`): a swap would spend an allowance on a
 *   fortnight nobody is living.
 * - **Only when the allowance is known**: the count is part of the control («20 de 20»),
 *   and a control that cannot say what it spends is not drawn.
 * - **Only a meal still to come**: a plate marked done or skipped is not something to change.
 * - **Not offline**: the swap is a request, and a stored copy's count may be stale. The
 *   server cannot know, so pages pass `false` and `MealSwap` asks again once on screen.
 *
 * A spent allowance still shows the control, disabled and saying so — that is the answer,
 * not a reason to hide it.
 */
export function swapOffered(meal: {
  readonly allowanceKnown: boolean;
  readonly away: boolean;
  readonly mealStatus: string;
  readonly offline: boolean;
  readonly planStatus: string;
}): boolean {
  return meal.planStatus === 'active' && !meal.away && meal.allowanceKnown && meal.mealStatus === 'planned' && !meal.offline;
}
