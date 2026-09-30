import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { AdminAlertController } from 'core/controllers/Admin';

import { OwnerAlertsService } from './OwnerAlerts.service.js';

import type { Env } from '../../../config/index.js';
import type { EmailService } from '../../email/services/Email.service.js';
import type { OwnerDigest, PictureFailures, SpendCrossing } from 'core/controllers/Admin';

const NOW = new Date('2026-09-29T08:00:00Z');
const OWNER = 'owner@example.com';
const ZERO = { mealsOutsideServingBounds: 0, overBound: 0, refusalLimit: 0, uncosted: 0, unserved: 0 };
const QUIET: OwnerDigest = {
  crons: [],
  failedGenerations: [],
  failedMail: [],
  newMessages: 0,
  pictureSpend: { capUsd: 10, share: 0, spentUsd: 0 },
  shouldBeZero: ZERO,
  waitingAccounts: 0
};
const TEXT_80: SpendCrossing = { capUsd: 25, share: 0.84, source: 'text', spentUsd: 21, threshold: 80 };
const HOUR = 60 * 60 * 1000;
const NO_PICTURES: PictureFailures = { failed: [], refused: [] };
const TEXT_100: SpendCrossing = { capUsd: 25, share: 1.04, source: 'text', spentUsd: 26, threshold: 100 };

function build({ configured = true, owner = OWNER as string | null, sent = true } = {}) {
  const send = jest.fn<EmailService['send']>().mockResolvedValue(sent);
  const service = new OwnerAlertsService(
    {
      AI_IMAGE_MONTHLY_CAP_USD: 10,
      AI_TEXT_MONTHLY_CAP_USD: 25,
      APP_URL: 'https://nutria.example',
      OWNER_EMAIL: owner ?? undefined
    } as unknown as Env,
    { configured, send } as unknown as EmailService
  );
  const claim = jest.spyOn(AdminAlertController, 'claim').mockResolvedValue('claim-1');
  const release = jest.spyOn(AdminAlertController, 'release').mockResolvedValue(undefined);
  const digest = jest.spyOn(AdminAlertController, 'digest').mockResolvedValue(QUIET);
  const failureStreak = jest.spyOn(AdminAlertController, 'failureStreak').mockResolvedValue(null);
  const spendCrossings = jest.spyOn(AdminAlertController, 'spendCrossings').mockResolvedValue([]);
  const silentCrons = jest.spyOn(AdminAlertController, 'silentCrons').mockResolvedValue([]);
  const pictureFailures = jest.spyOn(AdminAlertController, 'pictureFailures').mockResolvedValue(NO_PICTURES);

  return { claim, digest, failureStreak, pictureFailures, release, send, service, silentCrons, spendCrossings };
}

