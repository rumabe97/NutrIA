import { Injectable, Logger } from '@nestjs/common';

import { PlanJobController } from 'core/controllers/Plan';

import { BackgroundTaskService } from '../../../shared/services/index.js';
import { ErrorReporter } from '../../../shared/observability/index.js';
import { GenerationError, PlanGenerationService } from './PlanGeneration.service.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';

import type { ForClient } from 'core/controllers/Care';
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
    private readonly alerts: OwnerAlertsService,
    private readonly background: BackgroundTaskService,
    private readonly generation: PlanGenerationService,
    private readonly reporter: ErrorReporter
  ) {}

  /**
   * Creates the job and returns immediately; the work continues after the response.
   *
   * `record` is a professional's generation for their client, reached through
   * `CareController.generatePlan` (`0060`): the job and the trail row go in
   * together. The generation itself is the client's, on the client's profile.
   * `startDate` is the person's own choice of first day (project 015); a
   * professional's generation never carries one.
   */
  async start(userId: string, record?: Parameters<ForClient<JobView>>[1], startDate?: string): Promise<JobView> {
    const job = await PlanJobController.start(userId, record, startDate);

    // Deliberately not awaited: the HTTP request returns a job id in milliseconds
    // and the client polls. Handing it over rather than voiding it is what keeps
    // the work alive once this function has already answered.
    this.background.run(`plan-generation:${job.id}`, () => this.run(userId, job.id, record !== undefined));

    return job;
  }

  private async run(userId: string, jobId: string, byProfessional: boolean): Promise<void> {
    const deadline = new AbortController();
    let failed = false;
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
          deadline.signal,
          byProfessional
        ),
        failAt(deadline.signal)
      ]);

      await PlanJobController.markSucceeded(jobId, planId);
      this.logger.log(`Plan ${planId} generated for job ${jobId}`);
    } catch (error: unknown) {
      failed = true;
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

    // After the row says how it ended, so "the last three jobs" includes this one. Outside the
    // try on purpose: whatever this does must never turn a finished job into a failed one, and
    // it does not throw (`0071`).
    await this.alerts.afterJob(failed).catch(() => undefined);
  }
}
