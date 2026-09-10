import { and, asc, eq, gte } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { events } from 'database/schema/plan';

import { DatabaseOperationError } from 'core/entities/Error';
import { eventSchema } from 'core/entities/Event';

import type { AddEvent, Event } from 'core/entities/Event';

export const EventRepository = {
  async create(userId: string, event: AddEvent): Promise<Event> {
    try {
      const [row] = await database()
        .insert(events)
        .values({ carbs: event.carbs, daysBefore: event.daysBefore, fat: event.fat, name: event.name, on: event.on, protein: event.protein, userId })
        .returning();

      return eventSchema.parse(row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Events that have not happened yet, soonest first.
   *
   * By the event's own date rather than its load's: an event tomorrow whose
   * load began yesterday is still upcoming, still on the screen, and still the
   * reason today's plan day looks the way it does. A past event is history and
   * the plan days it shaped carry its name themselves (`0021`).
   */
  async findUpcoming(userId: string, today: string): Promise<readonly Event[]> {
    try {
      const rows = await database()
        .select()
        .from(events)
        .where(and(eq(events.userId, userId), gte(events.on, today)))
        .orderBy(asc(events.on));

      return rows.map(row => eventSchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Owner-scoped: a stranger's id is a row that does not exist, and the caller turns false into a 404. */
  async remove(userId: string, id: string): Promise<boolean> {
    try {
      const deleted = await database()
        .delete(events)
        .where(and(eq(events.id, id), eq(events.userId, userId)))
        .returning({ id: events.id });

      return deleted.length > 0;
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof DatabaseOperationError) {
    return error;
  }

  return new DatabaseOperationError(error instanceof ZodError ? 'Stored event failed validation' : undefined);
}
