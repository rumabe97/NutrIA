import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';
import { ProfileController } from 'core/controllers/Profile';

import { IllnessRuleSweepService } from './IllnessRuleSweep.service.js';

import type { EmailService, OutgoingEmail } from '../../email/services/index.js';
import type { Env } from '../../../config/index.js';

const NOW = new Date('2026-11-19T06:00:00.000Z');
const ENV = { APP_URL: 'https://nutria.example' } as Env;

/**
 * The illness rule's daily part (project 025 phase 5, `0111` § 8): the links it
 * ends, each client mailed once in their own language with `textos/06` § Y's
 * words, **nobody else mailed** — the practitioner least of all (legal F4) —
 * and never a throw, an address, a name or anything of a record in the log.
 */
describe('IllnessRuleSweepService', () => {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();
  const lines: string[] = [];
  let service: IllnessRuleSweepService;

  beforeEach(() => {
    send.mockResolvedValue(true);
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');

    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
    }

    service = new IllnessRuleSweepService(ENV, { send } as unknown as EmailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
    lines.length = 0;
  });

  it('mails each client whose link it ended, in their language, at their own address — and no one else', async () => {
    const sweep = jest.spyOn(CareController, 'sweepBadgeLoss').mockResolvedValue({
      ended: [
        { clientId: 'usr-a', professionalName: 'Ana Pérez', to: 'a@example.invalid' },
        { clientId: 'usr-b', professionalName: 'Luis Gil', to: 'b@example.invalid' }
      ],
      narrowed: 0
    });

    await service.run(NOW);

    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledWith(NOW);
    expect(send.mock.calls.map(([mail]) => [mail.kind, mail.to])).toEqual([
      ['care-link-ended-by-rule', 'a@example.invalid'],
      ['care-link-ended-by-rule', 'b@example.invalid']
    ]);
    expect(send.mock.calls[0]?.[0].subject).toBe('Your link with Ana Pérez on NutrIA has ended');
    // The profile is where the reason is explained (`textos/05` § G.3).
    expect(send.mock.calls[0]?.[0].text).toContain('https://nutria.example/en/perfil');
  });

  it('mails nobody for a narrowing, and logs only the count', async () => {
    jest.spyOn(CareController, 'sweepBadgeLoss').mockResolvedValue({ ended: [], narrowed: 4 });

    await service.run(NOW);

    expect(send).not.toHaveBeenCalled();
    expect(lines).toEqual(['badge loss sweep: ended 0, narrowed 4, not mailed 0']);
  });

  it('sends nothing, and logs nothing, when nothing changed', async () => {
    jest.spyOn(CareController, 'sweepBadgeLoss').mockResolvedValue({ ended: [], narrowed: 0 });

    await service.run(NOW);

    expect(send).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
  });

  it('counts a mail that could not go — a refused send, or no address — and keeps going', async () => {
    jest.spyOn(CareController, 'sweepBadgeLoss').mockResolvedValue({
      ended: [
        { clientId: 'usr-a', professionalName: 'Ana', to: null },
        { clientId: 'usr-b', professionalName: 'Luis', to: 'b@example.invalid' },
        { clientId: 'usr-c', professionalName: 'Eva', to: 'c@example.invalid' }
      ],
      narrowed: 1
    });
    send.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('smtp'));

    await service.run(NOW);

    expect(send).toHaveBeenCalledTimes(2);
    expect(lines).toEqual(['badge loss sweep: ended 3, narrowed 1, not mailed 3']);
  });

  it('never throws, and logs no person, when the sweep fails', async () => {
    jest.spyOn(CareController, 'sweepBadgeLoss').mockRejectedValue(new Error('usr-a a@example.invalid Ana'));

    await expect(service.run(NOW)).resolves.toBeUndefined();
    expect(lines).toEqual(['The illness rule sweep failed: Error']);
  });
});
