import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { careInvitations, careLinks } from 'database/schema/care';
import { targetOverrides } from 'database/schema/profile';
import { user } from 'database/schema/auth';

import { CARE_CONSENT_VERSION } from 'core/entities/Care';

import { CareRepository } from './CareRepository';

import type { AcceptInvitation } from 'core/entities/Care';
import type { SQL } from 'drizzle-orm';
import type * as HealthRepositoryModule from '../Health/HealthRepository';

/*
 * Project 025 phase 5 (`0111` §§ 4 and 8, PRD 025 criteria 11, 12 and 22): what
 * `CareRepository` asks for, in order, when it records a consent's scope and when
 * it enforces the illness rule. A fake that answers each awaited statement from a
 * script, in order, and keeps what each was given. That Postgres honours the
 * statements — the lock queues, the `UPDATE`'s re-check — is the end-to-end
 * suite's to prove.
 */

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });

type Call = {
  lock?: string;
  readonly op: 'delete' | 'insert' | 'select' | 'update';
  set?: Record<string, unknown>;
  table?: unknown;
  values?: Record<string, unknown>;
  where?: SQL;
};

interface Chain extends PromiseLike<unknown> {
  for: (lock: string) => Chain;
  from: (table: unknown) => Chain;
  innerJoin: () => Chain;
  limit: () => Chain;
  onConflictDoNothing: () => Chain;
  orderBy: () => Chain;
  returning: () => Chain;
  set: (set: Record<string, unknown>) => Chain;
  values: (values: Record<string, unknown>) => Chain;
  where: (where: SQL) => Chain;
}

const calls: Call[] = [];
/** What each awaited statement answers, in the order they are awaited. */
let script: unknown[][] = [];

function chain(call: Call): Chain {
  calls.push(call);

  const link: Chain = {
    for: lock => {
      call.lock = lock;

      return link;
    },
    from: table => {
      call.table ??= table;

      return link;
    },
    innerJoin: () => link,
    limit: () => link,
    onConflictDoNothing: () => link,
    orderBy: () => link,
    returning: () => link,
    set: set => {
      call.set = set;

      return link;
    },
    // A statement is a promise once awaited: the next scripted answer.
    then: (resolve, reject) => Promise.resolve(script.shift() ?? []).then(resolve, reject),
    values: values => {
      call.values = values;

      return link;
    },
    where: where => {
      call.where = where;

      return link;
    }
  };

  return link;
}

const db = {
  delete: (table: unknown) => chain({ op: 'delete', table }),
  insert: (table: unknown) => chain({ op: 'insert', table }),
  select: () => chain({ op: 'select' }),
  transaction: <T>(fn: (tx: unknown) => Promise<T>) => fn(db),
  update: (table: unknown) => chain({ op: 'update', table })
};

vi.mock('database', () => ({ database: () => db }));

const badgeOf = vi.fn<(userId: string, now: Date) => Promise<object | null>>();
const badgesOf = vi.fn<(userIds: readonly string[], now: Date) => Promise<ReadonlyMap<string, object>>>();
const hasRecord = vi.fn<(userId: string, db: unknown) => Promise<boolean>>();

vi.mock('#repositories/Professional', () => ({
  ProfessionalBadgeRepository: {
    badgeOf: (userId: string, now: Date) => badgeOf(userId, now),
    badgesOf: (userIds: readonly string[], now: Date) => badgesOf(userIds, now)
  }
}));
vi.mock('#repositories/Health', async () => ({
  HealthRepository: { hasRecord: (userId: string, tx: unknown) => hasRecord(userId, tx) },
  // The real definition of "on record": it is what the sweep's `WHERE` is checked against.
  onRecord: (await vi.importActual<typeof HealthRepositoryModule>('../Health/HealthRepository')).onRecord
}));

const NOW = new Date('2026-11-19T10:00:00.000Z');
const LINK = '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b';
const BADGE = { number: '28-1234' };

function storedLink(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LINK,
    clientId: 'usr-client',
    consentedAt: NOW,
    consentScope: 'full',
    consentVersion: CARE_CONSENT_VERSION,
    createdAt: NOW,
    endedAt: null,
    endedBy: null,
    professionalId: 'usr-pro',
    reviewBeforePublish: true,
    sharesHealth: false,
    status: 'active',
    updatedAt: NOW,
    ...overrides
  };
}

function where(call: Call | undefined): { readonly params: unknown[]; readonly sql: string } {
  return dialect.sqlToQuery(call?.where as SQL);
}

beforeEach(() => {
  calls.length = 0;
  script = [];
  badgeOf.mockReset();
  badgesOf.mockReset();
  hasRecord.mockReset();
});

