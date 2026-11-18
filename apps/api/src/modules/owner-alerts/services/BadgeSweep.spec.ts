import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { ProfessionalBadgeController } from 'core/controllers/Professional';
import { ProfileController } from 'core/controllers/Profile';

import { BadgeSweepService } from './BadgeSweep.service.js';

import type { EmailService, OutgoingEmail } from '../../email/services/index.js';
import type { OwnerAlertsService } from './OwnerAlerts.service.js';

const NOW = new Date('2026-11-18T08:00:00.000Z');

/**
 * The badge's daily pass (project 025 phase 3, step 4): nothing while the
 * switch is off; each lapse's statement and each due reminder to the
 * practitioner's own address; the owner's counts; and never a throw or a
 * personal datum in the log.
 */
describe('BadgeSweepService', () => {
  const send = jest.fn<(message: OutgoingEmail) => Promise<boolean>>();
  const badgesDue = jest.fn<(counts: { due: number; soon: number }, now?: Date) => Promise<void>>();
  const lines: string[] = [];
  let service: BadgeSweepService;

  beforeEach(() => {
    send.mockResolvedValue(true);
    badgesDue.mockResolvedValue();
    jest.spyOn(ProfileController, 'localeOf').mockResolvedValue('en-GB');

    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
    }

    service = new BadgeSweepService({ badgesDue } as unknown as OwnerAlertsService, { send } as unknown as EmailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    send.mockReset();
    badgesDue.mockReset();
    lines.length = 0;
  });

  it('does nothing while the switch is off', async () => {
    jest.spyOn(ProfessionalBadgeController, 'sweep').mockResolvedValue(null);

    await service.run(NOW);

    expect(send).not.toHaveBeenCalled();
    expect(badgesDue).not.toHaveBeenCalled();
  });

  it('mails each lapse’s statement and each reminder to the practitioner, in their language, then tells the owner the counts', async () => {
    jest
      .spyOn(ProfessionalBadgeController, 'sweep')
      .mockResolvedValue({
        counts: { due: 2, soon: 1 },
        lapsed: [{ detail: 'code_not_entered', dueAt: new Date('2026-10-19T08:00:00.000Z'), to: 'lapsed@example.invalid', userId: 'usr-lapsed' }],
        reminders: [{ lapsesAt: new Date('2026-12-18T08:00:00.000Z'), register: 'Colegio de Madrid', to: 'due@example.invalid', userId: 'usr-due' }]
      });

    await service.run(NOW);

    expect(send.mock.calls.map(([mail]) => [mail.kind, mail.to])).toEqual([
      ['professional-badge-lapsed', 'lapsed@example.invalid'],
      ['professional-badge-due', 'due@example.invalid']
    ]);
    expect(send.mock.calls[0]?.[0].subject).toBe('Your NutrIA badge has lapsed');
    expect(badgesDue).toHaveBeenCalledWith({ due: 2, soon: 1 }, NOW);
  });

  it('logs counts only — no address, no account', async () => {
    send.mockResolvedValue(false);
    jest
      .spyOn(ProfessionalBadgeController, 'sweep')
      .mockResolvedValue({
        counts: { due: 1, soon: 0 },
        lapsed: [{ detail: 'our_delay', dueAt: NOW, to: 'lapsed@example.invalid', userId: 'usr-lapsed' }],
        reminders: []
      });

    await service.run(NOW);

    expect(lines).toEqual(['badge sweep: lapsed 1, reminded 0, not mailed 1']);
  });

  it('never throws, and says only what kind of error it was', async () => {
    jest.spyOn(ProfessionalBadgeController, 'sweep').mockRejectedValue(new TypeError('postgres://user:secret@db usr-lapsed'));

    await expect(service.run(NOW)).resolves.toBeUndefined();
    expect(lines).toEqual(['The badge sweep failed: TypeError']);
  });
});
