import { ConflictError, InputParseError, NotFoundError } from 'core/entities/Error';
import { EventRepository } from '#repositories/Event';
import { loadedDates, loadStartsOn, problemWith } from 'core/domain/Event';

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
 * Declaring one changes nothing about a plan already made. It is read at the
 * next generation, which lays the days out from today and gives each date that
 * eats for an event the targets `core/domain/Event` derives — and stamps the
 * name on the day, so the plan says why. A person who wants it in the fortnight
 * already under way regenerates, which spends a redo; that is the existing
 * machinery and the honest price.
 */
export const EventController = {
  /**
   * Declares an event.
   *
   * The refusals are about days that cannot be re-eaten: a load that would
   * already have started, and a day that would have to eat for two things.
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
