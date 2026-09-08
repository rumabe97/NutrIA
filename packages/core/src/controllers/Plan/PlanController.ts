import { ConflictError, NotFoundError } from 'core/entities/Error';
import { FALLBACK_LOCALE } from '#repositories/Recipe';
import { PlanJobRepository, PlanRepository } from '#repositories/Plan';
import { ProfileRepository } from '#repositories/Profile';
import type { MealSlot, PlanDraft } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

// --- Presenters ---------------------------------------------------------------

export interface MealView {
  id: string;
  carbsG: number;
  cookMinutes: number;
  difficulty: string;
  fatG: number;
  fiberG: number;
  /**
   * The recipe's ingredients, **scaled to this meal's portion**.
   *
   * Carried on the plan rather than fetched per meal, because a fortnight of
   * meal names with the quantities a click away is a plan you cannot shop or
   * cook from without fifty-six navigations.
   */
  /** API path of the recipe's illustration, or null when none has been drawn yet. Relative: the client prefixes its API base. */
  illustrationPath: string | null;
  ingredients: readonly { grams: number; name: string }[];
  kcal: number;
  name: string;
  prepMinutes: number;
  proteinG: number;
  recipeId: string;
  servings: number;
  slot: MealSlot;
  status: string;
}

export interface PlanDayView {
  date: string;
  dayIndex: number;
  meals: readonly MealView[];
  totals: { carbsG: number; fatG: number; fiberG: number; kcal: number; proteinG: number };
}

export interface PlanView {
  id: string;
  days: readonly PlanDayView[];
  endDate: string;
  startDate: string;
  status: string;
  strategy: NutritionTargets | null;
  version: number;
}

export interface PlanSummaryView {
  id: string;
  endDate: string;
  startDate: string;
  status: string;
  version: number;
}

export interface JobView {
  id: string;
  /** A stable code. The client maps it to copy. */
  error: string | null;
  /** The provider's own redacted message, when there was one. Diagnostic, not copy. */
  errorDetail: string | null;
  planId: string | null;
  status: string;
  step: string | null;
}

type MealRow = Awaited<ReturnType<typeof PlanRepository.findDaysWithMeals>>[number]['meals'][number];

function presentMeal({ items, meal, recipe }: MealRow): MealView {
  // The recipe's quantities are for *its* servings; this meal may have been
  // scaled to fit the day. The same factor `loadMealDetail` applies.
  const factor = Number(meal.servings) / (recipe.servings || 1);

  return {
    id: meal.id,
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    fatG: Number(meal.fatG),
    fiberG: Number(meal.fiberG),
    illustrationPath: recipe.hasImage ? `/recipes/${recipe.id}/image` : null,
    ingredients: items.map(item => ({ grams: Math.round(Number(item.grams) * factor * 10) / 10, name: item.name })),
    kcal: Number(meal.kcal),
    name: recipe.name,
    prepMinutes: recipe.prepMinutes,
    proteinG: Number(meal.proteinG),
    recipeId: recipe.id,
    servings: Number(meal.servings),
    slot: meal.slot,
    status: meal.status
  };
}

// --- Controller ---------------------------------------------------------------

