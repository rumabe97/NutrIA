import type { Goal } from 'core/entities/Profile';
import type { Kitchen } from 'core/entities/Kitchen';
import type { Macros, NutritionTargets } from 'core/entities/Nutrition';
import type { MealSlot } from 'core/entities/Plan';

/** The most days of a plan an assistant prompt carries: one fortnight. */
export const ASSISTANT_MAX_DAYS = 14;

/** The most names any one list carries. A person's taste is not improved by the eightieth dish. */
export const ASSISTANT_MAX_NAMES = 40;

/** One meal of the active plan, as the service stored it. */
export type AssistantMealInput = {
  /** Names only: their macros are already inside `macros` (see `AssistantMeal`). */
  readonly accompaniments: readonly string[];
  readonly dish: string;
  /** The `meals` row's own figures, which **already include its accompaniments**. */
  readonly macros: Macros;
  readonly slot: MealSlot;
};

/** One day of the active plan, with the targets *that day* answers to — an event day has its own. */
export type AssistantDayInput = { readonly date: string; readonly meals: readonly AssistantMealInput[]; readonly targets: NutritionTargets };

/** Everything the context is built from — supplied by the service, never read from a request. */
export type AssistantContextInput = {
  readonly cookingTimeMinutes: number | null;
  readonly cuisines: readonly string[];
  readonly days: readonly AssistantDayInput[];
  readonly dietaryPatterns: readonly string[];
  readonly dislikedNames: readonly string[];
  readonly goal: Goal['type'] | null;
  readonly kitchen: Kitchen | null;
  readonly language: string;
  readonly likedFoods: readonly string[];
  readonly lovedNames: readonly string[];
  /** Each eaten slot's share of the whole day, 0–1 (`weightsFor`, `0036`). */
  readonly slotShares: ReadonlyMap<MealSlot, number>;
  readonly targets: NutritionTargets;
};

/** Figures as the assistant is shown them, and as `figureSet` reads them back: rounded once, here. */
export type AssistantFigures = {
  readonly carbsG: number;
  readonly fatG: number;
  readonly fiberG: number;
  readonly kcal: number;
  readonly proteinG: number;
};

export type AssistantMeal = {
  readonly accompaniments: readonly string[];
  readonly dish: string;
  readonly figures: AssistantFigures;
  readonly slot: MealSlot;
};

export type AssistantDay = {
  readonly date: string;
  readonly meals: readonly AssistantMeal[];
  readonly targets: AssistantFigures;
  /** The `meals` rows summed, **and nothing else** — see `assistantContext`. */
  readonly totals: AssistantFigures;
};

/**
 * What the assistant is told about one person (project 023, `0104` clause 3).
 *
 * **Exactly what the plan generator already tells a model, and nothing more**:
 * the person-level half of `PromptContext` — goal, patterns, cuisines, cooking
 * time, the dishes and foods they like and dislike, their kitchen, the meal
 * shape — plus the plan the service built. The per-generation half
 * (`needBySlot`, `excludeSlugs`, `loadedTargets`, `swapWish`, `dishRequest`,
 * `avoidNames`) is not here because no question needs it.
 *
 * **This type has nowhere to put a condition, a medication, a supplement or
 * anything from the cupboard**, and `Assistant.boundary.test.ts` holds its key
 * list to an exact, reviewed set. A type with no slot is the only version of
 * "never" that survives the next edit: a rule in a prompt can be argued with by
 * the model, and a rule in a comment can be argued with by the next agent.
 */
export type AssistantContext = {
  readonly cookingTimeMinutes: number | null;
  readonly cuisines: readonly string[];
  /** The active plan, oldest day first; empty when there is none, which is a context and not an error. */
  readonly days: readonly AssistantDay[];
  readonly dietaryPatterns: readonly string[];
  readonly dislikedNames: readonly string[];
  readonly goal: Goal['type'] | null;
  readonly kitchen: Kitchen | null;
  readonly language: string;
  readonly likedFoods: readonly string[];
  readonly lovedNames: readonly string[];
  /** Each eaten slot's share of the day, as a whole percentage — "¿por qué tanto almuerzo?" needs it. */
  readonly slotShares: Readonly<Partial<Record<MealSlot, number>>>;
  readonly targets: AssistantFigures;
};

/** Rounded the way a person reads them: whole kilocalories, whole grams, fibre to a tenth. */
export function assistantFigures(macros: Macros | NutritionTargets): AssistantFigures {
  return {
    carbsG: Math.round(macros.carbsG),
    fatG: Math.round(macros.fatG),
    fiberG: Math.round(macros.fiberG * 10) / 10,
    kcal: Math.round(macros.kcal),
    proteinG: Math.round(macros.proteinG)
  };
}

/** Distinct, trimmed, empty ones dropped, in a fixed order — so the same person makes the same prompt. */
function names(values: readonly string[], limit: number): readonly string[] {
  return [...new Set(values.map(value => value.trim()).filter(value => value !== ''))].sort((one, other) => one.localeCompare(other)).slice(0, limit);
}

/**
 * The context, from what the service read.
 *
 * **A day's total is its `meals` rows summed and nothing else.** A meal's
 * stored figures already include its accompaniments — `withAccompaniments` in
 * the scheduler writes them in so that every reader sees what the person eats —
 * and adding the accompaniments again overstated production's days by 20–30 %
 * the one time it was done (the 2026-11-06 production read). Accompaniments
 * reach this type as **names only**, so there is nothing left to add twice.
 */
export function assistantContext(input: AssistantContextInput): AssistantContext {
  const days = [...input.days]
    .sort((one, other) => one.date.localeCompare(other.date))
    .slice(0, ASSISTANT_MAX_DAYS)
    .map(day => {
      const meals = day.meals.map(meal => ({
        accompaniments: names(meal.accompaniments, ASSISTANT_MAX_NAMES),
        dish: meal.dish.trim(),
        figures: assistantFigures(meal.macros),
        slot: meal.slot
      }));
      const sum = day.meals.reduce<Macros>(
        (total, meal) => ({
          carbsG: total.carbsG + meal.macros.carbsG,
          fatG: total.fatG + meal.macros.fatG,
          fiberG: total.fiberG + meal.macros.fiberG,
          kcal: total.kcal + meal.macros.kcal,
          proteinG: total.proteinG + meal.macros.proteinG
        }),
        { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
      );

      return { date: day.date, meals, targets: assistantFigures(day.targets), totals: assistantFigures(sum) };
    });
  const slotShares: Partial<Record<MealSlot, number>> = {};

  for (const [slot, share] of input.slotShares) {
    if (share > 0) {
      slotShares[slot] = Math.round(share * 100);
    }
  }

  return {
    cookingTimeMinutes: input.cookingTimeMinutes,
    cuisines: names(input.cuisines, ASSISTANT_MAX_NAMES),
    days,
    dietaryPatterns: names(input.dietaryPatterns, ASSISTANT_MAX_NAMES),
    dislikedNames: names(input.dislikedNames, ASSISTANT_MAX_NAMES),
    goal: input.goal,
    kitchen: input.kitchen,
    language: input.language,
    likedFoods: names(input.likedFoods, ASSISTANT_MAX_NAMES),
    lovedNames: names(input.lovedNames, ASSISTANT_MAX_NAMES),
    slotShares,
    targets: assistantFigures(input.targets)
  };
}
