import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CareController } from 'core/controllers/Care';
import { CheckInController } from 'core/controllers/CheckIn';

import { CheckInsService } from './CheckIns.service.js';

import type { BackgroundTaskService } from '../../../shared/services/index.js';
import type { CheckInSubmittedService } from '../../notifications/index.js';
import type { SessionUser } from '../../../shared/index.js';

const ALICE: SessionUser = { id: 'usr-alice', activated: true, email: 'alice@example.invalid', emailVerified: true, name: 'Alice', role: 'user' };
const PRO = { id: 'usr-pro', email: 'dietista@example.invalid' };
const BODY = { difficulty: 'ok' as const, hunger: 'right' as const, planId: '11111111-2222-4333-8444-555555555555', satisfaction: 4, weightKg: 78.5 };

/**
 * `CheckInsService.submit`: records the check-in, then tells the client's
 * professional in the background — once, and only for a client with an
 * `active` link (PRD 004, criterion 10). The trigger runs through
 * `BackgroundTaskService`, so a slow mail or push never delays the answer.
 */
describe('CheckInsService.submit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function harness() {
    const run = jest.fn<(label: string, work: () => Promise<unknown>) => void>((_label, work) => {
      // Runs the work eagerly so the test can assert on it without a real event loop wait.
      void work();
    });
    const notify = jest.fn<(professional: { id: string; email: string }, clientName: string) => Promise<void>>().mockResolvedValue(undefined);
    const background = { run } as unknown as BackgroundTaskService;
    const notifier = { notify } as unknown as CheckInSubmittedService;

    return { background, notifier, notify, run, service: new CheckInsService(background, notifier) };
  }

  it('tells the professional of a client with an active link, with the client’s name', async () => {
    jest.spyOn(CheckInController, 'submit').mockResolvedValue({ targets: null, weightLogged: false });
    jest.spyOn(CareController, 'activeProfessional').mockResolvedValue(PRO);

    const { notify, service } = harness();

    await service.submit(ALICE, BODY);

    expect(notify).toHaveBeenCalledWith(PRO, 'Alice');
  });

  it('tells nobody for a client with no active link', async () => {
    jest.spyOn(CheckInController, 'submit').mockResolvedValue({ targets: null, weightLogged: false });
    jest.spyOn(CareController, 'activeProfessional').mockResolvedValue(null);

    const { notify, run, service } = harness();

    await service.submit(ALICE, BODY);

    expect(run).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('never notifies when the check-in itself is refused — a retried request tells nobody twice', async () => {
    jest.spyOn(CheckInController, 'submit').mockRejectedValue(new Error('conflict'));

    const activeProfessional = jest.spyOn(CareController, 'activeProfessional');
    const { run, service } = harness();

    await expect(service.submit(ALICE, BODY)).rejects.toThrow('conflict');
    expect(activeProfessional).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('answers with the check-in’s own result, unchanged by the notice', async () => {
    jest.spyOn(CheckInController, 'submit').mockResolvedValue({ targets: { fromKcal: 2000, toKcal: 2100 }, weightLogged: true });
    jest.spyOn(CareController, 'activeProfessional').mockResolvedValue(PRO);

    const { service } = harness();

    await expect(service.submit(ALICE, BODY)).resolves.toEqual({ targets: { fromKcal: 2000, toKcal: 2100 }, weightLogged: true });
  });
});
