/**
 * What an account may spend, per person, per tier
 * ([`0015`](../../../../docs/decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md),
 * [`0042`](../../../../docs/decisions/0042-what-a-paid-account-may-spend.md)).
 *
 * Two numbers in one place rather than rules spread over the routes that
 * enforce them, which is what made a second tier a table rather than a rewrite.
 *
 * What premium raises, and what it deliberately does not:
 *
 * - **Redos** go from one a fortnight to three. This is the number that costs
 *   money — a redo is a model call — and it is the one people actually ask for,
 *   because a plan you cannot re-roll is a plan you are stuck with for two
 *   weeks.
 * - **Swaps** go from five a plan to twenty. A swap is usually served from the
 *   library and costs nothing; the limit exists so a plan stays a plan rather
 *   than becoming a menu. Twenty is generous without removing the shape.
 * - **Events** go from three a plan to ten (`0043`, `0044`). Declaring a day
 *   that eats differently costs nothing at all — it is scheduling, not a model
 *   call — so the free number exists to keep a fortnight a fortnight rather
 *   than a periodisation, and the paid one is deliberately generous: the
 *   overlap rule already bounds how many loads fit in fourteen days.
 * - **Mid-plan events** go from none to three. This is the one that is really
 *   sold: free declares an event and it applies at the next generation, which
 *   is what `0043` shipped; premium may add one to the fortnight *already under
 *   way* and have its days rebuilt on the spot. The rebuild is served from the
 *   library and spends no generation, so three is about how much churn a lived
 *   plan can take, not about cost.
 *
 * Nothing about safety, allergies or the quality of a plan is behind this, and
 * nothing ever should be. A free account gets the same allergy gate, the same
 * catalogue and the same nutrition maths. What is sold is *more of the thing
 * that costs us money to produce*, which is the only honest thing to sell here.
 */
export type Tier = 'free' | 'premium';

export type Allowances = {
  readonly eventsPerPlan: number;
  readonly mealSwapsPerPlan: number;
  readonly midPlanEventsPerPlan: number;
  readonly planRedosPerFortnight: number;
};

const BY_TIER: Readonly<Record<Tier, Allowances>> = {
  free: { eventsPerPlan: 3, mealSwapsPerPlan: 5, midPlanEventsPerPlan: 0, planRedosPerFortnight: 1 },
  premium: { eventsPerPlan: 10, mealSwapsPerPlan: 20, midPlanEventsPerPlan: 3, planRedosPerFortnight: 3 }
};

/** The free tier, still named for the callers whose answer does not depend on a person. */
export const ALLOWANCES = BY_TIER.free;

/**
 * What this tier allows.
 *
 * An unknown tier falls back to free rather than throwing. This is read on the
 * path that decides whether somebody may spend a model call, and the failure
 * that matters is the one where a bad value quietly grants more than it should
 * — so the fallback is the smaller number, always.
 */
export function allowancesFor(tier: Tier | null | undefined): Allowances {
  return tier === 'premium' ? BY_TIER.premium : BY_TIER.free;
}

export type PlanRedoStanding = {
  readonly allowed: boolean;
  /** Whether the next generation would start a new fortnight or redo the one in progress. */
  readonly kind: 'new_fortnight' | 'redo';
  readonly limit: number;
  /** The first day a new fortnight may be generated, when a redo is no longer allowed. */
  readonly nextAt: string | null;
  readonly used: number;
};

/**
 * An allowance that counts down: how many, how many are gone, how many are
 * left, and whether one more is permitted.
 *
 * One shape for every counted allowance rather than one per feature, because
 * the screen sentence is the same sentence — *"2 of 3 left"* — and a second
 * shape would only be a second way to render it.
 */
export type CountedStanding = { readonly allowed: boolean; readonly limit: number; readonly remaining: number; readonly used: number };

export type MealSwapStanding = CountedStanding;

/**
 * Generating the next fortnight is always allowed: that is the product. Only
 * *redoing* the fortnight in progress is counted, and the count comes from the
 * plan chain, not a calendar — see `redosInFortnight`.
 */
export function planRedoStanding(
  active: { readonly endDate: string } | undefined,
  redosUsed: number,
  today: string,
  tier: Tier = 'free'
): PlanRedoStanding {
  const limit = allowancesFor(tier).planRedosPerFortnight;

  if (!active || active.endDate < today) {
    return { allowed: true, kind: 'new_fortnight', limit, nextAt: null, used: 0 };
  }

  const allowed = redosUsed < limit;

  return { allowed, kind: 'redo', limit, nextAt: allowed ? null : dayAfter(active.endDate), used: redosUsed };
}

export function mealSwapStanding(used: number, tier: Tier = 'free'): MealSwapStanding {
  return countDown(used, allowancesFor(tier).mealSwapsPerPlan);
}

/**
 * How many more days that eat for something this fortnight may hold (`0044`).
 *
 * Counted over the plan's own window rather than over a calendar month: an
 * event belongs to the fortnight its loaded days fall in, and that is the unit
 * the person experiences.
 */
export function eventStanding(used: number, tier: Tier = 'free'): CountedStanding {
  return countDown(used, allowancesFor(tier).eventsPerPlan);
}

/**
 * Whether the fortnight already under way may be rebuilt for one more event
 * (`0044`).
 *
 * Free is zero, and that is the whole of the difference: a free account's event
 * is read at the next generation, exactly as `0043` shipped it. The standing
 * still answers `allowed: false` with `limit: 0` rather than being absent, so
 * the screen has one thing to read whichever tier is asking.
 */
export function midPlanEventStanding(used: number, tier: Tier = 'free'): CountedStanding {
  return countDown(used, allowancesFor(tier).midPlanEventsPerPlan);
}

function countDown(used: number, limit: number): CountedStanding {
  return { allowed: used < limit, limit, remaining: Math.max(limit - used, 0), used };
}

/**
 * How many times the fortnight in progress has already been redone.
 *
 * `createPlanAtomically` stamps a plan `redo` when it was generated while the
 * previous one still had days to run. The chain is walked from the active plan
 * backwards, newest first, counting stamped plans and stopping at the first that
 * is not one: that plan opened the fortnight, and everything behind it belongs
 * to earlier ones. Plans from before the stamp existed carry none, so a person
 * whose history predates the allowance starts with it untouched. No calendar
 * arithmetic, no extra column.
 */
export function redosInFortnight(chainFromActive: readonly { readonly redo: boolean }[]): number {
  let count = 0;

  for (const plan of chainFromActive) {
    if (!plan.redo) {
      break;
    }

    count += 1;
  }

  return count;
}

function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}
