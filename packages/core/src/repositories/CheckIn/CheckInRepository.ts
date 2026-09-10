import { and, desc, eq, sql } from 'drizzle-orm';

import { database } from 'database';
import { checkIns } from 'database/schema/progress';
import { mealPlans, meals, planDays } from 'database/schema/plan';

import { DatabaseOperationError } from 'core/entities/Error';

export type CheckInRow = {
  readonly id: string;
  readonly comments: string | null;
  readonly completedAt: string | null;
  readonly difficultyRating: number | null;
  readonly hungerRating: number | null;
  readonly planId: string;
  readonly satisfactionRating: number | null;
  readonly weightKg: number | null;
};

export type PlanStats = { readonly completed: number; readonly planned: number; readonly skipped: number; readonly total: number };

const COLUMNS = {
  id: checkIns.id,
  comments: checkIns.comments,
  completedAt: checkIns.completedAt,
  difficultyRating: checkIns.difficultyRating,
  hungerRating: checkIns.hungerRating,
  planId: checkIns.planId,
  satisfactionRating: checkIns.satisfactionRating,
  weightKg: checkIns.weightKg
};

function present(row: { weightKg: string | null } & Omit<CheckInRow, 'weightKg'>): CheckInRow {
  return { ...row, weightKg: row.weightKg === null ? null : Number(row.weightKg) };
}

export const CheckInRepository = {
  async create(
    userId: string,
    input: {
      readonly comments: string | null;
      readonly completedAt: string;
      readonly difficultyRating: number;
      readonly dueOn: string;
      readonly hungerRating: number;
      readonly planId: string;
      readonly satisfactionRating: number;
      readonly weightKg: number | null;
    }
  ): Promise<CheckInRow> {
    try {
      const [row] = await database()
        .insert(checkIns)
        .values({ ...input, userId, weightKg: input.weightKg === null ? null : String(input.weightKg) })
        .returning(COLUMNS);

      if (!row) {
        throw new DatabaseOperationError('Check-in insert returned no row');
      }

      return present(row);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Every check-in the person has made, newest first. */
  async findAll(userId: string): Promise<readonly CheckInRow[]> {
    try {
      const rows = await database().select(COLUMNS).from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.createdAt));

      return rows.map(present);
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findByPlan(userId: string, planId: string): Promise<CheckInRow | undefined> {
    try {
      const [row] = await database()
        .select(COLUMNS)
        .from(checkIns)
        .where(and(eq(checkIns.userId, userId), eq(checkIns.planId, planId)))
        .limit(1);

      return row ? present(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findLatest(userId: string): Promise<CheckInRow | undefined> {
    try {
      const [row] = await database().select(COLUMNS).from(checkIns).where(eq(checkIns.userId, userId)).orderBy(desc(checkIns.createdAt)).limit(1);

      return row ? present(row) : undefined;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** How the fortnight went, counted from what the person marked on each meal. */
  async planStats(userId: string, planId: string): Promise<PlanStats> {
    try {
      const rows = await database()
        .select({ n: sql<number>`count(*)::int`, status: meals.status })
        .from(meals)
        .innerJoin(planDays, eq(planDays.id, meals.planDayId))
        .innerJoin(mealPlans, eq(mealPlans.id, planDays.planId))
        .where(and(eq(planDays.planId, planId), eq(mealPlans.userId, userId)))
        .groupBy(meals.status);
      const count = (status: string) => rows.find(row => row.status === status)?.n ?? 0;
      const completed = count('completed');
      const skipped = count('skipped');
      const planned = count('planned');

      return { completed, planned, skipped, total: completed + skipped + planned };
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  return error instanceof DatabaseOperationError ? error : new DatabaseOperationError();
}
