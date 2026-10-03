import { NO_ACCOMPANIMENT, setsBeside } from 'core/domain/Accompaniment';
import { addMacros, composePerServing, scaleIngredients, scaleMacros, sumMacros } from 'core/domain/Composition';
import {
  canPlace,
  countsFor,
  isPreferredDish,
  kindAtCap,
  kindExcess,
  kindMeals,
  kindPastCap,
  kindsCrowded,
  kindsExcess,
  legumeCheck,
  legumeIndex,
  MAIN_SLOTS,
  mainProtein,
  nearestGap,
  planWeek,
  PREFERRED_MAIN_GAP,
  PROTEIN_RULES,
  proteinCap,
  snackCheck,
  starchCheck,
  starchIndex
} from 'core/domain/Variety';
import { outOfSeasonFruit } from 'core/domain/MealFit';
import { PLAN_TOLERANCE } from 'core/domain/PlanValidation';
import { plateFoodMax, plateFoods } from 'core/domain/PlateFood';
import type { AccompanimentPortion, AccompanimentSet, Larder } from 'core/domain/Accompaniment';
import type { KindCheck, KindMeal, Leaning, Placement } from 'core/domain/Variety';
import type { PlateFood } from 'core/domain/PlateFood';
import type { CandidateDish, Catalogue, Macros, MealSlot, PlanAssignment, PlanDayAssignment, ScheduledMeal, SwapAxis } from 'core/entities/Plan';
import type { NutritionTargets } from 'core/entities/Nutrition';

export const PLAN_DAYS = 14;

/**
 * Portions are quantised to quarters. A quarter portion is a thing a person can
 * serve; 1.37 servings is not, and printing it would make the plan look
 * machine-generated in the one place it most needs to look considered.
 */
const SERVING_STEP = 0.25;
// A high target over few meals needs large plates: 4,100 kcal across three meals
// is ~1,370 kcal each, and a model rarely proposes a dish that size. Refusing to
// scale past 2.5 meant refusing to plan for people who eat a lot.
export const SERVING_BOUNDS = { max: 4, min: 0.5 } as const;

/**
 * How far, in quarter servings, the portion search looks either side of the
 * size each dish was first scaled to.
 *
 * Four steps is a whole serving each way. The search is exhaustive over every
 * combination inside that window — four dishes at nine sizes each is 6,561
 * days to price, which costs nothing — so the day always leaves with the best
 * portions its dishes allow, not the first local minimum a greedy walk found
 * (`0045`). Wider than this and the sizes stop being the dish's own; narrower
 * and fat, which arrives in small grams inside a plate, cannot be steered.
 */
const BALANCE_WINDOW_STEPS = 4;

/**
 * How many portion combinations one day may price, at most.
 *
 * The search is exhaustive, so its cost is the product of every dish's sizes:
 * nine sizes each is 6,561 for four meals, 59,049 for five — and 531,441 for
 * six, which took 98 seconds to schedule one fortnight, a third of a serverless
 * function's five minutes before the model had written a dish, twice over when
 * a plan is scheduled again (`0046`). So the window
 * is shared out under a ceiling (`windowsFor`): every day of five meals or
 * fewer keeps the whole window it always had, and a sixth meal narrows the
 * light ones first, where a quarter serving moves the day least.
 */
const BALANCE_MAX_COMBOS = 59_049;

/**
 * The same ceiling inside the spread pass, which sizes two days for every
 * exchange it prices and may price hundreds. A four-meal day's whole search.
 */
const SPREAD_MAX_COMBOS = 6561;

/**
 * The portion search may size any meal freely, but may never make a meal
 * bigger than one the person said should be bigger (`0036`).
 *
 * A soft penalty on every meal's drift from its share was tried first, and it
 * traded the thing that matters: at a weight that kept a light dinner smaller
 * than lunch it also pulled protein and fat back outside 5% on a real library.
 * The promise is not "each meal within a few per cent of its share" — the
 * person did not ask for that — it is that a light dinner is lighter than a
 * normal lunch, a large lunch larger than a normal one. So the cost is a
 * hinge: nothing while the order holds, and steep once it breaks, so the
 * search is free inside the order and cannot leave it.
 *
 * Only pairs whose shares differ by more than `SHARE_ORDER_GAP` are ordered.
 * The default weights put lunch at 0.33 and dinner at 0.30, and nobody chose
 * that; light against normal is a factor of two, and that they did.
 *
 * The hinge is a step plus the gap, not the gap alone. Priced by the gap, an
 * inversion of twelve calories on a light dinner cost 0.016 and the search
 * paid it gladly for a slightly better fit — the end-to-end suite caught a
 * "light" dinner twelve calories over the lunch beside it. A fixed cost for
 * the fact of inverting, at this weight, is more than any few per cent of
 * macro fit can buy, so the best combination that keeps the order always wins
 * over any that breaks it.
 */
const SHARE_ORDER_GAP = 0.2;
const SHARE_INVERSION_WEIGHT = 2;

/**
 * How far one meal may stray from its share of the day, as a fraction of the
 * energy its share gives it (`0051`).
 *
 * The hinge above keeps a light meal lighter than a normal one, and only
 * where two shares differ by a fifth. Lunch and dinner at their default
 * weights do not, so between them the portion search was free, and a real
 * plan used all of it: a 388-kcal lunch beside a 1,247-kcal dinner, and
 * another day the other way round — every day on its macros, none of them the
 * day the person set. So a meal outside the band costs: nothing inside it, the
 * distance outside.
 *
 * The distance alone, not a step and the distance as the order's hinge has. A
 * step made the band a wall, and on a pool of a few plain dishes — the
 * end-to-end suite's — the wall held a day 10% off its energy rather than let
 * one plate a little past its share. The shape is how a day should feel; the
 * macros are the promise.
 */
export const SHARE_BAND = { max: 1.4, min: 0.7 } as const;

/**
 * What each point of a meal's share outside `SHARE_BAND` costs, in fit. A
 * meal at half its share costs 0.2 — far more than the few points of fit a
 * free portion search trades a day's shape for, so on a real library every
 * meal stays inside; less than a day several points off its macros, so a pool
 * that cannot land them in band lets a plate out instead. In the spread pass
 * it is further outranked by every macro band (`BAND_MISS_WEIGHT`).
 */
const SHARE_BAND_WEIGHT = 1;

/**
 * How far one plate may stray from its share of the day, as a bound rather
 * than a price (`0076`). `SHARE_BAND` inside it stays the preference.
 *
 * `SHARE_BAND` alone let a real meal plan trade a plate's shape for macro fit
 * every time a protein target asked for it: 1,700-kcal lunches beside 250-kcal
 * dinners, a "light" snack of 550. `0070` caps one serving; this caps the plate,
 * relative to the person's own share, so a big eater's 2–4 servings still fit.
 * A dish that cannot be sized into it is not a candidate for the slot, and a
 * day that cannot meet its macros inside it is delivered out of band with its
 * advisory. The energy floor is the one thing that outranks it — see
 * `balancedDay` and `pickReplacement`.
 */
export const PLATE_LIMIT = { max: 1.5, min: 0.5 } as const;

/**
 * How much one plate may weigh, by slot (`0078`) — the bound on its grams that
 * `PLATE_LIMIT` is on its energy, enforced the same way and with the same one
 * exception: the energy floor.
 *
 * `PLATE_LIMIT` left a person with two main meals lunches and dinners of
 * 0.8–1.2 kg, each carrying about 1,000 kcal much of it in water — cooked
 * grains, vegetables, skyr. The energy was right and the plate was not
 * something anybody eats. A dish whose smallest serving is past its slot's
 * ceiling is not a candidate there, exactly like one that cannot be sized into
 * its share.
 */
export const PLATE_GRAMS_MAX: Readonly<Record<MealSlot, number>> = {
  afternoon_snack: 250,
  breakfast: 750,
  dinner: 750,
  lunch: 750,
  morning_snack: 250,
  supper: 250
};

/**
 * TEMPORARY (project 016, LOG 2026-10-02) — until the `accompaniments` flag
 * (016 phase 3) carries a big meal's energy on a second plate, a main meal
 * whose share is past `fromKcal` may weigh more than `PLATE_GRAMS_MAX`: in
 * proportion to its share, up to `maxGrams`.
 *
 * The flat 750 g of `0078` left a person with two main meals 3–11 days of 14
 * inside ±5 %, against 14 before it: a 1,100-kcal lunch of ordinary dishes does
 * not fit in 750 g. The owner put the ±5 % promise first. When the flag turns
 * on, this goes and `PLATE_GRAMS_MAX` is the ceiling again.
 */
export const SCALED_PLATE_GRAMS = { fromKcal: 950, maxGrams: 900 } as const;

/** The slots `SCALED_PLATE_GRAMS` scales — the meals; snacks and supper keep their ceiling. */
const SCALED_PLATE_SLOTS: ReadonlySet<MealSlot> = new Set(['breakfast', 'lunch', 'dinner']);

/**
 * How much one plate in this slot may weigh when its share of the day is
 * `budgetKcal`: `PLATE_GRAMS_MAX`, scaled for a big main meal by
 * `SCALED_PLATE_GRAMS`. The one ceiling every sizing path reads, through
 * `withinPlateLimit`.
 */
export function plateGramsMax(slot: MealSlot, budgetKcal: number): number {
  const base = PLATE_GRAMS_MAX[slot];

  if (!SCALED_PLATE_SLOTS.has(slot) || budgetKcal <= SCALED_PLATE_GRAMS.fromKcal) {
    return base;
  }

  return Math.min(SCALED_PLATE_GRAMS.maxGrams, (base * budgetKcal) / SCALED_PLATE_GRAMS.fromKcal);
}

/** Float slack for a share computed at a limit's edge. */
const PLATE_EPSILON = 1e-9;

/**
 * Accompaniments (project 016, `0079` Table 3, design A of `0008`): what goes
 * beside a big main meal — bread, a salad, a piece of fruit — chosen inside
 * the day's portion search, so the plate is sized knowing what is beside it.
 *
 * Only lunch and dinner (`MAIN_SLOTS`), and only when their share of the day
 * is past `ACCOMPANIED_FROM_KCAL`: below it a plate is a meal on its own, and a
 * person who eats five times on an ordinary target pays nothing in search.
 * Each such meal is offered `ACCOMPANIMENT_SETS` sets, "none" always among
 * them, the best at closing that meal's gap (`rankedSets`), so a three-meal
 * day prices (9 × 6)² × 9 = 26,244 combinations, under `BALANCE_MAX_COMBOS`.
 */
export const ACCOMPANIED_FROM_KCAL = 700;
export const ACCOMPANIMENT_SETS = 6;

/**
 * Accompaniments accompany; they do not replace the dish (016 phase 4). With
 * nothing holding them, phase 3's evaluator saw sides carry 54 % of a
 * vegetarian's meal and 46 % of a halal or traditional Spanish one. So the
 * sides of one meal carry at most this share of its energy, plate and sides
 * together — checked inside the set choice, at every size the search tries,
 * so a set past it is never offered (`sidesWithinShare`).
 */
export const ACCOMPANIMENT_MAX_SHARE = 0.35;

/** Whether what is beside a plate of this size stays within `ACCOMPANIMENT_MAX_SHARE` of the meal. Nothing beside it always does. */
function sidesWithinShare(perServing: PerServing, servings: number, besideKcal: number): boolean {
  return besideKcal <= 0 || besideKcal <= ACCOMPANIMENT_MAX_SHARE * (perServing.kcal * servings + besideKcal) + PLATE_EPSILON;
}

/**
 * With accompaniments on, a serving is best between these (`0008` § A,
 * "Raciones"): the hard bounds stay `SERVING_BOUNDS`, and a plate outside this
 * band costs `SERVING_PREFERENCE_WEIGHT` per serving outside it — so where
 * half a serving more of a stew and 60 g of bread fit the day alike, the
 * bread wins. About three points of energy for half a serving: a preference,
 * never enough to hold a day off its macros.
 */
export const SERVING_PREFERENCE = { max: 1.5, min: 0.75 } as const;
const SERVING_PREFERENCE_WEIGHT = 0.1;

/** What a serving outside `SERVING_PREFERENCE` costs, before its weight. */
function servingMiss(servings: number): number {
  return servings < SERVING_PREFERENCE.min ? SERVING_PREFERENCE.min - servings : Math.max(0, servings - SERVING_PREFERENCE.max);
}

/**
 * What the scheduler is told about accompaniments: whose larder (`larderFor`)
 * and which month each day falls in, since season is a hard filter on the day
 * a meal is served (owner's answer 8). Absent, there are none — the flag off,
 * and the plan is the one the scheduler always made.
 */
export type AccompanimentOffer = {
  readonly larder: Larder;
  /** 1–12, for a day of the plan. */
  readonly monthOf: (dayIndex: number) => number;
};

/** The offer, bound to one day: the sets a pick of that day may take, or null for a meal that takes none. */
type Sides = { readonly setsOf: (pick: Pick, budget: SlotBudget) => readonly AccompanimentSet[] | null };

function sidesFor(offer: AccompanimentOffer | undefined, cache: Map<string, readonly AccompanimentSet[]>): ((dayIndex: number) => Sides) | undefined {
  if (!offer) {
    return undefined;
  }

  return dayIndex => {
    const month = offer.monthOf(dayIndex);

    return {
      setsOf: (pick, budget) => {
        if (!MAIN_SLOTS.has(pick.slot) || budget.kcal <= ACCOMPANIED_FROM_KCAL) {
          return null;
        }

        const key = `${pick.dish.slug}|${pick.slot}|${month}|${budget.kcal}|${budget.proteinG}|${budget.carbsG}|${budget.fatG}`;
        let sets = cache.get(key);

        if (!sets) {
          sets = offeredSets(offer.larder, pick.dish, pick.slot, month, pick.base, budget);
          cache.set(key, sets);
        }

        return sets;
      }
    };
  };
}

/**
 * How many portions of each role go into the product of sets (018 phase 3).
 * The list grew from 46 entries to 85, and every set is priced for every dish,
 * meal, month and budget: unpruned, the Spanish table went from about 410 sets
 * to 2,666 and `schedulePlan` took a third longer with accompaniments on. So
 * each role keeps its best portions on their own first — priced exactly as a
 * set of one (`setCost`) — and only those are combined.
 */
export const ACCOMPANIMENT_CANDIDATES_PER_ROLE = 6;

/** The sets offered beside one pick: `setsBeside` on each role's best `ACCOMPANIMENT_CANDIDATES_PER_ROLE` portions, ranked. */
function offeredSets(
  larder: Larder,
  dish: CandidateDish,
  slot: MealSlot,
  month: number,
  base: PerServing,
  budget: SlotBudget
): readonly AccompanimentSet[] {
  const keep = (portions: readonly AccompanimentPortion[]): readonly AccompanimentPortion[] => {
    const priced = portions
      .map((portion, index) => ({
        cost: setCost({ items: portion.items, macros: portion.macros, portions: [portion] }, base, budget, slot),
        index,
        portion
      }))
      .filter(entry => Number.isFinite(entry.cost))
      .sort((a, b) => a.cost - b.cost || a.index - b.index);
    const kept = new Set(
      (['starch', 'vegetable', 'dessert'] as const).flatMap(role =>
        priced
          .filter(entry => entry.portion.accompaniment.role === role)
          .slice(0, ACCOMPANIMENT_CANDIDATES_PER_ROLE)
          .map(entry => entry.portion)
      )
    );

    // Table order kept, so a tie in the ranking still goes to the plainer, older entry.
    return portions.filter(portion => kept.has(portion));
  };

  return rankedSets(setsBeside(larder, dish, slot, month, keep), base, budget, slot);
}

/**
 * The `ACCOMPANIMENT_SETS` sets that best close a meal's gap: each priced with
 * the plate sized to what the set leaves of the budget, by the fit of the
 * whole meal to its share plus `SERVING_PREFERENCE`. "None" is always kept.
 * Returned in the order they were offered — "none" first — so a tie in the
 * day's search keeps the plainer meal. Deterministic: a tie in rank keeps
 * table order.
 */
