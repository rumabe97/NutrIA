import { and, eq, inArray, lt, or, sql } from 'drizzle-orm';

import { database } from 'database';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';

import { DatabaseOperationError } from 'core/entities/Error';

/** A `running` job older than this is presumed dead — the process that owned it restarted. */
export const STALE_JOB_MINUTES = 15;

export type JobStatus = 'failed' | 'queued' | 'running' | 'succeeded';

export const PlanJobRepository = {
  /**
   * Adopts jobs whose plan committed but whose runner died before saying so.
   *
   * The last thing generation does is commit the whole plan in one transaction
   * and *then* mark the job succeeded. A restart in that gap — a deploy, a dev
   * server reloading on a file change — leaves a complete, active plan and a job
   * row that still says `running`. `failStale` would then declare it abandoned,
   * and the user would read "we could not create your plan" with the plan sitting
   * right there.
   *
   * The plan carries the job id in `generation_metadata`, so the evidence that a
   * job finished is the plan itself. Same staleness cutoff as `failStale`, which
   * removes the race with a runner that is about to mark its own job succeeded.
   */
  async adoptCompleted(userId: string): Promise<number> {
    try {
      const db = database();
      const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60 * 1000);

      const stale = await db
        .select({ id: planGenerationJobs.id })
        .from(planGenerationJobs)
        .where(and(eq(planGenerationJobs.userId, userId), eq(planGenerationJobs.status, 'running'), lt(planGenerationJobs.startedAt, cutoff)));

      if (stale.length === 0) {
        return 0;
      }

      const ids = stale.map(row => row.id);
      const plans = await db
        .select({ id: mealPlans.id, jobId: sql<string>`${mealPlans.generationMetadata}->>'jobId'` })
        .from(mealPlans)
        .where(and(eq(mealPlans.userId, userId), inArray(sql`${mealPlans.generationMetadata}->>'jobId'`, ids)));

      let adopted = 0;

      for (const plan of plans) {
        await db
          .update(planGenerationJobs)
          .set({ finishedAt: new Date(), planId: plan.id, status: 'succeeded', step: 'done' })
          .where(and(eq(planGenerationJobs.id, plan.jobId), eq(planGenerationJobs.status, 'running')));

        adopted += 1;
      }

      return adopted;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async create(userId: string) {
    try {
      const [row] = await database().insert(planGenerationJobs).values({ status: 'queued', userId }).returning();

      if (!row) {
        throw new DatabaseOperationError('Job insert returned no row');
      }

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Fails jobs abandoned by a restart.
   *
   * The runner is in-process, so a deploy mid-generation leaves a `running` row
   * nobody is advancing. Without this the user's next attempt is refused forever by
   * the in-flight check.
   *
   * Run `adoptCompleted` first: a job whose plan exists did not fail, and calling
   * it abandoned would throw away a fortnight of work the user already paid for.
   */
  async failStale(userId: string): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - STALE_JOB_MINUTES * 60 * 1000);

      const failed = await database()
        .update(planGenerationJobs)
        .set({ error: 'GENERATION_ABANDONED', finishedAt: new Date(), status: 'failed' })
        .where(and(eq(planGenerationJobs.userId, userId), eq(planGenerationJobs.status, 'running'), lt(planGenerationJobs.startedAt, cutoff)))
        .returning({ id: planGenerationJobs.id });

      return failed.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async findById(userId: string, jobId: string) {
    try {
      const [row] = await database()
        .select()
        .from(planGenerationJobs)
        .where(and(eq(planGenerationJobs.id, jobId), eq(planGenerationJobs.userId, userId)))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Any job still in flight for this user. Used to refuse a second concurrent generation. */
  async findInFlight(userId: string) {
    try {
      const [row] = await database()
        .select()
        .from(planGenerationJobs)
        .where(and(eq(planGenerationJobs.userId, userId), or(eq(planGenerationJobs.status, 'queued'), eq(planGenerationJobs.status, 'running'))))
        .limit(1);

      return row;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * `reason` is a stable code the client switches on. `detail` is the provider's own
   * message, already redacted — the thing that actually tells an operator what to fix.
   */
  async markFailed(jobId: string, reason: string, detail?: string) {
    try {
      await database()
        .update(planGenerationJobs)
        .set({ error: reason, errorDetail: detail ?? null, finishedAt: new Date(), status: 'failed' })
        .where(eq(planGenerationJobs.id, jobId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async markStarted(jobId: string) {
    try {
      await database()
        .update(planGenerationJobs)
        .set({ attempts: 1, startedAt: new Date(), status: 'running' })
        .where(eq(planGenerationJobs.id, jobId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Records which stage the pipeline reached.
   *
   * The client renders this label directly, so it is written *before* each stage
   * starts and never contains a stage the pipeline did not enter — that is what
   * makes the progress real rather than a timer (PRD criterion 8).
   */
  async markStep(jobId: string, step: string) {
    try {
      await database().update(planGenerationJobs).set({ status: 'running', step }).where(eq(planGenerationJobs.id, jobId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  async markSucceeded(jobId: string, planId: string) {
    try {
      await database()
        .update(planGenerationJobs)
        .set({ finishedAt: new Date(), planId, status: 'succeeded', step: 'done' })
        .where(eq(planGenerationJobs.id, jobId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof DatabaseOperationError) {
    return error;
  }

  return new DatabaseOperationError();
}