describe('CareRepository.accept — the scope recorded, and the illness rule', () => {
  /** The invitation's three reads, the client's lock, then whatever the case scripts. */
  function invited(...rest: unknown[][]): void {
    script = [
      [{ professionalId: 'usr-pro' }],
      [{ open: true }],
      [{ id: 'inv-1', professionalId: 'usr-pro', professionalName: 'Ana' }],
      [{ id: 'usr-client' }],
      ...rest
    ];
  }

  const answer = (overrides: Partial<AcceptInvitation> = {}): AcceptInvitation => ({
    consentVersion: CARE_CONSENT_VERSION,
    sharesHealth: true,
    ...overrides
  });

  it('refuses an un-badged practitioner while a condition or a medication is on record: nothing written, the invitation kept', async () => {
    invited();
    badgeOf.mockResolvedValue(null);
    hasRecord.mockResolvedValue(true);

    await expect(CareRepository.accept('usr-client', 'c@example.com', 'h'.repeat(64), answer(), NOW)).resolves.toEqual({ kind: 'refused' });

    // The client's row is held before the record is read, in the acceptance's own transaction.
    const lock = calls[3];

    expect(lock).toMatchObject({ lock: 'no key update', op: 'select', table: user });
    expect(where(lock)).toMatchObject({ params: ['usr-client'], sql: '"user"."id" = $1' });
    expect(hasRecord).toHaveBeenCalledExactlyOnceWith('usr-client', db);
    expect(badgeOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW);
    expect(calls.filter(call => call.op !== 'select')).toEqual([]);
  });

  it.each([
    ['absent', undefined, true, 'full', true],
    ['`full`', 'full', true, 'full', true],
    ['`plan`', 'plan', true, 'plan', false],
    ['absent', undefined, false, 'plan', false],
    ['`full`', 'full', false, 'plan', false]
  ] as const)('the list read %s, badged: %s — records `%s`, health line %s', async (_read, consentScope, badged, recorded, sharesHealth) => {
    invited([storedLink({ consentScope: recorded, sharesHealth })], []);
    badgeOf.mockResolvedValue(badged ? BADGE : null);
    hasRecord.mockResolvedValue(false);

    await expect(CareRepository.accept('usr-client', 'c@example.com', 'h'.repeat(64), answer({ consentScope }), NOW)).resolves.toMatchObject({
      kind: 'created'
    });

    const insert = calls.find(call => call.op === 'insert');

    expect(insert?.table).toBe(careLinks);
    // Named on every insert (step 0), and narrowed, never widened, by what the client read.
    expect(insert?.values).toMatchObject({ consentScope: recorded, sharesHealth });
    expect(calls.find(call => call.op === 'delete')?.table).toBe(careInvitations);
    // A badged practitioner is never refused, so the record is not even read.
    expect(hasRecord).toHaveBeenCalledTimes(badged ? 0 : 1);
  });
});

describe('CareRepository.endOnDeclaration — the rule inside the declaration’s transaction', () => {
  it('holds the client first, and ends nothing while nothing is on record', async () => {
    script = [[{ id: 'usr-client' }]];
    hasRecord.mockResolvedValue(false);

    await expect(CareRepository.endOnDeclaration('usr-client', NOW, db as never)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ lock: 'no key update', table: user });
    expect(badgeOf).not.toHaveBeenCalled();
  });

  it('leaves a link to a badged practitioner alone', async () => {
    script = [[{ id: 'usr-client' }], [{ id: LINK, professionalId: 'usr-pro', professionalName: 'Ana' }]];
    hasRecord.mockResolvedValue(true);
    badgeOf.mockResolvedValue(BADGE);

    await expect(CareRepository.endOnDeclaration('usr-client', NOW, db as never)).resolves.toBeNull();
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });

  it('ends the open link to an un-badged practitioner as the client’s own act, and the targets become theirs', async () => {
    script = [
      [{ id: 'usr-client' }],
      [{ id: LINK, professionalId: 'usr-pro', professionalName: 'Ana' }],
      [{ id: LINK, clientId: 'usr-client', professionalId: 'usr-pro' }],
      []
    ];
    hasRecord.mockResolvedValue(true);
    badgeOf.mockResolvedValue(null);

    await expect(CareRepository.endOnDeclaration('usr-client', NOW, db as never)).resolves.toEqual({
      clientId: 'usr-client',
      linkId: LINK,
      professionalName: 'Ana'
    });

    // The open link is the session's, `active` or `paused`.
    expect(where(calls[1])).toMatchObject({
      params: ['usr-client', 'active', 'paused'],
      sql: '("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3))'
    });

    const [ending, targets] = calls.filter(call => call.op === 'update');

    expect(ending?.table).toBe(careLinks);
    // `client`: to the practitioner it is exactly a link the client ended (legal F4).
    expect(ending?.set).toEqual({ endedAt: NOW, endedBy: 'client', status: 'ended', updatedAt: NOW });
    expect(where(ending).params).toEqual([LINK, 'usr-client', 'active', 'paused']);
    expect(targets?.table).toBe(targetOverrides);
    expect(targets?.set).toEqual({ setByProfessionalId: null, updatedAt: NOW });
  });
});