function rankedSets(sets: readonly AccompanimentSet[], base: PerServing, budget: SlotBudget, slot: MealSlot): readonly AccompanimentSet[] {
  const priced = sets
    .map((set, index) => ({ cost: setCost(set, base, budget, slot), index, set }))
    .filter(entry => Number.isFinite(entry.cost) || entry.set === NO_ACCOMPANIMENT)
    .sort((a, b) => a.cost - b.cost || a.index - b.index);
  const kept = priced.slice(0, ACCOMPANIMENT_SETS);

  if (!kept.some(entry => entry.set === NO_ACCOMPANIMENT)) {
    kept.splice(kept.length - 1, 1, { cost: 0, index: -1, set: NO_ACCOMPANIMENT });
  }

  return kept.sort((a, b) => a.index - b.index).map(entry => entry.set);
}

/** The plate's size beside a set: closest to what the set leaves of the budget, inside the limits. Undefined when none fits. */
function servingsBeside(set: AccompanimentSet, base: PerServing, budget: SlotBudget, slot: MealSlot): number | undefined {
  const sizes = plateServings(base, budget, slot, set.macros.kcal);
  const wanted = base.kcal > 0 ? (budget.kcal - set.macros.kcal) / base.kcal : 1;

  return [...sizes].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || a - b).at(0);
}

