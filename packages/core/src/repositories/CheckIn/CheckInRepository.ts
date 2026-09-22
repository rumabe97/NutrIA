import { and, desc, eq, sql } from 'drizzle-orm';

import { database } from 'database';
import { checkIns } from 'database/schema/progress';
import { mealPlans, meals, planDays } from 'database/schema/plan';

import { ConflictError, DatabaseOperationError } from 'core/entities/Error';

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
  /**
   * Writes the fortnight's answers, or reports that it was already answered.
   *
   * The insert **is** the check. Reading `findByPlan` first and inserting after
   * was two statements against two snapshots: under READ COMMITTED two submits
   * fired together both read *none* before either had written, both passed, and
   * both landed — two check-ins for one plan, and the caller nudged twice.
   * `ON CONFLICT DO NOTHING` against `check_ins_one_per_plan` collapses the two
   * into one statement, which is the only thing Postgres will serialise for us.
   *
   * `undefined` therefore means the plan already has its check-in, and nothing
   * else: it is the conflict, not a write that mysteriously returned no row.
   */
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
  ): Promise<CheckInRow | undefined> {
    try {
      const [row] = await database()
        .insert(checkIns)
        .values({ ...input, userId, weightKg: input.weightKg === null ? null : String(input.weightKg) })
        .onConflictDoNothing({ target: [checkIns.userId, checkIns.planId] })
        .returning(COLUMNS);

      return row ? present(row) : undefined;
    } catch (error: unknown) {
      // Belt and braces: `onConflictDoNothing` is what actually resolves the
      // race in the code running now, by returning no row rather than raising.
      // This exists for whichever build is NOT running that statement yet — a
      // rollback, or the previous deploy's few minutes against the migrated
      // schema — so a raw 23505 still reaches the caller as the same refusal,
      // never a bare 500 (`core/AGENTS.md`'s own rule, and PlanRepository's
      // `isUniqueViolation`).
      if (isUniqueViolation(error)) {
        throw new ConflictError('This fortnight has its check-in already');
      }

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

/** Postgres 23505. Here it means `check_ins_one_per_plan` fired. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}
