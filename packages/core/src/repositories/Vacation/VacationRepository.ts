import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

import { database } from 'database';
import { mealPlans, planDays, vacations } from 'database/schema/plan';

import { DatabaseOperationError } from 'core/entities/Error';
import { addDays, daysAway, daysToGiveBack } from 'core/domain/Vacation';
import { vacationSchema } from 'core/entities/Vacation';

import type { PlanVacation, Vacation } from 'core/entities/Vacation';

/** Plans a pause may still move. A finished plan is history and history does not move (`0021`). */
const MOVABLE = ['active', 'draft', 'generating'] as const;

export const VacationRepository = {
  /**
   * Makes a freshly generated plan respect the trips already declared.
   *
   * Generation always lays a plan out from today, one day after another, because
   * that is what a fortnight is. A holiday declared last week is only known
   * here, so the days are pushed apart afterwards — same arithmetic, applied
   * once per trip in date order, each one moving the days that come after it.
   */
  async applyTo(userId: string, today = new Date().toISOString().slice(0, 10)): Promise<void> {
    try {
      const trips = await VacationRepository.findUpcoming(userId, today);

      if (trips.length === 0) {return;}

      await database().transaction(async tx => {
        for (const trip of trips) {
          await shift(tx, userId, trip.startsOn, daysAway(trip));
        }
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Records the trip and pauses the plan in one transaction.
   *
   * Both halves or neither: a row saying somebody is away while their plan still
   * expects them to cook is worse than an error, because nothing about the
   * screen would look wrong.
   */
  async create(userId: string, trip: PlanVacation): Promise<Vacation> {
    try {
      return await database().transaction(async tx => {
        const [row] = await tx.insert(vacations).values({ endsOn: trip.endsOn, startsOn: trip.startsOn, userId }).returning();

        await shift(tx, userId, trip.startsOn, daysAway(trip));

        return vacationSchema.parse(row);
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Trips that have not finished yet, soonest first. A past trip is not a plan, it is a memory. */
  async findUpcoming(userId: string, today: string): Promise<readonly Vacation[]> {
    try {
      const rows = await database()
        .select()
        .from(vacations)
        .where(and(eq(vacations.userId, userId), gte(vacations.endsOn, today)))
        .orderBy(asc(vacations.startsOn));

      return rows.map(row => vacationSchema.parse(row));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Cancels a trip and gives the plan back the days it has not spent yet.
   *
   * A trip already under way is truncated rather than deleted: the days before
   * today happened, and the row is what explains the gap they left in the plan.
   */
  async remove(userId: string, id: string, today: string): Promise<boolean> {
    try {
      return await database().transaction(async tx => {
        const [trip] = await tx.select().from(vacations).where(and(eq(vacations.id, id), eq(vacations.userId, userId))).limit(1);

        if (!trip) {return false;}

        const back = daysToGiveBack(trip, today);

        if (back > 0) {await shift(tx, userId, trip.startsOn > today ? trip.startsOn : today, -back);}

        if (trip.startsOn > today) {
          await tx.delete(vacations).where(eq(vacations.id, id));
        } else {
          await tx.update(vacations).set({ endsOn: addDays(today, -1), updatedAt: new Date() }).where(eq(vacations.id, id));
        }

        return true;
      });
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

/**
 * Moves every plan day on or after `from` by `days`, and the plan's own dates
 * with them.
 *
 * Written as three statements against `date` columns rather than in JavaScript:
 * Postgres adds days to a `date` without ever meeting a timezone, and a plan
 * that shifted by a day because a server ran in UTC would be a bug nobody could
 * reproduce before eleven at night.
 *
 * `::int` is not decoration. A bare parameter arrives untyped and `date + $1`
 * is ambiguous — `operator is not unique: date + unknown` — so the cast is what
 * makes the statement run at all.
 */
async function shift(tx: Transaction, userId: string, from: string, days: number): Promise<void> {
  const mine = and(eq(mealPlans.userId, userId), inArray(mealPlans.status, MOVABLE));
  const movable = tx.select({ id: mealPlans.id }).from(mealPlans).where(mine);

  await tx
    .update(planDays)
    .set({ date: sql`${planDays.date} + ${days}::int`, updatedAt: new Date() })
    .where(and(inArray(planDays.planId, movable), gte(planDays.date, from)));

  await tx
    .update(mealPlans)
    .set({ endDate: sql`${mealPlans.endDate} + ${days}::int`, updatedAt: new Date() })
    .where(and(mine, gte(mealPlans.endDate, from)));

  await tx
    .update(mealPlans)
    .set({ startDate: sql`${mealPlans.startDate} + ${days}::int`, updatedAt: new Date() })
    .where(and(mine, gte(mealPlans.startDate, from)));
}

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof ZodError) {return new DatabaseOperationError(`Schema mismatch on vacation: ${error.message}`);}

  return new DatabaseOperationError();
}