describe('CareRepository.endUnderBadgeLoss — the daily sweep', () => {
  it('reads only open links of clients with something on record, and ends only those whose practitioner has no badge now', async () => {
    script = [
      [
        { id: 'link-a', professionalId: 'usr-unbadged', professionalName: 'Sin' },
        { id: 'link-b', professionalId: 'usr-badged', professionalName: 'Con' },
        { id: 'link-c', professionalId: 'usr-unbadged', professionalName: 'Sin' }
      ],
      [
        { id: 'link-a', clientId: 'usr-a', professionalId: 'usr-unbadged' },
        { id: 'link-c', clientId: 'usr-c', professionalId: 'usr-unbadged' }
      ],
      [],
      []
    ];
    badgesOf.mockResolvedValue(new Map([['usr-badged', BADGE]]));

    await expect(CareRepository.endUnderBadgeLoss(NOW)).resolves.toEqual([
      { clientId: 'usr-a', linkId: 'link-a', professionalName: 'Sin' },
      { clientId: 'usr-c', linkId: 'link-c', professionalName: 'Sin' }
    ]);

    // One badge read for every practitioner at once — the one definition, by date, never a cached flag.
    expect(badgesOf).toHaveBeenCalledExactlyOnceWith(['usr-unbadged', 'usr-badged'], NOW);

    const read = where(calls[0]);

    expect(read.sql).toContain('"care_links"."status" in ($1, $2)');
    // "On record": any condition row or any medication — never a supplement.
    expect(read.sql).toContain('"health_conditions"');
    expect(read.sql).toContain('"medications"');
    expect(read.sql).not.toContain('supplements');

    const [ending, ...targets] = calls.filter(call => call.op === 'update');

    expect(ending?.set).toEqual({ endedAt: NOW, endedBy: 'badge_lost', status: 'ended', updatedAt: NOW });

    const written = where(ending);

    // Only the un-badged practitioner's links, and only while the record is still there and the link still open.
    expect(written.params.slice(0, 2)).toEqual(['link-a', 'link-c']);
    expect(written.sql).toContain('"medications"');
    expect(written.sql).toContain('"care_links"."status" in');
    expect(targets.map(call => call.table)).toEqual([targetOverrides, targetOverrides]);
  });

  it('writes nothing, and reads no badge, when no open link has a client with something on record', async () => {
    script = [[]];

    await expect(CareRepository.endUnderBadgeLoss(NOW)).resolves.toEqual([]);
    expect(badgesOf).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('writes nothing when every practitioner involved still holds the badge', async () => {
    script = [[{ id: 'link-b', professionalId: 'usr-badged', professionalName: 'Con' }]];
    badgesOf.mockResolvedValue(new Map([['usr-badged', BADGE]]));

    await expect(CareRepository.endUnderBadgeLoss(NOW)).resolves.toEqual([]);
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });
});

describe('CareRepository.lastEndedByRule — the client’s own notice', () => {
  it('answers the latest link of the session’s, only when the sweep ended it', async () => {
    script = [[{ endedAt: NOW, endedBy: 'badge_lost', professionalName: 'Ana' }]];

    await expect(CareRepository.lastEndedByRule('usr-client')).resolves.toEqual({ endedAt: NOW, professionalName: 'Ana' });
    expect(where(calls[0])).toMatchObject({ params: ['usr-client'], sql: '"care_links"."client_id" = $1' });
  });

  it.each([
    ['ended by the client', { endedAt: NOW, endedBy: 'client' }],
    ['still open', { endedAt: null, endedBy: null }]
  ])('is null when the latest link is %s', async (_case, row) => {
    script = [[{ ...row, professionalName: 'Ana' }]];

    await expect(CareRepository.lastEndedByRule('usr-client')).resolves.toBeNull();
  });
});

describe('CareRepository.reconsent — widening needs the badge now', () => {
  it('widens the session’s `plan` link to `full`, and moves nothing else', async () => {
    script = [[{ link: storedLink({ consentScope: 'plan', consentVersion: '1.9.0' }), professionalName: 'Ana' }], []];
    badgeOf.mockResolvedValue(BADGE);

    await expect(CareRepository.reconsent('usr-client', CARE_CONSENT_VERSION, NOW)).resolves.toMatchObject({
      link: { consentedAt: NOW, consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, sharesHealth: false }
    });

    const [read, write] = calls;

    expect(read?.lock).toBe('update');
    expect(where(read)).toMatchObject({
      params: ['usr-client', 'active', 'paused', 'plan'],
      sql: '(("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3)) and "care_links"."consent_scope" = $4)'
    });
    // Not `consentedAt` (the link's "since"), not the health line.
    expect(write?.set).toEqual({ consentScope: 'full', consentVersion: CARE_CONSENT_VERSION, updatedAt: NOW });
  });

  it('is null, and writes nothing, without the badge now', async () => {
    script = [[{ link: storedLink({ consentScope: 'plan' }), professionalName: 'Ana' }]];
    badgeOf.mockResolvedValue(null);

    await expect(CareRepository.reconsent('usr-client', CARE_CONSENT_VERSION, NOW)).resolves.toBeNull();
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });

  it('is null, and reads no badge, with no `plan` link to widen', async () => {
    script = [[]];

    await expect(CareRepository.reconsent('usr-client', CARE_CONSENT_VERSION, NOW)).resolves.toBeNull();
    expect(badgeOf).not.toHaveBeenCalled();
  });
});
