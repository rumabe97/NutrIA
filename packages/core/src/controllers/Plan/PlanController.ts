import { ConflictError, InputParseError, MealInFutureError, NotFoundError, PlanPausedError, QuotaExceededError } from 'core/entities/Error';
import { LIVED_PLAN_STATUSES } from 'core/entities/Plan';
import {
  allowancesFor,
  eventStanding,
  MAX_START_DAYS_AHEAD,
  mealSwapStanding,
  midPlanEventStanding,
  planRedoStanding,
  redosInFortnight,
  startMeaning
} from 'core/domain/Allowance';
import { dayKeyIn } from 'core/domain/Period';
import { eventsInWindow, planWindow } from 'core/domain/Event';
import { MAX_DAYS_BEFORE } from 'core/entities/Event';
import { addDays } from 'core/domain/Vacation';
import { CareRepository } from '#repositories/Care';
import { EventRepository } from '#repositories/Event';
import { FALLBACK_LOCALE, RecipeRepository } from '#repositories/Recipe';
import { PlanJobRepository, PlanRepository } from '#repositories/Plan';
import { ProfileRepository } from '#repositories/Profile';
import { ProfileController, requireProfileConsent } from 'core/controllers/Profile';
import { UserRepository } from '#repositories/User';
import { VacationRepository } from '#repositories/Vacation';
import { isAway } from 'core/domain/Vacation';
import { SafetyController } from 'core/controllers/Safety';
import { SettingsController } from 'core/controllers/Settings';
import { RecipeController, toPictureStatus } from 'core/controllers/Recipe';
import { alternativesFor } from 'core/domain/Substitution';
import { toDry, withoutCooked } from 'core/domain/Yield';
import { accompanimentName } from 'core/domain/Accompaniment';
import type {
  AiCallRecord,
  Macros,
  MealAccompanimentDraft,
  MealSlot,
  MealStatus,
  PlanDraft,
  RecipeDraft,
  ShoppingItemDraft
} from 'core/entities/Plan';
import type { CountedStanding, MealSwapStanding, PlanRedoStanding, StartMeaning, Tier } from 'core/domain/Allowance';
import type { NutritionTargets } from 'core/entities/Nutrition';
import type { PlanWindow } from 'core/domain/Event';
import type { RecordAccess } from '#repositories/Care';
import type { MealAccompanimentRead } from '#repositories/Plan';
import type { PictureClaim } from 'core/controllers/Recipe';
import type { MealSizeView } from 'core/controllers/Profile';

// --- Presenters ---------------------------------------------------------------

/**
 * One thing beside the plate (project 016, `0079` Table 3): bread, a salad, a
 * piece of fruit. `key` is stable; `name` is in the reader's language — the
 * food's own name for a simple one, the dish's for a composed one (a salad).
 * `grams` and `kcal` are its whole portion; `ingredients` are its foods, with
 * `dry` as on a meal's own ingredient (`0078`).
 */
export interface AccompanimentView {
  grams: number;
  ingredients: readonly { dry?: { grams: number; name: string }; grams: number; name: string }[];
  kcal: number;
  key: string;
  name: string;
}

