import { ProfileRepository } from '#repositories/Profile';
import { ProgressRepository } from '#repositories/Progress';
import type { LogWeight, ProgressEntry } from 'core/entities/Progress';

/** How much history the dashboard needs to show a direction rather than a number. */
const RECENT_LIMIT = 30;

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
  }
};
