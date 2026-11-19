import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PROFESSIONAL_AGREEMENT_VERSION } from 'core/entities/Professional';

import { CareRepository } from './CareRepository';

import { PgDialect } from 'drizzle-orm/pg-core';

import type { blocksPractice as blocksPracticeFn, RestrictionStanding } from '#repositories/Professional';
import type { NameRefusal } from './CareRepository';
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
    limit: () => link,
    onConflictDoUpdate: () => link,
    returning: () => link,
    then: (resolve, reject) => {
      events.push(name);

      return Promise.resolve(script.shift() ?? []).then(resolve, reject);
    },
    values: () => link,
    where: (condition: SQL) => {
      wheres.push(condition);

      return link;
    }
  };

  return link;
}

/** Every `WHERE` the transaction was given, in order. */
const wheres: SQL[] = [];

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
const badgeOf = vi.fn<(userId: string, now: Date, db?: unknown) => Promise<object | null>>();

vi.mock('#repositories/Professional', async () => ({
  blocksPractice: (await vi.importActual<{ blocksPractice: typeof blocksPracticeFn }>('../Professional/PracticeRestrictionRepository'))
    .blocksPractice,
  PracticeRestrictionRepository: { standing: (userId: string, db?: unknown) => standing(userId, db) },
  ProfessionalBadgeRepository: { badgeOf: (userId: string, now: Date, db?: unknown) => badgeOf(userId, now, db) }
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
  script = [row, [{ name: 'Ana Pérez' }], [{ total: links }], [{ total: invitations }], [], [INVITATION]];
}

const freeSeats = vi.fn(async () => 10);
const judge = vi.fn((_name: string, _badged: boolean): NameRefusal | null => null);

beforeEach(() => {
  events.length = 0;
  wheres.length = 0;
  script = [];
  freeSeats.mockClear();
  judge.mockClear();
  badgeOf.mockReset();
  badgeOf.mockResolvedValue(null);
  standing.mockReset();
  standing.mockResolvedValue({ closing: null, suspended: null });
});

/*
 * Invariant review of phase 6, P1-2: the name the invitation carries — the account's, which the page, the link and
 * the trail show — is judged in the invitation's transaction, with the badge read on it; a refusal writes nothing.
 */
describe('CareRepository.invite — the inviter’s name', () => {
  it('judges the account’s name with the badge read in the transaction, and answers it for the mail', async () => {
    scripted(practice(false), 0, 0);
    badgeOf.mockResolvedValue({ number: '28-1234' });

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toMatchObject({
      inviterName: 'Ana Pérez',
      kind: 'invited'
    });
    expect(judge).toHaveBeenCalledExactlyOnceWith('Ana Pérez', true);
    expect(badgeOf).toHaveBeenCalledWith('usr-pro', NOW, tx);
  });

  it('refuses a name that may not be shown, before any seat is counted, writing nothing', async () => {
    scripted(practice(false), 0, 0);
    judge.mockReturnValueOnce({ list: 'badge_only', word: 'dietista' });

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toEqual({
      kind: 'name_refused',
      refusal: { list: 'badge_only', word: 'dietista' }
    });
    expect(freeSeats).not.toHaveBeenCalled();
    expect(events).not.toContain('insert');
  });
});

describe('CareRepository.invite — the seats', () => {
  it('a free practice invites up to its ten, live invitations counted', async () => {
    scripted(practice(false), 6, 3);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toMatchObject({
      kind: 'invited'
    });
    expect(freeSeats).toHaveBeenCalledOnce();
  });

  /* Invariant review of phase 6, P1-1: a `paused` link takes its seat too — nobody stacks new clients on top of paused ones. */
  it('counts every open link, a paused one included, toward the seats', async () => {
    scripted(practice(false), 6, 3);

    await CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge);

    const counted = wheres
      .map(condition => new PgDialect({ casing: 'snake_case' }).sqlToQuery(condition))
      .find(query => query.sql.includes('"care_links"."status"'));

    expect(counted?.sql).toBe('("care_links"."professional_id" = $1 and "care_links"."status" in ($2, $3))');
    expect(counted?.params).toEqual(['usr-pro', 'active', 'paused']);
  });

  it('and the next is refused as `full`, naming the ten', async () => {
    scripted(practice(false), 7, 3);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toEqual({
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

    await CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge);

    expect(events.indexOf('select')).toBeLessThan(events.indexOf('free seats'));
  });

  it('a paid practice keeps its plan’s number, and never asks the free seats', async () => {
    scripted(practice(true, 30), 25, 5);

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toEqual({
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

    await expect(CareRepository.invite('usr-pro', 'nueva@example.com', 'h'.repeat(64), LATER, NOW, freeSeats, judge)).resolves.toEqual({
      kind: 'closed'
    });
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
