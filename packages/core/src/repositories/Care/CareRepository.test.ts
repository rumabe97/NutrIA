import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { careLinks } from 'database/schema/care';
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

vi.mock('database', () => ({ database: () => ({ transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({ update }) }) }));

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
