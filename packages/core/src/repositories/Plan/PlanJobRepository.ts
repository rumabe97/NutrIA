import { and, eq, getTableColumns, inArray, lt, or, sql } from 'drizzle-orm';

import { database } from 'database';
import { mealPlans, planGenerationJobs } from 'database/schema/plan';

import { ConflictError, DatabaseOperationError } from 'core/entities/Error';

import type { AiCallRecord } from 'core/entities/Plan';

/** A `running` job older than this is presumed dead — the process that owned it restarted. */
export const STALE_JOB_MINUTES = 15;

export type JobStatus = 'failed' | 'queued' | 'running' | 'succeeded';

export const PlanJobRepository = {
  /**
   * Admits a claimed job as a professional's generation (`0060`): the trail row
   * (`record`) goes in one transaction with the job's own row, once the
   * allowance has been checked after the claim, as for the client's own. A job
   * no longer `queued` admits nothing and is a `ConflictError`. If this fails
   * the caller releases the claim, so a refused generation leaves neither.
   */
  async admit(jobId: string, record: (tx: Transaction) => Promise<void>): Promise<void> {
    try {
      await database().transaction(async tx => {
        const [row] = await tx
          .update(planGenerationJobs)
          .set({ updatedAt: new Date() })
          .where(and(eq(planGenerationJobs.id, jobId), eq(planGenerationJobs.status, 'queued')))
          .returning({ id: planGenerationJobs.id });

        if (!row) {
          throw new ConflictError('The generation is no longer waiting to start');
        }

        await record(tx);
      });
    } catch (error: unknown) {
      if (error instanceof ConflictError) {
        throw error;
      }

      throw wrap(error);
    }
  },

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

  /**
   * Takes this user's one generation slot, or reports that it is taken.
   *
   * Reading "is one in flight?" and then inserting was two statements against
   * two snapshots. Under READ COMMITTED three requests fired together each read
   * *nothing in flight* before any of them had inserted, and each started its
   * own pipeline: three fortnights of model calls for one press, all but one of
   * them thrown away by `meal_plans_one_active_per_user` at the very end —
   * after the money was spent.
   *
   * There is no row to hold `FOR UPDATE` here, because what is being defended
   * is the row that does not exist yet. A **transaction-scoped advisory lock**
   * keyed on the user is the lock that can be taken over an absence: it costs
   * no schema change, it is released by the commit whatever happens, and it is
   * keyed per user, so two people never wait on each other. `try` rather than
   * the blocking form — a request that cannot take it is racing one that is
   * creating the job right now, which *is* the "already being generated"
   * answer, and no request ever sits on a pooled connection waiting for it.
   *
   * Returns the claimed job, or `undefined` when a generation is already under
   * way. `release` gives the slot back if the generation may not start after all.
   */
  async claim(userId: string) {
    try {
      return await database().transaction(async tx => {
        const [lock] = await tx.execute<{ held: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtext('plan_generation_jobs'), hashtext(${userId})) as held`
        );

        if (!lock?.held) {
          return undefined;
        }

        const [inFlight] = await tx
          .select({ id: planGenerationJobs.id })
          .from(planGenerationJobs)
          .where(and(eq(planGenerationJobs.userId, userId), inArray(planGenerationJobs.status, ['queued', 'running'])))
          .limit(1);

        if (inFlight) {
          return undefined;
        }

        const [row] = await tx.insert(planGenerationJobs).values({ status: 'queued', userId }).returning();

        if (!row) {
          throw new DatabaseOperationError('Job insert returned no row');
        }

        return row;
      });
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
   * A `queued` row is swept on the same cutoff and for the same reason: it is a
   * claim (`claim`) whose runner never picked it up — the process died between
   * the claim and `markStarted`, or between the claim and the allowance check
   * that would have released it. Its `startedAt` is null, so the `running` arm
   * cannot see it, and a claim nobody will ever advance refuses every future
   * generation for that user for good.
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
        .where(
          and(
            eq(planGenerationJobs.userId, userId),
            or(
              and(eq(planGenerationJobs.status, 'running'), lt(planGenerationJobs.startedAt, cutoff)),
              and(eq(planGenerationJobs.status, 'queued'), lt(planGenerationJobs.createdAt, cutoff))
            )
          )
        )
        .returning({ id: planGenerationJobs.id });

      return failed.length;
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /** Owner-scoped. `planStatus` is the status of the plan it made, so a plan under review can be kept from its client (`0060`). */
  async findById(userId: string, jobId: string) {
    try {
      const [row] = await database()
        .select({ ...getTableColumns(planGenerationJobs), planStatus: mealPlans.status })
        .from(planGenerationJobs)
        .leftJoin(mealPlans, eq(mealPlans.id, planGenerationJobs.planId))
        .where(and(eq(planGenerationJobs.id, jobId), eq(planGenerationJobs.userId, userId)))
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
  },

  /** Keeps the generation's model calls on its row, whatever becomes of the job afterwards. */
  async recordAiCalls(jobId: string, calls: readonly AiCallRecord[]) {
    try {
      await database().update(planGenerationJobs).set({ aiCalls: calls }).where(eq(planGenerationJobs.id, jobId));
    } catch (error: unknown) {
      throw wrap(error);
    }
  },

  /**
   * Gives a claimed slot back, for a generation that turned out not to be allowed.
   *
   * Deleted rather than failed: no model was called and no plan was attempted,
   * and a `failed` row would tell whoever reads the job log that a generation
   * broke when none ever began. Guarded on `queued`, so it can never remove a
   * job a runner has already taken up.
   */
  async release(jobId: string): Promise<void> {
    try {
      await database()
        .delete(planGenerationJobs)
        .where(and(eq(planGenerationJobs.id, jobId), eq(planGenerationJobs.status, 'queued')));
    } catch (error: unknown) {
      throw wrap(error);
    }
  }
};

type Transaction = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];

function wrap(error: unknown): DatabaseOperationError {
  if (error instanceof DatabaseOperationError) {
    return error;
  }

  return new DatabaseOperationError();
}
