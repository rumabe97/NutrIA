import { CheckInRepository } from '#repositories/CheckIn';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { PlanRepository } from '#repositories/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { ProgressRepository } from '#repositories/Progress';

import type { DifficultyAnswer, HungerAnswer, SubmitCheckIn } from 'core/entities/CheckIn';
import type { PlanStats } from '#repositories/CheckIn';

/**
 * How far the calorie target moves on "I was left hungry" / "it was too much"
 * ([`0018`](../../../../docs/decisions/0018-the-fortnight-closes-with-a-check-in.md)).
 * Five per cent, clamped to the same bounds an edit by hand gets: enough to
 * feel next fortnight, never past what the equations call safe.
 */
const PORTION_NUDGE = 0.05;

const HUNGER_RATING: Record<HungerAnswer, number> = { hungry: 1, right: 2, too_much: 3 };
const DIFFICULTY_RATING: Record<DifficultyAnswer, number> = { easy: 1, hard: 3, ok: 2 };

export interface CheckInStatusView {
  /** Meals marked eaten over meals with any mark, or null when nothing was marked. */
  adherence: number | null;
  done: boolean;
  due: boolean;
  plan: { id: string; endDate: string; startDate: string; status: string } | null;
  stats: PlanStats;
}

export interface CheckInResultView {
  targets: { fromKcal: number; toKcal: number } | null;
  weightLogged: boolean;
}

/** What the next plan is told about the last fortnight, in the person's terms. */
export type CheckInForGeneration = {
  readonly comments: string | null;
  readonly difficulty: DifficultyAnswer;
  readonly hunger: HungerAnswer;
  readonly satisfaction: number;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function answerFor<T extends string>(table: Record<T, number>, rating: number | null, fallback: T): T {
  return ((Object.keys(table) as T[]).find(key => table[key] === rating) ?? fallback);
}

export const CheckInController = {
  /** The last fortnight's answers, for the prompt; nothing when there are none. */
  async latestForGeneration(userId: string): Promise<CheckInForGeneration | null> {
    const latest = await CheckInRepository.findLatest(userId);

    if (!latest) {return null;}

    return {
      comments: latest.comments,
      difficulty: answerFor(DIFFICULTY_RATING, latest.difficultyRating, 'ok'),
      hunger: answerFor(HUNGER_RATING, latest.hungerRating, 'right'),
      satisfaction: latest.satisfactionRating ?? 3
    };
  },

  /**
   * Whether a check-in is due: the latest plan has reached its last day and has
   * none yet. The latest plan rather than the active one, so a fortnight can
   * still be closed after the next one was generated.
   */
  async status(userId: string): Promise<CheckInStatusView> {
    const [latest] = await PlanRepository.findChain(userId);

    if (!latest) {return { adherence: null, done: false, due: false, plan: null, stats: { completed: 0, planned: 0, skipped: 0, total: 0 } };}

    const [existing, stats] = await Promise.all([CheckInRepository.findByPlan(userId, latest.id), CheckInRepository.planStats(userId, latest.id)]);
    const marked = stats.completed + stats.skipped;

    return {
      adherence: marked > 0 ? Math.round((stats.completed / marked) * 100) : null,
      done: existing !== undefined,
      due: existing === undefined && isoToday() >= latest.endDate,
      plan: { id: latest.id, endDate: latest.endDate, startDate: latest.startDate, status: latest.status },
      stats
    };
  },

  /**
   * Records the fortnight. The weight goes to the progress log first, so the
   * targets read below already follow it; then the portion answer nudges the
   * calorie target through the same override an edit by hand uses, clamped by
   * the same bounds. Words stay words: they reach the next plan's prompt.
   */
  async submit(userId: string, input: SubmitCheckIn): Promise<CheckInResultView> {
    const plan = await PlanRepository.findById(userId, input.planId);

    if (!plan) {throw new NotFoundError('Plan not found');}

    if (await CheckInRepository.findByPlan(userId, plan.id)) {throw new ConflictError('This fortnight has its check-in already');}

    const today = isoToday();

    await CheckInRepository.create(userId, {
      comments: input.comments?.trim() ? input.comments.trim() : null,
      completedAt: today,
      difficultyRating: DIFFICULTY_RATING[input.difficulty],
      dueOn: plan.endDate,
      hungerRating: HUNGER_RATING[input.hunger],
      planId: plan.id,
      satisfactionRating: input.satisfaction,
      weightKg: input.weightKg ?? null
    });

    if (input.weightKg) {await ProgressRepository.upsertWeight(userId, today, input.weightKg);}

    let targets: CheckInResultView['targets'] = null;

    if (input.hunger !== 'right') {
      const current = (await ProfileController.getFullProfile(userId)).targets;

      if (current) {
        const factor = input.hunger === 'hungry' ? 1 + PORTION_NUDGE : 1 - PORTION_NUDGE;
        const toKcal = Math.round(Math.min(Math.max(current.effective.kcal * factor, current.bounds.floorKcal), current.bounds.ceilingKcal));

        if (toKcal !== Math.round(current.effective.kcal)) {
          await ProfileController.updateTargets(userId, { kcal: toKcal });
          targets = { fromKcal: Math.round(current.effective.kcal), toKcal };
        }
      }
    }

    return { targets, weightLogged: Boolean(input.weightKg) };
  }
};
