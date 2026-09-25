import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { careAccessLog, careLinks } from 'database/schema/care';
import { targetOverrides } from 'database/schema/profile';

import { CareRepository } from './CareRepository';

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

function select() {
  const chain = { from: () => chain, innerJoin: () => chain, limit: () => Promise.resolve(openLink ? [openLink] : []), where: () => chain };

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

function selectTrail() {
  const chain = { from: () => chain, limit: () => Promise.resolve(trail), orderBy: () => chain, where: () => chain };

  return chain;
}

vi.mock('database', () => ({
  database: () => ({ select: selectTrail, transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ insert, select, update }) })
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
 * P0-1 (`docs/legal/analisis.md`): the client stops or starts sharing the health
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
      consentVersion: '2.0.0',
      createdAt: NOW,
      endedAt: null,
      endedBy: null,
      professionalId: PRO_ID,
      reviewBeforePublish: true,
      sharesHealth,
      status: 'active',
      updatedAt: NOW
    },
    professionalName: 'Dra. Pérez'
  });

  beforeEach(() => {
    statements.length = 0;
    inserted.length = 0;
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
    // The session's id is the owner, only an open link, and only when it would change.
    expect(change?.sql).toBe('(("care_links"."client_id" = $1 and "care_links"."status" in ($2, $3)) and "care_links"."shares_health" <> $4)');
    expect(change?.params).toEqual(['usr-client', 'active', 'paused', sharesHealth]);
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
  const row = (action: string, kind: string) => ({
    id: LINK,
    action,
    createdAt: NOW,
    kind,
    linkId: null,
    professionalId: null,
    professionalName: 'Dra. Pérez',
    updatedAt: NOW,
    userId: 'usr-client'
  });

  it('leaves out a row it cannot name, rather than failing the client’s whole trail', async () => {
    trail = [row('read', 'overview'), row('reviewed', 'overview'), row('read', 'allergies'), row('withdrawn', 'health')];

    const rows = await CareRepository.accessLog('usr-client', 101);

    expect(rows.map(entry => [entry.action, entry.kind])).toEqual([
      ['read', 'overview'],
      ['withdrawn', 'health']
    ]);
  });
});
