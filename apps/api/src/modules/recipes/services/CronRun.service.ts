import { Injectable } from '@nestjs/common';

import { AnalyticsController } from 'core/controllers/Analytics';

import type { CronJob } from 'core/entities/Analytics';

/**
 * The record that a cron ran (`0071`): a run leaves no row of its own, and a
 * cron that stops — a lost `CRON_SECRET` answers 404 and only the log says so
 * — is found by the silence after its last `cron_run`.
 *
 * The job and its counts (a number, or `'cap'` for a sweep held back), never a
 * user and never free text (`0028`). Written when the run finished, so a
 * run that threw is a silence too. Never throws (`0033`): the cron's answer
 * does not wait on a counter.
 */
@Injectable()
export class CronRunService {
  async record(job: CronJob, counts: Readonly<Record<string, 'cap' | number>>): Promise<void> {
    await AnalyticsController.record('cron_run', null, { ...counts, job });
  }
}