export interface MealView {
  id: string;
  /**
   * What goes beside the plate, in serving order; empty when nothing does — a
   * plan made with the `accompaniments` flag off, or before it existed. The
   * meal's `kcal` and macros already include it; `ingredients` are the dish's only.
   */
  accompaniments: readonly AccompanimentView[];
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
  /**
   * The dish's picture, an absolute Blob address, once it is ready (`0066`); null otherwise. Read only:
   * the dashboard card never starts a drawing.
   */
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

/**
 * One day a generation may start on (project 015): today to a week ahead.
 * `kind` is what starting there spends — nothing for the next fortnight, a
 * redo for cutting the one under way or replacing a plan waiting for its day —
 * and `allowed` is false when it is a redo and none is left.
 */
export interface StartOptionView {
  allowed: boolean;
  date: string;
  kind: 'new_fortnight' | 'redo';
}

/** What the person may still do this fortnight, for the screen to say before they try. */
export interface AllowancesView {
  /** The day the chooser offers first (project 015): the day after the plan under way ends, when that is within reach, else today. */
  defaultStart: string;
  events: EventAllowancesView;
  /**
   * How big the largest main meal of the next plan will be, so the generation
   * screen can offer one meal more before it starts (project 016). Null until
   * the profile has targets — see `FullProfileView.mealSize`.
   */
  mealSize: MealSizeView | null;
  mealSwaps: MealSwapStanding;
  planRedo: PlanRedoStanding;
  /** Every day a generation may start on, today first, and what each would spend (project 015). */
  startOptions: readonly StartOptionView[];
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
  /** The day the meal is on, so a plan cut short can keep only its days before the cut (project 015). */
  date: string;
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
  /** Whether the plan this job made is waiting for a professional's review. False for everybody else. */
  pendingReview: boolean;
  /**
   * The plan the job made, or null — **null for its client while that plan is
   * waiting for their professional's review** (`0060`): the screen says the
   * plan is with their dietitian instead of sending them to it. The
   * professional's own job route carries the id.
   */
  planId: string | null;
  status: string;
  step: string | null;
}

type JobRow = NonNullable<Awaited<ReturnType<typeof PlanJobRepository.findById>>>;

/** A job as its reader may see it: a client is never handed the id of a plan under review (`0060`). */
function presentJob(
  job: Omit<JobRow, 'planStatus'> & { readonly planStatus?: string | null },
  reader: 'client' | 'professional' = 'client'
): JobView {
  const pendingReview = job.planStatus === 'pending_review';

  return {
    id: job.id,
    error: job.error,
    errorDetail: job.errorDetail,
    pendingReview,
    planId: pendingReview && reader === 'client' ? null : job.planId,
    status: job.status,
    step: job.step
  };
}

type MealRow = Awaited<ReturnType<typeof PlanRepository.findDaysWithMeals>>[number]['meals'][number];

/**
 * A meal's accompaniment rows, one view per accompaniment in serving order.
 * `dryNames` are the dry foods' names where the reader has them; without one, a
 * cooked food's own name without "cocido", as on the meal's own ingredients.
 */
function presentAccompaniments(
  sides: readonly MealAccompanimentRead[],
  locale: string,
  dryNames: ReadonlyMap<string, string> = new Map()
): readonly AccompanimentView[] {
  const byKey = new Map<string, MealAccompanimentRead[]>();

  for (const side of sides) {
    byKey.set(side.accompanimentKey, [...(byKey.get(side.accompanimentKey) ?? []), side]);
  }

  return [...byKey].map(([key, rows]) => ({
    grams: round(rows.reduce((sum, row) => sum + row.grams, 0)),
    ingredients: rows.map(row => {
      const dry = toDry(row.slug, row.grams);

      return {
        ...(dry && {
          dry: {
            grams: Math.max(DRY_STEP_G, Math.round(dry.dryGrams / DRY_STEP_G) * DRY_STEP_G),
            name: (dry.drySlug && dryNames.get(dry.drySlug)) ?? withoutCooked(row.name)
          }
        }),
        grams: row.grams,
        name: row.name
      };
    }),
    kcal: round(rows.reduce((sum, row) => sum + row.kcal, 0)),
    key,
    name: accompanimentName(key, locale, rows.find(row => row.slug === key)?.name)
  }));
}

function presentMeal({ items, meal, recipe, sides }: MealRow, locale: string): MealView {
  // The recipe's quantities are for *its* servings; this meal may have been
  // scaled to fit the day. The same factor `loadMealDetail` applies.
  const factor = Number(meal.servings) / (recipe.servings || 1);

  return {
    id: meal.id,
    accompaniments: presentAccompaniments(sides, locale),
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    difficulty: recipe.difficulty,
    fatG: Number(meal.fatG),
    fiberG: Number(meal.fiberG),
    illustrationPath: recipe.pictureUrl,
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
  /**
   * The nightly cron (project 015): every plan waiting for its day whose day
   * has come in its owner's time zone, activated one owner at a time. Answers
   * how many were. A failure for one owner does not stop the others; the next
   * read of their plan activates it anyway.
   */
  async activateAllDue(now: Date = new Date()): Promise<{ readonly activated: number; readonly failed: number }> {
    // Fetched up to the day after UTC's: the zones ahead of it reach tomorrow first.
    const candidates = await PlanRepository.findScheduledDue(addDays(now.toISOString().slice(0, 10), 1));
    let activated = 0;
    let failed = 0;

    for (const candidate of candidates) {
      const today = dayKeyIn(now, candidate.timezone ?? DEFAULT_TIME_ZONE);

      if (candidate.startDate > today) {
        continue;
      }

      try {
        activated += (await PlanRepository.activateDue(candidate.userId, today)) ? 1 : 0;
      } catch {
        failed += 1;
      }
    }

    return { activated, failed };
  },

  /**
   * Makes the plan waiting for its day active once `today` — the person's —
   * has reached it (project 015): the plan under way completed the day before,
   * in one transaction. Idempotent: with nothing due it changes nothing. Run at
   * the start of every read of the active plan, so a cron that missed a night
   * never leaves somebody without their plan, and by the cron itself.
   */
  async activateDue(userId: string, today: string): Promise<boolean> {
    return PlanRepository.activateDue(userId, today);
  },

  /**
   * What the fortnight still allows. `forGeneration` is `PlanJobController.start`'s
   * question (`0060`): whether a generation may begin counts a pending plan that
   * can still be published as the fortnight under way — its redo and its end.
   * The client's own screen (the default) counts its redos too, but takes
   * `kind` and `nextAt` from the plans the client can see, never from one
   * they cannot.
   */
  async allowances(userId: string, forGeneration = false): Promise<AllowancesView> {
    // What the fortnight allows is read off the active plan: one whose day has come is it.
    await PlanController.activateDue(userId, await personToday(userId));

    const context = await startContext(userId, forGeneration);
    const { active, tier } = context;
    const today = isoToday();
    const [swaps, events, mealSize] = await Promise.all([
      active ? PlanRepository.countSwaps(active.id) : 0,
      PlanController.eventStanding(userId, planWindow(active, today), tier),
      ProfileController.mealSize(userId)
    ]);
    // The counter is on the plan row and dies with the plan, which is what
    // "per plan" means; a plan that has ended is not one that can be rebuilt.
    const midPlan = midPlanEventStanding(active && active.endDate >= today ? active.midPlanLoads : 0, tier);
    const days = Array.from({ length: MAX_START_DAYS_AHEAD + 1 }, (_, offset) => addDays(context.today, offset));
    const afterActive = active ? addDays(active.endDate, 1) : null;

    return {
      defaultStart: afterActive !== null && days.includes(afterActive) ? afterActive : context.today,
      events: {
        limit: events.limit,
        midPlan: midPlan.limit > 0 ? { limit: midPlan.limit, remaining: midPlan.remaining } : null,
        remaining: events.remaining
      },
      mealSize,
      mealSwaps: mealSwapStanding(swaps, tier),
      planRedo: standingAt(context, context.today).standing,
      startOptions: days.map(date => {
        const { standing } = standingAt(context, date);

        return { allowed: standing.allowed, date, kind: standing.kind };
      }),
      tier
    };
  },

  /** Owner-scoped, like `getPlan`; the plan's meals as the swap sees them. A plan under review only with `withPending` (`0060`). */
  async composition(userId: string, planId: string, withPending = false): Promise<readonly MealCompositionView[]> {
    const plan = await PlanRepository.findById(userId, planId, withPending);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const days = await PlanRepository.findDaysWithMeals(plan.id, FALLBACK_LOCALE);

    return days.flatMap(day =>
      day.meals.map(({ items, meal, recipe, sides }) => {
        const factor = Number(meal.servings) / (recipe.servings || 1);

        return {
          id: meal.id,
          date: day.date,
          dayIndex: day.dayIndex,
          // The plate's, then what is beside it (project 016): the shopping list a swap rebuilds counts both.
          ingredients: [
            ...items.map(item => ({ grams: Math.round(Number(item.grams) * factor * 10) / 10, slug: item.slug })),
            ...sides.map(side => ({ grams: side.grams, slug: side.slug }))
          ],
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
   * What the active plan keeps when a plan starting on `start` cuts it (project
   * 015): its id and its meals before `start`, as `composition` reads them — what
   * its shopping list is rebuilt from. Null when nothing is cut: no active plan,
   * or one that ends before `start`.
   */
  async cutComposition(userId: string, start: string): Promise<{ readonly meals: readonly MealCompositionView[]; readonly planId: string } | null> {
    const active = await PlanRepository.findActive(userId);

    if (!active || active.endDate < start) {
      return null;
    }

    const meals = await PlanController.composition(userId, active.id);

    return { meals: meals.filter(meal => meal.date < start), planId: active.id };
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
    await PlanController.activateDue(userId, await personToday(userId));

    const plan = await PlanRepository.findActive(userId);

    if (!plan) {
      return null;
    }

    const resolved = await localeFor(userId, locale);

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, resolved), resolved);
  },

  async getDay(userId: string, planId: string, dayIndex: number, locale: string | null = null): Promise<PlanDayView> {
    const plan = await PlanController.getPlan(userId, planId, locale);
    const day = plan.days.find(candidate => candidate.dayIndex === dayIndex);

    if (!day) {
      throw new NotFoundError('Day not found');
    }

    return day;
  },

  /**
   * One generation of theirs. `reader` is who asks: the client by default,
   * who is not handed a plan under review; `professional` only from
   * `CareController`, through `withClient`.
   */
  async getJob(userId: string, jobId: string, reader: 'client' | 'professional' = 'client'): Promise<JobView> {
    const job = await PlanJobRepository.findById(userId, jobId);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    return presentJob(job, reader);
  },

  /** A meal of theirs. A meal of a plan under review only with `withPending` (`0060`). */
  async getMeal(userId: string, mealId: string, locale: string | null = null, withPending = false): Promise<MealDetailView> {
    return loadMealDetail(userId, mealId, locale, withPending);
  },

  /**
   * The plan waiting for review (`0060`), or null. Only a professional's read
   * through `CareController.withClient` asks for it; `locale` is the reader's.
   */
  async getPendingPlan(userId: string, locale: string | null = null): Promise<PlanView | null> {
    const plan = await PlanRepository.findPending(userId);

    if (!plan) {
      return null;
    }

    const resolved = await localeFor(userId, locale);

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, resolved), resolved);
  },

  /** Owner-scoped. A plan belonging to someone else is simply not found. */
  async getPlan(userId: string, planId: string, locale: string | null = null): Promise<PlanView> {
    const plan = await PlanRepository.findById(userId, planId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const resolved = await localeFor(userId, locale);

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, resolved), resolved);
  },

  /**
   * The plan waiting for its day (project 015), as the active plan is read —
   * or not found when there is none, its day having come included: it is then
   * the active plan.
   */
  async getScheduledPlan(userId: string, locale: string | null = null): Promise<PlanView> {
    await PlanController.activateDue(userId, await personToday(userId));

    const plan = await PlanRepository.findScheduled(userId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const resolved = await localeFor(userId, locale);

    return assemble(plan, await PlanRepository.findDaysWithMeals(plan.id, resolved), resolved);
  },

  /** The list of the plan waiting for its day (project 015), to shop before it starts; not found when there is none. */
  async getScheduledShoppingList(userId: string, locale: string | null = null): Promise<ShoppingListView> {
    await PlanController.activateDue(userId, await personToday(userId));

    const plan = await PlanRepository.findScheduled(userId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    return PlanController.getShoppingList(userId, plan.id, locale);
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

  /** The meal a swap is anchored on, owner-scoped; a meal that is not theirs — or is under review, without `withPending` — is not found. */
  async mealForSwap(userId: string, mealId: string, withPending = false) {
    const found = await PlanRepository.findMealForSwap(userId, mealId, withPending);

    if (!found) {
      throw new NotFoundError('Meal not found');
    }

    return found;
  },

  /**
   * The swaps one plan still allows (`0015`), counted on that plan — what a
   * professional's swap on the plan under review spends (`0060`), since
   * `allowances` counts the active plan's.
   */
  async mealSwapStanding(userId: string, planId: string): Promise<MealSwapStanding> {
    const [swaps, tier] = await Promise.all([PlanRepository.countSwaps(planId), PlanController.tierOf(userId)]);

    return mealSwapStanding(swaps, tier);
  },

  /**
   * A meal of theirs, opened on its own page — the one read that may start a
   * dish's picture (`0066`, PRD 1). With no picture yet, it asks
   * `RecipeController.requestPicture`, which checks the flag, the cool-off and
   * `capUsd`; the claim it may win is handed back for the caller to draw in the
   * background, and the meal already says `drawing`. The answer never waits
   * for a picture. Every other read of a meal only reads.
   */
  async openMeal(
    userId: string,
    mealId: string,
    locale: string | null,
    capUsd: number
  ): Promise<{ readonly claim: PictureClaim | null; readonly failure?: unknown; readonly meal: MealDetailView }> {
    const meal = await loadMealDetail(userId, mealId, locale);

    if (meal.pictureStatus === 'ready') {
      return { claim: null, meal };
    }

    let claim: PictureClaim | null;

    try {
      claim = await RecipeController.requestPicture(meal.recipeId, capUsd);
    } catch (failure: unknown) {
      // A picture never costs somebody their meal: the page answers as it stands,
      // and the caller logs what went wrong.
      return { claim: null, failure, meal };
    }

    return { claim, meal: claim ? { ...meal, pictureStatus: 'drawing' } : meal };
  },

  /**
   * Whether a professional may generate for this client (`0060`): a plan waits
   * for review, the client has no active plan, or the active plan's fortnight
   * has ended (owner's decision, 2026-09-24). "Ended" is `planRedoStanding`'s
   * `new_fortnight` on the same day the client's own allowance reads — the
   * same rule, so it is never earlier. A fortnight still running never is.
   */
  async professionalMayGenerate(userId: string, today: string = isoToday()): Promise<boolean> {
    const [active, pending] = await Promise.all([PlanRepository.findActive(userId), PlanRepository.findPending(userId)]);

    return pending !== undefined || planRedoStanding(active, 0, today).kind === 'new_fortnight';
  },

  /**
   * Publishes the plan waiting for review (`0060`): the active plan completed,
   * this one active, the professional's trail row with them — one
   * transaction, `PlanRepository.publish`. Nothing pending is a
   * `NotFoundError`. Answers the plan as the client will now see it.
   */
  async publish(userId: string, record: RecordAccess, locale: string | null = null): Promise<PlanView> {
    const planId = await PlanRepository.publish(userId, record);

    if (!planId) {
      throw new NotFoundError('Plan not found');
    }

    return PlanController.getPlan(userId, planId, locale);
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

  /**
   * What a generation starting on `start` would mean and spend (project 015),
   * as `PlanJobController.start` asks it: a pending plan that counts is the
   * fortnight under way (`0060`), as in `allowances(…, true)`.
   */
  async startStanding(
    userId: string,
    start: string,
    chargeWaiting = true
  ): Promise<{ readonly meaning: StartMeaning; readonly standing: PlanRedoStanding }> {
    return standingAt(await startContext(userId, true), start, chargeWaiting);
  },

  async swapMeal(
    userId: string,
    mealId: string,
    change: {
      /** What goes beside the new plate (project 016); absent or empty is nothing. */
      readonly accompaniments?: readonly MealAccompanimentDraft[];
      readonly locale: string;
      readonly macros: Macros;
      readonly newRecipe: RecipeDraft | null;
      readonly recipeSlug: string;
      readonly servings: number;
      readonly source: 'library' | 'model';
    },
    shoppingItems: readonly ShoppingItemDraft[],
    // A professional's swap on the plan under review, with its trail row (`0060`).
    review?: { readonly record: RecordAccess }
  ): Promise<void> {
    await assertNotPaused(userId);
    await PlanRepository.swapMeal(
      userId,
      mealId,
      { ...change, limit: allowancesFor(await PlanController.tierOf(userId)).mealSwapsPerPlan },
      shoppingItems,
      review
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
   *
   * **A client of a practice is premium first** (`0061`): behind the
   * `professional` switch — which fails off — a client with an `active` link
   * to a professional whose practice is paid for has the paid allowances,
   * before the `premium` switch or the column is read. The `premium` switch
   * governs personal premium alone. A pause, an end or a lapse is the next
   * request's answer: nothing is cached.
   */
  async tierOf(userId: string): Promise<Tier> {
    const { premium, professional } = await SettingsController.flags();

    if (professional && (await CareRepository.coveredByOpenPractice(userId))) {
      return 'premium';
    }

    if (!premium) {
      return 'free';
    }

    return UserRepository.tierOf(userId);
  }
};

function assemble(
  plan: Awaited<ReturnType<typeof PlanRepository.findActive>>,
  days: Awaited<ReturnType<typeof PlanRepository.findDaysWithMeals>>,
  locale: string
): PlanView {
  if (!plan) {
    throw new NotFoundError('Plan not found');
  }

  return {
    id: plan.id,
    days: days.map(day => {
      const presented = day.meals.map(meal => presentMeal(meal, locale));

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
  /**
   * The days a generation is laid out on (project 015): `start`, the one the
   * person chose when the job was claimed or else their today, and `today`,
   * which decides whether the plan waits for its day. Owner-scoped, like the job.
   */
  async dates(userId: string, jobId: string): Promise<{ readonly start: string; readonly today: string }> {
    const [job, today] = await Promise.all([PlanJobRepository.findById(userId, jobId), personToday(userId)]);

    if (!job) {
      throw new NotFoundError('Job not found');
    }

    return { start: job.startDate ?? today, today };
  },

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

  /**
   * The single write path for a generated plan. Atomic; see `PlanRepository`.
   * With the `professional` switch on, a linked client's plan may wait for
   * review (`0060`) — the link itself is read inside the plan's transaction.
   * `byProfessional` marks a professional's generation, which is refused rather
   * than replace a fortnight under way if review has ended in the meantime.
   */
  async persist(userId: string, draft: PlanDraft, byProfessional = false): Promise<string> {
    const { professional } = await SettingsController.flags();
    const planId = await PlanRepository.createPlanAtomically(userId, draft, professional, byProfessional);

    /*
     * Generation lays a fortnight out from its first day, one day after another, because
     * that is what a fortnight is — it knows nothing about a holiday declared
     * last week. The days are pushed apart afterwards (`0032`), which is the same
     * arithmetic declaring a trip performs, applied to a plan that did not exist
     * when it was declared.
     */
    await VacationRepository.applyTo(userId, planId);

    return planId;
  },

  async recordAiCalls(jobId: string, calls: readonly AiCallRecord[]): Promise<void> {
    await PlanJobRepository.recordAiCalls(jobId, calls);
  },

  /**
   * Refuses a second concurrent generation, after clearing anything a restart abandoned.
   *
   * `record` is a professional's generation for their client (`0060`), through
   * `CareController.withClient`: the same claim and the same allowance, then
   * the trail row in one transaction with the job's row (`admit`); anything
   * refused releases the claim, so it leaves no job and no row. Under the claim
   * it re-asks `professionalMayGenerate`: a fortnight the client started in the
   * meantime is a 404, as the professional's first check would have answered.
   * Started by both at once, one claims and the other is this conflict. Without it,
   * the path below is the client's own, unchanged.
   *
   * `startDate` is the day the person chose for the plan to start (project
   * 015): from their today to `MAX_START_DAYS_AHEAD` days on, or an
   * `InputParseError`. What starting there spends (`startMeaning`) is asked
   * before the claim, so a refusal leaves no job row, and again under it.
   * A professional's generation never carries one.
   */
  async start(userId: string, record?: RecordAccess, startDate?: string): Promise<JobView> {
    // No plan is built from a profile whose owner has not consented to its use
    // (RGPD art. 9.2.a) — theirs, whoever starts it. Asked before the claim, so
    // a refusal leaves no job row.
    await requireProfileConsent(userId);

    const today = await personToday(userId);

    if (startDate !== undefined && (startDate < today || startDate > addDays(today, MAX_START_DAYS_AHEAD))) {
      throw new InputParseError('Datos no válidos', { startDate: [`Must be between ${today} and ${addDays(today, MAX_START_DAYS_AHEAD)}`] });
    }

    const start = startDate ?? today;

    // A plan whose day has come is the active one before anything is counted.
    await PlanController.activateDue(userId, today);

    if (!record) {
      await refuseSpentStart(userId, start);
    }

    // Adopt before failing: a job whose plan committed did not fail, whatever its
    // row says, and marking it abandoned would discard a plan the user already
    // has — and charge them a second generation to get it back.
    await PlanJobRepository.adoptCompleted(userId);
    await PlanJobRepository.failStale(userId);

    // The claim is the refusal: "is one in flight?" and "start one" are a single
    // atomic step in `claim`, because asked as two they both answered *no* to
    // requests fired together and every one of them started a pipeline.
    const job = await PlanJobRepository.claim(userId, start === today ? null : start);

    if (!job) {
      throw new ConflictError('A plan is already being generated');
    }

    try {
      // Asked again under the claim: a client's own generation that committed
      // between the professional's first check and this claim may have started
      // a new fortnight, and a professional never replaces one under way.
      if (record && !(await PlanController.professionalMayGenerate(userId))) {
        throw new NotFoundError('Client not found');
      }

      // The next fortnight is always allowed; redoing the one in progress is an
      // allowance, and it is checked here — the one place a generation starts —
      // rather than in the route, so no second route can forget it.
      //
      // Counted *after* the claim, not before: holding the slot is what makes
      // the count honest. A plan can only be committed by a generation, no
      // generation can begin while this claim stands, so the chain this reads
      // is the whole chain and cannot grow underneath the decision. A
      // professional's generation replaces a plan waiting for its day at no
      // charge to the client, so that plan is not counted for it.
      await refuseSpentStart(userId, start, record === undefined);

      if (record) {
        await PlanJobRepository.admit(job.id, record);
      }
    } catch (error: unknown) {
      // Nothing was started, so nothing may stay claimed — a slot held by a
      // generation that never begins refuses the next one for fifteen minutes.
      await PlanJobRepository.release(job.id);

      throw error;
    }

    return presentJob(job);
  }
};

export interface MealDetailView {
  id: string;
  /**
   * What goes beside the plate, as on `MealView` (project 016); empty when
   * nothing does. `ingredients` below are the dish's only; the meal's `kcal`
   * and macros are the whole meal.
   */
  accompaniments: readonly AccompanimentView[];
  carbsG: number;
  cookMinutes: number;
  cuisine: string | null;
  /** The day this meal belongs to, so a screen can tell "not yet" from "not allowed". */
  date: string;
  dayIndex: number;
  difficulty: string;
  fatG: number;
  fiberG: number;
  /** The dish's picture, an absolute Blob address, once `pictureStatus` is `ready` (`0066`); null otherwise. */
  illustrationPath: string | null;
  /**
   * `alternatives` are what to buy instead when the shop has none, already
   * filtered for this person's allergens and scaled to this portion. Empty for
   * a staple, on purpose.
   *
   * `dry` is present only on a cooked grain or pasta (`0078`): what it weighs
   * before cooking, rounded to 5 g, and the dry food's name — or the cooked
   * one's without "cocido" when the catalogue has no dry food. `grams` stays the
   * cooked weight on the plate.
   */
  ingredients: readonly {
    alternatives: readonly { grams: number; name: string }[];
    dry?: { grams: number; name: string };
    grams: number;
    name: string;
    unit: string;
  }[];
  kcal: number;
  name: string;
  /**
   * Where the dish's picture stands (`0066`): `ready` with `illustrationPath`,
   * `drawing` while one is being drawn — poll `GET /recipes/:recipeId/picture-status`
   * — or `none`: no picture, the placeholder, nothing to announce.
   */
  pictureStatus: 'drawing' | 'none' | 'ready';
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
/** Whether a pending plan may count toward the allowance: it can still be published (`0060`). */
async function pendingCounts(userId: string): Promise<boolean> {
  const { professional } = await SettingsController.flags();

  return professional && (await PlanRepository.isPublishable(userId));
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The zone a profile keeps when it says nothing else — the column's own default. */
const DEFAULT_TIME_ZONE = 'Europe/Madrid';

/** The person's calendar day, in the time zone their profile keeps (project 015). */
async function personToday(userId: string): Promise<string> {
  const profile = await ProfileRepository.findByUserId(userId);

  return dayKeyIn(new Date(), profile?.timezone ?? DEFAULT_TIME_ZONE);
}

type ChainPlan = Awaited<ReturnType<typeof PlanRepository.findChain>>[number];

/** Everything `startMeaning` and the redo count read, loaded once for every day the chooser offers. */
type StartContext = {
  readonly active: Awaited<ReturnType<typeof PlanRepository.findActive>>;
  readonly chain: readonly ChainPlan[];
  /** The plan whose chain a redo of the fortnight under way is counted from: a pending plan that counts (`0060`), else the active plan. */
  readonly current: { readonly version: number } | undefined;
  /** The fortnight a redo would redo: a pending plan that counts (`0060`) when a generation asks, else the active plan. */
  readonly ends: { readonly endDate: string; readonly version: number } | undefined;
  readonly tier: Tier;
  readonly today: string;
  /** The plan waiting for its day (project 015), from the chain. */
  readonly waiting: ChainPlan | undefined;
};

async function startContext(userId: string, forGeneration: boolean): Promise<StartContext> {
  const [active, chain, tier, today] = await Promise.all([
    PlanRepository.findActive(userId),
    PlanRepository.findChain(userId, true),
    PlanController.tierOf(userId),
    personToday(userId)
  ]);
  // A plan waiting for review (`0060`) is the fortnight a redo would redo: it
  // was generated, and what it spent is spent, whether or not it is published —
  // while it can still be published. A plan stranded by a link that ended,
  // paused or lost its grant costs the client nothing. Nobody unlinked ever
  // has one, so for them this is the active plan, as before. The client's own
  // screen counts its redos too, but takes the fortnight's end from the plans
  // the client can see.
  const pending = chain.find(plan => plan.status === 'pending_review');
  const counted = pending && (await pendingCounts(userId)) ? pending : undefined;
  const current = counted ?? active;

  return { active, chain, current, ends: forGeneration ? current : active, tier, today, waiting: chain.find(plan => plan.status === 'scheduled') };
}

/**
 * What starting on `start` would spend, and whether it may (project 015).
 *
 * With a plan waiting for its day, every start replaces it, and its chain is
 * counted — whichever way it faced, so a redo spent cutting the plan under way
 * stays spent when the waiting plan is replaced by one that opens the next
 * fortnight. A start that cuts the plan under way also counts that plan's own
 * chain, and the larger of the two decides. With nothing waiting, a cut counts
 * the plan under way and anything later is free.
 *
 * `chargeWaiting` false is a professional's generation (`0060`, owner's
 * decision 2026-10-02): it replaces a waiting plan at no charge to the client,
 * so the waiting plan neither makes it a redo nor is counted.
 */
function standingAt(
  context: StartContext,
  start: string,
  chargeWaiting = true
): { readonly meaning: StartMeaning; readonly standing: PlanRedoStanding } {
  const { chain, current, ends, tier, today } = context;
  const waiting = chargeWaiting ? context.waiting : undefined;
  const meaning = startMeaning(ends, start, today, waiting !== undefined);
  const limit = allowancesFor(tier).planRedosPerFortnight;

  if (meaning.kind === 'new_fortnight') {
    return { meaning, standing: planRedoStanding(undefined, 0, today, tier) };
  }

  const countFrom = (plan: { readonly version: number } | undefined) =>
    plan ? redosInFortnight(chain.filter(candidate => candidate.version <= plan.version)) : 0;
  const used = Math.max(countFrom(waiting), meaning.cuts !== null ? countFrom(current) : 0);
  const allowed = used < limit;

  return {
    meaning,
    standing: { allowed, kind: 'redo', limit, nextAt: allowed || meaning.cuts === null || !ends ? null : addDays(ends.endDate, 1), used }
  };
}

/** Refuses a start whose redo is spent, as the allowance always has: 429 with the day the next fortnight opens. */
async function refuseSpentStart(userId: string, start: string, chargeWaiting = true): Promise<void> {
  const { standing } = await PlanController.startStanding(userId, start, chargeWaiting);

  if (!standing.allowed) {
    throw new QuotaExceededError('plan_redo', standing.nextAt);
  }
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

/** What a cooked grain's dry weight is rounded to on the meal (`0078`), and the least it shows: never "0 g". */
const DRY_STEP_G = 5;

/** The dry foods' names, in the reader's language, for the cooked grains among these slugs. No query when there are none. */
async function dryNamesFor(slugs: readonly string[], locale: string): Promise<ReadonlyMap<string, string>> {
  const drySlugs = [...new Set(slugs.flatMap(slug => toDry(slug, 0)?.drySlug ?? []))];

  if (drySlugs.length === 0) {
    return new Map();
  }

  const ingredients = await RecipeRepository.loadCatalogue(locale, null, drySlugs);

  return new Map(ingredients.map(ingredient => [ingredient.slug, ingredient.name]));
}

async function loadMealDetail(userId: string, mealId: string, requested: string | null, withPending = false): Promise<MealDetailView> {
  const locale = await localeFor(userId, requested);
  // The safety profile is fetched alongside the meal rather than only when an
  // ingredient has alternatives: it is the gate every alternative passes through,
  // and a gate loaded lazily is a gate that can be skipped by mistake.
  const [found, safety] = await Promise.all([
    PlanRepository.findMealDetail(userId, mealId, locale, withPending),
    SafetyController.getSafetyProfile(userId)
  ]);

  if (!found) {
    throw new NotFoundError('Meal not found');
  }

  const { day, items, meal, plan, recipe, sides } = found;
  const factor = Number(meal.servings) / (recipe.servings || 1);
  const verdict = await RecipeRepository.findVerdict(userId, recipe.id);
  const dryNames = await dryNamesFor([...items.map(item => item.slug), ...sides.map(side => side.slug)], locale);
  const picture = toPictureStatus({ status: recipe.pictureStatus, url: recipe.pictureUrl });

  return {
    id: meal.id,
    accompaniments: presentAccompaniments(sides, locale, dryNames),
    carbsG: Number(meal.carbsG),
    cookMinutes: recipe.cookMinutes,
    cuisine: recipe.cuisine,
    date: day.date,
    dayIndex: day.dayIndex,
    difficulty: recipe.difficulty,
    fatG: Number(meal.fatG),
    fiberG: Number(meal.fiberG),
    illustrationPath: picture.url,
    ingredients: items.map(item => {
      const grams = Math.round(Number(item.grams) * factor * 10) / 10;

      const dry = toDry(item.slug, grams);

      return {
        alternatives: alternativesFor(item, grams, item.substitutes, safety),
        ...(dry && {
          dry: {
            grams: Math.max(DRY_STEP_G, Math.round(dry.dryGrams / DRY_STEP_G) * DRY_STEP_G),
            name: (dry.drySlug && dryNames.get(dry.drySlug)) ?? withoutCooked(item.name)
          }
        }),
        grams,
        name: item.name,
        unit: item.unit
      };
    }),
    kcal: Number(meal.kcal),
    name: recipe.name,
    pictureStatus: picture.status,
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
