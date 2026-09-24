import { CareRepository } from '#repositories/Care';
import { CheckInRepository } from '#repositories/CheckIn';
import { ConflictError, NotFoundError } from 'core/entities/Error';
import { PlanRepository } from '#repositories/Plan';
import { ProfileController } from 'core/controllers/Profile';
import { ProfileRepository } from '#repositories/Profile';
import { ProgressRepository } from '#repositories/Progress';

import { DIFFICULTY_RATING, HUNGER_RATING } from 'core/entities/CheckIn';

import type { DifficultyAnswer, HungerAnswer, SubmitCheckIn } from 'core/entities/CheckIn';
import type { PlanStats } from '#repositories/CheckIn';
import type { ResolvedTargets } from 'core/domain/Nutrition';

/**
 * How far the calorie target moves on "I was left hungry" / "it was too much"
 * ([`0018`](../../../../docs/decisions/0018-the-fortnight-closes-with-a-check-in.md)).
 * Five per cent, clamped to the same bounds an edit by hand gets: enough to
 * feel next fortnight, never past what the equations call safe.
 */
const PORTION_NUDGE = 0.05;

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

/**
 * Whether a fortnight's check-in is due: the plan has reached its last day and
 * has not been answered. One definition, read by the client's own status and
 * by a professional's list (`CareController.clients`), so the two never
 * disagree about the same fortnight.
 */
export function isCheckInDue(plan: { readonly endDate: string }, answered: boolean, today: string): boolean {
  return !answered && today >= plan.endDate;
}

function answerFor<T extends string>(table: Record<T, number>, rating: number | null, fallback: T): T {
  return (Object.keys(table) as T[]).find(key => table[key] === rating) ?? fallback;
}

/**
 * What the portion nudge would move kcal to, from a set of targets — the exact
 * formula `submit` applies, exported so a professional's read of a check-in
 * (`CareController.overview`) can show the same number as a suggestion,
 * without a second copy of the maths (`0059`, Phase 6). Null for "right", and
 * null when the clamp leaves the figure unchanged.
 */
export function nudgedKcal(hunger: HungerAnswer, targets: Pick<ResolvedTargets, 'bounds' | 'effective'>): number | null {
  if (hunger === 'right') {
    return null;
  }

  const factor = hunger === 'hungry' ? 1 + PORTION_NUDGE : 1 - PORTION_NUDGE;
  const toKcal = Math.round(Math.min(Math.max(targets.effective.kcal * factor, targets.bounds.floorKcal), targets.bounds.ceilingKcal));

  return toKcal !== Math.round(targets.effective.kcal) ? toKcal : null;
}

/**
 * Whether this fortnight's nudge is somebody else's to give — an `active` link
 * **and** a stored override that names a professional (owner's decision,
 * 2026-09-24). The raw column, not `findTargetOverride`'s merged `setBy`: an
 * override with every numeric field null resolves as "no override at all"
 * (`resolveTargets`), which would read as `self` even though the column names
 * a professional.
 */
async function supervisedElsewhere(userId: string): Promise<boolean> {
  const [link, setterId] = await Promise.all([CareRepository.clientLink(userId), ProfileRepository.findTargetSetterId(userId)]);

  return link?.link.status === 'active' && setterId !== null;
}

export const CheckInController = {
  /** The last fortnight's answers, for the prompt; nothing when there are none. */
  async latestForGeneration(userId: string): Promise<CheckInForGeneration | null> {
    const latest = await CheckInRepository.findLatest(userId);

    if (!latest) {
      return null;
    }

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
   * still be closed after the next one was generated. A plan waiting for a
   * professional's review is not in the chain (`findChain` leaves it out,
   * `0060`): the client has not seen it, so it is not the fortnight they close.
   */
  async status(userId: string): Promise<CheckInStatusView> {
    const [latest] = await PlanRepository.findChain(userId);

    if (!latest) {
      return { adherence: null, done: false, due: false, plan: null, stats: { completed: 0, planned: 0, skipped: 0, total: 0 } };
    }

    const [existing, stats] = await Promise.all([CheckInRepository.findByPlan(userId, latest.id), CheckInRepository.planStats(userId, latest.id)]);
    const marked = stats.completed + stats.skipped;

    return {
      adherence: marked > 0 ? Math.round((stats.completed / marked) * 100) : null,
      done: existing !== undefined,
      due: isCheckInDue(latest, existing !== undefined, isoToday()),
      plan: { id: latest.id, endDate: latest.endDate, startDate: latest.startDate, status: latest.status },
      stats
    };
  },

  /**
   * Records the fortnight. The weight goes to the progress log first, so the
   * targets read below already follow it; then the portion answer nudges the
   * calorie target through the same override an edit by hand uses, clamped by
   * the same bounds. Words stay words: they reach the next plan's prompt.
   *
   * "Has this fortnight been answered?" and "answer it" are one statement, not
   * two. Asking first and inserting after let two submits fired together both
   * see *none* and both land — and everything below the insert runs per accepted
   * check-in, so the calorie target moved by two nudges for one fortnight.
   * `CheckInRepository.create` returns nothing when the plan already has its
   * check-in, and that refusal happens before any of it. The same uniqueness is
   * what makes a professional's notification (the caller's job, once this
   * returns) at most once too: a retried request or a concurrent one never
   * gets a second `recorded` row to act on.
   *
   * **The nudge never touches a professional's targets** (owner's decision,
   * 2026-09-24): with an `active` link whose override carries
   * `setByProfessionalId`, the answer is still recorded and the weight still
   * logged, but the targets and their mark stay exactly as they are — a
   * supervised client answering "hungry" must not silently make the whole
   * override their own, macros included (Phase 4's `LOG.md` note). The
   * professional sees the number the nudge would have set through their own
   * read of the check-in (`nudgedKcal`, `CareController.overview`) and applies
   * it, or does not, through their own targets route.
   */
  async submit(userId: string, input: SubmitCheckIn): Promise<CheckInResultView> {
    // A plan under review is not found here either (`0060`).
    const plan = await PlanRepository.findById(userId, input.planId);

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    const today = isoToday();

    const recorded = await CheckInRepository.create(userId, {
      comments: input.comments?.trim() ? input.comments.trim() : null,
      completedAt: today,
      difficultyRating: DIFFICULTY_RATING[input.difficulty],
      dueOn: plan.endDate,
      hungerRating: HUNGER_RATING[input.hunger],
      planId: plan.id,
      satisfactionRating: input.satisfaction,
      weightKg: input.weightKg ?? null
    });

    if (!recorded) {
      throw new ConflictError('This fortnight has its check-in already');
    }

    if (input.weightKg) {
      await ProgressRepository.upsertWeight(userId, today, input.weightKg);
    }

    let targets: CheckInResultView['targets'] = null;

    if (input.hunger !== 'right' && !(await supervisedElsewhere(userId))) {
      const current = (await ProfileController.getFullProfile(userId)).targets;

      if (current) {
        const toKcal = nudgedKcal(input.hunger, current);

        if (toKcal !== null) {
          await ProfileController.updateTargets(userId, { kcal: toKcal });
          targets = { fromKcal: Math.round(current.effective.kcal), toKcal };
        }
      }
    }

    return { targets, weightLogged: Boolean(input.weightKg) };
  }
};
