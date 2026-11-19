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

const badgeOf = vi.fn<(userId: string, now: Date, db?: unknown) => Promise<object | null>>();
const badgesOf = vi.fn<(userIds: readonly string[], now: Date, db?: unknown) => Promise<ReadonlyMap<string, object>>>();
const hasRecord = vi.fn<(userId: string, db: unknown) => Promise<boolean>>();

vi.mock('#repositories/Professional', () => ({
  ProfessionalBadgeRepository: {
    badgeOf: (userId: string, now: Date, db?: unknown) => badgeOf(userId, now, db),
    badgesOf: (userIds: readonly string[], now: Date, db?: unknown) => badgesOf(userIds, now, db)
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
    scopeConsentedAt: null,
    scopeConsentVersion: null,
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
    consentScope: 'full',
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
    // On the acceptance's own connection: no second one is taken while its locks are held.
    expect(badgeOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW, db);
    expect(calls.filter(call => call.op !== 'select')).toEqual([]);
  });

  it.each([
    ['`full`', 'full', true, 'full', true],
    ['`plan`', 'plan', true, 'plan', false],
    ['`full`', 'full', false, 'plan', false],
    ['`plan`', 'plan', false, 'plan', false]
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

  it('ends the open link to an un-badged practitioner as `declared`, and the targets become the client’s', async () => {
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
    // `declared`: the client's screen can say why; a practitioner reads it as `client` (`endedByForPractitioner`, legal F4).
    expect(ending?.set).toEqual({ endedAt: NOW, endedBy: 'declared', status: 'ended', updatedAt: NOW });
    expect(badgeOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW, db);
    expect(where(ending).params).toEqual([LINK, 'usr-client', 'active', 'paused']);
    expect(targets?.table).toBe(targetOverrides);
    expect(targets?.set).toEqual({ setByProfessionalId: null, updatedAt: NOW });
  });
});

describe('CareRepository.sweepBadgeLoss — a badge gone, in the daily sweep', () => {
  it('ends the links of clients with something on record, narrows the others, and only for a practitioner with no badge now', async () => {
    script = [
      [
        { id: 'link-a', professionalId: 'usr-unbadged', professionalName: 'Sin' },
        { id: 'link-b', professionalId: 'usr-badged', professionalName: 'Con' },
        { id: 'link-c', professionalId: 'usr-unbadged', professionalName: 'Sin' }
      ],
      [{ id: 'link-a', clientId: 'usr-a', professionalId: 'usr-unbadged' }],
      [],
      [{ id: 'link-c' }]
    ];
    badgesOf.mockResolvedValue(new Map([['usr-badged', BADGE]]));

    await expect(CareRepository.sweepBadgeLoss(NOW)).resolves.toEqual({
      ended: [{ clientId: 'usr-a', linkId: 'link-a', professionalName: 'Sin' }],
      narrowed: 1
    });

    // One badge read for every practitioner at once, then again inside the write, on its own connection.
    expect(badgesOf).toHaveBeenNthCalledWith(1, ['usr-unbadged', 'usr-badged'], NOW, undefined);
    expect(badgesOf).toHaveBeenNthCalledWith(2, ['usr-unbadged'], NOW, db);

    const read = where(calls[0]);

    expect(read.sql).toContain('"care_links"."status" in ($1, $2)');
    // Either more than the plan-only list, or something on record — never a supplement.
    expect(read.sql).toContain('"care_links"."consent_scope" =');
    expect(read.sql).toContain('"care_links"."shares_health" =');
    expect(read.sql).toContain('"health_conditions"');
    expect(read.sql).toContain('"medications"');
    expect(read.sql).not.toContain('supplements');

    const [ending, targets, narrowing] = calls.filter(call => call.op === 'update');

    expect(ending?.set).toEqual({ endedAt: NOW, endedBy: 'badge_lost', status: 'ended', updatedAt: NOW });

    const ended = where(ending);

    // Only the un-badged practitioner's links, and only while the record is still there and the link still open.
    expect(ended.params.slice(0, 2)).toEqual(['link-a', 'link-c']);
    expect(ended.sql).toContain('"medications"');
    expect(ended.sql).toContain('"care_links"."status" in');
    expect(targets?.table).toBe(targetOverrides);

    // The rest narrow for good: the plan-only list, the health line off — the acceptance and re-consent columns stay.
    expect(narrowing?.table).toBe(careLinks);
    expect(narrowing?.set).toEqual({ consentScope: 'plan', sharesHealth: false, updatedAt: NOW });

    const narrowed = where(narrowing);

    expect(narrowed.params.slice(0, 2)).toEqual(['link-a', 'link-c']);
    expect(narrowed.sql).toContain('"care_links"."status" in');
    expect(narrowed.sql).toContain('"care_links"."consent_scope" =');
  });

  it('leaves every link alone when the owner recorded a pass between the read and the write', async () => {
    script = [[{ id: 'link-a', professionalId: 'usr-back', professionalName: 'Vuelve' }]];
    badgesOf.mockResolvedValueOnce(new Map()).mockResolvedValueOnce(new Map([['usr-back', BADGE]]));

    await expect(CareRepository.sweepBadgeLoss(NOW)).resolves.toEqual({ ended: [], narrowed: 0 });
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });

  it('writes nothing, and reads no badge, when no open link holds more than the plan or has a client with something on record', async () => {
    script = [[]];

    await expect(CareRepository.sweepBadgeLoss(NOW)).resolves.toEqual({ ended: [], narrowed: 0 });
    expect(badgesOf).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it('writes nothing when every practitioner involved still holds the badge', async () => {
    script = [[{ id: 'link-b', professionalId: 'usr-badged', professionalName: 'Con' }]];
    badgesOf.mockResolvedValue(new Map([['usr-badged', BADGE]]));

    await expect(CareRepository.sweepBadgeLoss(NOW)).resolves.toEqual({ ended: [], narrowed: 0 });
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });
});

describe('CareRepository.narrowLinksOf — a badge the owner took back', () => {
  it('narrows every open link of that practitioner that holds more than the plan, inside the owner’s transaction', async () => {
    script = [[{ id: 'link-a' }, { id: 'link-b' }]];

    await expect(CareRepository.narrowLinksOf('usr-pro', NOW, db as never)).resolves.toBe(2);

    const [narrowing] = calls;

    expect(narrowing).toMatchObject({ op: 'update', table: careLinks });
    expect(narrowing?.set).toEqual({ consentScope: 'plan', sharesHealth: false, updatedAt: NOW });

    const { params, sql } = where(narrowing);

    expect(params.slice(0, 3)).toEqual(['usr-pro', 'active', 'paused']);
    expect(sql).toBe(
      '("care_links"."professional_id" = $1 and "care_links"."status" in ($2, $3) and ("care_links"."consent_scope" = $4 or "care_links"."shares_health" = $5))'
    );
    // Nothing ends here: the illness rule's ending is the sweep's alone (`0111` § 8).
    expect(JSON.stringify(narrowing?.set)).not.toContain('ended');
  });
});

describe('CareRepository.lastEndedByRule — the client’s own notice', () => {
  it.each(['badge_lost', 'declared'] as const)('answers the latest link of the session’s, when the rule ended it (%s), and which', async reason => {
    script = [[{ endedAt: NOW, endedBy: reason, professionalName: 'Ana' }]];

    await expect(CareRepository.lastEndedByRule('usr-client')).resolves.toEqual({ endedAt: NOW, professionalName: 'Ana', reason });
    expect(where(calls[0])).toMatchObject({ params: ['usr-client'], sql: '"care_links"."client_id" = $1' });
  });

  it.each([
    ['ended by the client', { endedAt: NOW, endedBy: 'client' }],
    ['ended by the practitioner', { endedAt: NOW, endedBy: 'professional' }],
    ['still open', { endedAt: null, endedBy: null }]
  ])('is null when the latest link is %s', async (_case, row) => {
    script = [[{ ...row, professionalName: 'Ana' }]];

    await expect(CareRepository.lastEndedByRule('usr-client')).resolves.toBeNull();
  });
});

describe('CareRepository.reconsent — widening needs the badge now', () => {
  it('widens the session’s `plan` link to `full`, records when and under which version, and moves nothing else', async () => {
    script = [[{ link: storedLink({ consentScope: 'plan', consentVersion: '1.9.0' }), professionalName: 'Ana' }], []];
    badgeOf.mockResolvedValue(BADGE);

    await expect(CareRepository.reconsent('usr-client', CARE_CONSENT_VERSION, NOW)).resolves.toMatchObject({
      link: {
        consentedAt: NOW,
        consentScope: 'full',
        consentVersion: '1.9.0',
        scopeConsentedAt: NOW,
        scopeConsentVersion: CARE_CONSENT_VERSION,
        sharesHealth: false
      }
    });

    const [read, write] = calls;

    expect(read?.lock).toBe('update');
    expect(where(read)).toMatchObject({
      params: ['usr-client', 'active', 'paused', 'plan'],
      sql: '(("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3)) and "care_links"."consent_scope" = $4)'
    });
    // The acceptance's `consentedAt` and `consentVersion` stay (what was accepted, and when); the widening has its own two.
    expect(write?.set).toEqual({ consentScope: 'full', scopeConsentedAt: NOW, scopeConsentVersion: CARE_CONSENT_VERSION, updatedAt: NOW });
    expect(badgeOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW, db);
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
