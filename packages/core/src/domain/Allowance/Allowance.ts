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
 * - **Fixed meals** go from one to three (`0098`, `0099`). A standing weekly rule
 *   — *"every Friday dinner is tortilla de patata"* — is the one allowance that
 *   constrains the *plan* rather than counting an action: one rule lands on two
 *   days of every fortnight, for ever. It costs no model call at all; what it
 *   spends is the promise that every day lands inside 5% on all four macros,
 *   which is why it is the only `structural` number here. Free gets one so the
 *   feature can be tried before it is paid for.
 * - **Dish requests** go from none to three a month (report `0011`, and the
 *   `marketing` audit in `docs/reference/marketing/dish-requests.md`). Asking us
 *   to write a dish the library does not have is the one thing here that spends
 *   money every time it succeeds — about 0.04 $, of which 94–98% is the picture
 *   the dish is then drawn with. Free gets none, and the reason is arithmetic
 *   rather than meanness: free is the population that scales, and one request
 *   per account at a hundred sign-ups a month is 4 $ a month for ever against a
 *   10 $ pot that stops drawing for *everybody* when it runs out. Three is one
 *   per standing fixed meal premium may hold, which is what makes it bind
 *   exactly where the want is and keeps it from being another unreachable ten.
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
  /**
   * Dishes a person may ask us to write, per calendar month (report `0011`).
   *
   * **Spent when a dish is stored, never when a request is made.** The output
   * gate can refuse what the model writes back, and a rejection costs a
   * twentieth of a success — so giving those away is nearly free, and it is what
   * makes the number sayable: three a month is three dishes, not three tries.
   */
  readonly dishRequestsPerMonth: number;
  readonly eventsPerPlan: number;
  /** Standing weekly rules fixing one meal of one day (`0098`, `0099`). */
  readonly fixedMeals: number;
  readonly mealSwapsPerPlan: number;
  readonly midPlanEventsPerPlan: number;
  readonly planRedosPerFortnight: number;
};

const BY_TIER: Readonly<Record<Tier, Allowances>> = {
  free: { dishRequestsPerMonth: 0, eventsPerPlan: 3, fixedMeals: 1, mealSwapsPerPlan: 5, midPlanEventsPerPlan: 0, planRedosPerFortnight: 1 },
  // Seven events and not ten: the eighth was never possible. A load is one to
  // three days and two events may not share one, so a fortnight admits seven —
  // `0044` named that rule as the bound and then wrote ten anyway. Nobody loses
  // anything they could reach, and the table stops promising what it cannot
  // give. Every other number here is what it has always been; moving those is a
  // product decision, and the console is where it will be made (`0097`).
  // Three fixed meals, chosen by the owner on 2026-10-13 against a measurement
  // that refused nothing up to four (`0099`): it is the number the `marketing`
  // audit priced as worth paying for, and three standing rules still leave
  // eleven days of every fourteen to the planner.
  premium: { dishRequestsPerMonth: 3, eventsPerPlan: 7, fixedMeals: 3, mealSwapsPerPlan: 20, midPlanEventsPerPlan: 3, planRedosPerFortnight: 3 }
};

export type AllowanceName = keyof Allowances;

export const ALLOWANCE_NAMES = [
  'dishRequestsPerMonth',
  'eventsPerPlan',
  'fixedMeals',
  'mealSwapsPerPlan',
  'midPlanEventsPerPlan',
  'planRedosPerFortnight'
] as const satisfies readonly AllowanceName[];

/**
 * What kind of number this is, which decides who may move it (`0097`).
 *
 * - `commercial`: its worst case is that somebody pays for something they could
 *   have had free, or has a thinner product than they chose. Move it freely.
 * - `financial`: moving it spends money from a pot everybody shares — the
 *   month's pictures, under one cap that stops drawing for **everyone** when it
 *   is reached. Movable, never without the spend in front of whoever moves it.
 * - `structural`: moving it up spends the promise that every day of every plan
 *   lands inside 5% on all four macros. The console cannot know what a raise
 *   costs, and the failure is not an error — it is a day delivered with an
 *   advisory, for everybody on that tier, found later. **A structural limit's
 *   ceiling is the number shipped in the code**, so the console may only lower
 *   it; raising one is a measurement and a deploy, never a click.
 */
