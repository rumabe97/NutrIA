import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { PlanRepository, saveShape } from './PlanRepository';

import type { blocksPractice as blocksPracticeFn, RestrictionStanding } from '#repositories/Professional';
import type { SQL } from 'drizzle-orm';

/*
 * PLAN 025 phase 6 (the lead, on answer a): a client is never left without a plan
 * because the owner suspended — or closed — their practitioner. The link a plan
 * waits on (`publishingLink`) asks what `practising` asks: the current agreement,
 * and no suspension or close come standing. When it does not stand, the client's
 * plan publishes to them directly, and a plan already waiting is stranded: it is
 * counted toward no allowance (`isPublishable`, which the redo count asks) and the
 * next generation replaces it at no charge (`saveShape` with nothing `counted`).
 */

const dialect = new PgDialect({ casing: 'snake_case' });
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** What the link read answers, and the `WHERE` it was given. */
let rows: unknown[] = [];
let where: SQL | undefined;

function select() {
  const chain = {
    from: () => chain,
    limit: () => Promise.resolve(rows),
    where: (condition: SQL) => {
      where ??= condition;

      return chain;
    }
  };

  return chain;
}

vi.mock('database', () => ({ database: () => ({ select }) }));

const standing = vi.fn<(userId: string, db?: unknown) => Promise<RestrictionStanding>>();

vi.mock('#repositories/Professional', async () => ({
  blocksPractice: (await vi.importActual<{ blocksPractice: typeof blocksPracticeFn }>('../Professional/PracticeRestrictionRepository'))
    .blocksPractice,
  PracticeRestrictionRepository: { standing: (userId: string, db?: unknown) => standing(userId, db) }
}));

const LINK = {
  id: '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b',
  createdAt: new Date(NOW - 30 * DAY),
  professionalId: 'usr-pro',
  reviewBeforePublish: true
};
const NOTHING: RestrictionStanding = { closing: null, suspended: null };
const SUSPENDED: RestrictionStanding = { closing: null, suspended: { actedAt: new Date(NOW - DAY), reason: null } };

function closing(inDays: number): RestrictionStanding {
  return {
    closing: { id: 'c', actedAt: new Date(NOW - DAY), actedBy: null, effectiveAt: new Date(NOW + inDays * DAY), reason: null },
    suspended: null
  };
}

beforeEach(() => {
  rows = [LINK];
  where = undefined;
  standing.mockReset();
  standing.mockResolvedValue(NOTHING);
});

describe('PlanRepository.isPublishable — a plan waits only for a practitioner who practises now', () => {
  it('waits for a practitioner with the current agreement and nothing standing', async () => {
    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(true);
    expect(standing).toHaveBeenCalledExactlyOnceWith('usr-pro', expect.anything());
  });

  it('asks the current agreement in the read itself, as `practising` does', async () => {
    await PlanRepository.isPublishable('usr-client');

    const { params, sql } = dialect.sqlToQuery(where as SQL);

    expect(sql).toContain('"professionals"."agreement_version" = $');
    expect(params).toContain(PROFESSIONAL_AGREEMENT_VERSION);
  });

  it.each([
    ['suspended', SUSPENDED],
    ['whose close has come, before the sweep', closing(0)]
  ])('does not wait for a practitioner %s: the plan publishes directly, and one already waiting costs nothing', async (_case, stands) => {
    standing.mockResolvedValue(stands);

    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(false);
  });

  it('still waits through a close whose day has not come: the practice works until then', async () => {
    standing.mockResolvedValue(closing(10));

    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(true);
  });

  it('waits again once the suspension is lifted — nothing retroactive, read on every call', async () => {
    standing.mockResolvedValueOnce(SUSPENDED).mockResolvedValueOnce(NOTHING);

    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(false);
    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(true);
  });

  it('reads no restriction when there is no link to wait on', async () => {
    rows = [];

    await expect(PlanRepository.isPublishable('usr-client')).resolves.toBe(false);
    expect(standing).not.toHaveBeenCalled();
  });
});

/*
 * A plan already waiting when the suspension lands: with no link that can publish,
 * the save counts nothing of it (`counted` undefined). Its own redo is not carried
 * onto the plan replacing it, and the new plan is a redo only of the fortnight the
 * client is living — exactly what it would be with no link at all.
 */
describe('saveShape — a plan stranded by the owner’s act is replaced at no charge', () => {
  const TODAY = '2026-11-19';
  const stranded = { endDate: '2026-12-02', generationMetadata: { redo: true, replacedRedos: 1 } };

  it('carries nothing of the stranded plan, and goes active', () => {
    const shape = saveShape({ active: undefined, counted: undefined, review: false, start: TODAY, today: TODAY, waiting: undefined });

    expect(shape).toMatchObject({ redo: false, replacedRedos: 0, status: 'active' });
  });

  it('as the same plan would cost were it still publishable — the difference the owner’s act must not charge', () => {
    expect(saveShape({ active: undefined, counted: stranded, review: false, start: TODAY, today: TODAY, waiting: undefined })).toMatchObject({
      redo: true,
      replacedRedos: 2
    });
  });
});
