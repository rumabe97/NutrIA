import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAlertController, crossedThreshold, hasNews, safeCode } from './AdminAlertController';

import type { OwnerDigest } from './AdminAlertController';

const admin = vi.hoisted(() => ({
  accountTotals: vi.fn(),
  failedPictures: vi.fn(),
  failuresByCode: vi.fn(),
  lastCronRuns: vi.fn(),
  lastOutcomes: vi.fn(),
  mailPerDay: vi.fn(),
  messagesSince: vi.fn(),
  monthByFeature: vi.fn(),
  pictures: vi.fn(),
  quality: vi.fn()
}));
const analytics = vi.hoisted(() => ({ claimOwnerAlert: vi.fn(), lastOwnerAlert: vi.fn(), releaseOwnerAlert: vi.fn() }));

vi.mock('#repositories/Admin', () => ({
  AdminAiRepository: { monthByFeature: admin.monthByFeature },
  AdminGenerationsRepository: { failuresByCode: admin.failuresByCode, lastOutcomes: admin.lastOutcomes },
  AdminRepository: { failedPictures: admin.failedPictures, pictures: admin.pictures },
  AdminSeriesRepository: { accountTotals: admin.accountTotals, messagesSince: admin.messagesSince },
  AdminSystemRepository: { lastCronRuns: admin.lastCronRuns, mailPerDay: admin.mailPerDay },
  JOB_STATUSES: [],
  PLAN_STATUSES: []
}));
vi.mock('#repositories/Analytics', () => ({ AnalyticsRepository: analytics }));
vi.mock('./AdminQualityController', () => ({ AdminQualityController: { quality: admin.quality } }));

const NOW = new Date('2026-09-29T08:00:00Z');
const HOUR = 60 * 60 * 1000;
const ZERO = { mealsOutsideServingBounds: 0, overBound: 0, refusalLimit: 0, uncosted: 0, unserved: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  admin.accountTotals.mockResolvedValue({ created: { current: 0, previous: 0 }, total: 5, waiting: 0 });
  admin.failedPictures.mockResolvedValue([]);
  admin.failuresByCode.mockResolvedValue([]);
  admin.lastCronRuns.mockResolvedValue([
    { at: new Date(NOW.getTime() - 20 * HOUR), job: 'reminders' },
    { at: new Date(NOW.getTime() - 20 * HOUR), job: 'rewrite' },
    { at: new Date(NOW.getTime() - 20 * HOUR), job: 'verifications' },
    { at: new Date(NOW.getTime() - 20 * HOUR), job: 'activations' }
  ]);
  admin.mailPerDay.mockResolvedValue([]);
  admin.messagesSince.mockResolvedValue(0);
  admin.monthByFeature.mockResolvedValue([]);
  admin.pictures.mockResolvedValue({ spentUsd: 0 });
  admin.quality.mockResolvedValue({ shouldBeZero: ZERO });
  analytics.lastOwnerAlert.mockResolvedValue(null);
});

describe('AdminAlertController.digest', () => {
  it('is empty, and has no news, when nothing is wrong', async () => {
    const digest = await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0' });

    expect(hasNews(digest)).toBe(false);
    expect(digest.textSpend).toBeUndefined();
  });

  it('counts messages since the last digest, and a day back when there was none', async () => {
    await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0' });
    expect(admin.messagesSince).toHaveBeenLastCalledWith(new Date(NOW.getTime() - 24 * HOUR));

    const last = new Date(NOW.getTime() - 26 * HOUR);

    analytics.lastOwnerAlert.mockResolvedValue(last);
    await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0' });
    expect(admin.messagesSince).toHaveBeenLastCalledWith(last);
  });

  it('reads the quality counts, the spend and the failures from the console’s own readers', async () => {
    admin.accountTotals.mockResolvedValue({ created: { current: 0, previous: 0 }, total: 9, waiting: 3 });
    admin.quality.mockResolvedValue({ shouldBeZero: { ...ZERO, overBound: 4 } });
    admin.pictures.mockResolvedValue({ spentUsd: 9 });
    admin.monthByFeature.mockResolvedValue([{ calls: 10, costUsd: 20, feature: 'plan', uncosted: 0 }]);
    admin.failuresByCode.mockResolvedValue([
      { code: 'GENERATION_AI_UNAVAILABLE', n: 2 },
      { code: null, n: 1 }
    ]);

    const digest = await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0', textCapUsd: 25 });

    expect(digest.waitingAccounts).toBe(3);
    expect(digest.shouldBeZero.overBound).toBe(4);
    expect(digest.pictureSpend).toEqual({ capUsd: 10, share: 0.9, spentUsd: 9 });
    expect(digest.textSpend?.share).toBe(0.8);
    expect(digest.failedGenerations).toEqual([
      { code: 'GENERATION_AI_UNAVAILABLE', n: 2 },
      { code: 'OTHER', n: 1 }
    ]);
    expect(hasNews(digest)).toBe(true);
  });

  it('does not count the reminders cron as silent while it is the one running, but does the rewrite', async () => {
    admin.lastCronRuns.mockResolvedValue([{ at: new Date(NOW.getTime() - 30 * HOUR), job: 'reminders' }]);

    const digest = await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0' });

    // Never recorded is stale, like the Sistema page reads it.
    expect(digest.crons).toEqual(['rewrite', 'verifications', 'activations']);
  });

  it('turns any free text a source held into a closed label: it cannot reach the mail', async () => {
    admin.failuresByCode.mockResolvedValue([{ code: 'Error: someone@example.com had no plan', n: 1 }]);
    admin.mailPerDay.mockResolvedValue([
      { day: '2026-09-29', failed: true, kind: 'someone@example.com', n: 1 },
      { day: '2026-09-29', failed: true, kind: 'verify-email', n: 2 },
      { day: '2026-09-29', failed: false, kind: 'password-reset', n: 9 }
    ]);

    const digest = await AdminAlertController.digest(NOW, { pictureCapUsd: 10, stepsVersion: '2.8.0' });

    expect(digest.failedGenerations).toEqual([{ code: 'OTHER', n: 1 }]);
    expect(digest.failedMail).toEqual([
      { kind: 'unknown', n: 1 },
      { kind: 'verify-email', n: 2 }
    ]);
    expect(JSON.stringify(digest)).not.toContain('@');
  });
});

