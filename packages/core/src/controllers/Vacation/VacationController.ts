import { ConflictError, InputParseError, NotFoundError } from 'core/entities/Error';
import { MAX_VACATION_DAYS } from 'core/entities/Vacation';
import { VacationRepository } from '#repositories/Vacation';
import { daysAway, isAway, problemWith } from 'core/domain/Vacation';
import { personToday } from 'core/controllers/Profile';

import type { PlanVacation, Vacation } from 'core/entities/Vacation';

// --- Presenters ---------------------------------------------------------------

/** One trip, plus the two things a screen asks: how long, and is it happening now. */
export interface VacationView {
  id: string;
  away: boolean;
  days: number;
  endsOn: string;
  startsOn: string;
}

function present(trip: Vacation, today: string): VacationView {
  return { id: trip.id, away: isAway(trip, today), days: daysAway(trip), endsOn: trip.endsOn, startsOn: trip.startsOn };
}

// --- Controller ---------------------------------------------------------------

// Every dated method takes the person's own day (`personToday`), the one their
// plan is laid out in; a caller — a test — may name it instead.

/**
 * Being away, and what it does to a plan (`0032`).
 *
 * Declaring a trip pauses the plan: every day at or after it moves forward by
 * the length of the trip, so those dates hold no meals at all. Nothing is
 * skipped, nothing is missed, no reminder is due — not because each of those was
 * taught about holidays, but because there is nothing there.
 */
export const VacationController = {
  /** Whether the person is away today — the one question every screen asks. */
  async away(userId: string, day?: string): Promise<VacationView | null> {
    const today = day ?? (await personToday(userId));

    const trips = await VacationRepository.findUpcoming(userId, today);

    return trips.map(trip => present(trip, today)).find(trip => trip.away) ?? null;
  },

  async cancel(userId: string, id: string, day?: string): Promise<void> {
    const today = day ?? (await personToday(userId));

    if (!(await VacationRepository.remove(userId, id, today))) {
      throw new NotFoundError(`Vacation "${id}" not found`);
    }
  },

  async list(userId: string, day?: string): Promise<readonly VacationView[]> {
    const today = day ?? (await personToday(userId));

    return (await VacationRepository.findUpcoming(userId, today)).map(trip => present(trip, today));
  },

  /**
   * Declares a trip. The plan moves with it, in the same transaction.
   *
   * The refusals are the interesting part, and each is about a thing that cannot
   * be undone rather than about tidiness: a trip in the past would move days
   * somebody has already eaten, and two overlapping trips would count the same
   * days twice and push the plan further than the person is away.
   */
  async plan(userId: string, trip: PlanVacation, day?: string): Promise<VacationView> {
    const today = day ?? (await personToday(userId));

    const problem = problemWith(trip, today, await VacationRepository.findUpcoming(userId, today));

    if (problem === 'overlaps') {
      throw new ConflictError('That overlaps a trip already planned');
    }

    if (problem === 'too-long') {
      throw new InputParseError('A pause may not be longer than a season', { endsOn: [`must be at most ${MAX_VACATION_DAYS} days after the start`] });
    }

    if (problem === 'starts-in-the-past') {
      throw new InputParseError('A pause cannot start in the past', { startsOn: ['must not be before today'] });
    }

    if (problem === 'ends-before-it-starts') {
      throw new InputParseError('A pause cannot end before it starts', { endsOn: ['must not be before the start'] });
    }

    return present(await VacationRepository.create(userId, trip), today);
  }
};
