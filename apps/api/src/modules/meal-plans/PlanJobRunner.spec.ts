import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { PlanJobController } from 'core/controllers/Plan';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { GenerationError } from './PlanGeneration.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

import type { ErrorReporter } from '../../shared/observability/index.js';
import type { PlanGenerationService } from './PlanGeneration.service.js';
import type { RecipeIllustrator } from '../ai/RecipeIllustrator.service.js';

const JOB = { id: 'job-1', error: null, errorDetail: null, planId: null, status: 'queued', step: null };

/** The runner deliberately does not await its own work; let the microtask queue drain. */
async function settle(): Promise<void> {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}

function build(generate: () => Promise<string>) {
  const start = jest.spyOn(PlanJobController, 'start').mockResolvedValue(JOB);
  const markStarted = jest.spyOn(PlanJobController, 'markStarted').mockResolvedValue(undefined);
  const markStep = jest.spyOn(PlanJobController, 'markStep').mockResolvedValue(undefined);
  const markSucceeded = jest.spyOn(PlanJobController, 'markSucceeded').mockResolvedValue(undefined);
  const markFailed = jest.spyOn(PlanJobController, 'markFailed').mockResolvedValue(undefined);

  // The real service, not a stub: off-platform its `waitUntil` throws and is
  // caught, which is exactly the path a local run takes. A stub here would test
  // the double.
  // Illustrations off: the runner asks the illustrator nothing, which is the state
  // every environment starts in and the one these tests are about.
  const illustrator = { illustrateMissing: jest.fn(), isAvailable: false } as unknown as RecipeIllustrator;
  // Reporting is off in a test the way it is off without a DSN in production.
  const report = jest.fn();
  const runner = new PlanJobRunner(new BackgroundTaskService(), { generate: jest.fn(generate) } as unknown as PlanGenerationService, illustrator, { report } as unknown as ErrorReporter);

  return { markFailed, markStarted, markStep, markSucceeded, runner, start };
}

describe('PlanJobRunner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a job immediately rather than waiting for generation', async () => {
    let finished = false;
    const { runner } = build(async () => {
      await settle();
      finished = true;

      return 'plan-1';
    });

    const job = await runner.start('usr-1');

    // The response is available while the work is still running — that is what
    // lets the client poll instead of holding a multi-minute request open.
    expect(job.id).toBe('job-1');
    expect(finished).toBe(false);
  });

  it('records success with the plan id', async () => {
    const { markSucceeded, runner } = build(async () => Promise.resolve('plan-42'));

    await runner.start('usr-1');
    await settle();

    expect(markSucceeded).toHaveBeenCalledWith('job-1', 'plan-42');
  });

  it('records a generation failure as its stable code, not as a message', async () => {
    const { markFailed, markSucceeded, runner } = build(async () => Promise.reject(new GenerationError('GENERATION_POOL_TOO_SMALL', 'lunch')));

    await runner.start('usr-1');
    await settle();

    // The code is what the client switches on; the third argument is the detail,
    // here the slot the scheduler could not fill.
    expect(markFailed).toHaveBeenCalledWith('job-1', 'GENERATION_POOL_TOO_SMALL', 'lunch');
    expect(markSucceeded).not.toHaveBeenCalled();
  });

  it('records an unexpected failure generically, never leaking its message', async () => {
    const { markFailed, runner } = build(async () => Promise.reject(new Error('connection to postgres://user:hunter2@db failed')));

    await runner.start('usr-1');
    await settle();

    // An unexpected error carries no detail — its message is not ours to trust.
    expect(markFailed).toHaveBeenCalledWith('job-1', 'GENERATION_FAILED', undefined);
    expect(JSON.stringify(markFailed.mock.calls)).not.toContain('hunter2');
  });

  it('refuses a second concurrent generation', async () => {
    const { runner, start } = build(async () => Promise.resolve('plan-1'));

    start.mockRejectedValueOnce(new Error('A plan is already being generated'));

    await expect(runner.start('usr-1')).rejects.toThrow('already being generated');
  });

  it('does not throw when recording the failure itself fails', async () => {
    const { markFailed, runner } = build(async () => Promise.reject(new Error('boom')));

    markFailed.mockRejectedValueOnce(new Error('database down'));

    await runner.start('usr-1');
    await expect(settle()).resolves.toBeUndefined();
  });
});

describe('PlanJobRunner — carrying the provider’s own reason', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the provider message alongside the code, so an operator can act on it', async () => {
    const { markFailed, runner } = build(async () =>
      Promise.reject(new GenerationError('GENERATION_AI_UNAVAILABLE', 'API key not valid. Please pass a valid API key.'))
    );

    await runner.start('usr-1');
    await settle();

    expect(markFailed).toHaveBeenCalledWith('job-1', 'GENERATION_AI_UNAVAILABLE', 'API key not valid. Please pass a valid API key.');
  });

  it('records no detail when the message is only the code repeated', async () => {
    const { markFailed, runner } = build(async () => Promise.reject(new GenerationError('GENERATION_POOL_TOO_SMALL')));

    await runner.start('usr-1');
    await settle();

    expect(markFailed).toHaveBeenCalledWith('job-1', 'GENERATION_POOL_TOO_SMALL', undefined);
  });
});