describe('OwnerAlertsService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['without OWNER_EMAIL', { owner: null }],
    ['without SMTP', { configured: false }]
  ])('does nothing at all %s: no read, no claim, no mail', async (_name, options) => {
    const { claim, digest, failureStreak, pictureFailures, send, service, silentCrons, spendCrossings } = build(options);

    await service.digest(NOW);
    await service.afterJob(true, NOW);
    await service.checkSpend(NOW);
    await service.watchReminders(NOW);
    await service.pictureFailures(NOW);

    expect(pictureFailures).not.toHaveBeenCalled();
    expect(silentCrons).not.toHaveBeenCalled();
    expect(digest).not.toHaveBeenCalled();
    expect(failureStreak).not.toHaveBeenCalled();
    expect(spendCrossings).not.toHaveBeenCalled();
    expect(claim).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  describe('the digest', () => {
    it('checks the spend first, even on a day it has nothing else to say', async () => {
      const { send, service, spendCrossings } = build();

      spendCrossings.mockResolvedValue([TEXT_80]);
      await service.digest(NOW);

      expect(spendCrossings).toHaveBeenCalledTimes(1);
      // The spend alert is the only mail: the digest itself has nothing in it.
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner-alert' }));
    });

    it('sends nothing on a day with nothing to say', async () => {
      const { claim, send, service } = build();

      await service.digest(NOW);

      expect(claim).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('sends one mail to the owner, claimed for the Madrid day', async () => {
      const { claim, digest, send, service } = build();

      digest.mockResolvedValue({ ...QUIET, waitingAccounts: 2 });
      await service.digest(NOW);

      // 2026-09-29 in Madrid (UTC+2) begins at 22:00 UTC the day before.
      expect(claim).toHaveBeenCalledWith('digest', new Date('2026-09-28T22:00:00Z'));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner-digest', to: OWNER }));
    });

    it('sends nothing the second time in a day: the claim is refused', async () => {
      const { claim, digest, send, service } = build();

      digest.mockResolvedValue({ ...QUIET, waitingAccounts: 2 });
      claim.mockResolvedValueOnce('claim-1').mockResolvedValueOnce(null);
      await service.digest(NOW);
      await service.digest(new Date(NOW.getTime() + 60_000));

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('gives the day back when the mail did not leave, and never throws', async () => {
      const { digest, release, service } = build({ sent: false });

      digest.mockResolvedValue({ ...QUIET, waitingAccounts: 2 });
      await service.digest(NOW);

      expect(release).toHaveBeenCalledWith('claim-1');

      digest.mockRejectedValue(new Error('the database is gone'));
      await expect(service.digest(NOW)).resolves.toBeUndefined();
    });
  });

  describe('three failed generations in a row', () => {
    it('sends one alert, claimed for six hours', async () => {
      const { claim, failureStreak, send, service } = build();

      failureStreak.mockResolvedValue(['GENERATION_AI_UNAVAILABLE', 'GENERATION_AI_UNAVAILABLE', 'OTHER']);
      await service.afterJob(true, NOW);

      expect(claim).toHaveBeenCalledWith('generation-streak', new Date('2026-09-29T02:00:00Z'));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'owner-alert', to: OWNER }));
    });

    it('is not looked at when the job succeeded', async () => {
      const { failureStreak, service } = build();

      await service.afterJob(false, NOW);

      expect(failureStreak).not.toHaveBeenCalled();
    });

    it('sends one mail for two jobs failing together: only one wins the claim', async () => {
      const { claim, failureStreak, send, service } = build();

      failureStreak.mockResolvedValue(['A', 'B', 'C']);
      claim.mockResolvedValueOnce('claim-1').mockResolvedValueOnce(null);
      await Promise.all([service.afterJob(true, NOW), service.afterJob(true, NOW)]);

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the read fails', async () => {
      const { failureStreak, service } = build();

      failureStreak.mockRejectedValue(new Error('database gone'));

      await expect(service.afterJob(true, NOW)).resolves.toBeUndefined();
    });
  });

  describe('spend against a cap', () => {
    it('claims a threshold for the whole UTC month', async () => {
      const { claim, send, service, spendCrossings } = build();

      spendCrossings.mockResolvedValue([TEXT_80]);
      await service.checkSpend(NOW);

      expect(claim).toHaveBeenCalledWith('spend-text-80', new Date('2026-09-01T00:00:00Z'));
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('sends one mail, for 100 %, when a jump crosses both, and takes 80 % without a word', async () => {
      const { claim, send, service, spendCrossings } = build();

      spendCrossings.mockResolvedValue([TEXT_100]);
      await service.checkSpend(NOW);

      expect(claim.mock.calls.map(call => call[0])).toEqual(['spend-text-80', 'spend-text-100']);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0].subject).toContain('100 %');
    });

    it('does not send what was already sent this month', async () => {
      const { claim, send, service, spendCrossings } = build();

      spendCrossings.mockResolvedValue([TEXT_80]);
      claim.mockResolvedValue(null);
      await service.checkSpend(NOW);

      expect(send).not.toHaveBeenCalled();
    });

    it('is checked when a job ends, success or failure', async () => {
      const { service, spendCrossings } = build();

      await service.afterJob(false, NOW);
      await service.afterJob(true, NOW);

      expect(spendCrossings).toHaveBeenCalledTimes(2);
    });
  });

  describe('the reminders cron gone quiet', () => {
    it('sends one alert with a link to Sistema, claimed for 20 h so a daily cron firing early still sends', async () => {
      const { claim, send, service, silentCrons } = build();

      silentCrons.mockResolvedValue(['reminders']);
      await service.watchReminders(NOW);

      expect(claim).toHaveBeenCalledWith('cron-silent-reminders', new Date(NOW.getTime() - 20 * 60 * 60 * 1000));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0].subject).toBe('NutrIA — la tarea de recordatorios lleva más de 26 h sin correr');
      expect(send.mock.calls[0]?.[0].text).toContain('https://nutria.example/admin/ajustes/sistema');
    });

    it('sends nothing on a second call within 20 h, when the claim is already taken', async () => {
      const { claim, send, service, silentCrons } = build();

      silentCrons.mockResolvedValue(['reminders']);
      claim.mockResolvedValueOnce('claim-1').mockResolvedValueOnce(null);
      await service.watchReminders(NOW);
      await service.watchReminders(new Date(NOW.getTime() + 60 * 60 * 1000));

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('sends nothing when the reminders ran recently, or only the rewrite is silent', async () => {
      const { claim, send, service, silentCrons } = build();

      await service.watchReminders(NOW);
      silentCrons.mockResolvedValue(['rewrite']);
      await service.watchReminders(NOW);

      expect(claim).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('gives the claim back when the mail did not leave, and never throws', async () => {
      const { release, service, silentCrons } = build({ sent: false });

      silentCrons.mockResolvedValue(['reminders']);
      await service.watchReminders(NOW);
      expect(release).toHaveBeenCalledWith('claim-1');

      silentCrons.mockRejectedValue(new Error('database gone'));
      await expect(service.watchReminders(NOW)).resolves.toBeUndefined();
    });
  });

  /* Project 009, PRD 1. The counts themselves are `AdminAlertController.pictureFailures`'s, and the whole path is the e2e suite's. */
  describe('dish pictures that failed', () => {
    const ALLERGEN = { n: 1, reason: 'judge_allergen' } as const;

    it('sends one mail for one failure, claimed for an hour and dated at the instant it counted up to', async () => {
      const { claim, pictureFailures, send, service } = build();

      pictureFailures.mockResolvedValue({ failed: [ALLERGEN], refused: [] });
      await service.pictureFailures(NOW);

      expect(pictureFailures).toHaveBeenCalledWith(NOW);
      expect(claim).toHaveBeenCalledTimes(1);
      expect(claim).toHaveBeenCalledWith('picture-failed', new Date(NOW.getTime() - HOUR), NOW);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toMatchObject({ kind: 'owner-picture-alert', subject: 'NutrIA — imágenes de platos fallidas: 1', to: OWNER });
      expect(send.mock.calls[0]?.[0].text).toContain('https://nutria.example/admin/catalogo?picture=failed');
    });

    it('sends one mail for three failures within the hour, and the next call past it carries the other two', async () => {
      const { claim, pictureFailures, send, service } = build();

      // The first failure wins the claim; the two after it find the hour taken.
      claim.mockResolvedValueOnce('claim-1').mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce('claim-2');
      pictureFailures.mockResolvedValueOnce({ failed: [ALLERGEN], refused: [] });
      await service.pictureFailures(NOW);
      // Counted since the mail that left: the first failure is no longer among them.
      pictureFailures.mockResolvedValueOnce({ failed: [ALLERGEN], refused: [] });
      await service.pictureFailures(new Date(NOW.getTime() + 10 * 60 * 1000));
      pictureFailures.mockResolvedValueOnce({ failed: [{ n: 1, reason: 'call_failed' }, ALLERGEN], refused: [] });
      await service.pictureFailures(new Date(NOW.getTime() + 20 * 60 * 1000));

      expect(send).toHaveBeenCalledTimes(1);

      const later = new Date(NOW.getTime() + 61 * 60 * 1000);

      pictureFailures.mockResolvedValueOnce({ failed: [{ n: 1, reason: 'call_failed' }, ALLERGEN], refused: [] });
      await service.pictureFailures(later);

      expect(claim).toHaveBeenLastCalledWith('picture-failed', new Date(later.getTime() - HOUR), later);
      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1]?.[0].subject).toBe('NutrIA — imágenes de platos fallidas: 2');
    });

    it('sends nothing, and claims nothing, when no picture failed — a row given back by the cap is not one', async () => {
      const { claim, send, service } = build();

      await service.pictureFailures(NOW);

      expect(claim).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('mails a refused payment or a rate limit under its own claim, once in six hours', async () => {
      const { claim, pictureFailures, send, service } = build();

      pictureFailures.mockResolvedValue({
        failed: [],
        refused: [
          { n: 2, reason: 'payment_refused' },
          { n: 1, reason: 'model_refused' }
        ]
      });
      claim.mockResolvedValueOnce('claim-1').mockResolvedValueOnce(null);
      await service.pictureFailures(NOW);
      await service.pictureFailures(new Date(NOW.getTime() + 5 * HOUR));

      expect(claim).toHaveBeenCalledWith('picture-payment-refused', new Date(NOW.getTime() - 6 * HOUR), NOW);
      expect(claim).toHaveBeenLastCalledWith('picture-payment-refused', new Date(NOW.getTime() - HOUR), new Date(NOW.getTime() + 5 * HOUR));
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toMatchObject({
        kind: 'owner-picture-alert',
        subject: 'NutrIA — el proveedor de imágenes rechaza las peticiones'
      });
      expect(send.mock.calls[0]?.[0].text).toContain(
        'desde el aviso anterior: 3. Por motivo: El proveedor no puede cobrar: 2; El modelo rechazó la petición: 1.'
      );
    });

    it('sends both mails when pictures failed and the provider turns the key away, each under its own claim', async () => {
      const { claim, pictureFailures, send, service } = build();

      pictureFailures.mockResolvedValue({ failed: [ALLERGEN], refused: [{ n: 1, reason: 'model_refused' }] });
      await service.pictureFailures(NOW);

      expect(claim.mock.calls.map(([kind]) => kind)).toEqual(['picture-failed', 'picture-payment-refused']);
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('gives the claim back when the mail did not leave, and never throws', async () => {
      const { pictureFailures, release, service } = build({ sent: false });

      pictureFailures.mockResolvedValue({ failed: [ALLERGEN], refused: [] });
      await service.pictureFailures(NOW);
      expect(release).toHaveBeenCalledWith('claim-1');

      pictureFailures.mockRejectedValue(new Error('database gone'));
      await expect(service.pictureFailures(NOW)).resolves.toBeUndefined();
    });
  });
});
