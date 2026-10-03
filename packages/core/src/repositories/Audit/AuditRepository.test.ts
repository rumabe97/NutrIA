import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { AuditRepository } from './AuditRepository';

import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect({ casing: 'snake_case' });

function render(fragment: SQL | undefined): { params: unknown[]; sql: string } {
  if (!fragment) {
    return { params: [], sql: '' };
  }

  const { params, sql } = dialect.sqlToQuery(fragment);

  return { params, sql };
}

/** What each call was given, and what `page`'s two reads answer. */
let rows: Record<string, unknown>[] = [];
let counted: Record<string, unknown>[] = [{ n: 3 }];
let inserted: Record<string, unknown> | undefined;
let deleted: { table?: unknown; where?: SQL } = {};
const seen: { countWhere?: SQL; limit?: number; offset?: number; pageWhere?: SQL } = {};

vi.mock('database', () => ({
  database: () => ({
    delete: (table: unknown) => ({
      where: (where: SQL) => {
        deleted = { table, where };

        return { returning: () => Promise.resolve([{ id: 'a-1' }, { id: 'a-2' }]) };
      }
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        inserted = values;

        return Promise.resolve(undefined);
      }
    }),
    select: (fields: Record<string, unknown>) => {
      const counting = 'n' in fields;
      const chain = {
        from: () => chain,
        leftJoin: () => chain,
        limit: (limit: number) => {
          seen.limit = limit;

          return chain;
        },
        offset: (offset: number) => {
          seen.offset = offset;

          return Promise.resolve(rows);
        },
        orderBy: () => chain,
        where: (where: SQL | undefined) => {
          if (counting) {
            seen.countWhere = where;

            return Promise.resolve(counted);
          }

          seen.pageWhere = where;

          return chain;
        }
      };

      return chain;
    }
  })
}));

beforeEach(() => {
  rows = [];
  counted = [{ n: 3 }];
  inserted = undefined;
  deleted = {};

  for (const key of Object.keys(seen)) {
    delete seen[key as keyof typeof seen];
  }
});

describe('AuditRepository.record', () => {
  it('writes the action, the actor, the entity and the metadata — never a body, never an IP', async () => {
    await AuditRepository.record({
      action: 'setting.changed',
      actorId: 'usr-owner',
      entity: 'setting',
      entityId: 'premium',
      metadata: { enabled: true, key: 'premium' }
    });

    expect(inserted).toEqual({
      action: 'setting.changed',
      actorId: 'usr-owner',
      entity: 'setting',
      entityId: 'premium',
      metadata: { enabled: true, key: 'premium' },
      subjectUserId: null
    });
  });

  it('writes into the caller’s own transaction when given one', async () => {
    const tx = { insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve(undefined)) })) };

    await AuditRepository.record({ action: 'push.test_sent', actorId: 'usr-owner', entity: 'push', metadata: {} }, tx as never);

    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('defaults entityId and subjectUserId to null rather than leaving them undefined', async () => {
    await AuditRepository.record({ action: 'professional.granted', actorId: 'usr-owner', entity: 'professional', metadata: {} });

    expect(inserted).toMatchObject({ entityId: null, subjectUserId: null });
  });
});

describe('AuditRepository.page', () => {
  it('filters by action when asked, and by nothing otherwise', async () => {
    await AuditRepository.page({}, 0, 25);
    expect(seen.pageWhere).toBeUndefined();

    await AuditRepository.page({ action: 'account.activated' }, 0, 25);
    expect(render(seen.pageWhere)).toEqual({ params: ['account.activated'], sql: '"audit_logs"."action" = $1' });
  });

  it('counts under the same condition as the page, and pages with the given offset and size', async () => {
    rows = [
      {
        action: 'account.activated',
        actorEmail: null,
        createdAt: new Date('2026-09-29T08:00:00.000Z'),
        metadata: { via: 'mail_link' },
        subjectEmail: 'a@example.com'
      }
    ];
    counted = [{ n: 1 }];

    const result = await AuditRepository.page({ action: 'account.activated' }, 10, 25);

    expect(seen.limit).toBe(25);
    expect(seen.offset).toBe(10);
    expect(render(seen.countWhere)).toEqual(render(seen.pageWhere));
    expect(result).toEqual({ rows, total: 1 });
  });
});

describe('AuditRepository.forgetAuthRowsBefore', () => {
  it('deletes only rows whose action starts with auth. and that are older than the cutoff, and counts them', async () => {
    const cutoff = new Date('2025-10-03T08:05:00.000Z');

    await expect(AuditRepository.forgetAuthRowsBefore(cutoff)).resolves.toBe(2);
    expect(render(deleted.where)).toEqual({
      params: ['auth.%', cutoff.toISOString()],
      sql: '("audit_logs"."action" like $1 and "audit_logs"."created_at" < $2)'
    });
  });
});