export type AllowanceKind = 'commercial' | 'financial' | 'structural';

export type AllowanceLimits = {
  /** The highest the console may set it. For a `structural` one this is the shipped default. */
  readonly ceiling: number;
  readonly floor: number;
  readonly kind: AllowanceKind;
  /**
   * Why the ceiling is the ceiling, in one line.
   *
   * For whoever reads the code or the API, and **not** the sentence the console
   * renders: that one is in the dictionaries, in the reader's language. Both say
   * the same thing on purpose — a reason that lived only in the console could be
   * changed without the number it justifies.
   */
  readonly why: string;
};

/**
 * The bounds the console may not leave, and the reason for each (`0097`).
 *
 * Written here rather than in the console so the answer is the same whoever
 * asks — the route that writes, the page that renders and the resolution that
 * reads all take their bounds from this table. A ceiling with no reason beside
 * it is how `0044` set ten events on a fortnight that admits seven: the reason
 * is what a future change has to argue with.
 */
export const ALLOWANCE_BOUNDS: Readonly<Record<AllowanceName, AllowanceLimits>> = {
  dishRequestsPerMonth: {
    ceiling: 6,
    floor: 0,
    kind: 'financial',
    why: 'Six a month is every standing rule rewritten twice over, which is churn and not a routine; the money does not bound this one — at about 0.04 $ a stored dish, nearly all of it the picture, even six a month costs what a single redo’s pictures do.'
  },
  eventsPerPlan: {
    ceiling: 7,
    floor: 0,
    kind: 'commercial',
    why: 'Above seven has no effect: a load is one to three days and two events may not share one, so a fortnight holds seven at most.'
  },
  fixedMeals: {
    ceiling: 3,
    floor: 0,
    kind: 'structural',
    why: 'Three is the number shipped, so three is the ceiling (`0099`). Measured on 982 dishes, three standing rules leave the plans as balanced as plans with none — 1958 of 1960 days in band, the thirteen-rule mean at 77.7% against a no-rule 77.1% — and four was no worse; the limit is that eight of fourteen days would carry a meal decided in advance, which is a product judgement and not a measurement.'
  },
  mealSwapsPerPlan: {
    ceiling: 28,
    floor: 0,
    kind: 'commercial',
    why: 'Twenty-eight is a fortnight’s lunches and dinners; past that a swap limit names nothing.'
  },
  midPlanEventsPerPlan: {
    ceiling: 7,
    floor: 0,
    kind: 'commercial',
    why: 'A fortnight cannot be rebuilt for more events than it holds, so this resolves against that tier’s own events as well.'
  },
  planRedosPerFortnight: {
    ceiling: 6,
    floor: 0,
    kind: 'financial',
    why: 'Six a fortnight is twelve a month: about 3–6 $ of pictures for one account, against a 10 $ month shared by everybody.'
  }
};

/** The free tier, still named for the callers whose answer does not depend on a person. */
export const ALLOWANCES = BY_TIER.free;

/** One limit as the settings table stores it, before anything has been believed about it. */
export type StoredAllowance = { readonly name: string; readonly tier: string; readonly value: number };

/** Whether a stored number may be believed: a whole number, inside its own bounds. */
function believable(name: AllowanceName, value: number): boolean {
  const bounds = ALLOWANCE_BOUNDS[name];

  return Number.isInteger(value) && value >= bounds.floor && value <= bounds.ceiling;
}

