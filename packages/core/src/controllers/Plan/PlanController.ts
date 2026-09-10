import { ConflictError, MealInFutureError, NotFoundError, PlanPausedError, QuotaExceededError } from 'core/entities/Error';
import { LIVED_PLAN_STATUSES } from 'core/entities/Plan';
import { allowancesFor, eventStanding, mealSwapStanding, midPlanEventStanding, planRedoStanding, redosInFortnight } from 'core/domain/Allowance';
import { eventsInWindow, planWindow } from 'core/domain/Event';
import { MAX_DAYS_BEFORE } from 'core/entities/Event';
import { addDays } from 'core/domain/Vacation';
import { EventRepository } from '#repositories/Event';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { PlanJobRepository, PlanRepository } from '#repositories/Plan';
import { ProfileRepository } from '#repositories/Profile';
import { UserRepository } from '#repositories/User';
import { VacationRepository } from '#repositories/Vacation';
import { isAway } from 'core/domain/Vacation';
import { SafetyController } from 'core/controllers/Safety';
import { SettingsController } from 'core/controllers/Settings';
import { alternativesFor } from 'core/domain/Substitution';
import type { Macros, MealSlot, MealStatus, PlanDraft, RecipeDraft, ShoppingItemDraft } from 'core/entities/Plan';
import type { CountedStanding, MealSwapStanding, PlanRedoStanding, Tier } from 'core/domain/Allowance';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PlanWindow } from 'core/domain/Event';

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
  /**
   * The event this day eats for, by the name the person gave it, or null
   * (`0043`). Stored on the day, not looked up: the event may be gone and
   * this plan is history.
   */
  loadedFor: string | null;
  meals: readonly MealView[];
  /** What the day was built to hit. Null on plans older than loads, meaning the plan's `strategy`. */
  targets: NutritionTargets | null;
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
  /** True when a later plan began before this one ended — a redo, or a regeneration. */
  replaced: boolean;
  startDate: string;
  status: string;
  version: number;
}

/**
 * One line of the list. `name` resolves against the catalogue in the reader's
 * language, with the stored name surviving as the fallback for anything hand-added.
 */
export interface ShoppingListItemView {
  id: string;
  category: string | null;
  checked: boolean;
  displayQuantity: number;
  displayUnit: string;
  name: string;
  totalGrams: number;
}

/** The list a plan needs, ticked or not. */
export interface ShoppingListView {
  id: string;
  items: readonly ShoppingListItemView[];
  planId: string;
}

/**
 * Days that eat for something this fortnight (`0044`): how many the plan
 * window may hold and how many it still may. Counted over the active plan's
 * days, or over the fortnight the next generation will cover.
 */
export interface EventAllowancesView {
  limit: number;
  /**
   * Rebuilding the fortnight under way for one more event, or **null** on a
   * tier that has none. Null rather than a zero limit on purpose: the screen
   * shows the control when this is present and shows nothing at all otherwise
   * — no upsell, no disabled button — and a zero would have to be read as one.
   */
  midPlan: { limit: number; remaining: number } | null;
  remaining: number;
}

/** What the person may still do this fortnight, for the screen to say before they try. */
export interface AllowancesView {
  events: EventAllowancesView;
  mealSwaps: MealSwapStanding;
  planRedo: PlanRedoStanding;
  /**
   * Which allowances these are — the tier as it applies right now, with the
   * `premium` switch already taken into account. It is here so a screen can say
   * *why* the numbers are what they are without asking a second question, and
   * so that with the switch off every account reads `free` and no screen has a
   * reason to mention paying.
   */
  tier: Tier;
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
    const [active, chain, tier] = await Promise.all([
      PlanRepository.findActive(userId),
      PlanRepository.findChain(userId),
      PlanController.tierOf(userId)
    ]);
    const fromActive = active ? chain.filter(plan => plan.version <= active.version) : [];
    const today = isoToday();
    const [swaps, events] = await Promise.all([
      active ? PlanRepository.countSwaps(active.id) : 0,
      PlanController.eventStanding(userId, planWindow(active, today), tier)
    ]);
    // The counter is on the plan row and dies with the plan, which is what
    // "per plan" means; a plan that has ended is not one that can be rebuilt.
    const midPlan = midPlanEventStanding(active && active.endDate >= today ? active.midPlanLoads : 0, tier);

