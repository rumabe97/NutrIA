import { Injectable, Logger } from '@nestjs/common';

import { PlanJobController } from 'core/controllers/Plan';

import { RecipeIllustrator } from '../../ai/services/RecipeIllustrator.service.js';
import { BackgroundTaskService } from '../../../shared/services/index.js';
import { ErrorReporter } from '../../../shared/observability/index.js';
import { GenerationError, PlanGenerationService } from './PlanGeneration.service.js';

import type { JobView } from 'core/controllers/Plan';

/**
 * Runs generation in the background and reports through the job row.
 *
 * In-process on purpose: it needs no queue, no webhook and no third-party account,
 * which keeps the whole pipeline runnable by anyone who clones this repo. The cost
 * is that a restart mid-generation orphans a `running` row — handled by the stale
 * sweeper in `PlanJobController.start`, not ignored.
 *
 * The work is handed to `BackgroundTaskService` rather than dropped on the floor
 * with `void`. On a serverless host the invocation is frozen when the response is
 * sent, and generation needs another thirty to forty-five seconds after that.
 *
 * The job row is the contract, so replacing this with a real queue later means
 * writing a different runner, not changing the schema or the API.
 */
/** Enough for a fresh plan's new dishes to have pictures within a minute or two; the cron draws the rest. */
const ILLUSTRATIONS_AFTER_PLAN = 8;

/**
 * How long a generation may run before its job is failed. `vercel.json` ends
 * the function at 300 seconds, and the job has to say it failed before then:
 * otherwise it stays `running` and the screen waits on it. That happened in
 * production — a model call outlived its budget, and the job sat `running`
 * until the platform killed the function (`0050`).
 */
const GENERATION_DEADLINE_MS = 280_000;

/** Rejects when the deadline passes, with the code the screen explains as "it took too long". */
function failAt(deadline: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    deadline.addEventListener(
      'abort',
      () => {
        reject(new GenerationError('GENERATION_TIMED_OUT', `The generation did not finish within ${GENERATION_DEADLINE_MS / 1000} s`));
      },
      { once: true }
    );
  });
}

@Injectable()
export class PlanJobRunner {
  private readonly logger = new Logger(PlanJobRunner.name);

  constructor(
    private readonly background: BackgroundTaskService,
    private readonly generation: PlanGenerationService,
    private readonly illustrator: RecipeIllustrator,
    private readonly reporter: ErrorReporter
  ) {}

  /** Creates the job and returns immediately; the work continues after the response. */
  async start(userId: string): Promise<JobView> {
    const job = await PlanJobController.start(userId);

    // Deliberately not awaited: the HTTP request returns a job id in milliseconds
    // and the client polls. Handing it over rather than voiding it is what keeps
    // the work alive once this function has already answered.
    this.background.run(`plan-generation:${job.id}`, () => this.run(userId, job.id));

    return job;
  }

  private async run(userId: string, jobId: string): Promise<void> {
    const deadline = new AbortController();
    const timer = setTimeout(() => {
      deadline.abort();
    }, GENERATION_DEADLINE_MS);

    try {
      await PlanJobController.markStarted(jobId);

      const planId = await Promise.race([
        this.generation.generate(
          userId,
          jobId,
          // Past the deadline the job is already failed; a late stage must not
          // mark it running again.
          step => (deadline.signal.aborted ? Promise.resolve() : PlanJobController.markStep(jobId, step)),
          // The call log is how an operator reads what the model did; losing it
          // must never cost somebody their plan, so a failed write is only a warning.
          calls =>
            PlanJobController.recordAiCalls(jobId, calls).catch((failure: unknown) => {
              this.logger.warn(`Job ${jobId}: the AI call log was not saved: ${failure instanceof Error ? failure.message : 'unknown'}`);
            }),
          deadline.signal
        ),
        failAt(deadline.signal)
      ]);

      await PlanJobController.markSucceeded(jobId, planId);
      this.logger.log(`Plan ${planId} generated for job ${jobId}`);

      // The plan is done and reported; its pictures are a bonus drawn afterwards,
      // a bounded batch here and the rest by the cron. Never awaited by the job.
      if (this.illustrator.isAvailable) {
        this.background.run(`illustrate-after:${jobId}`, () => this.illustrator.illustrateMissing(ILLUSTRATIONS_AFTER_PLAN));
      }
    } catch (error: unknown) {
      // A stable code reaches the user; the detail stays in the log. Nothing
      // partial survives — every write happens in one transaction at the end.
      const code = error instanceof GenerationError ? error.code : 'GENERATION_FAILED';
      // For a provider failure this is the provider's own redacted message — the
      // one thing that tells an operator whether it is the key, the model or the quota.
      const detail = error instanceof GenerationError ? error.message : undefined;

      this.logger.error(`Job ${jobId} failed (${code}): ${detail ?? (error instanceof Error ? error.message : 'unknown')}`);
      // Nobody is waiting on a response here, so without this the failure is a
      // log line in a serverless function that nobody reads.
      this.reporter.report(error, `plan-generation:${code}`);

      await PlanJobController.markFailed(jobId, code, detail === code ? undefined : detail).catch((failure: unknown) => {
        this.logger.error(`Could not record failure for job ${jobId}: ${failure instanceof Error ? failure.message : 'unknown'}`);
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