export const PlanController = {
  /** For generation: the next plan version, and what the user was served last fortnight. */
  async generationHistory(userId: string): Promise<{ readonly nextVersion: number; readonly recentDishes: readonly { readonly name: string; readonly slug: string }[] }> {
    return PlanRepository.findGenerationHistory(userId);
  },

  /** The active plan with its days and meals, or null — having no plan is a normal state. */
  async getActivePlan(userId: string, locale: string | null = null): Promise<PlanView | null> {
    const plan = await PlanRepository.findActive(userId);

    if (!plan) {return null;}

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, await localeFor(userId, locale)));
  },

  async getDay(userId: string, planId: string, dayIndex: number, locale: string | null = null): Promise<PlanDayView> {
    const plan = await PlanController.getPlan(userId, planId, locale);
    const day = plan.days.find(candidate => candidate.dayIndex === dayIndex);

    if (!day) {throw new NotFoundError('Day not found');}

    return day;
  },

  async getJob(userId: string, jobId: string): Promise<JobView> {
    const job = await PlanJobRepository.findById(userId, jobId);

    if (!job) {throw new NotFoundError('Job not found');}

    return { id: job.id, error: job.error, errorDetail: job.errorDetail, planId: job.planId, status: job.status, step: job.step };
  },

  async getMeal(userId: string, mealId: string, locale: string | null = null): Promise<MealDetailView> {
    return loadMealDetail(userId, mealId, locale);
  },

  /** Owner-scoped. A plan belonging to someone else is simply not found. */
  async getPlan(userId: string, planId: string, locale: string | null = null): Promise<PlanView> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {throw new NotFoundError('Plan not found');}

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, await localeFor(userId, locale)));
  },

  async getShoppingList(userId: string, planId: string) {
    // Ownership is resolved on the plan; the list hangs off it.
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {throw new NotFoundError('Plan not found');}

    const list = await PlanRepository.findShoppingList(plan.id);

    if (!list) {throw new NotFoundError('Shopping list not found');}

    return {
      id: list.id,
      items: list.items.map(item => ({
        id: item.id,
        category: item.category,
        checked: item.checked,
        displayQuantity: Number(item.displayQuantity),
        displayUnit: item.displayUnit,
        name: item.name,
        totalGrams: Number(item.totalGrams)
      })),
      planId: list.planId
    };
  },

  async listPlans(userId: string, limit = 20, offset = 0): Promise<readonly PlanSummaryView[]> {
    const rows = await PlanRepository.findHistory(userId, limit, offset);

    return rows.map(row => ({ id: row.id, endDate: row.endDate, startDate: row.startDate, status: row.status, version: row.version }));
  },

  /**
   * Ticks an item off the shopping list.
   *
   * A read-only list was the honest state while nothing could be written; now
   * that something can, this is the whole of it. Deliberately not a "clear all"
   * or a quantity edit: those are separate decisions, and a control that does
   * more than it says is worse than one that does less.
   */
  async setShoppingItemChecked(userId: string, itemId: string, checked: boolean): Promise<void> {
    if (!(await PlanRepository.setItemChecked(userId, itemId, checked))) {
      throw new NotFoundError('Shopping list item not found');
    }
  }
};