    return {
      events: {
        limit: events.limit,
        midPlan: midPlan.limit > 0 ? { limit: midPlan.limit, remaining: midPlan.remaining } : null,
        remaining: events.remaining
      },
      mealSwaps: mealSwapStanding(swaps, tier),
      planRedo: planRedoStanding(active ? { endDate: active.endDate } : undefined, redosInFortnight(fromActive), today, tier),
      tier
    };
  },

  /** Owner-scoped, like `getPlan`; the plan's meals as the swap sees them. */
  async composition(userId: string, planId: string): Promise<readonly MealCompositionView[]> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const days = await PlanRepository.findDaysWithMeals(plan.id, FALLBACK_LOCALE);

    return days.flatMap(day =>
      day.meals.map(({ items, meal, recipe }) => {
        const factor = Number(meal.servings) / (recipe.servings || 1);

        return {
          id: meal.id,
          dayIndex: day.dayIndex,
          ingredients: items.map(item => ({ grams: Math.round(Number(item.grams) * factor * 10) / 10, slug: item.slug })),
          macros: {
            carbsG: Number(meal.carbsG),
            fatG: Number(meal.fatG),
            fiberG: Number(meal.fiberG),
            kcal: Number(meal.kcal),
            proteinG: Number(meal.proteinG)
          },
          recipeSlug: recipe.slug,
          servings: Number(meal.servings),
          slot: meal.slot,
          sortOrder: meal.sortOrder
        };
      })
    );
  },

  /**
   * How many events a fortnight already eats for, and how many more it may
   * (`0044`).
   *
   * The window is a parameter rather than resolved here because two callers
   * want different ones: `allowances` asks about the fortnight under way, and
   * `EventController.add` asks about the fortnight a new event would land in.
   * Here rather than on `EventController` because that controller already
   * needs `tierOf` from this one, and a controller that imports back is a cycle.
   */
  async eventStanding(userId: string, window: PlanWindow, tier?: Tier): Promise<CountedStanding> {
    const [resolved, dated] = await Promise.all([
      tier ?? PlanController.tierOf(userId),
      // Widened by the longest load: an event just past the window's end can
      // still move days inside it. `eventsInWindow` then decides which do.
      EventRepository.findInRange(userId, window.from, addDays(window.to, MAX_DAYS_BEFORE))
    ]);

    return eventStanding(eventsInWindow(dated, window).length, resolved);
  },

  /** For generation: the next plan version, and what the user was served last fortnight. */
  async generationHistory(
    userId: string
  ): Promise<{ readonly nextVersion: number; readonly recentDishes: readonly { readonly name: string; readonly slug: string }[] }> {
    return PlanRepository.findGenerationHistory(userId);
  },

  /** The active plan with its days and meals, or null — having no plan is a normal state. */
  async getActivePlan(userId: string, locale: string | null = null): Promise<PlanView | null> {
    const plan = await PlanRepository.findActive(userId);

    if (!plan) {
      return null;
    }

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, await localeFor(userId, locale)));
  },

  async getDay(userId: string, planId: string, dayIndex: number, locale: string | null = null): Promise<PlanDayView> {
    const plan = await PlanController.getPlan(userId, planId, locale);
    const day = plan.days.find(candidate => candidate.dayIndex === dayIndex);

    if (!day) {
      throw new NotFoundError('Day not found');
    }

    return day;
  },

  async getJob(userId: string, jobId: string): Promise<JobView> {
    const job = await PlanJobRepository.findById(userId, jobId);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    return { id: job.id, error: job.error, errorDetail: job.errorDetail, planId: job.planId, status: job.status, step: job.step };
  },

  async getMeal(userId: string, mealId: string, locale: string | null = null): Promise<MealDetailView> {
    return loadMealDetail(userId, mealId, locale);
  },

  /** Owner-scoped. A plan belonging to someone else is simply not found. */
  async getPlan(userId: string, planId: string, locale: string | null = null): Promise<PlanView> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, await localeFor(userId, locale)));
  },

  async getShoppingList(userId: string, planId: string, locale: string | null = null): Promise<ShoppingListView> {
    // Ownership is resolved on the plan; the list hangs off it.
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const list = await PlanRepository.findShoppingList(plan.id, await localeFor(userId, locale));

    if (!list) {
      throw new NotFoundError('Shopping list not found');
    }

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

  /** Newest first. A plan is replaced when the next lived plan began before it ended. */
  async listPlans(userId: string, limit = 20, offset = 0): Promise<readonly PlanSummaryView[]> {
    const rows = await PlanRepository.findHistory(userId, limit, offset);
    const lived = rows.filter(row => LIVED_PLAN_STATUSES.has(row.status));

    return rows.map(row => {
      const successor = lived[lived.indexOf(row) - 1];

      return {
        id: row.id,
        endDate: row.endDate,
        replaced: successor !== undefined && successor.startDate <= row.endDate,
        startDate: row.startDate,
        status: row.status,
        version: row.version
      };
    });
  },

  /** The meal a swap is anchored on, owner-scoped; a meal that is not theirs is not found. */
  async mealForSwap(userId: string, mealId: string) {
    const found = await PlanRepository.findMealForSwap(userId, mealId);

    if (!found) {
      throw new NotFoundError('Meal not found');
    }

    return found;
  },

  /**
   * Rewrites the days of the active plan that eat for an event declared after
   * the plan was made (`0044`), spending one of the tier's mid-plan events.
   *
   * The days, the meals, the shopping list and the counter commit together or
   * not at all — see `PlanRepository.rebuildLoadedDays`. Paused like every
   * other change to a plan (`0032`): while somebody is away their plan does not
   * change, and this is a change.
   *
   * The caller has already done the food: which days, from which library, past
   * which gate. What is decided here is only whether this account may.
   */
  async rebuildLoadedDays(
    userId: string,
    planId: string,
    days: Parameters<typeof PlanRepository.rebuildLoadedDays>[2]['days'],
    shoppingItems: readonly ShoppingItemDraft[]
  ): Promise<void> {
    await assertNotPaused(userId);
    await PlanRepository.rebuildLoadedDays(
      userId,
      planId,
      { days, limit: allowancesFor(await PlanController.tierOf(userId)).midPlanEventsPerPlan },
      shoppingItems
    );
  },

  /**
   * A meal that is not theirs is not found — the same shape as every other
   * denial. A meal of a plan that is no longer active is a conflict, not a
   * denial: the past is read-only (0021), and the screen says so.
   */
  async setMealStatus(userId: string, mealId: string, status: MealStatus): Promise<void> {
    await assertNotPaused(userId);

    const result = await PlanRepository.setMealStatus(userId, mealId, status);

    if (result === 'missing') {
      throw new NotFoundError('Meal not found');
    }

    if (result === 'closed') {
      throw new ConflictError('Only the active plan can be changed');
    }

    if (result === 'future') {
      throw new MealInFutureError();
    }
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
    change: {
      readonly locale: string;
      readonly macros: Macros;
      readonly newRecipe: RecipeDraft | null;
      readonly recipeSlug: string;
      readonly servings: number;
      readonly source: 'library' | 'model';
    },
    shoppingItems: readonly ShoppingItemDraft[]
  ): Promise<void> {
    await assertNotPaused(userId);
    await PlanRepository.swapMeal(
      userId,
      mealId,
      { ...change, limit: allowancesFor(await PlanController.tierOf(userId)).mealSwapsPerPlan },
      shoppingItems
    );
  },

  /**
   * What this account may spend, once the switch has had its say.
   *
   * The flag wins over the column, in that order and never the other way: with
   * `premium` off every account is on the free allowances no matter what its row
   * says, so turning the tier off is one switch rather than a migration over
   * everybody who was ever granted it. The column is what the flag then reads.
   *
   * Never taken from the caller. A tier decides whether somebody may spend a
   * model call, so it is read here, from the database, on every request that
   * asks — the same rule as every other authorisation in this codebase.
   */
  async tierOf(userId: string): Promise<Tier> {
    const { premium } = await SettingsController.flags();

    if (!premium) {
      return 'free';
    }

    return UserRepository.tierOf(userId);
  }
};

