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

function presentMeal({ meal, recipe }: MealRow): MealView {
  return {
    id: meal.id,
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    fatG: Number(meal.fatG),
    fiberG: Number(meal.fiberG),
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
  /** The active plan with its days and meals, or null — having no plan is a normal state. */
  async getActivePlan(userId: string): Promise<PlanView | null> {
    const plan = await PlanRepository.findActive(userId);

    if (!plan) {return null;}

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id));
  },

  async getDay(userId: string, planId: string, dayIndex: number): Promise<PlanDayView> {
    const plan = await PlanController.getPlan(userId, planId);
    const day = plan.days.find(candidate => candidate.dayIndex === dayIndex);

    if (!day) {throw new NotFoundError('Day not found');}

    return day;
  },

  async getJob(userId: string, jobId: string): Promise<JobView> {
    const job = await PlanJobRepository.findById(userId, jobId);

    if (!job) {throw new NotFoundError('Job not found');}

    return { id: job.id, error: job.error, errorDetail: job.errorDetail, planId: job.planId, status: job.status, step: job.step };
  },

  async getMeal(userId: string, mealId: string): Promise<MealDetailView> {
    return loadMealDetail(userId, mealId);
  },

  /** Owner-scoped. A plan belonging to someone else is simply not found. */
  async getPlan(userId: string, planId: string): Promise<PlanView> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {throw new NotFoundError('Plan not found');}

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id));
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
  ingredients: readonly { grams: number; name: string; unit: string }[];
  kcal: number;
  name: string;
  prepMinutes: number;
  proteinG: number;
  servings: number;
  slot: MealSlot;
  status: string;
  steps: readonly { minutes?: number; text: string }[];
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
async function loadMealDetail(userId: string, mealId: string): Promise<MealDetailView> {
  // The profile's locale, for the same reason generation uses it: one source,
  // and it works whether or not there is a request to read a header from.
  const profile = await ProfileRepository.findByUserId(userId);
  const found = await PlanRepository.findMealDetail(userId, mealId, profile?.locale ?? FALLBACK_LOCALE);

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