function assemble(plan: Awaited<ReturnType<typeof PlanRepository.findActive>>, days: Awaited<ReturnType<typeof PlanRepository.findDaysWithMeals>>): PlanView {
  if (!plan) {throw new NotFoundError('Plan not found');}

  return {
    id: plan.id,
    days: days.map(day => {
      const presented = day.meals.map(presentMeal);

      return {
        date: day.date,
        dayIndex: day.dayIndex,
        meals: presented,
        // Summed from the stored per-meal snapshots, so a historical plan keeps the
        // totals the user actually ate.
        totals: {
          carbsG: round(presented.reduce((sum, meal) => sum + meal.carbsG, 0)),
          fatG: round(presented.reduce((sum, meal) => sum + meal.fatG, 0)),
          fiberG: round(presented.reduce((sum, meal) => sum + meal.fiberG, 0)),
          kcal: round(presented.reduce((sum, meal) => sum + meal.kcal, 0)),
          proteinG: round(presented.reduce((sum, meal) => sum + meal.proteinG, 0))
        }
      };
    }),
    endDate: plan.endDate,
    startDate: plan.startDate,
    status: plan.status,
    strategy: plan.strategy,
    version: plan.version
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The write side of plan generation.
 *
 * Separated from `PlanController` because these are the only methods that mutate,
 * and the generation pipeline in `apps/api` is their only caller — keeping them
 * apart makes it obvious which surface a read-only screen may touch.
 */
export const PlanJobController = {
  async markFailed(jobId: string, reason: string, detail?: string): Promise<void> {
    await PlanJobRepository.markFailed(jobId, reason, detail);
  },

  async markStarted(jobId: string): Promise<void> {
    await PlanJobRepository.markStarted(jobId);
  },

  async markStep(jobId: string, step: string): Promise<void> {
    await PlanJobRepository.markStep(jobId, step);
  },

  async markSucceeded(jobId: string, planId: string): Promise<void> {
    await PlanJobRepository.markSucceeded(jobId, planId);
  },

  /** The single write path for a generated plan. Atomic; see `PlanRepository`. */
  async persist(userId: string, draft: PlanDraft): Promise<string> {
    return PlanRepository.createPlanAtomically(userId, draft);
  },

  /** Refuses a second concurrent generation, after clearing anything a restart abandoned. */
  async start(userId: string): Promise<JobView> {
    // Adopt before failing: a job whose plan committed did not fail, whatever its
    // row says, and marking it abandoned would discard a plan the user already
    // has — and charge them a second generation to get it back.
    await PlanJobRepository.adoptCompleted(userId);
    await PlanJobRepository.failStale(userId);

    const inFlight = await PlanJobRepository.findInFlight(userId);

    if (inFlight) {throw new ConflictError('A plan is already being generated');}

    const job = await PlanJobRepository.create(userId);

    return { id: job.id, error: job.error, errorDetail: job.errorDetail, planId: job.planId, status: job.status, step: job.step };
  }
};

export interface MealDetailView {
  id: string;
  carbsG: number;
  cookMinutes: number;
  cuisine: string | null;
  dayIndex: number;
  difficulty: string;
  fatG: number;
  fiberG: number;
  illustrationPath: string | null;
  ingredients: readonly { grams: number; name: string; unit: string }[];
  kcal: number;
  name: string;
  prepMinutes: number;
  proteinG: number;
  servings: number;
  slot: MealSlot;
  status: string;
  steps: readonly { cue?: string; minutes?: number; text: string }[];
}

/**
 * Meal detail with quantities **scaled to the servings actually planned**.
 *
 * The recipe stores its ingredients for its own serving count; the scheduler then
 * chose a portion to hit the day's target
 * ([`0005`](../../../../docs/decisions/0005-generate-a-pool-schedule-in-code.md)).
 * Showing the recipe's base quantities would tell someone standing in a kitchen to
 * cook the wrong amount, so the scaling happens here rather than being left to the
 * interface.
 */
/**
 * The language to resolve content into.
 *
 * The request wins when it names one, because that is the language the reader is
 * *looking at* — the web app's switch takes effect on the next request rather
 * than on the next profile write, and it works signed out, where there is no
 * profile to have written to. The stored preference is the fallback, and the only
 * answer available to a background job, which has no request at all.
 */
async function localeFor(userId: string, requested: string | null): Promise<string> {
  return requested ?? (await ProfileRepository.findByUserId(userId))?.locale ?? FALLBACK_LOCALE;
}

async function loadMealDetail(userId: string, mealId: string, requested: string | null): Promise<MealDetailView> {
  const found = await PlanRepository.findMealDetail(userId, mealId, await localeFor(userId, requested));

  if (!found) {throw new NotFoundError('Meal not found');}

  const { day, items, meal, recipe } = found;
  const factor = Number(meal.servings) / (recipe.servings || 1);

  return {
    id: meal.id,
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    cuisine: recipe.cuisine,
    dayIndex: day.dayIndex,
    difficulty: recipe.difficulty,
    fatG: Number(meal.fatG),
    fiberG: Number(meal.fiberG),
    illustrationPath: recipe.hasImage ? `/recipes/${recipe.id}/image` : null,
    ingredients: items.map(item => ({ grams: Math.round(Number(item.grams) * factor * 10) / 10, name: item.name, unit: item.unit })),
    kcal: Number(meal.kcal),
    name: recipe.name,
    prepMinutes: recipe.prepMinutes,
    proteinG: Number(meal.proteinG),
    servings: Number(meal.servings),
    slot: meal.slot,
    status: meal.status,
    steps: recipe.instructions
  };
}
