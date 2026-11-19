import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { careAccessLog, careInvitations, careLinks } from 'database/schema/care';
import { targetOverrides } from 'database/schema/profile';

import { CareRepository, rosterPlansSeen } from './CareRepository';
import { linkScope } from './CareScope';

import type { SQL } from 'drizzle-orm';

/** One statement the fake transaction was asked for: which table, what it sets, and its `WHERE` as Postgres would read it. */
type Statement = { readonly params: unknown[]; readonly set: Record<string, unknown>; readonly sql: string; readonly table: unknown };

// As the client reads column names (`database`): snake_case.
const dialect = new PgDialect({ casing: 'snake_case' });
const statements: Statement[] = [];
/** What the link's `UPDATE … RETURNING` answers: the ended link's two ids, or nothing when no open link matched. */
let ended: { clientId: string; professionalId: string } | undefined;

function update(table: unknown) {
  return {
    set: (set: Record<string, unknown>) => ({
      where: (where: SQL) => {
        const { params, sql } = dialect.sqlToQuery(where);

        statements.push({ params, set, sql, table });

        return Object.assign(Promise.resolve(), { returning: () => Promise.resolve(ended ? [ended] : []) });
      }
    })
  };
}

/** What the open-link `SELECT` answers inside the transaction, and every row an `INSERT` was given. */
let openLink: { link: Record<string, unknown>; professionalName: string } | undefined;
const inserted: { readonly table: unknown; readonly values: Record<string, unknown> }[] = [];

/** The `WHERE` the last `SELECT` inside the transaction was given. */
let selectWhere: SQL | undefined;

function select() {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    // Awaited as it is, or held `FOR UPDATE` first: the same rows either way.
    limit: () => {
      const rows = openLink ? [openLink] : [];

      return Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) });
    },
    where: (where: SQL) => {
      selectWhere = where;

      return chain;
    }
  };

  return chain;
}

function insert(table: unknown) {
  return {
    values: (values: Record<string, unknown>) => {
      inserted.push({ table, values });

      return Promise.resolve();
    }
  };
}

/** What a plain read of the trail answers, as stored. */
let trail: Record<string, unknown>[] = [];

/** The `WHERE` the last plain read of the trail was given. */
let trailWhere: SQL | undefined;

function selectTrail() {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    limit: () => Promise.resolve(trail),
    orderBy: () => chain,
    where: (where: SQL) => {
      trailWhere = where;

      return chain;
    }
  };

  return chain;
}

/** The last plain `DELETE`: which table, and its `WHERE`. */
let deleted: { readonly table: unknown; readonly where: SQL } | undefined;

function deleteRows(table: unknown) {
  return {
    where: (where: SQL) => {
      deleted = { table, where };

      return { returning: () => Promise.resolve([{ id: 'a' }, { id: 'b' }]) };
    }
  };
}

/** The badge, as `ProfessionalBadgeRepository.badgeOf` answers it — its own suite proves what it reads. */
const badgeOf = vi.fn<(userId: string, now: Date) => Promise<object | null>>();

/** The practitioner's badge lock, as `ProfessionalBadgeRepository.lock` takes it: whose. */
const badgeLock = vi.fn<(userId: string) => Promise<void>>();

vi.mock('#repositories/Professional', () => ({
  ProfessionalBadgeRepository: {
    badgeOf: (userId: string, now: Date) => badgeOf(userId, now),
    lock: (_tx: unknown, userId: string) => badgeLock(userId)
  }
}));

vi.mock('database', () => ({
  database: () => ({
    delete: deleteRows,
    select: selectTrail,
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ insert, select, update })
  })
}));

const NOW = new Date('2026-09-24T10:00:00.000Z');
const LINK = '0b8e7f4a-3c2d-4e1f-9a8b-7c6d5e4f3a2b';