function assemble(
  plan: Awaited<ReturnType<typeof PlanRepository.findActive>>,
  days: Awaited<ReturnType<typeof PlanRepository.findDaysWithMeals>>
): PlanView {
  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  return {
    id: plan.id,
    days: days.map(day => {
      const presented = day.meals.map(presentMeal);

      return {
        date: day.date,
        dayIndex: day.dayIndex,
        loadedFor: day.loadedFor ?? null,
        meals: presented,
        targets: day.targets ?? null,
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
    const planId = await PlanRepository.createPlanAtomically(userId, draft);

    /*
     * Generation lays a fortnight out from today, one day after another, because
     * that is what a fortnight is — it knows nothing about a holiday declared
     * last week. The days are pushed apart afterwards (`0032`), which is the same
     * arithmetic declaring a trip performs, applied to a plan that did not exist
     * when it was declared.
     */
    await VacationRepository.applyTo(userId);

    return planId;
  },

  /** Refuses a second concurrent generation, after clearing anything a restart abandoned. */
  async start(userId: string): Promise<JobView> {
    // Adopt before failing: a job whose plan committed did not fail, whatever its
    // row says, and marking it abandoned would discard a plan the user already
    // has — and charge them a second generation to get it back.
    await PlanJobRepository.adoptCompleted(userId);
    await PlanJobRepository.failStale(userId);

    const inFlight = await PlanJobRepository.findInFlight(userId);

    if (inFlight) {
      throw new ConflictError('A plan is already being generated');
    }

    // The next fortnight is always allowed; redoing the one in progress is an
    // allowance, and it is checked here — the one place a generation starts —
    // rather than in the route, so no second route can forget it.
    const { planRedo } = await PlanController.allowances(userId);

    if (!planRedo.allowed) {
      throw new QuotaExceededError('plan_redo', planRedo.nextAt);
    }

    const job = await PlanJobRepository.create(userId);

    return { id: job.id, error: job.error, errorDetail: job.errorDetail, planId: job.planId, status: job.status, step: job.step };
  }
};

export interface MealDetailView {
  id: string;
  carbsG: number;
  cookMinutes: number;
  cuisine: string | null;
  /** The day this meal belongs to, so a screen can tell "not yet" from "not allowed". */
  date: string;
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
  /** The plan this meal belongs to, and whether it is still the one being lived: only then can the meal be changed. */
  planId: string;
  planStatus: string;
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

/**
 * Refuses anything that would change a plan while its owner is away (`0032`).
 *
 * The pause is the whole point: those days hold no meals, so marking one eaten
 * records something that did not happen, and spending a swap buys a change to a
 * fortnight nobody is living. The screen greys the controls; this is what makes
 * that true rather than polite — a disabled button is a suggestion, and the
 * request behind it is one `curl` away.
 */
async function assertNotPaused(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const trips = await VacationRepository.findUpcoming(userId, today);

  if (trips.some(trip => isAway(trip, today))) {
    throw new PlanPausedError();
  }
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

  if (!found) {
    throw new NotFoundError('Meal not found');
  }

  const { day, items, meal, plan, recipe } = found;
  const factor = Number(meal.servings) / (recipe.servings || 1);
  const verdict = await RecipeRepository.findVerdict(userId, recipe.id);

  return {
    id: meal.id,
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    cuisine: recipe.cuisine,
    date: day.date,
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
    planId: plan.id,
    planStatus: plan.status,
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
