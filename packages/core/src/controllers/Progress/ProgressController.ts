import { CheckInRepository } from '#repositories/CheckIn';
import { difficultyAnswer, hungerAnswer } from 'core/entities/CheckIn';
import { LIVED_PLAN_STATUSES } from 'core/entities/Plan';
import { PlanRepository } from '#repositories/Plan';
import { ProfileRepository } from '#repositories/Profile';
import { ProgressRepository } from '#repositories/Progress';

import type { DifficultyAnswer, HungerAnswer } from 'core/entities/CheckIn';
import type { Goal } from 'core/entities/Profile';
import type { LogWeight, ProgressEntry } from 'core/entities/Progress';

/** How much history the dashboard needs to show a direction rather than a number. */
const RECENT_LIMIT = 30;
/** More than a year of daily weights; the progress screen draws whatever there is. */
const HISTORY_LIMIT = 400;
const FORTNIGHT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeightView {
  /** Latest minus the earliest reading in the window. Null until there are two. */
  changeKg: number | null;
  /** Most recent first. */
  entries: readonly { loggedOn: string; weightKg: number }[];
  /** The most recent logged weight, or null before anything is logged. */
  latestKg: number | null;
  /** The weight the plan's targets were computed against, for comparison. */
  startingWeightKg: number | null;
}

function present(entries: readonly ProgressEntry[], startingWeightKg: number | null): WeightView {
  const weighed = entries.filter((entry): entry is ProgressEntry & { weightKg: number } => entry.weightKg !== null);
  const latest = weighed.at(0) ?? null;
  const earliest = weighed.at(-1) ?? null;

  return {
    // A single reading is a number, not a trend. Reporting "0.0 kg" against
    // itself would be a claim about a direction nobody has measured yet.
    changeKg: latest && earliest && latest !== earliest ? Math.round((latest.weightKg - earliest.weightKg) * 10) / 10 : null,
    entries: weighed.map(entry => ({ loggedOn: entry.loggedOn, weightKg: entry.weightKg })),
    latestKg: latest?.weightKg ?? null,
    startingWeightKg
  };
}

export interface FortnightView {
  /** Meals marked eaten over meals with any mark, in percent — the check-in's definition — or null when nothing was marked. */
  adherence: number | null;
  checkIn: { difficulty: DifficultyAnswer | null; hunger: HungerAnswer | null; satisfaction: number | null; weightKg: number | null } | null;
  /** The last day this plan was lived: its own end, or the day before the plan that replaced it began. */
  endDate: string;
  /** `soFar` is every meal whose day has arrived; the rest of the plan is not yet a fact. */
  meals: { eaten: number; skipped: number; soFar: number };
  planId: string;
  /** True when a later plan began before this one ended — a redo, or a regeneration. */
  replaced: boolean;
  startDate: string;
  status: string;
  version: number;
}

