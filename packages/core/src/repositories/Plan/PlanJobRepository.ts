import { and, eq, lt, or } from 'drizzle-orm';

import { database } from 'database';
import { planGenerationJobs } from 'database/schema/plan';

import { DatabaseOperationError } from 'core/entities/Error';

/** A `running` job older than this is presumed dead — the process that owned it restarted. */
export const STALE_JOB_MINUTES = 15;

export type JobStatus = 'failed' | 'queued' | 'running' | 'succeeded';

export const PlanJobRepository = {
  async create(userId: string) {
    try {
      const [row] = await database().insert(planGenerationJobs).values({ status: 'queued', userId }).returning();

      if (!row) {throw new DatabaseOperationError('Job insert returned no row');}

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
  if (error instanceof DatabaseOperationError) {return error;}

  return new DatabaseOperationError();
}
