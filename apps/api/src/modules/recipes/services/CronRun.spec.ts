import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { AnalyticsController } from 'core/controllers/Analytics';

import { CronRunService } from './CronRun.service.js';

describe('CronRunService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a system event with the job and its counts, and no user', async () => {
    const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);

    await new CronRunService().record('rewrite', { pending: 4, rewritten: 3, skipped: 1, unreached: 0 });

    expect(record).toHaveBeenCalledWith('cron_run', null, { job: 'rewrite', pending: 4, rewritten: 3, skipped: 1, unreached: 0 });
  });

  it('names the job whatever the counts are called', async () => {
    const record = jest.spyOn(AnalyticsController, 'record').mockResolvedValue(undefined);

    await new CronRunService().record('reminders', { job: 7 } as unknown as Record<string, number>);

    expect(record).toHaveBeenCalledWith('cron_run', null, { job: 'reminders' });
  });
});
