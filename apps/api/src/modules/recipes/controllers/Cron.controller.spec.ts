import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { CheckInReminderService } from '../../notifications/index.js';
import { CronController } from './Cron.controller.js';
import { CronRunService } from '../services/index.js';
import { ExpiredInvitationsService } from '../../care/services/ExpiredInvitations.service.js';
import { ExpiredVerificationsService } from '../../auth/services/ExpiredVerifications.service.js';
import { ENV } from '../../../config/index.js';
import { OwnerAlertsService } from '../../owner-alerts/index.js';
import { PictureCandidatesService, RecipeRewriter } from '../../ai/index.js';
import { TwoFactorRemovalsService } from '../../auth/services/TwoFactorRemovals.service.js';

import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const SECRET = 'a-secret-of-sixteen-chars';

/**
 * The cron's door. Wrong secret, no secret, no secret configured: all 404, the
 * same as every other denial, so probing does not confirm the route exists.
 */
describe('the cron routes', () => {
  let app: INestApplication;
  const rewriteOutdated =
    jest.fn<(limit: number) => Promise<{ heldBy?: 'cap'; pending: number; rewritten: number; skipped: number; unreached: number }>>();
  const sweep = jest.fn(async () => Promise.resolve({ considered: 0, failed: 0, pushed: 0, sent: 0 }));
  const forget = jest.fn(async () => Promise.resolve());
  const forgetVerifications = jest.fn(async () => Promise.resolve(0));
  const removeTwoFactors = jest.fn(async () => Promise.resolve({ failed: 0, removed: 0 }));
  const record = jest.fn(async (_job: string, _counts: Readonly<Record<string, 'cap' | number>>) => Promise.resolve());
  const digest = jest.fn(async () => Promise.resolve());
  const checkSpend = jest.fn(async () => Promise.resolve());
  const watchReminders = jest.fn(async () => Promise.resolve());
  const pictureFailures = jest.fn(async () => Promise.resolve());
  const clean = jest.fn(async (_budgetMs: number) => Promise.resolve({ deleted: 0, left: 0 }));
  const bearer = (secret: string) => ['Bearer', secret].join(' ');

  afterEach(async () => {
    jest.clearAllMocks();
    await app?.close();
  });

  async function boot(secret: string | undefined): Promise<Server> {
    const moduleRef = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ENV, useValue: { CRON_SECRET: secret } },
        { provide: RecipeRewriter, useValue: { rewriteOutdated } },
        { provide: CheckInReminderService, useValue: { sweep } },
        { provide: ExpiredInvitationsService, useValue: { forget } },
        { provide: ExpiredVerificationsService, useValue: { forget: forgetVerifications } },
        { provide: TwoFactorRemovalsService, useValue: { run: removeTwoFactors } },
        { provide: CronRunService, useValue: { record } },
        { provide: PictureCandidatesService, useValue: { clean } },
        { provide: OwnerAlertsService, useValue: { checkSpend, digest, pictureFailures, watchReminders } }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    return app.getHttpServer() as Server;
  }

  /* RGPD art. 14: the invitation mail promises an address is gone within 14 days, answered or not. */
  it('deletes expired invitations on the daily reminder run, then sends the reminders', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(forget).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledTimes(1);
  });

  /* 0071: the digest is not the reminders: it goes first, whatever their switch says, and a switched-off sweep does not stop it. */
  it('sends the owner digest before the reminders, and even when the sweep will do nothing', async () => {
    const order: string[] = [];

    digest.mockImplementationOnce(async () => {
      order.push('digest');

      return Promise.resolve();
    });
    sweep.mockImplementationOnce(async () => {
      order.push('sweep');

      return Promise.resolve({ considered: 0, failed: 0, pushed: 0, sent: 0 });
    });
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(order).toEqual(['digest', 'sweep']);
  });

  it('checks the spend once the rewrite sweep ends, not before', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

    expect(checkSpend).toHaveBeenCalledTimes(1);
  });

  it('checks the reminders cron before the rewrite sweep, whether it is held by the cap, throws, or the watch itself fails', async () => {
    const order: string[] = [];

    watchReminders.mockImplementationOnce(async () => {
      order.push('watch');

      return Promise.resolve();
    });
    rewriteOutdated.mockImplementationOnce(async () => {
      order.push('sweep');

      return Promise.resolve({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    });
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);
    expect(order).toEqual(['watch', 'sweep']);

    watchReminders.mockRejectedValueOnce(new Error('database gone'));
    rewriteOutdated.mockResolvedValueOnce({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);
    expect(record).toHaveBeenLastCalledWith('rewrite', { candidatesDeleted: 0, pending: 0, rewritten: 0, skipped: 0, unreached: 0 });

    watchReminders.mockClear();
    rewriteOutdated.mockRejectedValueOnce(new Error('model gone'));
    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(500);
    expect(watchReminders).toHaveBeenCalledTimes(1);
  });

  it('runs nothing on the rewrite route for the wrong bearer', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('wrong')).expect(404);

    expect(watchReminders).not.toHaveBeenCalled();
    expect(rewriteOutdated).not.toHaveBeenCalled();
    expect(checkSpend).not.toHaveBeenCalled();
  });

  it('sends no digest to the wrong bearer', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer('wrong')).expect(404);

    expect(digest).not.toHaveBeenCalled();
  });

  /* 0071: a run leaves no row of its own, so each one that finishes says so — its job and its counts. */
  it('records the reminder run once it finished, with its counts', async () => {
    sweep.mockResolvedValueOnce({ considered: 3, failed: 1, pushed: 1, sent: 2 });
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('reminders', { considered: 3, failed: 1, pushed: 1, sent: 2 });
  });

  /* Project 009: the failed pictures an hour's claim held back go out with the next cron, whichever it is. */
  it('sends the failed pictures’ mail on both crons, and neither run depends on it', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);
    expect(pictureFailures).toHaveBeenCalledTimes(1);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);
    expect(pictureFailures).toHaveBeenCalledTimes(2);

    pictureFailures.mockRejectedValue(new Error('smtp is down'));
    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);
    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);
    expect(sweep).toHaveBeenCalledTimes(2);
    expect(rewriteOutdated).toHaveBeenCalledTimes(2);
    pictureFailures.mockResolvedValue(undefined);
  });

  it('waits for the failed pictures’ mail only as long as its budget, on both crons', async () => {
    const budgets: number[] = [];
    const realTimeout = setTimeout;

    // The budget's own timer fires at once; every other timer is left alone.
    jest.spyOn(globalThis, 'setTimeout').mockImplementation(((run: () => void, ms?: number) => {
      if (ms !== 10_000) {
        return realTimeout(run, ms);
      }

      budgets.push(ms);

      return realTimeout(run, 0);
    }) as typeof setTimeout);
    rewriteOutdated.mockResolvedValue({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    // A mail server that never answers.
    pictureFailures.mockImplementation(async () => new Promise<void>(() => undefined));

    try {
      const server = await boot(SECRET);

      await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);
      expect(budgets).toHaveLength(1);
      await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);
      expect(budgets).toHaveLength(2);

      expect(sweep).toHaveBeenCalledTimes(1);
      expect(rewriteOutdated).toHaveBeenCalledTimes(1);
    } finally {
      jest.restoreAllMocks();
      pictureFailures.mockImplementation(async () => Promise.resolve());
    }
  });

  /* 0072, PRD 009 criterion 3: the expired candidates are deleted at 03:30, before the sweep, and the run says how many. */
  describe('the cleanup of expired picture candidates', () => {
    it('runs on the rewrite route only, after the watch and before the sweep, and its count goes in the run’s record', async () => {
      const order: string[] = [];

      watchReminders.mockImplementationOnce(async () => {
        order.push('watch');

        return Promise.resolve();
      });
      clean.mockImplementationOnce(async () => {
        order.push('clean');

        return Promise.resolve({ deleted: 3, left: 1 });
      });
      rewriteOutdated.mockImplementationOnce(async () => {
        order.push('sweep');

        return Promise.resolve({ pending: 4, rewritten: 2, skipped: 1, unreached: 1 });
      });
      const server = await boot(SECRET);

      const response = await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

      expect(order).toEqual(['watch', 'clean', 'sweep']);
      expect(clean).toHaveBeenCalledWith(8_000);
      expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 3, pending: 4, rewritten: 2, skipped: 1, unreached: 1 });
      // The sweep's answer is the sweep's: the cleanup is in the record, not in it.
      expect(response.body).toEqual({ pending: 4, rewritten: 2, skipped: 1, unreached: 1 });

      clean.mockClear();
      await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);
      expect(clean).not.toHaveBeenCalled();
    });

    it('is counted in a run held back by the cap too', async () => {
      clean.mockResolvedValueOnce({ deleted: 2, left: 0 });
      rewriteOutdated.mockResolvedValue({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
      const server = await boot(SECRET);

      await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

      expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 2, pending: 0, rewritten: 0, skipped: 'cap', unreached: 0 });
    });

    it('never throws into the sweep: a cleanup that fails is recorded as none', async () => {
      clean.mockRejectedValueOnce(new Error('store down'));
      rewriteOutdated.mockResolvedValue({ pending: 0, rewritten: 1, skipped: 0, unreached: 0 });
      const server = await boot(SECRET);

      await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

      expect(rewriteOutdated).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 0, pending: 0, rewritten: 1, skipped: 0, unreached: 0 });
    });

    it('holds the sweep no longer than its own budget, apart from the watch’s', async () => {
      const budgets: number[] = [];
      const realTimeout = setTimeout;

      // The cleanup's own timer fires at once; every other timer is left alone.
      jest.spyOn(globalThis, 'setTimeout').mockImplementation(((run: () => void, ms?: number) => {
        if (ms !== 8_000) {
          return realTimeout(run, ms);
        }

        budgets.push(ms);

        return realTimeout(run, 0);
      }) as typeof setTimeout);
      rewriteOutdated.mockResolvedValue({ pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
      // A store that never answers.
      clean.mockImplementationOnce(async () => new Promise<{ deleted: number; left: number }>(() => undefined));

      try {
        const server = await boot(SECRET);

        await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

        expect(budgets).toHaveLength(1);
        expect(rewriteOutdated).toHaveBeenCalledTimes(1);
        expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 0, pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('deletes nothing for the wrong bearer', async () => {
      const server = await boot(SECRET);

      await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('wrong')).expect(404);

      expect(clean).not.toHaveBeenCalled();
    });
  });

  it('sends no failed pictures’ mail to the wrong bearer', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer('wrong')).expect(404);
    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('wrong')).expect(404);

    expect(pictureFailures).not.toHaveBeenCalled();
  });

  it("still runs the reminders when the owner's digest fails", async () => {
    digest.mockRejectedValueOnce(new Error('smtp is down'));
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(200);

    expect(forget).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('reminders', { considered: 0, failed: 0, pushed: 0, sent: 0 });
  });

  it('still answers the rewrite sweep when the spend check fails', async () => {
    rewriteOutdated.mockResolvedValueOnce({ pending: 0, rewritten: 1, skipped: 0, unreached: 0 });
    checkSpend.mockRejectedValueOnce(new Error('database gone'));
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

    expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 0, pending: 0, rewritten: 1, skipped: 0, unreached: 0 });
  });

  it('records no run that did not finish', async () => {
    sweep.mockRejectedValueOnce(new Error('database gone'));
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer(SECRET)).expect(500);

    expect(record).not.toHaveBeenCalled();
  });

  it('deletes nothing for the wrong bearer', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/reminders').set('Authorization', bearer('wrong')).expect(404);
    expect(forget).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('runs a bounded rewrite sweep on its own route', async () => {
    rewriteOutdated.mockResolvedValue({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    const server = await boot(SECRET);

    const response = await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

    expect(response.body).toEqual({ pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
    expect(rewriteOutdated).toHaveBeenCalledWith(12);
    expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 0, pending: 12, rewritten: 9, skipped: 1, unreached: 2 });
  });

  it('records a sweep held back by the cap as skipped: cap', async () => {
    rewriteOutdated.mockResolvedValue({ heldBy: 'cap', pending: 0, rewritten: 0, skipped: 0, unreached: 0 });
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(200);

    expect(record).toHaveBeenCalledWith('rewrite', { candidatesDeleted: 0, pending: 0, rewritten: 0, skipped: 'cap', unreached: 0 });
  });

  it('records nothing when the sweep throws (a spend it could not read)', async () => {
    rewriteOutdated.mockRejectedValue(new Error('database down'));
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer(SECRET)).expect(500);

    expect(record).not.toHaveBeenCalled();
  });

  it('guards the rewrite route exactly as it guards the other', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('wrong')).expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });

  /* PLAN 011: Better Auth's own pruning is off, so this route owns it; it touches nothing else. */
  it('deletes the expired verification rows on its own route and answers how many', async () => {
    forgetVerifications.mockResolvedValueOnce(5);
    const server = await boot(SECRET);

    const response = await request(server).get('/cron/sweep-verifications').set('Authorization', bearer(SECRET)).expect(200);

    expect(response.body).toEqual({ deleted: 5 });
    expect(forgetVerifications).toHaveBeenCalledTimes(1);
    expect(forget).not.toHaveBeenCalled();
    expect(sweep).not.toHaveBeenCalled();
    expect(rewriteOutdated).not.toHaveBeenCalled();
    // 0071: the run says it finished, with its count, so the console's silent-cron watch sees it.
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('verifications', { deleted: 5 });
  });

  it('records no verification sweep that did not finish', async () => {
    forgetVerifications.mockRejectedValueOnce(new Error('database down'));
    const server = await boot(SECRET);

    await request(server).get('/cron/sweep-verifications').set('Authorization', bearer(SECRET)).expect(500);

    expect(record).not.toHaveBeenCalled();
  });

  it('deletes no verification row for the wrong bearer, or none at all', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/sweep-verifications').set('Authorization', bearer('wrong')).expect(404);
    await request(server).get('/cron/sweep-verifications').expect(404);
    expect(forgetVerifications).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it('deletes no verification row when no secret is configured', async () => {
    const server = await boot(undefined);

    await request(server).get('/cron/sweep-verifications').set('Authorization', bearer('undefined')).expect(404);
    expect(forgetVerifications).not.toHaveBeenCalled();
  });

  /* PLAN 011 phase 4: the owner's removals of lost second factors run on their own route, and record their run. */
  it('carries out the due two-factor removals on their own route, answers the counts and records the run', async () => {
    removeTwoFactors.mockResolvedValueOnce({ failed: 1, removed: 2 });
    const server = await boot(SECRET);

    const response = await request(server).get('/cron/two-factor-removals').set('Authorization', bearer(SECRET)).expect(200);

    expect(response.body).toEqual({ failed: 1, removed: 2 });
    expect(removeTwoFactors).toHaveBeenCalledTimes(1);
    expect(forgetVerifications).not.toHaveBeenCalled();
    expect(sweep).not.toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith('twoFactorRemovals', { failed: 1, removed: 2 });
  });

  it('records no two-factor run that did not finish', async () => {
    removeTwoFactors.mockRejectedValueOnce(new Error('database down'));
    const server = await boot(SECRET);

    await request(server).get('/cron/two-factor-removals').set('Authorization', bearer(SECRET)).expect(500);

    expect(record).not.toHaveBeenCalled();
  });

  it('removes no factor for the wrong bearer, none at all, or no secret configured', async () => {
    let server = await boot(SECRET);

    await request(server).get('/cron/two-factor-removals').set('Authorization', bearer('wrong')).expect(404);
    await request(server).get('/cron/two-factor-removals').expect(404);
    await app.close();
    server = await boot(undefined);
    await request(server).get('/cron/two-factor-removals').set('Authorization', bearer('undefined')).expect(404);

    expect(removeTwoFactors).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  /* 0066: a dish is drawn the first time its meal page is opened, never by a sweep. */
  it('has no illustration sweep any more', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/illustrate').set('Authorization', bearer(SECRET)).expect(404);
  });

  it('is 404 with no bearer at all', async () => {
    const server = await boot(SECRET);

    await request(server).get('/cron/rewrite-steps').expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });

  it('does not exist when no secret is configured, whatever is sent', async () => {
    const server = await boot(undefined);

    await request(server).get('/cron/rewrite-steps').set('Authorization', bearer('anything')).expect(404);
    expect(rewriteOutdated).not.toHaveBeenCalled();
  });
});
