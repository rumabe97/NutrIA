import { ConflictError, NotFoundError, QuotaExceededError } from 'core/entities/Error';
import { ALLOWANCES, mealSwapStanding, planRedoStanding, redosInFortnight } from 'core/domain/Allowance';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { PlanJobRepository, PlanRepository } from '#repositories/Plan';
import { ProfileRepository } from '#repositories/Profile';
import { SafetyController } from 'core/controllers/Safety';
import { alternativesFor } from 'core/domain/Substitution';
import type { Macros, MealSlot, PlanDraft, RecipeDraft, ShoppingItemDraft } from 'core/entities/Plan';
import type { MealSwapStanding, PlanRedoStanding } from 'core/domain/Allowance';
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

/** What the person may still do this fortnight, for the screen to say before they try. */
export interface AllowancesView {
  mealSwaps: MealSwapStanding;
  planRedo: PlanRedoStanding;
}

/**
 * Every meal of a plan with its ingredients scaled to the portion planned — what a
 * swap needs to keep the variety rules and rebuild the shopping list.
 */
export interface MealCompositionView {
  id: string;
  dayIndex: number;
  ingredients: readonly { grams: number; slug: string }[];
  macros: Macros;
  recipeSlug: string;
  servings: number;
  slot: MealSlot;
  sortOrder: number;
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
  async allowances(userId: string): Promise<AllowancesView> {
    const [active, chain] = await Promise.all([PlanRepository.findActive(userId), PlanRepository.findChain(userId)]);
    const fromActive = active ? chain.filter(plan => plan.version <= active.version) : [];
    const swaps = active ? await PlanRepository.countSwaps(active.id) : 0;

    return {
      mealSwaps: mealSwapStanding(swaps),
      planRedo: planRedoStanding(active ? { endDate: active.endDate } : undefined, redosInFortnight(fromActive), isoToday())
    };
  },

  /** Owner-scoped, like `getPlan`; the plan's meals as the swap sees them. */
  async composition(userId: string, planId: string): Promise<readonly MealCompositionView[]> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {throw new NotFoundError('Plan not found');}

    const days = await PlanRepository.findDaysWithMeals(plan.id, FALLBACK_LOCALE);

    return days.flatMap(day =>
      day.meals.map(({ items, meal, recipe }) => {
        const factor = Number(meal.servings) / (recipe.servings || 1);

        return {
          id: meal.id,
          dayIndex: day.dayIndex,
          ingredients: items.map(item => ({ grams: Math.round(Number(item.grams) * factor * 10) / 10, slug: item.slug })),
          macros: { carbsG: Number(meal.carbsG), fatG: Number(meal.fatG), fiberG: Number(meal.fiberG), kcal: Number(meal.kcal), proteinG: Number(meal.proteinG) },
          recipeSlug: recipe.slug,
          servings: Number(meal.servings),
          slot: meal.slot,
          sortOrder: meal.sortOrder
        };
      })
    );
  },

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

  /** The meal a swap is anchored on, owner-scoped; a meal that is not theirs is not found. */
  async mealForSwap(userId: string, mealId: string) {
    const found = await PlanRepository.findMealForSwap(userId, mealId);

    if (!found) {throw new NotFoundError('Meal not found');}

    return found;
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
  },

  async swapMeal(
    userId: string,
    mealId: string,
    change: { readonly locale: string; readonly macros: Macros; readonly newRecipe: RecipeDraft | null; readonly recipeSlug: string; readonly servings: number; readonly source: 'library' | 'model' },
    shoppingItems: readonly ShoppingItemDraft[]
  ): Promise<void> {
    await PlanRepository.swapMeal(userId, mealId, { ...change, limit: ALLOWANCES.mealSwapsPerPlan }, shoppingItems);
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

    // The next fortnight is always allowed; redoing the one in progress is an
    // allowance, and it is checked here — the one place a generation starts —
    // rather than in the route, so no second route can forget it.
    const { planRedo } = await PlanController.allowances(userId);

    if (!planRedo.allowed) {throw new QuotaExceededError('plan_redo', planRedo.nextAt);}

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
  /**
   * `alternatives` are what to buy instead when the shop has none, already
   * filtered for this person's allergens and scaled to this portion. Empty for
   * a staple, on purpose.
   */
  ingredients: readonly { alternatives: readonly { grams: number; name: string }[]; grams: number; name: string; unit: string }[];
  kcal: number;
  name: string;
  prepMinutes: number;
  proteinG: number;
  /** The recipe behind this meal — what a verdict attaches to, since the dish can return in another plan. */
  recipeId: string;
  servings: number;
  slot: MealSlot;
  status: string;
  steps: readonly { cue?: string; minutes?: number; text: string }[];
  verdict: 'disliked' | 'liked' | null;
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
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function localeFor(userId: string, requested: string | null): Promise<string> {
  return requested ?? (await ProfileRepository.findByUserId(userId))?.locale ?? FALLBACK_LOCALE;
}

async function loadMealDetail(userId: string, mealId: string, requested: string | null): Promise<MealDetailView> {
  const locale = await localeFor(userId, requested);
  // The safety profile is fetched alongside the meal rather than only when an
  // ingredient has alternatives: it is the gate every alternative passes through,
  // and a gate loaded lazily is a gate that can be skipped by mistake.
  const [found, safety] = await Promise.all([PlanRepository.findMealDetail(userId, mealId, locale), SafetyController.getSafetyProfile(userId)]);

  if (!found) {throw new NotFoundError('Meal not found');}

  const { day, items, meal, recipe } = found;
  const factor = Number(meal.servings) / (recipe.servings || 1);
  const verdict = await RecipeRepository.findVerdict(userId, recipe.id);

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
    ingredients: items.map(item => {
      const grams = Math.round(Number(item.grams) * factor * 10) / 10;

      return { alternatives: alternativesFor(item, grams, item.substitutes, safety), grams, name: item.name, unit: item.unit };
    }),
    kcal: Number(meal.kcal),
    name: recipe.name,
    prepMinutes: recipe.prepMinutes,
    proteinG: Number(meal.proteinG),
    recipeId: recipe.id,
    servings: Number(meal.servings),
    slot: meal.slot,
    status: meal.status,
    steps: recipe.instructions,
    verdict
  };
}