/**
 * What each tier is really allowed, from what the console has stored (`0097`).
 *
 * **The order matters and is the whole of the correctness here**, so it is
 * written as steps rather than left to the reading:
 *
 * 1. **Each number on its own.** A stored value is believed when it is a whole
 *    number inside its bounds, and otherwise the code's default is used —
 *    *not* the nearest bound. Missing, unreadable, fractional, below the floor
 *    and above the ceiling all mean the same thing: nobody has validly moved
 *    this, so it is what shipped. Clamping up instead would turn a typo into a
 *    grant, and `0042`'s rule is that the fallback is always the smaller number.
 *    A row naming a limit this version does not have is ignored.
 * 2. **Premium is never below free.** Resolved on read and not only refused on
 *    write, because a pair that was valid when it was written is invalidated by
 *    raising free afterwards, and nobody would be there to see it.
 * 3. **Then the pairs that depend on each other.** Mid-plan events cannot
 *    exceed the events that tier may declare at all, against *that tier's* own
 *    events.
 *
 * Steps 2 and 3 are taken **per tier, free first**, and that order is load
 * bearing rather than tidy. Read against free's *unclamped* mid-plan number,
 * step 2 would raise premium to a figure free itself never gets — and the
 * write-time pair check compares against the clamped one, so it could not catch
 * it: an admin lowering premium's mid-plan events would be answered 200, the
 * trail would record the change, and premium would keep the old number. Free is
 * resolved in full first, and premium is then held above *that*.
 */
export function resolveAllowances(stored: readonly StoredAllowance[] = []): Readonly<Record<Tier, Allowances>> {
  const believed = new Map<string, number>();

  for (const row of stored) {
    const name = ALLOWANCE_NAMES.find(known => known === row.name);

    if (name && (row.tier === 'free' || row.tier === 'premium') && believable(name, row.value)) {
      believed.set(`${row.tier}:${name}`, row.value);
    }
  }

  // 1
  const of = (tier: Tier, name: AllowanceName): number => believed.get(`${tier}:${name}`) ?? BY_TIER[tier][name];
  const free: Allowances = {
    dishRequestsPerMonth: of('free', 'dishRequestsPerMonth'),
    eventsPerPlan: of('free', 'eventsPerPlan'),
    fixedMeals: of('free', 'fixedMeals'),
    mealSwapsPerPlan: of('free', 'mealSwapsPerPlan'),
    midPlanEventsPerPlan: of('free', 'midPlanEventsPerPlan'),
    planRedosPerFortnight: of('free', 'planRedosPerFortnight')
  };
  // 3, for free
  const freeFinal: Allowances = { ...free, midPlanEventsPerPlan: Math.min(free.midPlanEventsPerPlan, free.eventsPerPlan) };
  // 2, against the free that actually applies
  const premium: Allowances = {
    dishRequestsPerMonth: Math.max(of('premium', 'dishRequestsPerMonth'), freeFinal.dishRequestsPerMonth),
    eventsPerPlan: Math.max(of('premium', 'eventsPerPlan'), freeFinal.eventsPerPlan),
    fixedMeals: Math.max(of('premium', 'fixedMeals'), freeFinal.fixedMeals),
    mealSwapsPerPlan: Math.max(of('premium', 'mealSwapsPerPlan'), freeFinal.mealSwapsPerPlan),
    midPlanEventsPerPlan: Math.max(of('premium', 'midPlanEventsPerPlan'), freeFinal.midPlanEventsPerPlan),
    planRedosPerFortnight: Math.max(of('premium', 'planRedosPerFortnight'), freeFinal.planRedosPerFortnight)
  };

  // 3, for premium. It cannot drop below free's: premium's events are already at
  // least free's, and free's mid-plan is already at most free's events.
  return { free: freeFinal, premium: { ...premium, midPlanEventsPerPlan: Math.min(premium.midPlanEventsPerPlan, premium.eventsPerPlan) } };
}

