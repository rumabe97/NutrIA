import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { ProfileController } from 'core/controllers/Profile';
import { TwoFactorController } from 'core/controllers/TwoFactor';

import { TwoFactorRemovalsService } from './TwoFactorRemovals.service.js';

import type { Env } from '../../../config/index.js';
import type { OutgoingEmail } from '../../email/services/Email.service.js';

const NOW = new Date('2026-10-03T08:10:00.000Z');
const ENV = { APP_URL: 'https://nutria.example' } as Env;

/* PLAN 011 phase 4: the daily step that carries out the owner's removals once their 48 hours are past. */
describe('TwoFactorRemovalsService', () => {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();
  const lines: string[] = [];

  function service(): TwoFactorRemovalsService {
    return new TwoFactorRemovalsService(ENV, { configured: true, send } as never);
  }

  beforeEach(() => {
    lines.length = 0;
    send.mockReset();
    send.mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('es-ES');
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('removes every due request and mails each account’s own address', async () => {
    jest.spyOn(TwoFactorController, 'dueRemovals').mockResolvedValue(['usr-1', 'usr-2']);
    const removeDue = jest
      .spyOn(TwoFactorController, 'removeDue')
      .mockImplementation(async userId => Promise.resolve({ email: `${userId}@example.invalid`, userId }));

    await expect(service().run(NOW)).resolves.toEqual({ failed: 0, removed: 2 });

    expect(removeDue).toHaveBeenCalledWith('usr-1', NOW);
    expect(removeDue).toHaveBeenCalledWith('usr-2', NOW);
    expect(send.mock.calls.map(([message]) => ({ kind: message.kind, to: message.to }))).toEqual([
      { kind: 'two-factor-removed', to: 'usr-1@example.invalid' },
      { kind: 'two-factor-removed', to: 'usr-2@example.invalid' }
    ]);
  });

  it('says nothing for a request that was no longer due when its turn came — cancelled, or already removed', async () => {
    jest.spyOn(TwoFactorController, 'dueRemovals').mockResolvedValue(['usr-1']);
    jest.spyOn(TwoFactorController, 'removeDue').mockResolvedValue(null);

    await expect(service().run(NOW)).resolves.toEqual({ failed: 0, removed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('counts an account that fails and goes on with the rest; the log names the id, never the address', async () => {
    jest.spyOn(TwoFactorController, 'dueRemovals').mockResolvedValue(['usr-1', 'usr-2']);
    jest
      .spyOn(TwoFactorController, 'removeDue')
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValueOnce({ email: 'ana@example.invalid', userId: 'usr-2' });

    await expect(service().run(NOW)).resolves.toEqual({ failed: 1, removed: 1 });
    expect(lines.join('\n')).toContain('two_factor_removal_failed {"userId":"usr-1"}');
    expect(lines.join('\n')).not.toContain('@');
  });

  it('keeps a removal that could not be mailed as removed', async () => {
    jest.spyOn(TwoFactorController, 'dueRemovals').mockResolvedValue(['usr-1']);
    jest.spyOn(TwoFactorController, 'removeDue').mockResolvedValue({ email: 'ana@example.invalid', userId: 'usr-1' });
    send.mockRejectedValue(new Error('smtp down'));

    await expect(service().run(NOW)).resolves.toEqual({ failed: 0, removed: 1 });
    expect(lines.join('\n')).toContain('two_factor_removed_unmailed');
  });

  it('lets a failure to list the due requests through, so the cron run is seen to fail', async () => {
    jest.spyOn(TwoFactorController, 'dueRemovals').mockRejectedValue(new Error('database down'));

    await expect(service().run(NOW)).rejects.toThrow('database down');
  });
});