function setCost(set: AccompanimentSet, base: PerServing, budget: SlotBudget, slot: MealSlot): number {
  const servings = servingsBeside(set, base, budget, slot);

  if (servings === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return fitCost(addMacros(scaleMacros(base, servings), set.macros), budget) + servingMiss(servings) * SERVING_PREFERENCE_WEIGHT;
}

/**
 * The fortnight pass that spreads what a day could not fix on its own across
 * the days that have room for it (`0048`).
 *
 * Days are built in order, and each dish may appear twice a plan, so the
 * dishes that fit a person best are spent in the first week and the last days
 * are built from what is left. On a real plan that was protein: days one to
 * ten inside a point of target, days eleven to fourteen 7–19% over — while the
 * fortnight's surplus, spread evenly, was under 4% a day. No choice inside one
 * day can move that; an exchange between two days can. So once every day is
 * built, the day furthest outside its bands trades a meal with the same meal
 * of another day, both re-sized, whenever that leaves the two days with fewer
 * macros outside their bands — or as many, less far outside (`bandMiss`).
 *
 * Rounds are bounded, and each is two-stage like the day's own swaps: every
 * exchange is screened at its first sizes, and only the most promising
 * `SPREAD_SHORTLIST` are re-sized properly.
 */
const MAX_SPREAD_ROUNDS = 60;
const SPREAD_SHORTLIST = 24;

/**
 * Inside the spread pass, what a day pays for each point a macro sits outside
 * its band, on top of its ordinary fit — so the portions of a day being
 * repaired are sized to bring every macro inside first, and to fit closely
 * second. Not used while days are first built: there, pricing the band made
 * each day take the dishes that fit best and left the last days nothing,
 * measured worse on a real library.
 */
const BAND_MISS_WEIGHT = 10;

/**
 * What an inverted meal costs while the spread pass sizes a day to its bands:
 * more than every band of the day together can.
 *
 * The bands are priced steeply there, and at the ordinary inversion weight
 * they won — the end-to-end suite caught a "light" dinner of 1,475 kcal
 * beside a large lunch of 738, a day brought inside its bands by serving the
 * person's day back to front. The size order is something they chose; the
 * bands are something we promised. Theirs comes first.
 */
const ORDER_OUTRANKS_BANDS = 1000;

/**
 * What a day under the energy floor costs while it is being sized: more than
 * anything else about the day can save, the order of its meals included.
 *
 * The floor was validation's alone, and the scheduler aimed at the target with
 * a band either side. For most people the two never meet. For somebody light
 * and sedentary who asks for a fast pace they are the same number — the target
 * is clamped *to* the floor — and a day at 1,190 against 1,200 is a fine fit
 * and a blocking violation at once. Measured on the real library: fourteen days
 * of fourteen inside 5% on every macro, nine of them thrown away, so the plan
 * was, and the full-library retry aimed the same way and failed the same way.
 *
 * So it is a wall and not a band: a meal out of order is a plan the person can
 * eat, a day under the floor is one they are never given. It costs nothing to a
 * day that is over the floor at every size it could take, which is every day of
 * every plan whose target is not within a few points of it.
 */
const FLOOR_OUTRANKS_ORDER = 1_000_000;

/** Swap rounds per day. Each takes the single best improvement; they converge fast. */
const MAX_SWAP_ROUNDS = 8;

/**
 * How close two fit costs must be to count as the same fit.
 *
 * `fitCost` sums relative errors, so this is five points of one — a difference
 * no eater could taste, and small enough that nutrition still decides whenever
 * it has anything to say.
 */
const FIT_TIE = 0.05;

/**
 * What serving a main protein again costs (`PROTEIN_RULES`), in the units of
 * fit — about three points of energy, or five of protein. Enough that another
 * dish wins whenever it fits nearly as well; never enough to hold a day off
 * its macros. Priced rather than refused because a pool can be a few proteins
 * throughout: refused, on the end-to-end suite's three-protein pool, the
 * repeats went and a day landed 10% off its energy with them.
 */
const PROTEIN_REPEAT_WEIGHT = 0.05;

/**
 * What a day's swap pays for each meal it leaves past `PROTEIN_RULES`, or past
 * a kind rule (`STARCH_RULES`, `LEGUME_RULES`) — three times
 * `PROTEIN_REPEAT_WEIGHT`, about ten points of energy.
 *
 * At the first pick's weight the rules never decided anything here: a real
 * fortnight (017 phase 2) served pork in eight of twenty-eight mains, and on
 * rotated pools of the reference library this search put one protein in eight
 * mains, because a swap that fit a few points better was always on offer and
 * a protein past its limit cost less than that. At the same weight a meal past
 * a kind rule cost exactly what serving a dish a second time does, so the
 * search had no reason to prefer the second. Measured on rotated pools, the
 * most-served protein fell from eight mains to six.
 */
const PROTEIN_SWAP_WEIGHT = 0.15;

/**
 * What a day pays for each meal past the capped starches' four a fortnight
 * (`STARCH_RULES`: pasta, rice, grains), in the units of fit — more than any
 * fit a swap can buy, so the cap is held whenever another dish keeps the day as
 * close to its bands. Only the bands outrank it: `improveDay` and
 * `repairOutOfBand` judge a day's band miss first and the prices after, so a
 * day that needs a fifth plate of rice to land inside its macros gets it
 * (owner, 017: the macros win; `0081`).
 *
 * Priced at 0.15 like the other kind rules, the cap was passed on seven of
 * fourteen profiles of the reference library — rice six or seven times — with
 * every day inside its bands.
 */
const STARCH_CAP_WEIGHT = 100;

/**
 * How close two days' band misses (`bandMiss`) must be for `improveDay` to call
 * them equal and let fit and the variety rules' prices decide between them.
 */
const BAND_TIE = 0.01;

/**
 * The same inside the spread pass, where a macro brought inside its band is
 * worth one: half that. An exchange that only moves a macro closer does not
 * buy a repeat; one that brings a macro inside does.
 */
const SPREAD_REPEAT_WEIGHT = 0.5;

/**
 * What choosing a dish already served elsewhere in the plan costs, in fit —
 * the same weight and the same reasoning as `PROTEIN_REPEAT_WEIGHT`: enough
 * that a new dish wins whenever it fits nearly as well, never enough to hold
 * a day off its macros (owner, 2026-09-26 — "a dish repeats only when the
 * pool has no fitting alternative that keeps the day inside 5%").
 *
 * Priced, not refused, because `pickBest`'s usage-first ordering already
 * keeps a first choice from repeating whenever the pool has an unused dish
 * to offer; this is what the *repair* passes (`improveDay`) were missing —
 * a swap toward a better-fitting dish already used twice elsewhere cost the
 * same as a swap toward one that had never been served, so on a fortnight
 * whose daily targets barely move, the search converged on the same handful
 * of best-fitting dishes for every day it touched (`0065`).
 */
const DISH_REPEAT_WEIGHT = 0.05;

/**
 * On top of `DISH_REPEAT_WEIGHT`, for every day short of `PREFERRED_MAIN_GAP`
 * a repeated main (`MAIN_SLOTS`) lands from its nearest other serving — small
 * on purpose: this only breaks a tie between two repeats of the *same* dish
 * at different distances, never between a repeat and a new dish, which
 * `DISH_REPEAT_WEIGHT` alone already decides.
 */
const MAIN_GAP_SHORTFALL_WEIGHT = 0.01;

/**
 * What placing this dish again costs: nothing for its first serving anywhere
 * in the plan, `DISH_REPEAT_WEIGHT` for a repeat, and more still the closer a
 * repeated main lands to its other serving (`MAIN_GAP_SHORTFALL_WEIGHT`).
 * `placed` is the rest of the plan, this dish's own day (if already chosen)
 * excluded by the caller the way every other repeat cost here is.
 */
function reuseCost(dishSlug: string, slot: MealSlot, dayIndex: number, placed: readonly Placement[]): number {
  const gap = nearestGap(dishSlug, dayIndex, placed);

  if (gap === null) {
    return 0;
  }

  const mainShortfall = MAIN_SLOTS.has(slot) ? Math.max(0, PREFERRED_MAIN_GAP - gap) * MAIN_GAP_SHORTFALL_WEIGHT : 0;

  return DISH_REPEAT_WEIGHT + mainShortfall;
}

/** `reuseCost`, summed over a whole day's picks against the rest of the plan. */
function dayReuseCost(picks: readonly Pick[], dayIndex: number, placed: readonly Placement[]): number {
  return picks.reduce((sum, pick) => sum + reuseCost(pick.dish.slug, pick.slot, dayIndex, placed), 0);
}

export type SchedulerInput = {
  /** Accompaniments, when the flag is on; absent, none (`AccompanimentOffer`). */
  readonly accompaniments?: AccompanimentOffer;
  readonly catalogue: Catalogue;
  /**
   * Which days to lay out. Defaults to the whole fortnight, `1..days`.
   *
   * Given a subset, only those days are built and returned — that is what a
   * mid-plan rebuild needs (`0044`): an event declared on Tuesday touches three
   * days of a plan whose other eleven are already being lived, and rebuilding
   * the eleven would throw away meals somebody had already shopped for.
   */
  readonly dayIndexes?: readonly number[];
  readonly days?: number;
  /**
   * Days that eat for something (`0043`), by day index, with the targets they
   * eat to. Every other day uses `targets`. Kept as an override map rather than
   * a per-day array so a caller with no events passes nothing and the fortnight
   * is what it always was.
   */
  readonly dayTargets?: ReadonlyMap<number, NutritionTargets>;
  /**
   * The energy no day may be sized under — `minimumDailyKcal` of the person's
   * sex, the number validation blocks on. Required, not defaulted: a caller
   * that forgot it would schedule plans validation then throws away, which is
   * the bug this field exists for (`FLOOR_OUTRANKS_ORDER`).
   */
  readonly minimumKcal: number;
  /**
   * The month (1–12) each day falls in. Given, a dish whose fresh fruit is out
   * of season that month is not served that day (`outOfSeasonFruit`, 017
   * phase 2) — unless nothing else in the pool can fill the meal, because a
   * plan with a nectarine in October is still a plan and none is not.
   * Absent, every dish is in season, as before.
   */
  readonly monthOf?: (dayIndex: number) => number;
  /**
   * What is already on the plate and is *not* being laid out again.
   *
   * The variety rules are enforced against these exactly as against the days
   * this call places, so a rebuilt Tuesday cannot serve the same dish the
   * untouched Monday does. Empty for a generation, which starts with nothing.
   */
  readonly placed?: readonly Placement[];
  readonly pool: readonly CandidateDish[];
  readonly targets: NutritionTargets;
  /** Each eaten slot's share of the day, unnormalised — see `weightsFor` (`0036`). */
  readonly weights: ReadonlyMap<MealSlot, number>;
};

/** What a given day is built to hit: its own targets if it eats for something, the plan's otherwise. */
function targetsOn(input: SchedulerInput, dayIndex: number): NutritionTargets {
  return input.dayTargets?.get(dayIndex) ?? input.targets;
}

export type SchedulerShortfall = {
  readonly available: number;
  readonly dayIndex: number;
  readonly reason: 'insufficient_pool';
  readonly slot: MealSlot;
};

export type ScheduleResult =
  { readonly assignment: PlanAssignment; readonly ok: true } | { readonly ok: false; readonly shortfall: SchedulerShortfall };

/**
 * Assigns pool dishes across the fortnight.
 *
 * Deterministic by construction: candidates are ranked by how close their
 * per-serving macros sit to the slot's budget — energy, protein, carbs and fat
 * all four — ties broken by usage then by the pool's own order (`0009`). The
 * same input always produces the same plan, which is what makes the scheduler
 * testable and a failed generation reproducible.
 *
 * Variety is *prevented*, not detected — `canPlace` gates every placement, so a
 * finished assignment cannot contain a violation.
 */
export function schedulePlan(input: SchedulerInput): ScheduleResult {
  const days = input.days ?? PLAN_DAYS;
  const slots = [...input.weights.keys()];
  const perServing = perServingIndex(input.pool, input.catalogue);
  const proteins = proteinIndex(input.pool, input.catalogue);
  // Over the whole fortnight, even when only some of its days are laid out here.
  const cap = proteinCap(slots.length * days);
  // Pasta, rice and grains, the same legume and the same snack, priced at the protein rule's weight wherever they are (`kindRules`).
  const kinds = kindRules(input.pool, input.catalogue, days);
  const indexes = input.dayIndexes ?? Array.from({ length: days }, (_none, offset) => offset + 1);

  // The days that are not being laid out go in first, so every `canPlace` below
  // sees the whole plan rather than only the part of it this call is building.
  const placed: Placement[] = [...(input.placed ?? [])];
  const built: BuiltDay[] = [];
  const sidesOn = sidesFor(input.accompaniments, new Map());
  const seasonal = seasonFor(input);

  for (const dayIndex of indexes) {
    // Per day rather than once: a day that eats for an event has its own targets
    // (`0043`), and the budgets are what turn targets into a plate.
    const targets = targetsOn(input, dayIndex);
    const budgets = slotBudgets(input.weights, targets, input.accompaniments !== undefined);

    const picks: { base: PerServing; dish: CandidateDish; servings: number; slot: MealSlot; sortOrder: number }[] = [];

    for (const [sortOrder, slot] of slots.entries()) {
      const budget = budgets.get(slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
      const eligible = input.pool
        .filter(dish => dish.slots.includes(slot))
        .filter(dish => perServing.has(dish.slug))
        .filter(dish => canPlace(dish.slug, slot, dayIndex, placed));
      const inSeason = eligible.filter(dish => seasonal(dish.slug, dayIndex));
      const servable = inSeason.length > 0 ? inSeason : eligible;
      // Only dishes that can be sized inside `PLATE_LIMIT` (`0076`) and under
      // `PLATE_GRAMS_MAX` (`0078`) and `PLATE_FOOD_MAX` (016). When the pool
      // holds none for this slot, the day is still built from what there is —
      // a target no dish fits is validation's to refuse, not a reason to
      // deliver nothing — and the later passes never swap a fitting plate out.
      const fitting = servable.filter(dish => fitsPlate(perServing.get(dish.slug) as PerServing, budget, slot));
      const sized = fitting.length > 0 ? fitting : servable;
      // No pasta, rice or grains past their four while another dish can be
      // served here (`STARCH_CAP_WEIGHT`, `0081`); when none can, the cap gives.
      const cappedPlaced = kindMeals(placed, kinds.capped);
      const underCap = sized.filter(dish => !atStarchCap(dish.slug, slot, cappedPlaced, kinds));

      const kindsPlaced = kinds.checks.map(check => kindMeals(placed, check));
      const chosen = pickBest(
        underCap.length > 0 ? underCap : sized,
        budget,
        perServing,
        placed,
        dayIndex,
        slot,
        slug => Number(crowded(slug, { dayIndex, slot }, placed, proteins, cap)) + kindsCrowded(slug, slot, dayIndex, kindsPlaced, kinds.checks, days)
      );

      if (!chosen) {
        return {
          ok: false,
          shortfall: { available: input.pool.filter(dish => dish.slots.includes(slot)).length, dayIndex, reason: 'insufficient_pool', slot }
        };
      }

      const base = perServing.get(chosen.slug) as NonNullable<ReturnType<typeof perServing.get>>;

      picks.push({ base, dish: chosen, servings: servingsFor(base, budget, slot), slot, sortOrder });
      placed.push({ dayIndex, dishSlug: chosen.slug, slot });
    }

    const improved = improveDay(picks, input, perServing, dayIndex, placed, budgets, { cap, kinds, proteins, seasonal }, sidesOn?.(dayIndex));

    // Swapping changed what this day holds, so the placement record must follow or
    // later days would enforce variety against dishes that are no longer served.
    for (let index = placed.length - picks.length; index < placed.length; index += 1) {
      const replacement = improved[index - (placed.length - picks.length)];

      if (replacement) {
        placed[index] = { dayIndex, dishSlug: replacement.dish.slug, slot: replacement.slot };
      }
    }

    built.push({ budgets, dayIndex, picks: balanceDay(improved, targets, budgets, input.minimumKcal, sidesOn?.(dayIndex)), targets });
  }

  const spread = spreadAcrossDays(built, input.placed ?? [], proteins, kinds, seasonal, input.minimumKcal, sidesOn);
  const repaired = repairOutOfBand(spread, input, input.placed ?? [], perServing, { cap, kinds, proteins, seasonal }, sidesOn);
  const distinct = enforceDistinctDays(repaired, input, input.placed ?? [], proteins, cap, kinds, seasonal, sidesOn);

  const assignedDays: PlanDayAssignment[] = distinct.map(day => {
    const meals: ScheduledMeal[] = day.picks.map(pick => {
      const plate = {
        dish: pick.dish,
        ingredients: scaleIngredients(pick.dish.ingredients, pick.servings / pick.dish.servings),
        macros: scaleMacros(pick.base, pick.servings),
        servings: pick.servings,
        slot: pick.slot,
        sortOrder: pick.sortOrder
      };

      return input.accompaniments ? withAccompaniments(plate, pick.set ?? NO_ACCOMPANIMENT) : plate;
    });

    return { dayIndex: day.dayIndex, meals, totals: sumMacros(meals.map(meal => meal.macros)) };
  });

  return { assignment: { days: assignedDays }, ok: true };
}

/**
 * A plate and what is beside it, as one meal: the set's rows after the dish's,
 * and the macros of both — so the day's totals, `validatePlan`, the allergy
 * gate and the shopping list all see what the person eats, not only the plate.
 */
function withAccompaniments<
  T extends { readonly ingredients: readonly { readonly grams: number; readonly slug: string }[]; readonly macros: Macros }
>(plate: T, set: AccompanimentSet): T & { readonly accompaniments: ScheduledMeal['accompaniments'] } {
  return {
    ...plate,
    accompaniments: set.portions.map(portion => ({ ingredients: portion.items, key: portion.accompaniment.key, macros: portion.macros })),
    ingredients: [...plate.ingredients, ...set.items],
    macros: addMacros(plate.macros, set.macros)
  };
}

export type SlotBudget = {
  readonly carbsG: number;
  readonly fatG: number;
  /**
   * The plate's gram ceiling, when it is not `plateGramsMax`'s: with
   * accompaniments on, the flat `PLATE_GRAMS_MAX` again (016 phase 1's scaling
   * was until they carried a big meal's energy on a second plate).
   */
  readonly gramsMax?: number;
  readonly kcal: number;
  readonly proteinG: number;
};

export type Replacement = {
  /** As `ScheduledMeal.accompaniments`: present only when the swap was offered accompaniments. */
  readonly accompaniments?: ScheduledMeal['accompaniments'];
  readonly dish: CandidateDish;
  readonly ingredients: readonly { readonly grams: number; readonly slug: string }[];
  readonly macros: Macros;
  readonly servings: number;
};

/**
 * A favourite goes first only if it lands near the budget — this much fit cost
 * is roughly 20 % off on energy alone, or a smaller miss spread across energy
 * and composition. Past that, a favourite is the wrong dish for this slot
 * however much the person likes it, and the fit decides.
 */
const PREFERRED_FIT_TOLERANCE = 0.35;

/**
 * The best dish in `pool` for one slot of one day, judged exactly as the
 * scheduler judges: scaled to the budget, then by how close its macros land.
 * `placed` is the rest of the plan with the meal being replaced taken out, so the
 * variety rules hold after the swap as they did before it. Undefined when nothing
 * fits — the caller then asks the model for something new
 * ([`0015`](../../../../docs/decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md)).
 */
export function pickReplacement(input: {
  /**
   * Accompaniments, when the flag is on: whose larder, and the month of the day
   * being swapped. The new dish is chosen as ever, and its set composed the way
   * the scheduler composes one (`rankedSets`) — the budget is the whole meal.
   */
  readonly accompaniments?: { readonly larder: Larder; readonly month: number };
  readonly budget: SlotBudget;
  readonly catalogue: Catalogue;
  readonly dayIndex: number;
  /** What the person asked of the swap, as a test every candidate must pass — see `axisFilter`. */
  readonly filter?: (dish: CandidateDish, perServing: Macros) => boolean;
  /** What they lean towards: dishes by name, kitchens, foods they like (0026). */
  readonly leaning?: Leaning;
  /**
   * The month (1–12) of the day being swapped. Given, a dish whose fresh fruit
   * is out of season then is not a candidate (`outOfSeasonFruit`, 017 phase 2):
   * the model, asked next, is told the month.
   */
  readonly month?: number;
  readonly placed: readonly Placement[];
  /**
   * The least energy this plate may carry: the person's floor, less what the
   * day's other meals deliver. Zero or less for a day the rest of which clears
   * the floor alone, which is nearly everybody's. Required, like the scheduler's
   * `minimumKcal`, and for the same reason.
   *
   * A swap sizes the new dish to the old plate in quarter servings, so it lands a
   * little under or over it. For a day built just over the floor — which is where
   * `FLOOR_OUTRANKS_ORDER` leaves the days of somebody whose target *is* the
   * floor — a little under is under the floor: 1,203.5 became 1,163.5 on a
   * 400-kcal plate swapped for a dish of 360 a serving, and nothing validates a
   * day after generation. So the plate is served a quarter larger until the day
   * clears, and a dish that cannot get there at any size a person can be served
   * is not a candidate.
   */
  readonly plateMinimumKcal: number;
  readonly pool: readonly CandidateDish[];
  readonly slot: MealSlot;
}): Replacement | undefined {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const budget = input.accompaniments ? { ...input.budget, gramsMax: PLATE_GRAMS_MAX[input.slot] } : input.budget;

  const passes = (dish: CandidateDish): boolean => {
    const base = perServing.get(dish.slug);

    return (
      base !== undefined &&
      (input.month === undefined || outOfSeasonFruit(dish, input.catalogue, input.month) === null) &&
      fitsPlate(base, budget, input.slot) &&
      plateKcal(base, SERVING_BOUNDS.max) >= input.plateMinimumKcal &&
      (input.filter?.(dish, base) ?? true)
    );
  };

  const costOf = (slug: string): number => {
    const base = perServing.get(slug);

    return base ? scaledFitCost(base, budget, input.slot) : Number.MAX_VALUE;
  };

  const rank = (dish: CandidateDish): number =>
    input.leaning !== undefined && isPreferredDish(dish, input.leaning) && costOf(dish.slug) <= PREFERRED_FIT_TOLERANCE ? 0 : 1;
  // Pasta, rice, grains or a legume the plan already has that day, the day
  // either side or as often as its rule allows (`STARCH_RULES`, `LEGUME_RULES`),
  // priced as the scheduler prices it. The plan's own meals are never in a
  // swap's pool, so their bases and legumes come from `placed`.
  const kinds = kindRules(input.pool, input.catalogue, PLAN_DAYS);
  const kindsPlaced = kinds.checks.map(check => kindMeals(input.placed, check));
  const kindsCost = (dish: CandidateDish): number =>
    kindsCrowded(dish.slug, input.slot, input.dayIndex, kindsPlaced, kinds.checks, PLAN_DAYS) * PROTEIN_REPEAT_WEIGHT;
  // Past the capped starches' four only when no other dish passes (`0081`): a swap has no bands to weigh against it.
  const cappedPlaced = kindMeals(input.placed, kinds.capped);
  const pastCap = (dish: CandidateDish): number => Number(atStarchCap(dish.slug, input.slot, cappedPlaced, kinds));

  const dish = input.pool
    .filter(
      candidate => candidate.slots.includes(input.slot) && passes(candidate) && canPlace(candidate.slug, input.slot, input.dayIndex, input.placed)
    )
    .sort(
      (a, b) =>
        pastCap(a) - pastCap(b) ||
        rank(a) - rank(b) ||
        costOf(a.slug) + kindsCost(a) - (costOf(b.slug) + kindsCost(b)) ||
        a.slug.localeCompare(b.slug)
    )
    .at(0);
  const base = dish ? perServing.get(dish.slug) : undefined;

  if (!dish || !base) {
    return undefined;
  }

  const offer = input.accompaniments;
  const sets =
    offer && MAIN_SLOTS.has(input.slot) && budget.kcal > ACCOMPANIED_FROM_KCAL
      ? offeredSets(offer.larder, dish, input.slot, offer.month, base, budget)
      : [];
  // The best of the offered sets, priced as `rankedSets` priced them; "none" when it is the best or the only one.
  const set =
    [...sets]
      .map((candidate, index) => ({ cost: setCost(candidate, base, budget, input.slot), index, set: candidate }))
      .sort((a, b) => a.cost - b.cost || a.index - b.index)
      .at(0)?.set ?? NO_ACCOMPANIMENT;
  let servings =
    set === NO_ACCOMPANIMENT
      ? servingsFor(base, budget, input.slot)
      : (servingsBeside(set, base, budget, input.slot) ?? servingsFor(base, budget, input.slot));

  // Ends: `passes` kept only dishes that reach it at the largest size. The one
  // place a plate may pass `PLATE_LIMIT.max`, `PLATE_GRAMS_MAX` or `PLATE_FOOD_MAX`, and only as
  // far as the floor needs.
  while (plateKcal(base, servings) + set.macros.kcal < input.plateMinimumKcal && servings < SERVING_BOUNDS.max) {
    servings = roundServings(servings + SERVING_STEP);
  }

  const plate = { dish, ingredients: scaleIngredients(dish.ingredients, servings / dish.servings), macros: scaleMacros(base, servings), servings };

  return offer ? withAccompaniments(plate, set) : plate;
}

/** One plate's energy as it is stored and summed — `scaleMacros`' rounding, see `deliveredKcal`. */
function plateKcal(perServing: Macros, servings: number): number {
  return Math.round(perServing.kcal * servings * 10) / 10;
}

/** "More protein" means this much more protein per calorie than the dish being replaced. */
const MORE_PROTEIN_FACTOR = 1.2;

/** What "vegetarian" takes off a plate. Eggs and dairy are not on this list, on purpose. */
const MEATY: ReadonlySet<string> = new Set(['fish', 'meat', 'pork', 'shellfish']);

/**
 * The test a candidate must pass for what the person asked of the swap
 * (0022), judged against the dish being replaced. Undefined when nothing was
 * asked — every candidate passes.
 *
 * - `quicker`: less time in total, prep and cooking, than the current dish.
 * - `no_cooking`: no cooking at all.
 * - `more_protein`: clearly more protein per calorie, so that scaled to the
 *   same energy the plate carries more protein.
 * - `vegetarian`: no meat, no fish, no shellfish — read from the catalogue's
 *   classes, never from the dish's name. Eggs and dairy stay, which is what the
 *   word means; someone who wants neither says so on their profile.
 */
export function axisFilter(
  axis: SwapAxis | undefined,
  current: { readonly cookMinutes: number; readonly macros: Macros; readonly prepMinutes: number },
  catalogue?: Catalogue
): ((dish: CandidateDish, perServing: Macros) => boolean) | undefined {
  if (axis === undefined) {
    return undefined;
  }

  const currentMinutes = current.prepMinutes + current.cookMinutes;
  const currentDensity = current.macros.kcal > 0 ? current.macros.proteinG / current.macros.kcal : 0;

  switch (axis) {
    case 'quicker':
      return dish => dish.prepMinutes + dish.cookMinutes < currentMinutes;
    case 'no_cooking':
      return dish => dish.cookMinutes === 0;
    case 'more_protein':
      return (_dish, perServing) => perServing.kcal > 0 && perServing.proteinG / perServing.kcal >= currentDensity * MORE_PROTEIN_FACTOR;
    case 'vegetarian':
      // No catalogue, no claim: without it nothing can be told apart, and a
      // filter that lets everything through would answer the request with meat.
      return catalogue === undefined
        ? () => false
        : dish =>
            dish.ingredients.every(item => {
              const ingredient = catalogue.get(item.slug);

              return ingredient !== undefined && !ingredient.classes.some(cls => MEATY.has(cls));
            });
  }
}

/**
 * Normalised budget per slot, so the weights work for any slot subset.
 *
 * Protein is budgeted alongside energy because validation checks both. Scaling a
 * portion changes a dish's calories and its protein by the same factor, so a
 * plan's protein is decided entirely at *selection* time — an energy-only
 * scheduler cannot correct for a carb-heavy pool afterwards, and every plan it
 * builds from one is rejected.
 *
 * Carbs and fat are budgeted the same way, for the reason protein was: a real
 * dish's energy is not free to land wherever, it comes as some mix of carbs,
 * protein and fat, and scaling a portion moves all four together. A scheduler
 * that only watched kcal and protein could hit both while carbs and fat drifted
 * however the pool happened to be built — which is exactly what real Spanish
 * dishes did, meat- and fish-heavy and starch-light, delivering a day short on
 * carbohydrate and over on fat by up to half, with nothing anywhere to catch it
 * because validation never checked the split either. Found on a real plan, not
 * in a test (`0045`).
 */
function slotBudgets(weights: ReadonlyMap<MealSlot, number>, targets: NutritionTargets, flatGrams = false): ReadonlyMap<MealSlot, SlotBudget> {
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0) || 1;

  return new Map(
    [...weights].map(([slot, weight]) => [
      slot,
      {
        carbsG: (targets.carbsG * weight) / total,
        fatG: (targets.fatG * weight) / total,
        // With accompaniments on, the flat ceiling again — see `SlotBudget.gramsMax`.
        ...(flatGrams ? { gramsMax: PLATE_GRAMS_MAX[slot] } : {}),
        kcal: (targets.kcal * weight) / total,
        proteinG: (targets.proteinG * weight) / total
      }
    ])
  );
}

/**
 * How well a dish fits a slot **once scaled to it**.
 *
 * Judging a candidate at one serving compares its raw size to the budget, and size
 * is the one thing scaling fixes for free — so that ranking preferred a
 * wrong-ratio dish of the right size over a right-ratio dish of the wrong size,
 * which is precisely backwards. Scaling first neutralises size and leaves the
 * comparison to be about composition, which is what cannot be fixed later.
 */
function scaledFitCost(perServing: PerServing, budget: SlotBudget, slot: MealSlot): number {
  return fitCost(scaleMacros(perServing, servingsFor(perServing, budget, slot)), budget);
}

/** The portion that best meets the slot's energy, within what a person can be served, `PLATE_LIMIT` and `PLATE_GRAMS_MAX`. */
function servingsFor(perServing: PerServing, budget: SlotBudget, slot: MealSlot): number {
  const servings = quantiseServings(perServing.kcal > 0 ? budget.kcal / perServing.kcal : 1);
  const sizes = plateServings(perServing, budget, slot);
  const [smallest, largest] = [sizes.at(0), sizes.at(-1)];

  // No admissible size: every caller has already refused such a dish (`fitsPlate`).
  if (smallest === undefined || largest === undefined) {
    return servings;
  }

  return Math.min(Math.max(servings, smallest), largest);
}

/**
 * Whether this many servings keep the plate inside `PLATE_LIMIT` of its share,
 * under `plateGramsMax` for its slot and share, and under `PLATE_FOOD_MAX` of
 * every capped food (`plateFoodMax`). The weights are checked even where the
 * share cannot be — a budget or a dish of no energy.
 *
 * `besideKcal` is what the meal's accompaniments carry: the share is the whole
 * meal's, since the share is what the meal is sized to, and the grams are the
 * plate's alone (`0008`: the ceiling is the plate's; what is beside it has fixed
 * portions and does not count).
 */
function withinPlateLimit(perServing: PerServing, servings: number, budget: SlotBudget, slot: MealSlot, besideKcal = 0): boolean {
  const light =
    perServing.grams * servings <= (budget.gramsMax ?? plateGramsMax(slot, budget.kcal)) + PLATE_EPSILON &&
    withinFoodMax(perServing, servings, budget, slot) &&
    sidesWithinShare(perServing, servings, besideKcal);

  if (budget.kcal <= 0 || perServing.kcal <= 0) {
    return light;
  }

  const share = (perServing.kcal * servings + besideKcal) / budget.kcal;

  return light && share >= PLATE_LIMIT.min - PLATE_EPSILON && share <= PLATE_LIMIT.max + PLATE_EPSILON;
}

/**
 * Whether no capped food on a plate of this size passes its ceiling. The share
 * scaling it is the meal's, accompaniments included, as for `plateGramsMax`;
 * the grams are the plate's alone — nothing beside it is a capped food.
 */
function withinFoodMax(perServing: PerServing, servings: number, budget: SlotBudget, slot: MealSlot): boolean {
  return foodsOf(perServing).every(([food, grams]) => grams * servings <= plateFoodMax(food, slot, budget.kcal) + PLATE_EPSILON);
}

/** `perServing.foods` as entries, listed once per serving rather than at every size a search tries. */
const FOOD_ENTRIES = new WeakMap<PerServing, readonly (readonly [PlateFood, number])[]>();

function foodsOf(perServing: PerServing): readonly (readonly [PlateFood, number])[] {
  let entries = FOOD_ENTRIES.get(perServing);

  if (!entries) {
    entries = Object.entries(perServing.foods) as [PlateFood, number][];
    FOOD_ENTRIES.set(perServing, entries);
  }

  return entries;
}

/**
 * `plateServings` already worked out, per budget (a plan builds each day's
 * once, and the share and its ceiling are all it reads of one), per serving,
 * and by the slot and what is beside the plate.
 */
const PLATE_SERVINGS = new WeakMap<SlotBudget, WeakMap<PerServing, Map<string, readonly number[]>>>();

/** Every quarter size inside `SERVING_BOUNDS`, `PLATE_LIMIT`, `PLATE_GRAMS_MAX` and `PLATE_FOOD_MAX`, smallest first. Empty when there is none. */
function plateServings(perServing: PerServing, budget: SlotBudget, slot: MealSlot, besideKcal = 0): readonly number[] {
  let byServing = PLATE_SERVINGS.get(budget);

  if (!byServing) {
    byServing = new WeakMap();
    PLATE_SERVINGS.set(budget, byServing);
  }

  let known = byServing.get(perServing);
  const key = besideKcal === 0 ? slot : `${slot}|${besideKcal}`;
  const cached = known?.get(key);

  if (cached) {
    return cached;
  }

  const sizes: number[] = [];

  for (let servings: number = SERVING_BOUNDS.min; servings <= SERVING_BOUNDS.max; servings = roundServings(servings + SERVING_STEP)) {
    if (withinPlateLimit(perServing, servings, budget, slot, besideKcal)) {
      sizes.push(servings);
    }
  }

  if (!known) {
    known = new Map();
    byServing.set(perServing, known);
  }

  known.set(key, sizes);

  return sizes;
}

/** Whether a dish can be served in this slot at all without breaking `PLATE_LIMIT`, `PLATE_GRAMS_MAX` or `PLATE_FOOD_MAX`. */
function fitsPlate(perServing: PerServing, budget: SlotBudget, slot: MealSlot): boolean {
  return plateServings(perServing, budget, slot).length > 0;
}

/** How far a dish sits from a budget, as a sum of relative errors. */
function fitCost(macros: Macros, budget: SlotBudget): number {
  const energy = budget.kcal > 0 ? Math.abs(macros.kcal - budget.kcal) / budget.kcal : 0;
  const protein = budget.proteinG > 0 ? Math.abs(macros.proteinG - budget.proteinG) / budget.proteinG : 0;
  const carbs = budget.carbsG > 0 ? Math.abs(macros.carbsG - budget.carbsG) / budget.carbsG : 0;
  const fat = budget.fatG > 0 ? Math.abs(macros.fatG - budget.fatG) / budget.fatG : 0;

  // Energy and protein keep their weights (10%/15% tolerance → 1.5/1, by
  // 1/tolerance normalised on protein's). Carbs and fat are new (`0045`) and
  // looser — 20% tolerance each, the same scale gives 0.75 — because a day's
  // carb/fat split is more a matter of what dishes exist than protein is, and
  // this is meant to steer the split, not police it to the gram. Before this,
  // carbs and fat were not fitted at all: two dishes tying on kcal and protein
  // were indistinguishable here however differently they spent that energy,
  // which is what let a whole pool's fat-heavy lean pass through every check
  // unnoticed.
  //
  // `0048` later tightened every band to 5%, which by this same rule means all
  // four weights are 1 — a stale mismatch this file never came back to fix,
  // and a candidate explanation for a real plan that measured 14/14 inside
  // every band with fat still sitting +3% to +4.9% on ten of them (owner,
  // 2026-09-26). Re-weighting was tried and measured against the real library
  // (`docs/decisions/LOG.md`): every variant that raised fat's weight without
  // raising carbs' by the same amount regressed a real profile's variety or
  // worst-case deviation; equal weights avoided that but cost kcal precision
  // on every profile for a wash on the combined figure, not the clear win the
  // owner's bar requires. Left as measured, not changed.
  return energy * 1.5 + protein + carbs * 0.75 + fat * 0.75;
}

/**
 * One serving of a dish: its macros, what it weighs on the plate — cooked, as
 * the recipe stores it — and the grams of each `PLATE_FOOD_MAX` food in it.
 */
type PerServing = Macros & { readonly foods: Readonly<Partial<Record<PlateFood, number>>>; readonly grams: number };

/**
 * Per-serving macros and grams for every dish whose ingredients all resolve. A
 * dish referencing an unknown slug is silently absent rather than crashing the
 * scheduler — the pool builder in phase 3 is what rejects and retries those, and
 * by the time a pool reaches here it should contain none.
 */
function perServingIndex(pool: readonly CandidateDish[], catalogue: Catalogue): ReadonlyMap<string, PerServing> {
  const index = new Map<string, PerServing>();

  for (const dish of pool) {
    const composed = composePerServing(dish, catalogue);

    if (composed.ok) {
      const servings = dish.servings || 1;
      const grams = dish.ingredients.reduce((sum, item) => sum + item.grams, 0) / servings;
      const foods = Object.fromEntries(Object.entries(plateFoods(dish.ingredients, catalogue)).map(([food, total]) => [food, total / servings]));

      index.set(dish.slug, { ...composed.macros, foods, grams });
    }
  }

  return index;
}

/** Each pool dish's main protein, by slug — see `mainProtein`. */
type ProteinIndex = ReadonlyMap<string, string | null>;

/**
 * The kind rules (`KindRule`) the scheduler prices — pasta, rice and grains
 * (`STARCH_RULES`), the same legume (`LEGUME_RULES`), the same kind of snack
 * (`SNACK_RULES`) — each over the pool's index, and the plan's length their
 * caps are scaled to. A swap or a rebuild knows the starch and the legume of
 * the meals it keeps (`Placement`); a kept snack outside the pool counts for
 * nothing, as a kept protein does.
 *
 * `capped` is the one check whose cap is held, not priced (`STARCH_CAP_WEIGHT`,
 * `0081`): pasta, rice and grains four times a fortnight.
 */
type KindRules = { readonly capped: KindCheck; readonly checks: readonly KindCheck[]; readonly days: number };

function kindRules(pool: readonly CandidateDish[], catalogue: Catalogue, days: number): KindRules {
  const capped = starchCheck(starchIndex(pool));

  return { capped, checks: [capped, legumeCheck(legumeIndex(pool)), snackCheck(pool, catalogue)], days };
}

/** How many of these placements are past the capped starches' four a fortnight (`KindRules.capped`). */
function pastStarchCap(placements: readonly Placement[], kinds: KindRules): number {
  return kindPastCap(kindMeals(placements, kinds.capped), kinds.days, kinds.capped.rule);
}

/** Whether a dish at a slot would take its pasta, rice or grains past the cap, over these meals of the capped check. */
function atStarchCap(slug: string, slot: MealSlot, cappedMeals: readonly KindMeal[], kinds: KindRules): boolean {
  return countsFor(kinds.capped, slug, slot) && kindAtCap(kinds.capped.index.get(slug), cappedMeals, kinds.days, kinds.capped.rule);
}

/** Whether a pool dish may be served on a day: its fresh fruit in that day's month (`SchedulerInput.monthOf`). */
type Seasonal = (slug: string, dayIndex: number) => boolean;

function seasonFor(input: SchedulerInput): Seasonal {
  const { monthOf } = input;

  if (!monthOf) {
    return () => true;
  }

  const dishes = new Map(input.pool.map(dish => [dish.slug, dish]));
  const known = new Map<string, boolean>();

  return (slug, dayIndex) => {
    const key = `${slug}|${monthOf(dayIndex)}`;
    let fits = known.get(key);

    if (fits === undefined) {
      const dish = dishes.get(slug);

      fits = dish === undefined || outOfSeasonFruit(dish, input.catalogue, monthOf(dayIndex)) === null;
      known.set(key, fits);
    }

    return fits;
  };
}

/** Whether a dish at a slot has any kind the rules count — only a swap that brings one in or takes one out can move their cost. */
function countsForAny(kinds: KindRules, slug: string, slot: MealSlot): boolean {
  return kinds.checks.some(check => countsFor(check, slug, slot));
}

/** What the kind rules see of a dish at a slot: its kind under each, or nothing. */
function kindsKey(kinds: KindRules, slug: string, slot: MealSlot): string {
  return kinds.checks.map(check => (countsFor(check, slug, slot) ? (check.index.get(slug) ?? '') : '')).join('|');
}

function proteinIndex(pool: readonly CandidateDish[], catalogue: Catalogue): ProteinIndex {
  return new Map(pool.map(dish => [dish.slug, mainProtein(dish, catalogue)]));
}

/** A day's meal as the protein rules see it: its main protein, and which meal it is. */
type ProteinMeal = { readonly protein: string | null; readonly slot: MealSlot };

/**
 * Meals per main protein over a plan, within each meal of it (keyed
 * `slot:protein`), and at lunch and dinner within each week of it (keyed
 * `week:protein`, `planWeek`).
 */
type ProteinCounts = {
  readonly bySlot: ReadonlyMap<string, number>;
  readonly mainsByWeek: ReadonlyMap<string, number>;
  readonly plan: ReadonlyMap<string, number>;
};

const NO_PROTEIN_COUNTS: ProteinCounts = { bySlot: new Map(), mainsByWeek: new Map(), plan: new Map() };

/** Meals per main protein in these placements. A dish from outside the pool counts for nothing. */
function proteinCounts(placements: readonly Placement[], proteins: ProteinIndex): ProteinCounts {
  const plan = new Map<string, number>();
  const bySlot = new Map<string, number>();
  const mainsByWeek = new Map<string, number>();

  for (const placement of placements) {
    const protein = proteins.get(placement.dishSlug);

    if (protein) {
      plan.set(protein, (plan.get(protein) ?? 0) + 1);
      bySlot.set(`${placement.slot}:${protein}`, (bySlot.get(`${placement.slot}:${protein}`) ?? 0) + 1);

      if (MAIN_SLOTS.has(placement.slot)) {
        const key = `${planWeek(placement.dayIndex)}:${protein}`;

        mainsByWeek.set(key, (mainsByWeek.get(key) ?? 0) + 1);
      }
    }
  }

  return { bySlot, mainsByWeek, plan };
}

/** Lunches and dinners past `PROTEIN_RULES.perMainsWeek`, over every week and protein of these placements. */
function mainsWeekExcess(placements: readonly Placement[], proteins: ProteinIndex): number {
  let excess = 0;

  for (const count of proteinCounts(placements, proteins).mainsByWeek.values()) {
    excess += Math.max(0, count - PROTEIN_RULES.perMainsWeek);
  }

  return excess;
}

/**
 * How many of one day's meals break `PROTEIN_RULES`, given the rest of the
 * plan — each meal once per rule it breaks: a repeat inside the day, a meal
 * past the fortnight's cap, a meal past the three its slot may have.
 *
 * Counted by the meal, never by how far the plan is already over. Summed as the
 * overshoot, a slot six hake dinners past its line made one more hake cost as
 * much as four repeats — enough to buy a day 10% off its energy on the
 * end-to-end suite's three-protein dinners. A meal over the line is one meal.
 */
function proteinExcess(day: readonly ProteinMeal[], elsewhere: ProteinCounts, cap: number, week: number): number {
  const counts = new Map<string, number>();
  const mains = new Map<string, number>();
  let excess = 0;

  for (const { protein, slot } of day) {
    if (protein) {
      counts.set(protein, (counts.get(protein) ?? 0) + 1);
      // A day has one meal per slot, so this meal is the slot's only addition.
      excess += (elsewhere.bySlot.get(`${slot}:${protein}`) ?? 0) >= PROTEIN_RULES.perSlot ? 1 : 0;

      if (MAIN_SLOTS.has(slot)) {
        mains.set(protein, (mains.get(protein) ?? 0) + 1);
      }
    }
  }

  for (const [protein, count] of counts) {
    const room = Math.max(0, cap - (elsewhere.plan.get(protein) ?? 0));

    excess += Math.max(0, count - PROTEIN_RULES.perDay) + Math.max(0, count - room);
  }

  for (const [protein, count] of mains) {
    const room = Math.max(0, PROTEIN_RULES.perMainsWeek - (elsewhere.mainsByWeek.get(`${week}:${protein}`) ?? 0));

    excess += Math.max(0, count - room);
  }

  return excess;
}

/** Whether this dish would repeat a main protein the day already has, or pass its fortnight's, its meal's or its week's allowance. */
function crowded(
  slug: string,
  at: { readonly dayIndex: number; readonly slot: MealSlot },
  placed: readonly Placement[],
  proteins: ProteinIndex,
  cap: number
): boolean {
  const protein = proteins.get(slug);

  if (!protein) {
    return false;
  }

  let today = 0;
  let inPlan = 0;
  let inSlot = 0;
  let inWeek = 0;
  const main = MAIN_SLOTS.has(at.slot);

  for (const placement of placed) {
    if (proteins.get(placement.dishSlug) === protein) {
      inPlan += 1;
      today += placement.dayIndex === at.dayIndex ? 1 : 0;
      inSlot += placement.slot === at.slot ? 1 : 0;
      inWeek += main && MAIN_SLOTS.has(placement.slot) && planWeek(placement.dayIndex) === planWeek(at.dayIndex) ? 1 : 0;
    }
  }

  return today >= PROTEIN_RULES.perDay || inPlan >= cap || inSlot >= PROTEIN_RULES.perSlot || inWeek >= PROTEIN_RULES.perMainsWeek;
}

/**
 * Least-used first, then closest fit, then slug.
 *
 * Ranking on fit alone is the obvious implementation and it is wrong: it spends
 * the best-fitting dishes in the first few days and leaves the fortnight's tail
 * to whatever is left, so day 14 misses its target by hundreds of calories. A
 * test caught exactly that. Usage-first spreads the pool evenly, which both
 * keeps late days in band and makes the plan read as varied rather than
 * front-loaded.
 */
function pickBest(
  eligible: readonly CandidateDish[],
  budget: SlotBudget,
  perServing: ReadonlyMap<string, PerServing>,
  placed: readonly Placement[],
  dayIndex: number,
  slot: MealSlot,
  crowds: (slug: string) => number
): CandidateDish | undefined {
  // A dish that would repeat a main protein, a capped starch or a legume (`STARCH_RULES`, `LEGUME_RULES`), is priced as
  // fitting that much worse per rule (`PROTEIN_REPEAT_WEIGHT`): another dish wins if it fits nearly as
  // well, and the repeat is served when nothing does. A dish already served
  // elsewhere in the plan carries the same kind of cost (`DISH_REPEAT_WEIGHT`)
  // — usage already sorts a first-served dish ahead of a repeat, so this only
  // ever breaks a tie between two dishes at the same usage count, one of
  // which sits closer to `PREFERRED_MAIN_GAP` than the other.
  const repeatCost = new Map(
    eligible.map(dish => [dish.slug, crowds(dish.slug) * PROTEIN_REPEAT_WEIGHT + reuseCost(dish.slug, slot, dayIndex, placed)])
  );
  const usage = new Map<string, number>();
  // Where each dish sat in the pool handed to the scheduler, which is the order
  // rotation shuffled for this user.
  const order = new Map(eligible.map((dish, index) => [dish.slug, index]));

  for (const placement of placed) {
    usage.set(placement.dishSlug, (usage.get(placement.dishSlug) ?? 0) + 1);
  }

  return [...eligible]
    .sort((a, b) => {
      const used = (usage.get(a.slug) ?? 0) - (usage.get(b.slug) ?? 0);

      if (used !== 0) {
        return used;
      }

      const first = perServing.get(a.slug);
      const second = perServing.get(b.slug);
      const costA = (first ? scaledFitCost(first, budget, slot) : Number.MAX_VALUE) + (repeatCost.get(a.slug) ?? 0);
      const costB = (second ? scaledFitCost(second, budget, slot) : Number.MAX_VALUE) + (repeatCost.get(b.slug) ?? 0);

      /*
       * Two dishes that fit this budget equally well are decided by the order
       * the pool arrived in — which is this user's own seeded shuffle (`0009`).
       *
       * It used to be the alphabet, and that was the bug two users reported as
       * "we got the same plan": the pool is shuffled per person, but sorting it
       * again by fit and then by slug threw that away, so the best-fitting dish
       * on the shelf landed on day one of everybody drawing from it. Their
       * fortnights differed; their first days did not.
       */
      return Math.abs(costA - costB) > FIT_TIE ? costA - costB : (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0);
    })
    .at(0);
}

type Pick = {
  readonly base: PerServing;
  readonly dish: CandidateDish;
  readonly servings: number;
  /** What is beside the plate, once the day's search has chosen it; absent is nothing. Cleared whenever the dish changes. */
  readonly set?: AccompanimentSet;
  readonly slot: MealSlot;
  readonly sortOrder: number;
};

/** One meal's energy at a size and beside a set — the plate's own, or a set the search is trying. */
function mealKcal(pick: Pick, servings: number, set: AccompanimentSet | undefined = pick.set): number {
  return pick.base.kcal * servings + (set?.macros.kcal ?? 0);
}

/** One meal's part of a day's cost, at one size beside one set (`balancedDay`). */
type Term = {
  /** What the set beside it carries, zero for none. */
  readonly beside: Macros;
  /** The meal's energy: the plate and what is beside it. */
  readonly meal: number;
  readonly misses: number;
  /** The plate's own macros at this size. */
  readonly plate: Macros;
  /** How far outside `SHARE_BAND` the meal sits; zero inside it. */
  readonly stray: number;
  readonly tenths: number;
};

/** A day's cost so far, summed meal by meal. */
type DaySums = Macros & { readonly misses: number; readonly strays: number; readonly tenths: number };

const NO_SUMS: DaySums = { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, misses: 0, proteinG: 0, strays: 0, tenths: 0 };

/** The sums with one more meal: plate first, then what is beside it, as a day has always added them. */
function addTerm(sums: DaySums, term: Term): DaySums {
  return {
    carbsG: sums.carbsG + term.plate.carbsG + term.beside.carbsG,
    fatG: sums.fatG + term.plate.fatG + term.beside.fatG,
    fiberG: sums.fiberG + term.plate.fiberG + term.beside.fiberG,
    kcal: sums.kcal + term.plate.kcal + term.beside.kcal,
    misses: sums.misses + term.misses,
    proteinG: sums.proteinG + term.plate.proteinG + term.beside.proteinG,
    strays: sums.strays + term.stray,
    tenths: sums.tenths + term.tenths
  };
}

/**
 * What the meals from one onwards can still add to a day, whatever options
 * they take: each macro's least and most, the most tenths of energy, and the
 * least strays and serving misses. What `balancedDay` bounds a branch by.
 */
type RemainingRange = { readonly high: Macros; readonly low: Macros; readonly misses: number; readonly strays: number; readonly tenths: number };

/**
 * How far a bound may sit above the cost it bounds and still prune, relative
 * to that cost. A bound is summed in another order than the leaf it bounds, so
 * it can be a few units in the last place high; this is far above that, and
 * far below any difference in cost the search decides on.
 */
const BOUND_SLACK = 1e-9;

const MACRO_KEYS = ['carbsG', 'fatG', 'fiberG', 'kcal', 'proteinG'] as const;

/** `RemainingRange` from every meal onwards, the last one empty. */
function remainingRanges(options: readonly (readonly { readonly term: Term }[])[]): readonly RemainingRange[] {
  const zero: Macros = { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 };
  const ranges: RemainingRange[] = [{ high: zero, low: zero, misses: 0, strays: 0, tenths: 0 }];

  for (let index = options.length - 1; index >= 0; index -= 1) {
    const after = ranges[0] as RemainingRange;
    const high = { ...after.high };
    const low = { ...after.low };
    let misses = Number.POSITIVE_INFINITY;
    let strays = Number.POSITIVE_INFINITY;
    let tenths = Number.NEGATIVE_INFINITY;
    // Each macro's most and least this meal adds, found in one pass over its options.
    const most = {
      carbsG: Number.NEGATIVE_INFINITY,
      fatG: Number.NEGATIVE_INFINITY,
      fiberG: Number.NEGATIVE_INFINITY,
      kcal: Number.NEGATIVE_INFINITY,
      proteinG: Number.NEGATIVE_INFINITY
    };
    const least = {
      carbsG: Number.POSITIVE_INFINITY,
      fatG: Number.POSITIVE_INFINITY,
      fiberG: Number.POSITIVE_INFINITY,
      kcal: Number.POSITIVE_INFINITY,
      proteinG: Number.POSITIVE_INFINITY
    };

    for (const { term } of options[index] ?? []) {
      for (const key of MACRO_KEYS) {
        const added = term.plate[key] + term.beside[key];

        most[key] = Math.max(most[key], added);
        least[key] = Math.min(least[key], added);
      }

      misses = Math.min(misses, term.misses);
      strays = Math.min(strays, term.stray);
      tenths = Math.max(tenths, term.tenths);
    }

    for (const key of MACRO_KEYS) {
      high[key] += most[key];
      low[key] += least[key];
    }

    ranges.unshift({ high, low, misses: after.misses + misses, strays: after.strays + strays, tenths: after.tenths + tenths });
  }

  return ranges;
}

/**
 * Each dish's window, in quarter steps, under a ceiling on the combinations
 * the day will price — see `BALANCE_MAX_COMBOS`.
 *
 * Grown a step at a time, biggest meal first, round after round, until the
 * next step would pass the ceiling or every window is whole. So the windows
 * stay even, and when they cannot all be whole it is the lighter meals that
 * are sized more coarsely. Deterministic: ties keep slot order.
 */
function windowsFor(picks: readonly Pick[], budgets: ReadonlyMap<MealSlot, SlotBudget>, maxCombos: number, sets: readonly number[] = []): number[] {
  const order = picks.map((pick, index) => ({ index, kcal: budgets.get(pick.slot)?.kcal ?? 0 })).sort((a, b) => b.kcal - a.kcal || a.index - b.index);
  const windows = picks.map(() => 0);
  // Each meal offered accompaniments multiplies the day by its sets, before any window.
  let combos = sets.reduce((product, count) => product * count, 1);
  let grew = true;

  while (grew) {
    grew = false;

    for (const { index } of order) {
      const window = windows[index] ?? 0;
      const next = (combos / (2 * window + 1)) * (2 * window + 3);

      if (window < BALANCE_WINDOW_STEPS && next <= maxCombos) {
        windows[index] = window + 1;
        combos = next;
        grew = true;
      }
    }
  }

  return windows;
}

/**
 * How far a day's portions break the order of its meals' sizes — zero while a
 * meal the person said should be bigger is bigger (`SHARE_ORDER_GAP`). At the
 * sizes given, or each pick's own.
 */
function inversionsOf(
  picks: readonly Pick[],
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  servings: readonly number[] = [],
  sets: readonly (AccompanimentSet | undefined)[] = []
): number {
  let inversions = 0;

  for (const [i, bigger] of picks.entries()) {
    const biggerBudget = budgets.get(bigger.slot)?.kcal ?? 0;

    for (const [j, smaller] of picks.entries()) {
      const smallerBudget = budgets.get(smaller.slot)?.kcal ?? 0;

      if (i === j || biggerBudget <= 0 || biggerBudget < smallerBudget * (1 + SHARE_ORDER_GAP)) {
        continue;
      }

      const biggerKcal = mealKcal(bigger, servings[i] ?? bigger.servings, sets[i] ?? bigger.set);
      const smallerKcal = mealKcal(smaller, servings[j] ?? smaller.servings, sets[j] ?? smaller.set);

      // Level counts as out of order: a light dinner the size of the normal
      // breakfast is not lighter. With `SHARE_BAND` pulling every meal towards
      // its share, two meals of one dish landed on exactly the same size.
      if (smallerKcal >= biggerKcal) {
        inversions += 1 + (smallerKcal - biggerKcal) / biggerBudget;
      }
    }
  }

  return inversions;
}

/**
 * Sizes a day's portions to its targets, a quarter serving at a time — every
 * combination, not a walk.
 *
 * Each slot's serving is first quantised independently against its own share
 * of the day, so four slots each rounding a little the same way can put the
 * day well outside its band. This used to correct that greedily: one quarter
 * step per pass, whichever helped most, until a pass helped nothing. Greedy
 * stops at the first local minimum, and with four macros to satisfy at once
 * there are many — a day that could have landed inside 5% on everything sat at
 * 8% on fat because no single quarter step improved the sum, though a pair of
 * opposite steps on two dishes would have. So the search is now exhaustive
 * inside a window around each dish's starting size (`BALANCE_WINDOW_STEPS`),
 * and the day takes the combination with the lowest cost.
 *
 * Deterministic: combinations are visited in slot order, and a tie keeps the
 * earlier one, so the same day always sizes the same way.
 */
function balanceDay(
  picks: readonly Pick[],
  targets: NutritionTargets,
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  minimumKcal: number,
  sides?: Sides
): readonly Pick[] {
  return balancedDay(picks, targets, budgets, minimumKcal, false, sides).picks;
}

/**
 * `balanceDay`, and what the day costs once sized — the number a swap is judged by.
 *
 * With accompaniments (`sides`), a meal that takes them is searched over its
 * sets as well as its sizes: each set brings its own window of sizes, centred
 * where the plate was less what the set carries, and the day takes the best
 * combination of both. So bread and a smaller plate compete with a bigger
 * plate on the day's own macros, never chosen afterwards around sizes already
 * fixed (`0008`, the lesson of `0045`'s greedy pass). Every plate also pays
 * `SERVING_PREFERENCE` then.
 */
function balancedDay(
  picks: readonly Pick[],
  targets: NutritionTargets,
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  minimumKcal: number,
  banded = false,
  sides?: Sides
): { readonly cost: number; readonly picks: readonly Pick[] } {
  const noBudget = { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
  // Per pick, the sets the search may give it: its own (none, or the one it
  // carries) unless it takes accompaniments.
  const offered: readonly (readonly (AccompanimentSet | undefined)[])[] = picks.map(
    pick => sides?.setsOf(pick, budgets.get(pick.slot) ?? noBudget) ?? [pick.set]
  );

  // What does not change between combinations, worked out once: each meal's
  // share, and the pairs whose order the person set (`SHARE_ORDER_GAP`), in the
  // order `inversionsOf` visits them — so the sums below are its sums, to the bit.
  const shares = picks.map(pick => budgets.get(pick.slot)?.kcal ?? 0);
  const ordered: { readonly bigger: number; readonly budget: number; readonly smaller: number }[] = [];

  for (const [i] of picks.entries()) {
    const biggerBudget = shares[i] ?? 0;

    for (const [j] of picks.entries()) {
      const smallerBudget = shares[j] ?? 0;

      if (i === j || biggerBudget <= 0 || biggerBudget < smallerBudget * (1 + SHARE_ORDER_GAP)) {
        continue;
      }

      ordered.push({ bigger: i, budget: biggerBudget, smaller: j });
    }
  }

  const kcals: number[] = picks.map(() => 0);
  const target = { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG };

  // One meal's part of the day's cost at a size and beside a set — worked out
  // once per option of the search, not again at every combination holding it.
  const termOf = (index: number, factor: number, set: AccompanimentSet | undefined): Term => {
    const pick = picks[index] as Pick;
    const beside = (set ?? pick.set)?.macros;
    const plate = pick.base.kcal * factor;
    const meal = plate + (beside?.kcal ?? 0);
    const budget = shares[index] ?? 0;
    const share = budget > 0 ? meal / budget : 0;

    return {
      beside: {
        carbsG: beside?.carbsG ?? 0,
        fatG: beside?.fatG ?? 0,
        fiberG: beside?.fiberG ?? 0,
        kcal: beside?.kcal ?? 0,
        proteinG: beside?.proteinG ?? 0
      },
      meal,
      misses: servingMiss(factor),
      plate: {
        carbsG: pick.base.carbsG * factor,
        fatG: pick.base.fatG * factor,
        fiberG: pick.base.fiberG * factor,
        kcal: plate,
        proteinG: pick.base.proteinG * factor
      },
      // Zero inside the band: adding it is adding nothing, to the bit.
      stray: budget <= 0 ? 0 : share < SHARE_BAND.min ? SHARE_BAND.min - share : share > SHARE_BAND.max ? share - SHARE_BAND.max : 0,
      tenths: Math.round(plate * 10) + Math.round((beside?.kcal ?? 0) * 10)
    };
  };

  // `fitCost` + bands + `inversionsOf` + strays + `SERVING_PREFERENCE` +
  // `floorMiss(deliveredKcal)`, for the sizes and sets given.
  const dayCost = (servings: readonly number[], sets: readonly (AccompanimentSet | undefined)[] = []): number => {
    let sums = NO_SUMS;

    for (const [index, pick] of picks.entries()) {
      const term = termOf(index, servings[index] ?? pick.servings, sets[index] ?? pick.set);

      sums = addTerm(sums, term);
      kcals[index] = term.meal;
    }

    return closingCost(sums.carbsG, sums.fatG, sums.fiberG, sums.kcal, sums.misses, sums.proteinG, sums.strays, sums.tenths);
  };

  // The day's cost once every meal's term is summed and `kcals` holds each meal's
  // energy. The sums come in one by one, so the last meal's options need no object.
  const closingCost = (
    carbsG: number,
    fatG: number,
    fiberG: number,
    kcal: number,
    misses: number,
    proteinG: number,
    strays: number,
    tenths: number
  ): number => {
    // A meal the person said should be bigger must stay bigger — see
    // `SHARE_ORDER_GAP`. Priced as a hinge on every ordered pair.
    let inversions = 0;

    for (const pair of ordered) {
      const biggerKcal = kcals[pair.bigger] ?? 0;
      const smallerKcal = kcals[pair.smaller] ?? 0;

      if (smallerKcal >= biggerKcal) {
        inversions += 1 + (smallerKcal - biggerKcal) / pair.budget;
      }
    }

    const totals = { carbsG, fatG, fiberG, kcal, proteinG };

    return (
      fitCost(totals, target) +
      (banded ? bandMiss(totals, targets) * BAND_MISS_WEIGHT : 0) +
      inversions * (banded ? ORDER_OUTRANKS_BANDS : SHARE_INVERSION_WEIGHT) +
      strays * SHARE_BAND_WEIGHT +
      (sides ? misses * SERVING_PREFERENCE_WEIGHT : 0) +
      floorMiss(tenths / 10, minimumKcal) * FLOOR_OUTRANKS_ORDER
    );
  };

  // The sizes each dish may take: its own, and up to its window either side,
  // never past what a person can be served — and, unless `limited` is false,
  // never outside `PLATE_LIMIT` or over `PLATE_GRAMS_MAX`. Beside a set, the
  // window is centred where the set leaves the plate.
  const windows = windowsFor(
    picks,
    budgets,
    banded ? SPREAD_MAX_COMBOS : BALANCE_MAX_COMBOS,
    offered.map(sets => sets.length)
  );
  type Option = { readonly servings: number; readonly set: AccompanimentSet | undefined; readonly term: Term };
  const optionsFor = (limited: boolean): Option[][] =>
    picks.map((pick, index) => {
      const options: Option[] = [];
      const window = windows[index] ?? 0;
      const budget = budgets.get(pick.slot) ?? noBudget;

      for (const set of offered[index] ?? [pick.set]) {
        const centre =
          set === pick.set || pick.base.kcal <= 0
            ? pick.servings
            : quantiseServings(pick.servings + ((pick.set?.macros.kcal ?? 0) - (set?.macros.kcal ?? 0)) / pick.base.kcal);

        for (let step = -window; step <= window; step += 1) {
          const servings = roundServings(centre + step * SERVING_STEP);

          if (
            servings >= SERVING_BOUNDS.min &&
            servings <= SERVING_BOUNDS.max &&
            // The sides' share holds even where the floor lifts the plate's limits.
            sidesWithinShare(pick.base, servings, set?.macros.kcal ?? 0) &&
            (!limited || withinPlateLimit(pick.base, servings, budget, pick.slot, set?.macros.kcal ?? 0))
          ) {
            options.push({ servings, set, term: termOf(index, servings, set) });
          }
        }
      }

      // Nothing admissible in the window only for a dish with no admissible size
      // at all — `servingsFor` sizes every other one inside the limit, and its
      // own size is always in its window. It keeps that size.
      return options.length > 0 ? options : [{ servings: pick.servings, set: pick.set, term: termOf(index, pick.servings, pick.set) }];
    });

  // The day as it stands is the one to beat, when its plates are inside the
  // limit — a tie keeps it, as it always has.
  const inside = picks.every(pick =>
    withinPlateLimit(pick.base, pick.servings, budgets.get(pick.slot) ?? noBudget, pick.slot, pick.set?.macros.kcal ?? 0)
  );
  let best: readonly number[] = picks.map(pick => pick.servings);
  let bestSets: readonly (AccompanimentSet | undefined)[] = picks.map(pick => pick.set);
  let bestCost = inside ? dayCost(best, bestSets) : Number.POSITIVE_INFINITY;

  // Every combination, in slot order. The sums run down the recursion, one
  // meal a level, in the order `dayCost` adds them — so each leaf's cost is
  // `dayCost`'s for that combination, to the bit, without summing its prefix again.
  //
  // A branch is left unvisited only when no leaf under it can beat the best so
  // far (`lowestBelow`, less `BOUND_SLACK`): a leaf there could only have lost,
  // so the combination chosen — the first of the lowest cost — is the one the
  // whole search would choose.
  const search = (options: readonly (readonly Option[])[]): void => {
    const sizes: number[] = picks.map(pick => pick.servings);
    const sets: (AccompanimentSet | undefined)[] = picks.map(pick => pick.set);
    const rest = remainingRanges(options);
    const distance = (sum: number, low: number, high: number, wanted: number): number =>
      wanted <= 0 ? 0 : sum + low > wanted ? (sum + low - wanted) / wanted : sum + high < wanted ? (wanted - sum - high) / wanted : 0;

    // The least any leaf under this prefix can cost: each macro's reachable
    // range against its target, what the prefix and the cheapest remaining
    // options already miss, the ordered pairs already placed, and the floor
    // at the most energy still reachable. `bandMiss` is taken as nothing.
    const lowestBelow = (index: number, sums: DaySums): number => {
      const range = rest[index] as RemainingRange;

      return (
        distance(sums.kcal, range.low.kcal, range.high.kcal, target.kcal) * 1.5 +
        distance(sums.proteinG, range.low.proteinG, range.high.proteinG, target.proteinG) +
        distance(sums.carbsG, range.low.carbsG, range.high.carbsG, target.carbsG) * 0.75 +
        distance(sums.fatG, range.low.fatG, range.high.fatG, target.fatG) * 0.75 +
        placedInversions(index) +
        unfitted(sums, range)
      );
    };

    // What the ordered pairs already placed cost, priced as `closingCost` prices them.
    const placedInversions = (index: number): number => {
      let inversions = 0;

      for (const pair of ordered) {
        if (pair.bigger < index && pair.smaller < index) {
          const biggerKcal = kcals[pair.bigger] ?? 0;
          const smallerKcal = kcals[pair.smaller] ?? 0;

          if (smallerKcal >= biggerKcal) {
            inversions += 1 + (smallerKcal - biggerKcal) / pair.budget;
          }
        }
      }

      return inversions * (banded ? ORDER_OUTRANKS_BANDS : SHARE_INVERSION_WEIGHT);
    };

    // The least the strays, the serving misses and the floor can still add.
    const unfitted = (sums: DaySums, range: RemainingRange): number => {
      const reachable = (sums.tenths + range.tenths) / 10;

      return (
        (sums.strays + range.strays) * SHARE_BAND_WEIGHT +
        (sides ? (sums.misses + range.misses) * SERVING_PREFERENCE_WEIGHT : 0) +
        (reachable < minimumKcal ? floorMiss(reachable, minimumKcal) * FLOOR_OUTRANKS_ORDER : 0)
      );
    };

    // The least `fitCost` the last meal can leave beside one set, at any size
    // between `low` and `high` — not only the quarter steps. Every macro moves
    // with the one size, so the macros cannot each find their target at a
    // different size, as the ranges let them: the cost is convex in the size,
    // and its least is at an end or where a macro meets its target.
    const lowestFit = (sums: DaySums, beside: Macros, low: number, high: number): number => {
      // Each macro's miss at size zero; at a size, the miss plus the plate's share of it.
      const kcal = sums.kcal + beside.kcal - target.kcal;
      const proteinG = sums.proteinG + beside.proteinG - target.proteinG;
      const carbsG = sums.carbsG + beside.carbsG - target.carbsG;
      const fatG = sums.fatG + beside.fatG - target.fatG;
      const at = (size: number): number => (size > low && size < high ? fitAlong(size, kcal, proteinG, carbsG, fatG) : Number.POSITIVE_INFINITY);

      return Math.min(
        fitAlong(low, kcal, proteinG, carbsG, fatG),
        fitAlong(high, kcal, proteinG, carbsG, fatG),
        at(-kcal / lastBase.kcal),
        at(-proteinG / lastBase.proteinG),
        at(-carbsG / lastBase.carbsG),
        at(-fatG / lastBase.fatG)
      );
    };

    // `fitCost` of the day with the last meal at a size, from each macro's miss without it.
    const fitAlong = (size: number, kcal: number, proteinG: number, carbsG: number, fatG: number): number =>
      (target.kcal > 0 ? (Math.abs(kcal + lastBase.kcal * size) / target.kcal) * 1.5 : 0) +
      (target.proteinG > 0 ? Math.abs(proteinG + lastBase.proteinG * size) / target.proteinG : 0) +
      (target.carbsG > 0 ? (Math.abs(carbsG + lastBase.carbsG * size) / target.carbsG) * 0.75 : 0) +
      (target.fatG > 0 ? (Math.abs(fatG + lastBase.fatG * size) / target.fatG) * 0.75 : 0);

    const last = picks.length - 1;
    const lastBase: Macros = picks[last]?.base ?? { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 };
    // The last meal's options, a run per set — the order they were offered in —
    // each with the range it alone can add: a run that cannot win is not priced.
    const runs: {
      readonly beside: Macros;
      readonly from: number;
      readonly high: number;
      readonly low: number;
      readonly range: RemainingRange;
      readonly to: number;
    }[] = [];
    const lastOptions = options[last] ?? [];

    for (let from = 0; from < lastOptions.length;) {
      let to = from + 1;

      while (to < lastOptions.length && lastOptions[to]?.set === lastOptions[from]?.set) {
        to += 1;
      }

      const run = lastOptions.slice(from, to);

      runs.push({
        beside: (run[0] as Option).term.beside,
        from,
        high: Math.max(...run.map(option => option.servings)),
        low: Math.min(...run.map(option => option.servings)),
        range: remainingRanges([run])[0] as RemainingRange,
        to
      });
      from = to;
    }

    const visit = (index: number, sums: DaySums): void => {
      if (index === picks.length) {
        const cost = closingCost(sums.carbsG, sums.fatG, sums.fiberG, sums.kcal, sums.misses, sums.proteinG, sums.strays, sums.tenths);

        if (cost < bestCost) {
          bestCost = cost;
          best = [...sizes];
          bestSets = [...sets];
        }

        return;
      }

      if (index > 0 && lowestBelow(index, sums) > bestCost + BOUND_SLACK * (1 + Math.abs(bestCost))) {
        return;
      }

      // The last meal's options are the leaves, most of the search: each is
      // summed in place, as `addTerm` sums it, and priced without a call a leaf.
      if (index === last) {
        const placed = placedInversions(index);

        for (const run of runs) {
          if (
            lowestFit(sums, run.beside, run.low, run.high) + placed + unfitted(sums, run.range) >
            bestCost + BOUND_SLACK * (1 + Math.abs(bestCost))
          ) {
            continue;
          }

          for (let at = run.from; at < run.to; at += 1) {
            const option = lastOptions[at] as Option;
            const { beside, plate } = option.term;

            kcals[index] = option.term.meal;

            const cost = closingCost(
              sums.carbsG + plate.carbsG + beside.carbsG,
              sums.fatG + plate.fatG + beside.fatG,
              sums.fiberG + plate.fiberG + beside.fiberG,
              sums.kcal + plate.kcal + beside.kcal,
              sums.misses + option.term.misses,
              sums.proteinG + plate.proteinG + beside.proteinG,
              sums.strays + option.term.stray,
              sums.tenths + option.term.tenths
            );

            if (cost < bestCost) {
              sizes[index] = option.servings;
              sets[index] = option.set;
              bestCost = cost;
              best = [...sizes];
              bestSets = [...sets];
            }
          }
        }

        return;
      }

      for (const option of options[index] ?? []) {
        sizes[index] = option.servings;
        sets[index] = option.set;
        kcals[index] = option.term.meal;
        visit(index + 1, addTerm(sums, option.term));
      }
    };

    visit(0, NO_SUMS);
  };

  search(optionsFor(true));

  // The energy floor outranks `PLATE_LIMIT` (`0076`), `PLATE_GRAMS_MAX`
  // (`0078`) and `PLATE_FOOD_MAX` (016): when no combination inside both reaches it, the day is searched once more at every size a person
  // can be served, and `FLOOR_OUTRANKS_ORDER` decides as it always has.
  if (floorMiss(deliveredKcal(picks, best, bestSets), minimumKcal) > 0) {
    search(optionsFor(false));
  }

  return {
    cost: bestCost,
    picks: picks.map((pick, index) => {
      const servings = best[index] ?? pick.servings;
      const set = bestSets[index];

      return set === pick.set ? { ...pick, servings } : { ...pick, servings, set };
    })
  };
}

/**
 * How many candidate swaps per round are priced properly — sized by the
 * exhaustive portion search — after a cheap first pass over the whole pool.
 *
 * The cheap pass judges a swap with the dish at the size it was first scaled
 * to; the expensive one asks what the day would cost once every portion is
 * re-fitted around it, which is the question that matters and the one the
 * greedy version never asked. A swap that only helps once the other plates
 * shrink a quarter to make room for it was invisible before, and fat — small
 * grams inside a plate, unreachable by scaling alone — is exactly what such
 * swaps fix. Twenty-four, measured on a real library: eight left one day of
 * fourteen at 7% on fat, twenty-four brought every day inside 5% on all four
 * macros, and the whole fortnight still prices in about four seconds.
 */
const SWAP_SHORTLIST = 24;

/**
 * Swaps whole dishes to improve the day as a whole.
 *
 * Choosing each slot independently optimises three separate fits and can still
 * miss the day: with a pool of both rice dishes and chicken dishes, every slot's
 * *individual* best fit on energy is a rice dish, and the day then lands on
 * calories and half a protein target short. Scaling portions cannot rescue that —
 * a portion changes a dish's size, never its composition — so the repair has to
 * happen at selection.
 *
 * Bounded and greedy over rounds: each takes the single best-improving swap and
 * stops when nothing improves. Within a round it is two-stage — see
 * `SWAP_SHORTLIST`. Variety is re-checked against the other days and the rest
 * of this one, so a swap can never introduce a violation.
 */
function improveDay(
  picks: readonly Pick[],
  input: SchedulerInput,
  perServing: ReadonlyMap<string, PerServing>,
  dayIndex: number,
  placed: readonly Placement[],
  budgets: ReadonlyMap<MealSlot, SlotBudget>,
  protein: { readonly cap: number; readonly kinds: KindRules; readonly proteins: ProteinIndex; readonly seasonal: Seasonal },
  sides?: Sides
): readonly Pick[] {
  const others = placed.filter(placement => placement.dayIndex !== dayIndex);
  const elsewhere = proteinCounts(others, protein.proteins);
  const proteinOf = (slug: string): string | null => protein.proteins.get(slug) ?? null;
  // Pasta, rice, grains and legumes against the rest of the plan, at the protein rule's weight.
  const { kinds } = protein;
  const kindsElsewhere = kinds.checks.map(check => kindMeals(others, check));
  const cappedElsewhere = kindMeals(others, kinds.capped);

  // The capped starches' cap is held at `STARCH_CAP_WEIGHT` on top: only the bands outrank it.
  const kindsOf = (day: readonly Pick[]): number => {
    const placements = day.map(entry => ({ dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));

    return (
      kinds.checks.reduce(
        (sum, check, position) => sum + kindExcess([...(kindsElsewhere[position] ?? []), ...kindMeals(placements, check)], kinds.days, check.rule),
        0
      ) *
        PROTEIN_SWAP_WEIGHT +
      kindPastCap([...cappedElsewhere, ...kindMeals(placements, kinds.capped)], kinds.days, kinds.capped.rule) * STARCH_CAP_WEIGHT
    );
  };

  const targets = targetsOn(input, dayIndex);
  let current = [...picks];

  // Each day `sized` has searched, by its dishes (017 phase 3): a swap a round
  // shortlisted comes back in the next round whenever that round changed another
  // meal, and a quarter of these searches were the same day again. Every pick here
  // is sized `servingsFor` its dish and slot and carries no set, so the dishes
  // alone are the day the search is given, and the answer is the one it would give.
  const known = new Map<string, { readonly cost: number; readonly miss: number }>();

  // A swap is judged on the bands first (`bandMiss`, the bands validation
  // reports): a day with fewer macros outside, or outside by less, wins whatever
  // its fit and the variety rules' prices say, and those decide only between days
  // equally inside. The variety rules are preferences, never a reason to hold a
  // day off its macros (owner, 017: the macros win).
  //
  // Priced together, they did hold it off once `PROTEIN_SWAP_WEIGHT` rose. The
  // end-to-end suite's pool gets its fat from eggs alone, and an egg at lunch and
  // at dinner passes the protein rules four ways: a swap to it that brought a day
  // from 14% under its energy and 22% under its fat to inside both paid more in
  // rules than it gained in fit, and eight or nine days of fourteen stayed 14%
  // under. This decides which dish; the sizes are still fitted unbanded here
  // (`BAND_MISS_WEIGHT` prices them only in the spread pass).
  // Measured on the reference library, days inside 5% on all four macros went
  // from 176/182 to 180/182 without accompaniments and from 182/182 to 181/182
  // with them (one day 5.1% over its fat); the rules gave a little where they had
  // held a day out — one profile's legume six times instead of four, a snack
  // kind four times. The most-served protein did not move.
  const sized = (day: readonly Pick[]): { readonly cost: number; readonly miss: number } => {
    const key = day.map(pick => pick.dish.slug).join('|');
    let found = known.get(key);

    if (!found) {
      const balanced = balancedDay(day, targets, budgets, input.minimumKcal, false, sides);

      found = { cost: balanced.cost, miss: bandMiss(totalsOf(balanced.picks), targets) };
      known.set(key, found);
    }

    return found;
  };

  for (let round = 0; round < MAX_SWAP_ROUNDS; round += 1) {
    // A repeated main protein is priced, not refused (`PROTEIN_REPEAT_WEIGHT`);
    // so is a dish already served elsewhere in the plan (`DISH_REPEAT_WEIGHT`) —
    // without it, a swap toward a better-fitting dish already used twice cost
    // the same as one toward a dish never served, and on a fortnight whose
    // daily targets barely move, this search kept spending the same handful of
    // best-fitting dishes on every day it touched (`0065`).
    const today = current.map(entry => ({ protein: proteinOf(entry.dish.slug), slot: entry.slot }));
    const repeatsOf = (day: readonly ProteinMeal[]): number => proteinExcess(day, elsewhere, protein.cap, planWeek(dayIndex)) * PROTEIN_SWAP_WEIGHT;
    // Priced the same way the candidates will be, or a swap could "win" against
    // a day that was never sized.
    const kindsNow = kindsOf(current);
    const kindsPriced = new Map<string, number>();
    const now = sized(current);
    let bestMiss = now.miss;
    let bestCost = now.cost + repeatsOf(today) + dayReuseCost(current, dayIndex, others) + kindsNow;
    let bestDay: readonly Pick[] | undefined;
    const shortlist: { readonly cost: number; readonly extra: number; readonly swapped: readonly Pick[] }[] = [];
    // Each meal's `reuseCost` as it stands, so a candidate's day is summed as
    // `dayReuseCost` sums it — in the same order, to the bit — pricing one meal.
    const reuseNow = current.map(entry => reuseCost(entry.dish.slug, entry.slot, dayIndex, others));
    // A swap moves the protein rules only through the candidate's protein: priced once per meal and protein.
    const repeatsPriced = new Map<string, number>();

    for (const [index, pick] of current.entries()) {
      // Everything already on the plate today except the one being replaced.
      const siblings = current
        .filter((_entry, position) => position !== index)
        .map(entry => ({ dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const rest = [...others, ...siblings];
      const budget = budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {
          continue;
        }

        const base = perServing.get(candidate.slug);

        if (
          !base ||
          !fitsPlate(base, budget, pick.slot) ||
          !protein.seasonal(candidate.slug, dayIndex) ||
          !canPlace(candidate.slug, pick.slot, dayIndex, rest)
        ) {
          continue;
        }

        const candidateProtein = proteinOf(candidate.slug);
        const repeatsKey = `${index}|${candidateProtein ?? ''}`;
        const repeats =
          repeatsPriced.get(repeatsKey) ??
          repeatsOf(today.map((entry, position) => (position === index ? { protein: candidateProtein, slot: entry.slot } : entry)));

        repeatsPriced.set(repeatsKey, repeats);
        const servings = servingsFor(base, budget, pick.slot);
        const swapped = current.map((entry, position) =>
          position === index ? { base, dish: candidate, servings, slot: entry.slot, sortOrder: entry.sortOrder } : entry
        );
        // Only a swap that brings a counted kind in, or takes it out, can move the kinds' cost.
        // A swap moves the kinds' cost only through what the candidate is, so it is
        // priced once per meal and kind (`kindsKey`), not once per candidate.
        let kindsCost = kindsNow;

        if (countsForAny(kinds, candidate.slug, pick.slot) || countsForAny(kinds, pick.dish.slug, pick.slot)) {
          const key = `${index}|${kindsKey(kinds, candidate.slug, pick.slot)}`;

          kindsCost = kindsPriced.get(key) ?? kindsOf(swapped);
          kindsPriced.set(key, kindsCost);
        }

        const reuse = reuseNow.reduce(
          (sum, cost, position) => sum + (position === index ? reuseCost(candidate.slug, pick.slot, dayIndex, others) : cost),
          0
        );
        const extra = repeats + reuse + kindsCost;

        shortlist.push({ cost: dayFitCost(swapped, targets) + extra, extra, swapped });
      }
    }

    // Stable: a tie on the cheap cost keeps pool order, which is the user's own
    // rotation (`0009`), and the shortlist is then priced in that order.
    const priced = shortlist
      .sort((a, b) => a.cost - b.cost)
      .slice(0, SWAP_SHORTLIST)
      .map(entry => {
        const day = sized(entry.swapped);

        return { cost: day.cost + entry.extra, miss: day.miss, swapped: entry.swapped };
      });

    for (const entry of priced) {
      // Fewer macros outside their bands first, whatever the rest costs; among
      // days equally inside them, fit and the variety rules' prices decide.
      if (entry.miss < bestMiss - BAND_TIE || (entry.miss <= bestMiss + BAND_TIE && entry.cost < bestCost)) {
        bestMiss = entry.miss;
        bestCost = entry.cost;
        bestDay = entry.swapped;
      }
    }

    if (!bestDay) {
      break;
    }

    current = [...bestDay];
  }

  return current;
}

/** A day's macros at the sizes its picks carry, with what is beside them. */
function totalsOf(picks: readonly Pick[]): Macros {
  return picks.reduce<Macros>(
    (sum, pick) => ({
      carbsG: sum.carbsG + pick.base.carbsG * pick.servings + (pick.set?.macros.carbsG ?? 0),
      fatG: sum.fatG + pick.base.fatG * pick.servings + (pick.set?.macros.fatG ?? 0),
      fiberG: sum.fiberG + pick.base.fiberG * pick.servings + (pick.set?.macros.fiberG ?? 0),
      kcal: sum.kcal + pick.base.kcal * pick.servings + (pick.set?.macros.kcal ?? 0),
      proteinG: sum.proteinG + pick.base.proteinG * pick.servings + (pick.set?.macros.proteinG ?? 0)
    }),
    { carbsG: 0, fatG: 0, fiberG: 0, kcal: 0, proteinG: 0 }
  );
}

/**
 * A day's macros as the plan will carry them: each meal's scaled and rounded
 * to a tenth (`scaleMacros`), what is beside it added (`addMacros`), and the
 * meals summed as `sumMacros` sums them — what `validatePlan` is given.
 */
function deliveredTotals(picks: readonly Pick[]): Macros {
  return sumMacros(
    picks.map(pick => (pick.set ? addMacros(scaleMacros(pick.base, pick.servings), pick.set.macros) : scaleMacros(pick.base, pick.servings)))
  );
}

/** The day's totals measured against the day's targets. */
function dayFitCost(picks: readonly Pick[], targets: NutritionTargets): number {
  return fitCost(totalsOf(picks), { carbsG: targets.carbsG, fatG: targets.fatG, kcal: targets.kcal, proteinG: targets.proteinG });
}

/**
 * How far a day sits from `PLAN_TOLERANCE` — the same bands validation
 * reports, so what the spread pass removes is exactly what a plan would
 * otherwise be delivered with as advice.
 *
 * Macros outside first, how far outside second: each macro outside its band
 * counts one, plus the fraction it is out by. Priced by distance alone, a day
 * whose fat could not reach its band pushed carbohydrate and protein a point
 * outside theirs to pull the fat a few points closer — less total distance,
 * two more numbers the person sees missed. Zero for a day inside every band.
 */
function bandMiss(totals: Macros, targets: NutritionTargets): number {
  const outside = (actual: number, target: number, under: number, over: number): number => {
    if (target <= 0) {
      return 0;
    }

    const error = (actual - target) / target;

    return error < 0 ? Math.max(0, -error - under) : Math.max(0, error - over);
  };

  return [
    outside(totals.kcal, targets.kcal, PLAN_TOLERANCE.kcal, PLAN_TOLERANCE.kcal),
    outside(totals.proteinG, targets.proteinG, PLAN_TOLERANCE.proteinUnder, PLAN_TOLERANCE.proteinOver),
    outside(totals.carbsG, targets.carbsG, PLAN_TOLERANCE.carbs, PLAN_TOLERANCE.carbs),
    outside(totals.fatG, targets.fatG, PLAN_TOLERANCE.fat, PLAN_TOLERANCE.fat)
  ].reduce((sum, excess) => sum + excess + (excess > SPREAD_EPSILON ? 1 : 0), 0);
}

/**
 * A day's energy as the plan will carry it, not as the search sums it.
 *
 * Every meal's macros are rounded to a decimal when the plan is assembled
 * (`scaleMacros`) and the day's total is the sum of those, so a day the search
 * holds at 1,200.02 can be delivered — and validated — at 1,199.9. The floor is
 * judged on the delivered number, so it is judged on the same one here.
 */
function deliveredKcal(picks: readonly Pick[], servings: readonly number[] = [], sets: readonly (AccompanimentSet | undefined)[] = []): number {
  // A set's macros are already tenths (`toSet`), so they add as the plan adds them (`addMacros`).
  const tenths = picks.reduce(
    (sum, pick, index) =>
      sum + Math.round(pick.base.kcal * (servings[index] ?? pick.servings) * 10) + Math.round(((sets[index] ?? pick.set)?.macros.kcal ?? 0) * 10),
    0
  );

  return tenths / 10;
}

/**
 * How far under the floor a day's energy sits: nothing at or over it, otherwise
 * one for being under plus the fraction it is under by — the shape of
 * `bandMiss`, so the spread pass can add the two.
 */
function floorMiss(kcal: number, minimumKcal: number): number {
  return kcal >= minimumKcal ? 0 : 1 + (minimumKcal - kcal) / minimumKcal;
}

/**
 * How far a day's energy sits outside its band (`PLAN_TOLERANCE.kcal`): nothing
 * inside it, otherwise the fraction past its edge.
 *
 * `bandMiss` counts a macro outside as one whatever the distance, so to the
 * repairs a day a little off on carbohydrate, fat and protein was worth more than
 * one 21% short of its energy, and they made that trade: on draws of the
 * end-to-end suite's small pool (017 phase 2) a day inside every band was handed
 * a third of another day's misses and left 17% and 21% under its energy — a
 * plate a person feels, where the three small misses were advice. So no repair
 * may leave a day's energy further outside its band than it found it
 * (`keepsEnergy`, and the same condition in `enforceDistinctDays`). On its own it
 * changed no plan of the reference library.
 */
function energyMiss(picks: readonly Pick[], targets: NutritionTargets): number {
  return targets.kcal > 0 ? Math.max(0, Math.abs(totalsOf(picks).kcal / targets.kcal - 1) - PLAN_TOLERANCE.kcal) : 0;
}

type BuiltDay = {
  readonly budgets: ReadonlyMap<MealSlot, SlotBudget>;
  readonly dayIndex: number;
  readonly picks: readonly Pick[];
  readonly targets: NutritionTargets;
};

/** Small enough to be rounding; an exchange has to buy more than this to be made. */
const SPREAD_EPSILON = 1e-6;

/**
 * Exchanges meals between days until no exchange brings the fortnight closer
 * to its bands — see `MAX_SPREAD_ROUNDS`.
 *
 * An exchange is the same meal on two days, each dish moving to the other
 * day. It can never break variety: a dish keeps its count, and each move is
 * checked with `canPlace` against everything else on the plan, including the
 * days a mid-plan rebuild is not touching. Deterministic: days and meals are
 * visited in order and a tie keeps the first.
 */
function spreadAcrossDays(
  days: readonly BuiltDay[],
  fixed: readonly Placement[],
  proteins: ProteinIndex,
  kinds: KindRules,
  seasonal: Seasonal,
  minimumKcal: number,
  sidesOn?: (dayIndex: number) => Sides
): readonly BuiltDay[] {
  const current = [...days];
  // A day under the floor is a day outside, whatever its bands say, so it is
  // repaired like one. That prices the floor at one band's worth, which is not
  // enough to protect it: an exchange that brought three macros inside and left
  // the day under the floor would read as a gain, and turn a plan delivered with
  // advice into one thrown away. So the floor is also a condition, like the
  // order of the meals — see `keepsFloor`.
  const missOf = (picks: readonly Pick[], day: BuiltDay): number =>
    bandMiss(totalsOf(picks), day.targets) + floorMiss(deliveredKcal(picks), minimumKcal);
  // No repair may leave a day further under the floor than it already was.
  const keepsFloor = (picks: readonly Pick[], day: BuiltDay): boolean =>
    floorMiss(deliveredKcal(picks), minimumKcal) <= floorMiss(deliveredKcal(day.picks), minimumKcal) + SPREAD_EPSILON;
  // No repair may leave a day's meals further out of the order the person set
  // than the day already was — see `ORDER_OUTRANKS_BANDS`.
  const keepsOrder = (picks: readonly Pick[], day: BuiltDay): boolean =>
    inversionsOf(picks, day.budgets) <= inversionsOf(day.picks, day.budgets) + SPREAD_EPSILON;
  // No repair may leave a day's energy further outside its band than it was —
  // nor, for an exchange, either day further outside than the worse of the two
  // was: moving a miss onto a day already at its band is fine, deepening it is
  // not (`energyMiss`).
  const keepsEnergy = (pairs: readonly (readonly [readonly Pick[], BuiltDay])[]): boolean =>
    Math.max(...pairs.map(([picks, day]) => energyMiss(picks, day.targets))) <=
    Math.max(...pairs.map(([, day]) => energyMiss(day.picks, day.targets))) + SPREAD_EPSILON;
  // An exchange that brings one main protein into a day twice pays for it
  // (`SPREAD_REPEAT_WEIGHT`). It moves dishes between days, so the fortnight's
  // counts cannot change; only a day's own repeats can.
  const repeatsIn = (picks: readonly Pick[]): number =>
    proteinExcess(
      picks.map(pick => ({ protein: proteins.get(pick.dish.slug) ?? null, slot: pick.slot })),
      NO_PROTEIN_COUNTS,
      Number.POSITIVE_INFINITY,
      0
    );
  const resized = (day: BuiltDay, index: number, replacement: Pick): Pick[] =>
    day.picks.map((pick, position) =>
      position === index
        ? {
            ...pick,
            base: replacement.base,
            dish: replacement.dish,
            servings: servingsFor(replacement.base, day.budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 }, pick.slot),
            // What was beside the old dish is not the new one's; the day's search chooses again.
            set: undefined
          }
        : pick
    );

  // First the cheapest repair: the same dishes, sized to the bands.
  for (const [position, day] of current.entries()) {
    const before = missOf(day.picks, day);

    if (before > SPREAD_EPSILON) {
      const picks = balancedDay(day.picks, day.targets, day.budgets, minimumKcal, true, sidesOn?.(day.dayIndex)).picks;

      if (missOf(picks, day) < before - SPREAD_EPSILON && keepsOrder(picks, day) && keepsFloor(picks, day) && keepsEnergy([[picks, day]])) {
        current[position] = { ...day, picks };
      }
    }
  }

  for (let round = 0; round < MAX_SPREAD_ROUNDS; round += 1) {
    const outside = current
      .map((day, position) => ({ miss: missOf(day.picks, day), position }))
      .filter(entry => entry.miss > SPREAD_EPSILON)
      .sort((a, b) => b.miss - a.miss || a.position - b.position);
    let exchanged = false;

    for (const { miss, position: worstAt } of outside) {
      const worst = current[worstAt] as BuiltDay;
      const placements: Placement[] = [
        ...fixed,
        ...current.flatMap(day => day.picks.map(pick => ({ dayIndex: day.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot })))
      ];
      const kindsBefore = kindsExcess(placements, kinds.checks, kinds.days) + mainsWeekExcess(placements, proteins);

      // An exchange keeps the fortnight's pasta, rice, grains and legumes, but
      // may bring two onto days running — or move a protein into a week that
      // already has its three (`PROTEIN_RULES.perMainsWeek`).
      const kindsAdded = (other: BuiltDay, toWorst: readonly Pick[], toOther: readonly Pick[]): number => {
        const moved = [
          ...placements.filter(placement => placement.dayIndex !== worst.dayIndex && placement.dayIndex !== other.dayIndex),
          ...toWorst.map(pick => ({ dayIndex: worst.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot })),
          ...toOther.map(pick => ({ dayIndex: other.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot }))
        ];

        return Math.max(0, kindsExcess(moved, kinds.checks, kinds.days) + mainsWeekExcess(moved, proteins) - kindsBefore);
      };

      const screened: { before: number; kinds: boolean; otherAt: number; quick: number; toOther: Pick[]; toWorst: Pick[] }[] = [];

      for (const [otherAt, other] of current.entries()) {
        if (otherAt === worstAt) {
          continue;
        }

        const before = miss + missOf(other.picks, other);

        for (const [worstIndex, mine] of worst.picks.entries()) {
          const otherIndex = other.picks.findIndex(pick => pick.slot === mine.slot);
          const theirs = other.picks[otherIndex];

          if (!theirs || theirs.dish.slug === mine.dish.slug) {
            continue;
          }

          const noBudget = { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };

          if (
            !fitsPlate(theirs.base, worst.budgets.get(mine.slot) ?? noBudget, mine.slot) ||
            !fitsPlate(mine.base, other.budgets.get(mine.slot) ?? noBudget, mine.slot)
          ) {
            continue;
          }

          const rest = placements.filter(
            placement => placement.slot !== mine.slot || (placement.dayIndex !== worst.dayIndex && placement.dayIndex !== other.dayIndex)
          );

          if (
            !canPlace(theirs.dish.slug, mine.slot, worst.dayIndex, rest) ||
            !canPlace(mine.dish.slug, mine.slot, other.dayIndex, rest) ||
            // A day's month decides its fruit: an exchange across a month's end may not carry one out of season.
            !seasonal(theirs.dish.slug, worst.dayIndex) ||
            !seasonal(mine.dish.slug, other.dayIndex)
          ) {
            continue;
          }

          const toWorst = resized(worst, worstIndex, theirs);
          const toOther = resized(other, otherIndex, mine);

          screened.push({
            before,
            kinds:
              kinds.checks.some(check => check.index.get(mine.dish.slug) !== check.index.get(theirs.dish.slug)) ||
              (planWeek(worst.dayIndex) !== planWeek(other.dayIndex) && proteins.get(mine.dish.slug) !== proteins.get(theirs.dish.slug)),
            otherAt,
            quick: missOf(toWorst, worst) + missOf(toOther, other) - before,
            toOther,
            toWorst
          });
        }
      }

      let best: { gain: number; otherAt: number; toOther: readonly Pick[]; toWorst: readonly Pick[] } | undefined;

      // Stable: a tie on the screen keeps the order the exchanges were found in.
      for (const entry of screened.sort((a, b) => a.quick - b.quick).slice(0, SPREAD_SHORTLIST)) {
        const other = current[entry.otherAt] as BuiltDay;
        const toWorst = balancedDay(entry.toWorst, worst.targets, worst.budgets, minimumKcal, true, sidesOn?.(worst.dayIndex)).picks;
        const toOther = balancedDay(entry.toOther, other.targets, other.budgets, minimumKcal, true, sidesOn?.(other.dayIndex)).picks;
        const added =
          Math.max(0, repeatsIn(toWorst) - repeatsIn(worst.picks)) +
          Math.max(0, repeatsIn(toOther) - repeatsIn(other.picks)) +
          (entry.kinds ? kindsAdded(other, toWorst, toOther) : 0);
        const gain = entry.before - missOf(toWorst, worst) - missOf(toOther, other) - added * SPREAD_REPEAT_WEIGHT;

        if (
          !keepsOrder(toWorst, worst) ||
          !keepsOrder(toOther, other) ||
          !keepsFloor(toWorst, worst) ||
          !keepsFloor(toOther, other) ||
          !keepsEnergy([
            [toWorst, worst],
            [toOther, other]
          ])
        ) {
          continue;
        }

        if (gain > SPREAD_EPSILON && (!best || gain > best.gain + SPREAD_EPSILON)) {
          best = { gain, otherAt: entry.otherAt, toOther, toWorst };
        }
      }

      if (best) {
        current[worstAt] = { ...worst, picks: best.toWorst };
        current[best.otherAt] = { ...(current[best.otherAt] as BuiltDay), picks: best.toOther };
        exchanged = true;
        break;
      }
    }

    if (!exchanged) {
      break;
    }
  }

  return current;
}

/**
 * How many swaps `repairOutOfBand` sizes to the bands per round, after the same
 * cheap screen `improveDay` uses. Four times `SWAP_SHORTLIST`, because only a
 * day still outside pays for it: on the reference library (017 phase 3) the
 * twenty-four best on the screen left a day 6.1% over its carbohydrate, and
 * forty-eight or more brought it inside.
 */
const REPAIR_SHORTLIST = 96;

/**
 * The last repair for a day still outside its bands once the spread pass is
 * done: a swap with any dish of the pool, its portions sized to the bands
 * (`balancedDay`, banded), the way the spread pass sizes an exchange (017
 * phase 3).
 *
 * Neither earlier pass could make it. `improveDay` swaps from the pool but
 * sizes unbanded, so a swap that lands only once its portions are fitted to the
 * bands looks no better there than the day it would replace; the spread pass
 * sizes to the bands but only trades meals the plan already has. A small target
 * at the energy floor showed the gap: a day 5.1% over its fat at 1,213 kcal,
 * where any quarter serving less was under the floor, so only another dish
 * could shed the fat.
 *
 * Only a day outside is touched, so a plan already in band is the plan it was.
 * A swap is made only when it leaves the day fewer macros outside, or outside
 * by less, and it is held to everything the spread pass holds an exchange to:
 * the floor, the order of the meals, the day's energy. Among swaps equally
 * inside, the variety rules' prices decide, as in `improveDay` — priced, never
 * a reason to keep a day off its macros (owner, 017: the macros win). `canPlace`
 * holds against the whole plan, so no swap breaks variety.
 */
function repairOutOfBand(
  days: readonly BuiltDay[],
  input: SchedulerInput,
  fixed: readonly Placement[],
  perServing: ReadonlyMap<string, PerServing>,
  rules: { readonly cap: number; readonly kinds: KindRules; readonly proteins: ProteinIndex; readonly seasonal: Seasonal },
  sidesOn?: (dayIndex: number) => Sides
): readonly BuiltDay[] {
  const { cap, kinds, proteins, seasonal } = rules;
  const current = [...days];
  // On the macros as the plan will carry them, each meal rounded to a tenth
  // (`deliveredTotals`), which is what validation judges: a day the search held
  // at 38.84 g of fat against a band ending at 38.85 was delivered at 38.9.
  const missOf = (picks: readonly Pick[], day: BuiltDay): number =>
    bandMiss(deliveredTotals(picks), day.targets) + floorMiss(deliveredKcal(picks), input.minimumKcal);

  for (const [position, start] of current.entries()) {
    if (missOf(start.picks, start) <= SPREAD_EPSILON) {
      continue;
    }

    const others: Placement[] = [
      ...fixed,
      ...current.flatMap((day, at) =>
        at === position ? [] : day.picks.map(pick => ({ dayIndex: day.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot }))
      )
    ];
    const elsewhere = proteinCounts(others, proteins);
    const week = planWeek(start.dayIndex);
    const sides = sidesOn?.(start.dayIndex);

    // What the day pays the variety rules, priced as `improveDay` prices them.
    const priceOf = (picks: readonly Pick[]): number => {
      const placements = picks.map(pick => ({ dayIndex: start.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot }));
      const repeats = proteinExcess(
        picks.map(pick => ({ protein: proteins.get(pick.dish.slug) ?? null, slot: pick.slot })),
        elsewhere,
        cap,
        week
      );

      return (
        (repeats + kindsExcess([...others, ...placements], kinds.checks, kinds.days)) * PROTEIN_SWAP_WEIGHT +
        pastStarchCap([...others, ...placements], kinds) * STARCH_CAP_WEIGHT +
        dayReuseCost(picks, start.dayIndex, others)
      );
    };

    let day = start;

    for (let round = 0; round < MAX_SWAP_ROUNDS && missOf(day.picks, day) > SPREAD_EPSILON; round += 1) {
      const screened: { readonly quick: number; readonly swapped: Pick[] }[] = [];

      for (const [index, pick] of day.picks.entries()) {
        const budget = day.budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
        const placed = [
          ...others,
          ...day.picks.filter((_entry, at) => at !== index).map(entry => ({ dayIndex: day.dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }))
        ];

        for (const candidate of input.pool) {
          const base = perServing.get(candidate.slug);

          if (
            !base ||
            candidate.slug === pick.dish.slug ||
            !candidate.slots.includes(pick.slot) ||
            !fitsPlate(base, budget, pick.slot) ||
            !seasonal(candidate.slug, day.dayIndex) ||
            !canPlace(candidate.slug, pick.slot, day.dayIndex, placed)
          ) {
            continue;
          }

          const swapped = day.picks.map((entry, at) =>
            at === index ? { ...entry, base, dish: candidate, servings: servingsFor(base, budget, pick.slot), set: undefined } : entry
          );

          screened.push({ quick: bandMiss(totalsOf(swapped), day.targets) * BAND_MISS_WEIGHT + dayFitCost(swapped, day.targets), swapped });
        }
      }

      let best: { readonly cost: number; readonly miss: number; readonly picks: readonly Pick[] } | undefined;
      const before = missOf(day.picks, day);

      // Stable: a tie on the screen keeps pool order, the user's own rotation (`0009`).
      for (const entry of screened.sort((a, b) => a.quick - b.quick).slice(0, REPAIR_SHORTLIST)) {
        const sized = balancedDay(entry.swapped, day.targets, day.budgets, input.minimumKcal, true, sides);
        const miss = missOf(sized.picks, day);

        if (
          miss >= before - SPREAD_EPSILON ||
          inversionsOf(sized.picks, day.budgets) > inversionsOf(day.picks, day.budgets) + SPREAD_EPSILON ||
          floorMiss(deliveredKcal(sized.picks), input.minimumKcal) > floorMiss(deliveredKcal(day.picks), input.minimumKcal) + SPREAD_EPSILON ||
          energyMiss(sized.picks, day.targets) > energyMiss(day.picks, day.targets) + SPREAD_EPSILON
        ) {
          continue;
        }

        const cost = dayFitCost(sized.picks, day.targets) + priceOf(sized.picks);

        if (!best || miss < best.miss - BAND_TIE || (miss <= best.miss + BAND_TIE && cost < best.cost)) {
          best = { cost, miss, picks: sized.picks };
        }
      }

      if (!best) {
        break;
      }

      day = { ...day, picks: best.picks };
    }

    current[position] = day;
  }

  return current;
}

/**
 * A day's set of dishes, as a single key — the same notion `varietyViolations`
 * audits: which slot each sits in does not matter, only the set (owner,
 * 2026-09-26) — paella at lunch and lentils at dinner is the same day as
 * lentils at lunch and paella at dinner.
 */
function daySignature(picks: readonly Pick[]): string {
  return [...picks]
    .map(pick => pick.dish.slug)
    .sort()
    .join('|');
}

/** The same signature, one per day, for a flat placement list — what a rebuild's untouched days are given as. */
function daySignaturesOf(placed: readonly Placement[]): readonly string[] {
  const byDay = new Map<number, string[]>();

  for (const placement of placed) {
    byDay.set(placement.dayIndex, [...(byDay.get(placement.dayIndex) ?? []), placement.dishSlug]);
  }

  return [...byDay.values()].map(slugs => [...slugs].sort().join('|'));
}

/**
 * No two days may serve exactly the same dishes (owner, 2026-09-26) — a hard
 * rule, checked once every other pass has run: two days built to nearly the
 * same targets from the same pool can still converge on the same handful of
 * dishes with every cost above in place, and `spreadAcrossDays` trades whole
 * meals between days for reasons that have nothing to do with which dishes
 * end up sharing a day, so either pass can produce — or remove — the
 * collision.
 *
 * The repair is the smallest one that clears it: for the later of two
 * identical days, the one slot cheapest to change is swapped to the
 * best-fitting eligible dish that is not already on this day and does not
 * recreate *another* collision. Guarded exactly the way `spreadAcrossDays`
 * guards its own exchanges — a repair may never leave the day's macros
 * further outside their bands, its energy further outside its own
 * (`energyMiss`), its meals further out of the order the person set, or its
 * energy further under the floor than it already was: this pass
 * runs *after* the spread pass has spent its own budget bringing a day
 * inside 5%, and repricing without the same bands (`balancedDay`'s plain,
 * unbanded cost) undid that work wholesale in testing — a day at 1% on
 * protein came back at 11%. Never refused: a thin pool serving the same
 * three dishes on two days is still a plan, and `varietyViolations` is what
 * tells the difference between "prevented" and "the pool left no choice".
 */
function enforceDistinctDays(
  days: readonly BuiltDay[],
  input: SchedulerInput,
  fixed: readonly Placement[],
  proteins: ProteinIndex,
  cap: number,
  kinds: KindRules,
  seasonal: Seasonal,
  sidesOn?: (dayIndex: number) => Sides
): readonly BuiltDay[] {
  const perServing = perServingIndex(input.pool, input.catalogue);
  const current = [...days];
  // A mid-plan rebuild (`0044`) hands `fixed` the days it is *not* laying out
  // again — untouched, already on the plate. Their signatures go in before
  // the loop below runs, or a rebuild could recreate a day identical to one
  // of them and this pass would never see it, because it only ever compares
  // the days it is itself building.
  const seen = new Set<string>(daySignaturesOf(fixed));

  const missOf = (picks: readonly Pick[], day: BuiltDay): number =>
    bandMiss(totalsOf(picks), day.targets) + floorMiss(deliveredKcal(picks), input.minimumKcal);
  const keepsFloor = (picks: readonly Pick[], day: BuiltDay): boolean =>
    floorMiss(deliveredKcal(picks), input.minimumKcal) <= floorMiss(deliveredKcal(day.picks), input.minimumKcal) + SPREAD_EPSILON;
  const keepsOrder = (picks: readonly Pick[], day: BuiltDay): boolean =>
    inversionsOf(picks, day.budgets) <= inversionsOf(day.picks, day.budgets) + SPREAD_EPSILON;

  for (const [index, day] of current.entries()) {
    const signature = daySignature(day.picks);

    if (!seen.has(signature)) {
      seen.add(signature);
      continue;
    }

    // Every other day already in `current`, repaired ones included — this is a
    // single forward pass, so a day fixed earlier is what a later day sees.
    const elsewhere = current.flatMap((other, otherIndex) =>
      otherIndex === index ? [] : other.picks.map(pick => ({ dayIndex: other.dayIndex, dishSlug: pick.dish.slug, slot: pick.slot }))
    );
    const before = missOf(day.picks, day);

    let repaired: readonly Pick[] | undefined;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const [position, pick] of day.picks.entries()) {
      const budget = day.budgets.get(pick.slot) ?? { carbsG: 0, fatG: 0, kcal: 0, proteinG: 0 };
      const siblings = day.picks
        .filter((_entry, at) => at !== position)
        .map(entry => ({ dayIndex: day.dayIndex, dishSlug: entry.dish.slug, slot: entry.slot }));
      const placedElsewhere = [...fixed, ...elsewhere, ...siblings];
      const kindsElsewhere = kinds.checks.map(check => kindMeals(placedElsewhere, check));

      for (const candidate of input.pool) {
        if (!candidate.slots.includes(pick.slot) || candidate.slug === pick.dish.slug) {
          continue;
        }

        const base = perServing.get(candidate.slug);

        if (
          !base ||
          !fitsPlate(base, budget, pick.slot) ||
          !seasonal(candidate.slug, day.dayIndex) ||
          crowded(candidate.slug, { dayIndex: day.dayIndex, slot: pick.slot }, placedElsewhere, proteins, cap) ||
          kindsCrowded(candidate.slug, pick.slot, day.dayIndex, kindsElsewhere, kinds.checks, kinds.days) > 0
        ) {
          continue;
        }

        if (!canPlace(candidate.slug, pick.slot, day.dayIndex, placedElsewhere)) {
          continue;
        }

        const servings = servingsFor(base, budget, pick.slot);
        const swapped = day.picks.map((entry, at) => (at === position ? { ...entry, base, dish: candidate, servings, set: undefined } : entry));

        // A repair that only trades this collision for another helps nobody.
        if (seen.has(daySignature(swapped))) {
          continue;
        }

        const priced = balancedDay(swapped, day.targets, day.budgets, input.minimumKcal, true, sidesOn?.(day.dayIndex));

        if (
          missOf(priced.picks, day) > before + SPREAD_EPSILON ||
          !keepsOrder(priced.picks, day) ||
          !keepsFloor(priced.picks, day) ||
          // Nor its energy further outside its band (`energyMiss`).
          energyMiss(priced.picks, day.targets) > energyMiss(day.picks, day.targets) + SPREAD_EPSILON
        ) {
          continue;
        }

        if (priced.cost < bestCost) {
          bestCost = priced.cost;
          repaired = priced.picks;
        }
      }
    }

    if (repaired) {
      current[index] = { ...day, picks: repaired };
      seen.add(daySignature(repaired));
    } else {
      // The pool left no choice — recorded by `varietyViolations`, not thrown away.
      seen.add(signature);
    }
  }

  return current;
}

/** Quarter-serving arithmetic in floats needs snapping, or 0.75 + 0.25 drifts. */
function roundServings(value: number): number {
  return Math.round(value / SERVING_STEP) * SERVING_STEP;
}

function quantiseServings(raw: number): number {
  const clamped = Math.min(Math.max(raw, SERVING_BOUNDS.min), SERVING_BOUNDS.max);

  return Math.max(SERVING_BOUNDS.min, Math.round(clamped / SERVING_STEP) * SERVING_STEP);
}
