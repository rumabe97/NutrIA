import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TERMS_VERSION } from 'core/entities/User';

import { AdminSystemController, CRON_STALE_HOURS } from './AdminSystemController';

import type { SystemSnapshot } from './AdminSystemController';

const repository = vi.hoisted(() => ({ lastCronRuns: vi.fn(), mailPerDay: vi.fn() }));

vi.mock('#repositories/Admin', () => ({ AdminSystemRepository: repository, JOB_STATUSES: [], PLAN_STATUSES: [] }));

const NOW = new Date('2026-09-29T10:00:00Z');
const HOUR = 60 * 60 * 1000;
const SNAPSHOT: SystemSnapshot = {
  commit: 'A1B2C3D4E5F60718293A4B5C6D7E8F9012345678',
  integrations: { cronSecret: true, mail: true, ownerAddress: false, pictures: true, push: false, rewriteSweep: true, sentry: true },
  pictureMonthlyCapUsd: 10,
  promptVersion: '4.5.0',
  stepsVersion: '2.8.0'
};

beforeEach(() => {
  vi.resetAllMocks();
  repository.lastCronRuns.mockResolvedValue([]);
  repository.mailPerDay.mockResolvedValue([]);
});

/** Every leaf of an answer, with the path that leads to it. */
function leaves(value: unknown, path: string[] = []): { path: string; value: unknown }[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, at) => leaves(item, [...path, String(at)]));
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
  }

  return [{ path: path.join('.'), value }];
}

describe('AdminSystemController.system', () => {
  it('holds only booleans, versions, dates, a commit hash, the app’s own caps, the period and counts — never a configuration value', async () => {
    repository.lastCronRuns.mockResolvedValue([{ at: new Date(NOW.getTime() - 2 * HOUR), job: 'reminders' }]);
    repository.mailPerDay.mockResolvedValue([{ day: '2026-09-28', failed: false, kind: 'verify', n: 3 }]);

    const view = await AdminSystemController.system(30, SNAPSHOT, NOW);
    const VERSION = /^\d+\.\d+\.\d+$/;
    const HASH = /^[0-9a-f]{7,40}$/;
    const DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/;
    const KEYS = new Set(['afternoon_snack', 'breakfast', 'dinner', 'lunch', 'morning_snack', 'supper', 'reminders', 'rewrite', 'verify']);

    for (const { path, value } of leaves(view)) {
      if (path.startsWith('caps.') || path === 'period' || path.startsWith('mail.') || path.startsWith('window.')) {
        // Limits the app enforces, the period, counts per day, and the days and template names they are indexed by.
        expect(['number', 'string'], path).toContain(typeof value);

        if (typeof value === 'string') {
          expect(DATE.test(value) || KEYS.has(value), path).toBe(true);
        }

        continue;
      }

      if (path === 'commit') {
        expect(value, path).toMatch(HASH);
      } else if (path.startsWith('versions.')) {
        expect(value, path).toMatch(VERSION);
      } else if (path.startsWith('crons.') && path.endsWith('.lastRunAt')) {
        expect(value === null || (typeof value === 'string' && DATE.test(value)), path).toBe(true);
      } else if (path.startsWith('crons.') && path.endsWith('.job')) {
        expect(KEYS.has(String(value)), path).toBe(true);
      } else {
        expect(typeof value, path).toBe('boolean');
      }
    }
  });

  it('carries no value the snapshot was given a name for', async () => {
    const view = JSON.stringify(await AdminSystemController.system(30, { ...SNAPSHOT, commit: 'not-a-hash: sk-secret' }, NOW));

    expect(view).not.toContain('sk-secret');
    expect((JSON.parse(view) as { commit: unknown }).commit).toBeNull();
  });

  it('accepts a commit of 7 to 40 hex characters and nothing longer', async () => {
    for (const [commit, shown] of [
      ['ABCDEF1', 'abcdef1'],
      ['a'.repeat(40), 'a'.repeat(40)],
      ['a'.repeat(41), null],
      ['a'.repeat(64), null],
      ['abcdef', null]
    ] as const) {
      expect((await AdminSystemController.system(30, { ...SNAPSHOT, commit }, NOW)).commit, commit).toBe(shown);
    }
  });

  it('lowercases a commit hash and shows the versions and caps the app is running', async () => {
    const view = await AdminSystemController.system(30, SNAPSHOT, NOW);

    expect(view.commit).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');
    expect(view.versions).toMatchObject({ prompt: '4.5.0', steps: '2.8.0', terms: TERMS_VERSION });
    expect(view.caps).toMatchObject({ oversizedFactor: 1.5, pictureMonthlyUsd: 10, rewriteAttemptBound: 3, servingBounds: { max: 4, min: 0.5 } });
    expect(view.caps.servingKcal.lunch).toBe(900);
  });

  it('marks a cron stale past 26 hours, and one never recorded', async () => {
    repository.lastCronRuns.mockResolvedValue([
      { at: new Date(NOW.getTime() - CRON_STALE_HOURS * HOUR), job: 'reminders' },
      { at: new Date(NOW.getTime() - (CRON_STALE_HOURS + 1) * HOUR), job: 'rewrite' }
    ]);

    const fresh = await AdminSystemController.system(30, SNAPSHOT, NOW);

    expect(fresh.crons).toEqual([
      { job: 'reminders', lastRunAt: new Date(NOW.getTime() - 26 * HOUR).toISOString(), stale: false },
      { job: 'rewrite', lastRunAt: new Date(NOW.getTime() - 27 * HOUR).toISOString(), stale: true }
    ]);

    repository.lastCronRuns.mockResolvedValue([]);

    expect((await AdminSystemController.system(30, SNAPSHOT, NOW)).crons).toEqual([
      { job: 'reminders', lastRunAt: null, stale: true },
      { job: 'rewrite', lastRunAt: null, stale: true }
    ]);
  });

  it('counts mail per template over the period and per day over every template, never a template per day', async () => {
    repository.mailPerDay.mockResolvedValue([
      { day: '2026-09-29', failed: false, kind: 'verify', n: 3 },
      { day: '2026-09-29', failed: true, kind: 'verify', n: 1 },
      { day: '2026-09-28', failed: false, kind: 'reset', n: 2 }
    ]);

    const { mail } = await AdminSystemController.system(7, SNAPSHOT, NOW);

    expect(mail.days).toHaveLength(7);
    expect(mail.kinds).toEqual([
      { failed: 0, kind: 'reset', sent: 2 },
      { failed: 1, kind: 'verify', sent: 3 }
    ]);
    expect(mail.perDay.sent).toHaveLength(7);
    expect(mail.perDay.sent.slice(-2)).toEqual([2, 3]);
    expect(mail.perDay.failed.slice(-2)).toEqual([0, 1]);
    expect(mail.totals).toEqual({ failed: 1, sent: 5 });
    expect(Object.keys(mail).sort()).toEqual(['days', 'kinds', 'perDay', 'totals']);
  });
});
