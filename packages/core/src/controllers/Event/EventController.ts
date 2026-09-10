import { ConflictError, InputParseError, NotFoundError, QuotaExceededError } from 'core/entities/Error';
import { EventRepository } from '#repositories/Event';
import { PlanRepository } from '#repositories/Plan';
import { loadedDates, loadStartsOn, planWindow, problemWith, windowFor } from 'core/domain/Event';
import { PlanController } from 'core/controllers/Plan';

import type { AddEvent, Event, MacroDirection } from 'core/entities/Event';

// --- Presenters ---------------------------------------------------------------

/** One event, plus the two things a screen asks: which days eat for it, and whether that has begun. */
export interface EventView {
  id: string;
  carbs: MacroDirection;
  daysBefore: number;
  fat: MacroDirection;
  /** The days that eat for it, oldest first. The event day itself is not among them. */
  loadedDates: readonly string[];
  loading: boolean;
  name: string;
  on: string;
  protein: MacroDirection;
}

/** The convention every dated controller here follows: the caller may say when "now" is, and a test does. */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function present(event: Event, today: string): EventView {
  return {
    id: event.id,
    carbs: event.carbs,
    daysBefore: event.daysBefore,
    fat: event.fat,
    loadedDates: loadedDates(event),
    loading: loadStartsOn(event) <= today && today < event.on,
    name: event.name,
    on: event.on,
    protein: event.protein
  };
}

// --- Controller ---------------------------------------------------------------

/**
 * A day that asks more of the body, and the days before it that eat for it
 * (`0043`).
 *
 * Declaring one changes nothing about a plan already made, here. It is read at
 * the next generation, which lays the days out from today and gives each date
 * that eats for an event the targets `core/domain/Event` derives — and stamps
 * the name on the day, so the plan says why. A paid account may instead have
 * the fortnight under way rebuilt for it on the spot (`0044`); that is the
 * API's `PlanLoadRebuildService`, which runs after this and writes through
 * `PlanController.rebuildLoadedDays`. Everybody else regenerates, which spends
 * a redo — the existing machinery and the honest price.
 */
export const EventController = {
  /**
   * Declares an event.
   *
   * The refusals are about days that cannot be re-eaten: a load that would
   * already have started, and a day that would have to eat for two things.
   * Then the fortnight's own cap (`0044`), which is an allowance rather than a
   * mistake — 429, the status for "not now", the same answer a spent swap gets.
   */
  async add(userId: string, event: AddEvent, today = isoToday()): Promise<EventView> {
    const problem = problemWith(event, today, await EventRepository.findUpcoming(userId, today));

    if (problem === 'overlaps') {
      throw new ConflictError('Those days already eat for another event');
    }

    if (problem === 'in-the-past') {
      throw new InputParseError('The days before this event have already happened', {
        on: [`must be at least ${event.daysBefore} day(s) after today`]
      });
    }

    // Counted against the fortnight this event's load lands in, which is not
    // necessarily the one under way: a race the week after next belongs to the
    // fortnight that will cover it, and is held to that fortnight's number.
    const window = windowFor(event, planWindow(await PlanRepository.findActive(userId), today));
    const standing = await PlanController.eventStanding(userId, window);

    if (!standing.allowed) {
      throw new QuotaExceededError('event');
    }

    return present(await EventRepository.create(userId, event), today);
  },

  async list(userId: string, today = isoToday()): Promise<readonly EventView[]> {
    return (await EventRepository.findUpcoming(userId, today)).map(event => present(event, today));
  },

  async remove(userId: string, id: string): Promise<void> {
    if (!(await EventRepository.remove(userId, id))) {
      throw new NotFoundError(`Event "${id}" not found`);
    }
  }
};