describe('the thresholds', () => {
  it('tells 80 and 100 apart, and nothing below', () => {
    expect([0.5, 0.79, 0.8, 0.99, 1, 1.4].map(crossedThreshold)).toEqual([null, null, 80, 80, 100, 100]);
  });

  it('accepts only a code written in capitals and underscores', () => {
    expect([safeCode('GENERATION_FAILED'), safeCode(null), safeCode('generation failed'), safeCode('A@B')]).toEqual([
      'GENERATION_FAILED',
      'OTHER',
      'OTHER',
      'OTHER'
    ]);
  });

  it('reports each source at its highest threshold, only with a cap for the text', async () => {
    admin.pictures.mockResolvedValue({ spentUsd: 10.2 });
    admin.monthByFeature.mockResolvedValue([{ calls: 1, costUsd: 21, feature: 'plan', uncosted: 0 }]);

    expect(await AdminAlertController.spendCrossings(NOW, { pictureCapUsd: 10 })).toEqual([
      { capUsd: 10, share: 1.02, source: 'pictures', spentUsd: 10.2, threshold: 100 }
    ]);
    expect((await AdminAlertController.spendCrossings(NOW, { pictureCapUsd: 10, textCapUsd: 25 })).map(c => [c.source, c.threshold])).toEqual([
      ['pictures', 100],
      ['text', 80]
    ]);
  });
});

describe('the failure streak', () => {
  it('is the codes of the last three when all three failed', async () => {
    admin.lastOutcomes.mockResolvedValue([
      { code: 'GENERATION_AI_UNAVAILABLE', status: 'failed' },
      { code: 'GENERATION_TIMED_OUT', status: 'failed' },
      { code: null, status: 'failed' }
    ]);

    expect(await AdminAlertController.failureStreak()).toEqual(['GENERATION_AI_UNAVAILABLE', 'GENERATION_TIMED_OUT', 'OTHER']);
  });

  it('is nothing when one of the three succeeded, or fewer than three ever finished', async () => {
    admin.lastOutcomes.mockResolvedValue([
      { code: 'X', status: 'failed' },
      { code: null, status: 'succeeded' },
      { code: 'X', status: 'failed' }
    ]);
    expect(await AdminAlertController.failureStreak()).toBeNull();

    admin.lastOutcomes.mockResolvedValue([{ code: 'X', status: 'failed' }]);
    expect(await AdminAlertController.failureStreak()).toBeNull();
  });
});