export interface ProgressSummaryView {
  /** Newest first. */
  fortnights: readonly FortnightView[];
  overall: { adherence: number | null; eaten: number; marked: number };
  weight: {
    /** Latest minus the goal's starting weight; minus the first reading when the goal has none. Null with fewer than two figures. */
    changeKg: number | null;
    /** Oldest to newest, so a chart reads left to right. */
    entries: readonly { loggedOn: string; weightKg: number }[];
    /** Latest minus the reading on or before a fortnight earlier. Null without one. */
    fortnightChangeKg: number | null;
    goalType: Goal['type'] | null;
    latestKg: number | null;
    startingWeightKg: number | null;
    targetWeightKg: number | null;
    /** Target minus latest: negative means there is weight to lose, positive to gain. */
    toTargetKg: number | null;
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function daysBefore(isoDate: string, days: number): string {
  return new Date(new Date(`${isoDate}T00:00:00Z`).getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function summariseWeight(entries: readonly ProgressEntry[], goal: Goal | undefined): ProgressSummaryView['weight'] {
  const weighed = entries
    .filter((entry): entry is ProgressEntry & { weightKg: number } => entry.weightKg !== null)
    .map(entry => ({ loggedOn: entry.loggedOn, weightKg: entry.weightKg }))
    .reverse();
  const latest = weighed.at(-1) ?? null;
  const first = weighed.at(0) ?? null;
  const starting = goal?.startingWeightKg ?? null;
  const target = goal?.targetWeightKg ?? null;
  const baseline = starting ?? (weighed.length > 1 ? first?.weightKg ?? null : null);
  const fortnightAgo = latest ? weighed.filter(entry => entry.loggedOn <= daysBefore(latest.loggedOn, FORTNIGHT_DAYS)).at(-1) ?? null : null;

  return {
    changeKg: latest && baseline !== null ? round1(latest.weightKg - baseline) : null,
    entries: weighed,
    fortnightChangeKg: latest && fortnightAgo ? round1(latest.weightKg - fortnightAgo.weightKg) : null,
    goalType: goal?.type ?? null,
    latestKg: latest?.weightKg ?? null,
    startingWeightKg: starting,
    targetWeightKg: target,
    toTargetKg: latest && target !== null ? round1(target - latest.weightKg) : null
  };
}

export const ProgressController = {
  async getWeight(userId: string): Promise<WeightView> {
    const [entries, goal] = await Promise.all([ProgressRepository.findRecent(userId, RECENT_LIMIT), ProfileRepository.findActiveGoal(userId)]);

    return present(entries, goal?.startingWeightKg ?? null);
  },

  /**
   * Logs today's weight.
   *
   * Deliberately **does not** move the goal's `startingWeightKg`, which is the
   * baseline every nutrition target was computed against. Silently re-deriving
   * someone's calories because they stepped on a scale would change the number
   * they act on without their asking — targets are corrected on the profile,
   * where the change is visible and reversible.
   */
  async logWeight(userId: string, input: LogWeight): Promise<WeightView> {
    const loggedOn = input.loggedOn ?? new Date().toISOString().slice(0, 10);

    await ProgressRepository.upsertWeight(userId, loggedOn, input.weightKg);

    return ProgressController.getWeight(userId);
  },

  /**
   * Everything the product has kept about how it is going, read back in one
   * piece: the weight line, and every fortnight lived with how its meals were
   * marked and what the check-in said. Nothing here is collected for this
   * screen; it is the weights, the marks and the check-ins, shown.
   */
  async summary(userId: string, today = new Date().toISOString().slice(0, 10)): Promise<ProgressSummaryView> {
    const [entries, goal, chain, marks, checkIns] = await Promise.all([
      ProgressRepository.findRecent(userId, HISTORY_LIMIT),
      ProfileRepository.findActiveGoal(userId),
      PlanRepository.findChain(userId),
      ProgressRepository.mealMarksByDay(userId, today),
      CheckInRepository.findAll(userId)
    ]);

    // Newest first. A plan is *replaced* when the next lived plan began before
    // it ended — a redo, or a regeneration — and from that day on its meals were
    // never on anyone's table: they are counted up to the day before, and a
    // plan replaced before a single meal was marked was not a fortnight at all.
    const lived = chain.filter(plan => LIVED_PLAN_STATUSES.has(plan.status));
    const fortnights = lived.flatMap((plan, index): FortnightView[] => {
      const successor = lived[index - 1];
      const replaced = successor !== undefined && successor.startDate <= plan.endDate;
      const endDate = replaced ? daysBefore(successor.startDate, 1) : plan.endDate;
      const counted = marks.filter(mark => mark.planId === plan.id && mark.date <= endDate);
      const count = (status: (typeof counted)[number]['status']) => counted.filter(mark => mark.status === status).reduce((sum, mark) => sum + mark.n, 0);
      const eaten = count('completed');
      const skipped = count('skipped');

      if (replaced && eaten + skipped === 0) {return [];}

      const checkIn = checkIns.find(row => row.planId === plan.id);

      return [
        {
          adherence: percent(eaten, eaten + skipped),
          checkIn: checkIn
            ? {
                difficulty: difficultyAnswer(checkIn.difficultyRating),
                hunger: hungerAnswer(checkIn.hungerRating),
                satisfaction: checkIn.satisfactionRating,
                weightKg: checkIn.weightKg
              }
            : null,
          endDate,
          meals: { eaten, skipped, soFar: eaten + skipped + count('planned') },
          planId: plan.id,
          replaced,
          startDate: plan.startDate,
          status: plan.status,
          version: plan.version
        }
      ];
    });
    const eaten = fortnights.reduce((sum, fortnight) => sum + fortnight.meals.eaten, 0);
    const marked = fortnights.reduce((sum, fortnight) => sum + fortnight.meals.eaten + fortnight.meals.skipped, 0);

    return { fortnights, overall: { adherence: percent(eaten, marked), eaten, marked }, weight: summariseWeight(entries, goal) };
  }
};
