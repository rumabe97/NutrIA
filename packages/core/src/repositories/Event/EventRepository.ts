import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { events } from 'database/schema/plan';

import { ConflictError, DatabaseOperationError, QuotaExceededError } from 'core/entities/Error';
import { eventSchema } from 'core/entities/Event';

import type { AddEvent, Event } from 'core/entities/Event';

/**
 * Bounded attempts at the per-user lock before refusing as a conflict rather
 * than waiting forever. Eight rather than a handful more: this same account
 * can double-submit, retry a slow request, and fire several event forms in
 * one burst, and each of those needs its own turn at the lock before the
 * budget runs out — a stress run against the real database at five-way
 * contention from one account needed most of it.
 */
const LOCK_ATTEMPTS = 8;

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Doubling and jittered, capped at 250ms base — long enough to let this same account's other request finish, short enough nobody notices. */
function backoff(attempt: number): number {
  const base = Math.min(20 * 2 ** (attempt - 1), 250);

  return base + Math.random() * base;
}

export const EventRepository = {
  /**
   * Adds an event, but only inside the same lock that re-counts the fortnight's
   * cap — closing the race a plain "count, then insert" left open (`0044`
   * follow-up; a security scan on 2026-09-22 found it as `EventController.add`
   * reading `eventStanding` and inserting as two unsynchronised statements).
   *
   * Two statements against two snapshots: under READ COMMITTED, several
   * requests fired together each read a count that still had room, and each
   * inserted — a cap of three ends with five. There is no row to hold `FOR
   * UPDATE` for the same reason `PlanJobRepository.claim` has none: what is
   * being defended is the row that does not exist yet, so a
   * **transaction-scoped advisory lock** keyed on the user takes its place
   * (`core/AGENTS.md`'s "is there one already?" rule).
   *
   * `try`, not the blocking form: a blocking lock as a transaction's first
   * statement pins a pooled connection for the whole wait, and this pool caps
   * at ten — ten concurrent requests from one account would be enough to deny
   * every other account (the same reasoning as `claim`). A failed try here is
   * not "already done" the way it is for `claim`, though: two of this same
   * user's own requests (a double submit, a client retry) are both
   * legitimate, so a few bounded, jittered retries give the other one its
   * turn before refusing. Each attempt opens and closes its own transaction,
   * and the wait between attempts always happens with none open, so nothing
   * ever holds a connection while backing off.
   *
   * `quota` decides whether one more event fits, and is asked again on every
   * attempt against rows read fresh inside that attempt's lock — never once
   * before the loop starts. The row count is not the only thing that can move
   * while a request waits its turn: a tier read once up front and reused
   * across retries would judge a later attempt against an upgrade or
   * downgrade that had not happened yet when it was read.
   */
  async createWithinQuota(
    userId: string,
    event: AddEvent,
    range: { readonly from: string; readonly to: string },
    quota: (dated: readonly Event[]) => Promise<boolean>
  ): Promise<Event> {
    try {
      for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
        if (attempt > 0) {
          await wait(backoff(attempt));
        }

        const row = await database().transaction(async tx => {
          const [lock] = await tx.execute<{ held: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext('events'), hashtext(${userId})) as held`);

          if (!lock?.held) {
            return undefined;
          }

          const dated = await tx
            .select()
            .from(events)
            .where(and(eq(events.userId, userId), gte(events.on, range.from), lte(events.on, range.to)))
            .orderBy(asc(events.on));

          if (!(await quota(dated.map(dateRow => eventSchema.parse(dateRow))))) {
            throw new QuotaExceededError('event');
          }

          const [inserted] = await tx
            .insert(events)
            .values({
              carbs: event.carbs,
              daysBefore: event.daysBefore,
              fat: event.fat,
              name: event.name,
              on: event.on,
              protein: event.protein,
              userId
            })
            .returning();

          return inserted;
        });

        if (row) {
          return eventSchema.parse(row);
        }
      }

      throw new ConflictError('Another request for this account is still adding an event');
    } catch (error: unknown) {
      if (error instanceof ConflictError || error instanceof QuotaExceededError) {
        throw error;
      }

      throw wrap(error);
    }
  },

  /**
   * Events dated inside a stretch of days, soonest first — what the per-plan
   * cap is counted from (`0044`).
   *
   * By the event's own date, and deliberately wider than the fortnight it is
   * asked about: an event up to `MAX_DAYS_BEFORE` days past the window's end
   * still loads days inside it. Which of these actually touch the window is
   * `eventsInWindow`'s decision, in `core/domain/Event`, where the load rule
   * already lives — a repository does not own arithmetic.
   *
   * Unlike `findUpcoming` this includes events that have already happened: a
   * race lived through on Tuesday still spent days of the fortnight it belongs
   * to, and pretending otherwise would let somebody past the cap by waiting.
   */
  async findInRange(userId: string, from: string, to: string): Promise<readonly Event[]> {
    try {
      const rows = await database()
        .select()
        .from(events)
        .where(and(eq(events.userId, userId), gte(events.on, from), lte(events.on, to)))
        .orderBy(asc(events.on));

      return rows.map(row => eventSchema.parse(row));
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
