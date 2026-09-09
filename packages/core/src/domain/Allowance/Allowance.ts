/**
 * What the free tier allows, per person
 * ([`0015`](../../../../docs/decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md)).
 *
 * A premium tier raises these; that is the whole reason they are two numbers in
 * one place rather than rules spread over the routes that enforce them.
 */
export const ALLOWANCES = { mealSwapsPerPlan: 5, planRedosPerFortnight: 1 } as const;

export type PlanRedoStanding = {
  readonly allowed: boolean;
  /** Whether the next generation would start a new fortnight or redo the one in progress. */
  readonly kind: 'new_fortnight' | 'redo';
  readonly limit: number;
  /** The first day a new fortnight may be generated, when a redo is no longer allowed. */
  readonly nextAt: string | null;
  readonly used: number;
};

export type MealSwapStanding = {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly used: number;
};

/**
 * Generating the next fortnight is always allowed: that is the product. Only
 * *redoing* the fortnight in progress is counted, and the count comes from the
 * plan chain, not a calendar — see `redosInFortnight`.
 */
export function planRedoStanding(active: { readonly endDate: string } | undefined, redosUsed: number, today: string): PlanRedoStanding {
  const limit = ALLOWANCES.planRedosPerFortnight;

  if (!active || active.endDate < today) {return { allowed: true, kind: 'new_fortnight', limit, nextAt: null, used: 0 };}

  const allowed = redosUsed < limit;

  return { allowed, kind: 'redo', limit, nextAt: allowed ? null : dayAfter(active.endDate), used: redosUsed };
}

export function mealSwapStanding(used: number): MealSwapStanding {
  const limit = ALLOWANCES.mealSwapsPerPlan;

  return { allowed: used < limit, limit, remaining: Math.max(limit - used, 0), used };
}

/**
 * How many times the fortnight in progress has already been redone.
 *
 * `createPlanAtomically` stamps the plan it replaces with `completedAt` = the
 * new plan's start date. A predecessor completed *before* its own end date was
 * cut short — replaced mid-fortnight — so a redo. The chain is walked from the
 * active plan's immediate predecessor backwards and stops at the first plan that
 * ran its course: that one closed the previous fortnight, and everything behind
 * it belongs to it. No calendar arithmetic, no extra column.
 */
export function redosInFortnight(predecessors: readonly { readonly completedAt: string | null; readonly endDate: string }[]): number {
  let count = 0;

  for (const plan of predecessors) {
    if (plan.completedAt === null || plan.completedAt >= plan.endDate) {break;}

    count += 1;
  }

  return count;
}

function dayAfter(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}