/**
 * What this tier allows **as shipped** — the default, and the fallback when the
 * console has stored nothing believable (`resolveAllowances`, `0097`).
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
  limits: Allowances = ALLOWANCES
): PlanRedoStanding {
  const limit = limits.planRedosPerFortnight;

  if (!active || active.endDate < today) {
    return { allowed: true, kind: 'new_fortnight', limit, nextAt: null, used: 0 };
  }

  const allowed = redosUsed < limit;

  return { allowed, kind: 'redo', limit, nextAt: allowed ? null : dayAfter(active.endDate), used: redosUsed };
}

export function mealSwapStanding(used: number, limits: Allowances = ALLOWANCES): MealSwapStanding {
  return countDown(used, limits.mealSwapsPerPlan);
}

/**
 * How many more days that eat for something this fortnight may hold (`0044`).
 *
 * Counted over the plan's own window rather than over a calendar month: an
 * event belongs to the fortnight its loaded days fall in, and that is the unit
 * the person experiences.
 */
export function eventStanding(used: number, limits: Allowances = ALLOWANCES): CountedStanding {
  return countDown(used, limits.eventsPerPlan);
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
export function midPlanEventStanding(used: number, limits: Allowances = ALLOWANCES): CountedStanding {
  return countDown(used, limits.midPlanEventsPerPlan);
}

/**
 * One counted allowance's standing: how many, how many are gone, how many are
 * left, and whether one more is permitted.
 *
 * Exported for the allowances whose unit is not "per plan" — a standing fixed
 * meal is counted over the account and not over a fortnight (`0099`), so it has
 * no window to name and no wrapper of its own worth writing.
 */
export function countedStanding(used: number, limit: number): CountedStanding {
  return { allowed: used < limit, limit, remaining: Math.max(limit - used, 0), used };
}

function countDown(used: number, limit: number): CountedStanding {
  return countedStanding(used, limit);
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
 * arithmetic, no extra column. A pending plan, when there is one, heads the
 * chain: it is the fortnight under way for this count.
 */
export function redosInFortnight(
  chainFromActive: readonly { readonly opens?: boolean; readonly redo: boolean; readonly replacedRedos?: number }[]
): number {
  let count = 0;

  for (const plan of chainFromActive) {
    if (!plan.redo) {
      break;
    }

    // A plan that replaced plans still under review (`0060`), or a plan
    // waiting for its day (project 015), carries the redos they were: deleted,
    // they are not in the chain, and they were spent.
    count += 1 + (plan.replacedRedos ?? 0);

    // A redo that replaced the plan waiting to open the next fortnight is that
    // fortnight's first plan (project 015): the one it replaced, which marked
    // the boundary, is gone, so the stamp marks it instead.
    if (plan.opens) {
      break;
    }
  }

  return count;
}

/** How far ahead a plan may be asked to start (project 015): today, or one of the next seven days. */
export const MAX_START_DAYS_AHEAD = 7;

/**
 * What starting a plan on `start` means (project 015), with `active` the plan
 * being lived — or the one under review that counts as it — and `today` the
 * person's calendar day:
 *
 * - no plan, or a start after it ends: the next fortnight, free;
 * - a start on or before its end: a redo, and `cuts` is the day it now ends —
 *   the day before the start. A start of today is the redo it always was:
 *   the plan is completed rather than cut, which the repository decides;
 * - a plan already waiting for its day (`waiting`) is replaced, and that is a
 *   redo whatever the start.
 *
 * `scheduled` says the new plan waits: its first day is after today.
 */
export type StartMeaning = { readonly cuts: string | null; readonly kind: 'new_fortnight' | 'redo'; readonly scheduled: boolean };

export function startMeaning(active: { readonly endDate: string } | undefined, start: string, today: string, waiting = false): StartMeaning {
  const scheduled = start > today;

  if (!active || start > active.endDate) {
    return { cuts: null, kind: waiting ? 'redo' : 'new_fortnight', scheduled };
  }

  return { cuts: dayBefore(start), kind: 'redo', scheduled };
}

function dayBefore(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().slice(0, 10);
}

function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}
