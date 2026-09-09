import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { ProgressController } from 'core/controllers/Progress';

import { ProgressRestController } from './progress.controller.js';

import type { ProgressSummaryView, WeightView } from 'core/controllers/Progress';
import type { SessionUser } from '../../shared/decorators/index.js';

const ALICE: SessionUser = { id: 'usr-alice', email: 'alice@example.invalid', emailVerified: true, name: 'Alice', role: 'user' };

const weight: WeightView = { changeKg: -1.2, entries: [{ loggedOn: '2026-09-09', weightKg: 86.2 }], latestKg: 86.2, startingWeightKg: 87.4 };
const summary: ProgressSummaryView = {
  fortnights: [],
  overall: { adherence: null, eaten: 0, marked: 0 },
  weight: { changeKg: null, entries: [], fortnightChangeKg: null, goalType: null, latestKg: null, startingWeightKg: null, targetWeightKg: null, toTargetKg: null }
};

/** Every read is scoped to the session user; nothing in a request names another person. */
describe('ProgressRestController', () => {
  const controller = new ProgressRestController();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the weight for the session user', async () => {
    const getWeight = jest.spyOn(ProgressController, 'getWeight').mockResolvedValue(weight);

    await expect(controller.weight(ALICE)).resolves.toEqual(weight);
    expect(getWeight).toHaveBeenCalledWith('usr-alice');
  });

  it('reads the summary for the session user', async () => {
    const read = jest.spyOn(ProgressController, 'summary').mockResolvedValue(summary);

    await expect(controller.summary(ALICE)).resolves.toEqual(summary);
    expect(read).toHaveBeenCalledWith('usr-alice');
  });

  it('logs a weight for the session user', async () => {
    const logWeight = jest.spyOn(ProgressController, 'logWeight').mockResolvedValue(weight);

    await expect(controller.logWeight(ALICE, { weightKg: 86.2 })).resolves.toEqual(weight);
    expect(logWeight).toHaveBeenCalledWith('usr-alice', { weightKg: 86.2 });
  });
});