describe('the pictures that failed', () => {
  const failed = (reason: string) => ({ provenance: { notes: ['1:rejected:SENTINEL-DISH-NAME'], reason }, released: false });
  const released = (reason: string) => ({ provenance: { reason, released: 'SENTINEL-ERROR-TEXT' }, released: true });

  it('counts each kind since its own last mail, and a day back when there was none', async () => {
    await AdminAlertController.pictureFailures(NOW);

    expect(analytics.lastOwnerAlert.mock.calls).toEqual([['picture-failed'], ['picture-payment-refused']]);
    expect(admin.failedPictures.mock.calls).toEqual([
      [new Date(NOW.getTime() - 24 * HOUR), NOW],
      [new Date(NOW.getTime() - 24 * HOUR), NOW]
    ]);

    const lastFailed = new Date(NOW.getTime() - 2 * HOUR);
    const lastRefused = new Date(NOW.getTime() - 50 * HOUR);

    analytics.lastOwnerAlert.mockImplementation(async (kind: string) => Promise.resolve(kind === 'picture-failed' ? lastFailed : lastRefused));
    admin.failedPictures.mockClear();
    await AdminAlertController.pictureFailures(NOW);

    expect(admin.failedPictures.mock.calls).toEqual([
      [lastFailed, NOW],
      [lastRefused, NOW]
    ]);
  });

  it('counts the dishes that failed by closed reason, and leaves out the ones given back', async () => {
    admin.failedPictures.mockResolvedValue([
      failed('judge_allergen'),
      failed('judge_allergen'),
      failed('no_provenance'),
      failed('SENTINEL-ERROR-TEXT'),
      released('cap_reached'),
      released('payment_refused')
    ]);

    const { failed: counts } = await AdminAlertController.pictureFailures(NOW);

    expect(counts).toEqual([
      { n: 2, reason: 'judge_allergen' },
      // A reason outside the closed set is read from the notes, never shown as it came.
      { n: 1, reason: 'judge_rejected' },
      { n: 1, reason: 'no_provenance' }
    ]);
    expect(JSON.stringify(counts)).not.toContain('SENTINEL');
  });

  /* 0072: a picture the owner removed is a failed row, and the owner's own act: no mail tells them what they just did. */
  it('leaves out the pictures the owner removed by hand, and mails nothing when they are all there is', async () => {
    admin.failedPictures.mockResolvedValue([failed('owner_removed'), failed('judge_allergen'), failed('owner_removed')]);
    await expect(AdminAlertController.pictureFailures(NOW)).resolves.toEqual({ failed: [{ n: 1, reason: 'judge_allergen' }], refused: [] });

    admin.failedPictures.mockResolvedValue([failed('owner_removed')]);
    await expect(AdminAlertController.pictureFailures(NOW)).resolves.toEqual({ failed: [], refused: [] });
  });

  it('counts the provider’s refusals — no payment, a rate limit — only on rows given back, and never the month’s cap', async () => {
    admin.failedPictures.mockResolvedValue([released('cap_reached'), released('other'), failed('payment_refused'), failed('model_refused')]);
    await expect(AdminAlertController.pictureFailures(NOW)).resolves.toMatchObject({ refused: [] });

    admin.failedPictures.mockResolvedValue([
      released('payment_refused'),
      released('payment_refused'),
      released('model_refused'),
      released('cap_reached')
    ]);
    await expect(AdminAlertController.pictureFailures(NOW)).resolves.toEqual({
      failed: [],
      refused: [
        { n: 2, reason: 'payment_refused' },
        { n: 1, reason: 'model_refused' }
      ]
    });
  });

  it('dates a claim by the clock it is given', async () => {
    await AdminAlertController.claim('picture-failed', new Date(NOW.getTime() - HOUR), NOW);

    expect(analytics.claimOwnerAlert).toHaveBeenCalledWith('picture-failed', new Date(NOW.getTime() - HOUR), NOW);
  });
});

describe('the silent crons', () => {
  it('names a cron past 26 h or never run, and none when both are recent', async () => {
    expect(await AdminAlertController.silentCrons(NOW)).toEqual([]);

    admin.lastCronRuns.mockResolvedValue([{ at: new Date(NOW.getTime() - 30 * HOUR), job: 'reminders' }]);
    expect(await AdminAlertController.silentCrons(NOW)).toEqual(['reminders', 'rewrite', 'verifications', 'activations']);

    admin.lastCronRuns.mockResolvedValue([]);
    expect(await AdminAlertController.silentCrons(NOW)).toEqual(['reminders', 'rewrite', 'verifications', 'activations']);
  });
});

describe('hasNews', () => {
  const quiet: OwnerDigest = {
    crons: [],
    failedGenerations: [],
    failedMail: [],
    newMessages: 0,
    pictureSpend: { capUsd: 10, share: 0.79, spentUsd: 7.9 },
    shouldBeZero: ZERO,
    waitingAccounts: 0
  };

  it('needs one non-zero item or a spend at 80 %, and a should-be-zero count alone is not one', () => {
    expect(hasNews(quiet)).toBe(false);
    expect(hasNews({ ...quiet, waitingAccounts: 1 })).toBe(true);
    expect(hasNews({ ...quiet, newMessages: 1 })).toBe(true);
    expect(hasNews({ ...quiet, shouldBeZero: { ...ZERO, unserved: 1 } })).toBe(false);
    expect(hasNews({ ...quiet, pictureSpend: { capUsd: 10, share: 0.8, spentUsd: 8 } })).toBe(true);
    expect(hasNews({ ...quiet, textSpend: { capUsd: 10, share: 0.85, spentUsd: 8.5 } })).toBe(true);
    expect(hasNews({ ...quiet, crons: ['rewrite'] })).toBe(true);
  });
});
