import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CareController } from 'core/controllers/Care';
import { CheckInController } from 'core/controllers/CheckIn';

import { CheckInsController } from './CheckIns.controller.js';
import { CheckInsService } from '../services/index.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { CheckInSubmittedService } from '../../notifications/index.js';
import type { SessionUser } from '../../../shared/index.js';

const ALICE: SessionUser = { id: 'usr-alice', activated: true, email: 'alice@example.invalid', emailVerified: true, name: 'Alice', role: 'user' };
const PLAN = '11111111-2222-4333-8444-555555555555';

/**
 * Two routes, both scoped to the session user and nothing else: the check-in
 * names a plan, never a person, and the controller passes the full session
 * user through, so the service has the name a professional's notice carries.
 */
describe('CheckInsController', () => {
  const background = { run: jest.fn() } as unknown as BackgroundTaskService;
  const notifier = { notify: jest.fn() } as unknown as CheckInSubmittedService;
  const controller = new CheckInsController(new CheckInsService(background, notifier));

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the status for the session user', async () => {
    const status = jest
      .spyOn(CheckInController, 'status')
      .mockResolvedValue({ adherence: 80, done: false, due: true, plan: null, stats: { completed: 8, planned: 4, skipped: 2, total: 14 } });

    await expect(controller.status(ALICE)).resolves.toMatchObject({ adherence: 80, due: true });
    expect(status).toHaveBeenCalledWith('usr-alice');
  });

  it('submits for the session user, whatever else the body says', async () => {
    const submit = jest.spyOn(CheckInController, 'submit').mockResolvedValue({ targets: null, weightLogged: true });

    jest.spyOn(CareController, 'activeProfessional').mockResolvedValue(null);

    const body = { difficulty: 'ok' as const, hunger: 'right' as const, planId: PLAN, satisfaction: 4, weightKg: 78.5 };

    await expect(controller.submit(ALICE, body)).resolves.toEqual({ targets: null, weightLogged: true });
    expect(submit).toHaveBeenCalledWith('usr-alice', body);
  });
});