/*
 * The owner's decision of 2026-09-24: when a link ends, the targets stay and
 * become the client's own. What is pinned here is the shape of the one
 * statement that does it; that Postgres honours it — the numbers equal before
 * and after, a second professional's mark untouched — is the end-to-end
 * suite's to prove.
 */
describe('CareRepository.end — the targets become the client’s own', () => {
  beforeEach(() => {
    statements.length = 0;
    ended = { clientId: 'usr-client', professionalId: 'usr-pro' };
  });

  it.each(['client', 'professional'] as const)('clears the mark in the same transaction when the %s ends it, and writes no number', async side => {
    await expect(CareRepository.end(side === 'client' ? 'usr-client' : 'usr-pro', side, LINK, NOW)).resolves.toBe(true);

    const [link, targets] = statements;

    expect(link?.table).toBe(careLinks);
    expect(link?.set).toMatchObject({ endedBy: side, status: 'ended' });
    expect(targets?.table).toBe(targetOverrides);
    // The mark and the time of the change — never kcal, a macro, or when the targets were set.
    expect(targets?.set).toEqual({ setByProfessionalId: null, updatedAt: NOW });
  });

  it('clears only the mark that names this link’s professional, on this link’s client — both from the ended row', async () => {
    ended = { clientId: 'usr-client-of-link', professionalId: 'usr-pro-of-link' };

    await CareRepository.end('usr-client-of-link', 'client', LINK, NOW);

    const targets = statements[1];

    expect(targets?.sql).toBe('("target_overrides"."user_id" = $1 and "target_overrides"."set_by_professional_id" = $2)');
    expect(targets?.params).toEqual(['usr-client-of-link', 'usr-pro-of-link']);
  });

  it('touches no targets when no open link of the caller’s matched', async () => {
    ended = undefined;

    await expect(CareRepository.end('usr-stranger', 'professional', LINK, NOW)).resolves.toBe(false);
    expect(statements.map(statement => statement.table)).toEqual([careLinks]);
  });
});

/*
 * P0-1 (`docs/legal/analysis.md`): the client stops or starts sharing the health
 * line without ending the link, and each change leaves its row in the same
 * transaction. That Postgres keeps the two together is the end-to-end suite's.
 */
