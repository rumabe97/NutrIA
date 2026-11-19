import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { CareRepository } from './CareRepository';

import { PgDialect } from 'drizzle-orm/pg-core';

import type { blocksPractice as blocksPracticeFn, RestrictionStanding } from '#repositories/Professional';
import type { SQL } from 'drizzle-orm';

/*
 * PRD 025 scope 2 and criterion 7, `0111` § 6: a practice nobody pays for
 * invites within its free seats, resolved inside the invitation's transaction
 * after the practice's row is held; a paid one keeps its plan's number; a
 * suspended or closed one, or one without the current agreement, is `closed`.
 * A fake that answers each awaited statement from a script, in order.
 */

const NOW = new Date('2026-11-19T09:00:00.000Z');
const LATER = new Date('2026-12-03T09:00:00.000Z');

const events: string[] = [];
let script: unknown[][] = [];

function chain(name: string): PromiseLike<unknown> & Record<string, unknown> {
  const link: PromiseLike<unknown> & Record<string, unknown> = {
    for: () => link,
    from: () => link,
    onConflictDoUpdate: () => link,
    returning: () => link,
    then: (resolve, reject) => {
      events.push(name);

      return Promise.resolve(script.shift() ?? []).then(resolve, reject);
    },
    values: () => link,
    where: () => link
  };

  return link;
}

const tx = { delete: () => chain('delete'), insert: () => chain('insert'), select: () => chain('select') };

/** The join conditions a plain read was given, in order. */
const joins: SQL[] = [];

function plainSelect() {
  const link = {
    from: () => link,
    innerJoin: (_table: unknown, on: SQL) => {
      joins.push(on);

      return link;
    },
    limit: () => Promise.resolve(script.shift() ?? []),
    where: () => link
  };

  return link;
}

vi.mock('database', () => ({ database: () => ({ select: plainSelect, transaction: <T>(fn: (db: unknown) => Promise<T>) => fn(tx) }) }));

const standing = vi.fn<(userId: string, db?: unknown) => Promise<RestrictionStanding>>();

vi.mock('#repositories/Professional', async () => ({
  blocksPractice: (await vi.importActual<{ blocksPractice: typeof blocksPracticeFn }>('../Professional/PracticeRestrictionRepository'))
    .blocksPractice,
  PracticeRestrictionRepository: { standing: (userId: string, db?: unknown) => standing(userId, db) },
  ProfessionalBadgeRepository: {}
}));

const INVITATION = {
  id: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  createdAt: NOW,
  email: 'nueva@example.com',
  expiresAt: LATER,
  professionalId: 'usr-pro',
  tokenHash: 'h'.repeat(64),
  updatedAt: NOW
};

function practice(open: boolean, includedClients = open ? 30 : 0, agreementVersion: string | null = PROFESSIONAL_AGREEMENT_VERSION) {
  return [{ agreementVersion, includedClients, open }];
}

/** The practice's row, then the two counts, then — when there is room — the clean-up and the insert. */
function scripted(row: unknown[], links: number, invitations: number): void {
  script = [row, [{ total: links }], [{ total: invitations }], [], [INVITATION]];
}

const freeSeats = vi.fn(async () => 10);

beforeEach(() => {
  events.length = 0;
  script = [];
  freeSeats.mockClear();
  standing.mockReset();
  standing.mockResolvedValue({ closing: null, suspended: null });
});

describe('CareRepository.invite — the seats', () => {
  it('a free practice invites up to its ten, live invitations counted', async () => {
    scripted(practice(false), 6, 3);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats)).resolves.toMatchObject({
      kind: 'invited'
    });
    expect(freeSeats).toHaveBeenCalledOnce();
  });

  it('and the next is refused as `full`, naming the ten', async () => {
    scripted(practice(false), 7, 3);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats)).resolves.toEqual({
      includedClients: 10,
      kind: 'full'
    });
    expect(events).not.toContain('insert');
  });

  it('asks the free seats only after the practice’s row is held — inside the transaction', async () => {
    freeSeats.mockImplementationOnce(async () => {
      events.push('free seats');

      return 10;
    });
    scripted(practice(false), 0, 0);

    await CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats);

    expect(events.indexOf('select')).toBeLessThan(events.indexOf('free seats'));
  });

  it('a paid practice keeps its plan’s number, and never asks the free seats', async () => {
    scripted(practice(true, 30), 25, 5);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats)).resolves.toEqual({
      includedClients: 30,
      kind: 'full'
    });
    expect(freeSeats).not.toHaveBeenCalled();
  });

  it.each([
    ['no longer a professional', [], { closing: null, suspended: null }],
    ['the agreement not accepted', practice(false, 0, null), { closing: null, suspended: null }],
    ['suspended', practice(true), { closing: null, suspended: { actedAt: NOW, reason: null } }],
    ['whose close has come', practice(false), { closing: { id: 'c', actedAt: NOW, actedBy: null, effectiveAt: NOW, reason: null }, suspended: null }]
  ])('is `closed`, writing nothing, for a practice %s', async (_case, row, stands) => {
    script = [row];
    standing.mockResolvedValue(stands as RestrictionStanding);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats)).resolves.toEqual({ kind: 'closed' });
    expect(events).not.toContain('insert');
    expect(freeSeats).not.toHaveBeenCalled();
  });
});

/*
 * PRD 025 scope 3, criterion 8 (PLAN phase 6 step 3): `tierOf` and
 * `coveredByOpenPractice` are untouched — premium follows a link only to a
 * practice **paid for**. A client of a free practice keeps their own tier,
 * because the join still asks `practice_open = true`.
 */
describe('CareRepository.coveredByOpenPractice — no premium by link to a free practice', () => {
  it('joins the practice on `practice_open = true`, so a free practice covers nobody', async () => {
    joins.length = 0;
    script = [[]];

    await expect(CareRepository.coveredByOpenPractice('usr-client')).resolves.toBe(false);

    const { params, sql } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(joins[0] as SQL);

    expect(sql).toBe('("professionals"."user_id" = "care_links"."professional_id" and "professionals"."practice_open" = $1)');
    expect(params).toEqual([true]);
  });
});