describe('CareRepository.setSharesHealth', () => {
  const PRO_ID = 'usr-pro';
  const stored = (sharesHealth: boolean) => ({
    link: {
      id: LINK,
      clientId: 'usr-client',
      consentedAt: NOW,
      consentScope: 'full',
      consentVersion: '2.0.0',
      createdAt: NOW,
      endedAt: null,
      endedBy: null,
      narrowedAt: null,
      professionalId: PRO_ID,
      reviewBeforePublish: true,
      scopeConsentedAt: null,
      scopeConsentVersion: null,
      sharesHealth,
      status: 'active',
      updatedAt: NOW
    },
    // What the first read — the practitioner, without a lock on the link — answers from the same fake.
    professionalId: PRO_ID,
    professionalName: 'Dra. Pérez'
  });

  beforeEach(() => {
    statements.length = 0;
    inserted.length = 0;
    badgeOf.mockReset();
    badgeOf.mockResolvedValue({ number: '28-1234' });
    badgeLock.mockReset();
    badgeLock.mockResolvedValue();
  });

  it('turning it on takes the practitioner’s badge lock before the link’s row; turning it off takes none', async () => {
    ended = { clientId: 'usr-client', professionalId: PRO_ID };
    openLink = stored(false);

    await CareRepository.setSharesHealth('usr-client', true, NOW);
    expect(badgeLock).toHaveBeenCalledExactlyOnceWith(PRO_ID);

    badgeLock.mockClear();
    openLink = stored(true);

    await CareRepository.setSharesHealth('usr-client', false, NOW);
    expect(badgeLock).not.toHaveBeenCalled();
  });

  it.each([
    ['without the badge', 'full', false],
    ['on a link consented to the plan-only list', 'plan', true]
  ] as const)('refuses to turn it on %s — null, as no link is, and nothing written (PRD 025 criterion 11)', async (_case, consentScope, badged) => {
    ended = { clientId: 'usr-client', professionalId: PRO_ID };
    openLink = { ...stored(false), link: { ...stored(false).link, consentScope } };
    badgeOf.mockResolvedValue(badged ? { number: '28-1234' } : null);

    await expect(CareRepository.setSharesHealth('usr-client', true, NOW)).resolves.toBeNull();
    expect(statements).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it('turns it off whatever the scope — a consent is as easy to take back as to give', async () => {
    ended = { clientId: 'usr-client', professionalId: PRO_ID };
    openLink = { ...stored(true), link: { ...stored(true).link, consentScope: 'plan' } };
    badgeOf.mockResolvedValue(null);

    await expect(CareRepository.setSharesHealth('usr-client', false, NOW)).resolves.toMatchObject({ link: { sharesHealth: false } });
    expect(badgeOf).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(1);
  });

  it.each([
    [false, 'withdrawn'],
    [true, 'granted']
  ] as const)('sets it to %s on the session’s open link and writes a %s health row under that link', async (sharesHealth, action) => {
    ended = { clientId: 'usr-client', professionalId: PRO_ID };
    openLink = stored(sharesHealth);

    await expect(CareRepository.setSharesHealth('usr-client', sharesHealth, NOW)).resolves.toMatchObject({
      link: { id: LINK, sharesHealth },
      professionalName: 'Dra. Pérez'
    });

    const [change] = statements;

    expect(change?.table).toBe(careLinks);
    expect(change?.set).toEqual({ sharesHealth, updatedAt: NOW });
    // The session's id is the owner, only an open link — on is also only the practitioner whose badge lock
    // is held — and only when it would change.
    const owner = sharesHealth
      ? '("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3) and "care_links"."professional_id" = $4)'
      : '("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3))';
    const ownerParams = sharesHealth ? ['usr-client', 'active', 'paused', PRO_ID] : ['usr-client', 'active', 'paused'];

    expect(change?.sql).toBe(`(${owner} and "care_links"."shares_health" <> $${ownerParams.length + 1})`);
    expect(change?.params).toEqual([...ownerParams, sharesHealth]);
    // The link it answers and logs is read the same way: the session's client, open, and never by a link id.
    const read = dialect.sqlToQuery(selectWhere as SQL);

    expect(read.sql).toBe(owner);
    expect(read.params).toEqual(ownerParams);
    expect(`${change?.sql} ${read.sql}`).not.toContain('"care_links"."id"');
    expect(inserted).toEqual([
      {
        table: careAccessLog,
        values: { action, kind: 'health', linkId: LINK, professionalId: PRO_ID, professionalName: 'Dra. Pérez', userId: 'usr-client' }
      }
    ]);
  });

  it('writes no row when nothing changed', async () => {
    ended = undefined;
    openLink = stored(false);

    await expect(CareRepository.setSharesHealth('usr-client', false, NOW)).resolves.toMatchObject({ link: { sharesHealth: false } });
    expect(inserted).toEqual([]);
  });

  it('answers null, and writes no row, for a client with no open link', async () => {
    ended = undefined;
    openLink = undefined;

    await expect(CareRepository.setSharesHealth('usr-stranger', true, NOW)).resolves.toBeNull();
    expect(inserted).toEqual([]);
  });
});

describe('CareRepository.accessLog — a value a later release added', () => {
  it('asks only for rows it can name, in the WHERE, so the limit counts only those and paging reaches every older row', async () => {
    trail = [];

    await CareRepository.accessLog('usr-client', 101);

    const { params, sql } = dialect.sqlToQuery(trailWhere as SQL);

    expect(sql).toContain('"care_access_log"."action" in ($2, $3, $4, $5)');
    expect(sql).toContain('"care_access_log"."kind" in ($6, $7, $8, $9, $10, $11, $12)');
    expect(params.slice(0, 5)).toEqual(['usr-client', 'read', 'write', 'granted', 'withdrawn']);
  });
});

describe('CareRepository.forgetExpired', () => {
  it('deletes every invitation at or past its date, whoever sent it, and counts them', async () => {
    await expect(CareRepository.forgetExpired(NOW)).resolves.toBe(2);

    const { params, sql } = dialect.sqlToQuery(deleted?.where as SQL);

    expect(deleted?.table).toBe(careInvitations);
    expect(sql).toBe('"care_invitations"."expires_at" <= $1');
    expect(params).toEqual([NOW.toISOString()]);
  });
});

/*
 * Project 025 phase 4 (`0111` § 4): the link answers its scope, from the
 * badge of the practitioner on it — read for the session's id, on every call —
 * and the link's own consent. What is pinned here is the scope it hands
 * `withClient`; the `WHERE` is the end-to-end suite's.
 */
describe('CareRepository.activeLink — the scope the link opens now', () => {
  const stored = (consentScope: 'full' | 'plan') => ({
    clientName: 'Lucía',
    link: {
      id: LINK,
      clientId: 'usr-client',
      consentedAt: NOW,
      consentScope,
      consentVersion: '2.0.0',
      createdAt: NOW,
      endedAt: null,
      endedBy: null,
      narrowedAt: null,
      professionalId: 'usr-pro',
      reviewBeforePublish: false,
      scopeConsentedAt: null,
      scopeConsentVersion: null,
      sharesHealth: true,
      status: 'active',
      updatedAt: NOW
    },
    professionalName: 'Dra. Pérez'
  });

  beforeEach(() => {
    badgeOf.mockReset();
  });

  it.each([
    ['full', true, 'full'],
    ['full', false, 'plan'],
    ['plan', true, 'plan'],
    ['plan', false, 'plan']
  ] as const)('a link consented to `%s`, the badge standing: %s — opens `%s`', async (consentScope, badged, scope) => {
    trail = [stored(consentScope)];
    badgeOf.mockResolvedValue(badged ? { number: '28-1234' } : null);

    await expect(CareRepository.activeLink('usr-pro', LINK, NOW)).resolves.toMatchObject({ clientName: 'Lucía', scope });
    expect(badgeOf).toHaveBeenCalledExactlyOnceWith('usr-pro', NOW);
  });

  it('reads no badge for a link that is not there — the same null as before', async () => {
    trail = [];

    await expect(CareRepository.activeLink('usr-pro', LINK, NOW)).resolves.toBeNull();
    expect(badgeOf).not.toHaveBeenCalled();
  });

  it('fails like any read when the badge cannot be read — never a scope guessed', async () => {
    trail = [stored('full')];
    badgeOf.mockRejectedValue(new Error('down'));

    await expect(CareRepository.activeLink('usr-pro', LINK, NOW)).rejects.toThrow();
  });
});

describe('rosterPlansSeen — the list’s stage reads only what the page would show (`0111` § 5)', () => {
  it('without the badge: only plans made through the link, whatever the consent', () => {
    expect(dialect.sqlToQuery(rosterPlansSeen(false) as SQL).sql).toBe('"meal_plans"."care_link_id" = "care_links"."id"');
  });

  it('with the badge: every plan on a `full` link, only the link’s own on a `plan` one', () => {
    const { params, sql } = dialect.sqlToQuery(rosterPlansSeen(true) as SQL);

    expect(sql).toBe('("care_links"."consent_scope" = $1 or "meal_plans"."care_link_id" = "care_links"."id")');
    expect(params).toEqual(['full']);
  });
});

describe('linkScope — the one rule (`0111` § 4)', () => {
  it('is `full` only with the badge and the badged list both', () => {
    expect(linkScope('full', true)).toBe('full');
    expect(linkScope('full', false)).toBe('plan');
    expect(linkScope('plan', true)).toBe('plan');
    expect(linkScope('plan', false)).toBe('plan');
  });
});
