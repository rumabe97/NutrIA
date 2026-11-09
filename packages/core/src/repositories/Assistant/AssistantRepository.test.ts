import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ZodError } from 'zod';

import { AI_MESSAGE_DECLINES } from 'database/schema/ai';

import { ASSISTANT_DECLINES } from 'core/domain/Assistant';
import { DatabaseOperationError } from 'core/entities/Error';

import { AssistantRepository, usageWindow } from './AssistantRepository';

const dialect = new PgDialect({ casing: 'snake_case' });

let inserted: unknown[] = [];
let counted: Record<string, number>[] = [];
let failure: unknown = null;

vi.mock('database', () => ({
  database: () => ({
    insert: () => ({
      values: (row: unknown) => {
        if (failure) {
          return Promise.reject(failure);
        }

        inserted.push(row);

        return Promise.resolve();
      }
    }),
    select: () => ({ from: () => ({ where: () => (failure ? Promise.reject(failure) : Promise.resolve(counted)) }) })
  })
}));

beforeEach(() => {
  inserted = [];
  counted = [];
  failure = null;
});

describe('usageWindow', () => {
  it('is this person’s rows since the window began, both bound as parameters', () => {
    const since = new Date('2026-11-10T00:00:00Z');
    const { params, sql } = dialect.sqlToQuery(usageWindow('user-1', since) as never);

    expect(sql).toBe('("assistant_usage"."user_id" = $1 and "assistant_usage"."created_at" >= $2)');
    expect(params).toEqual(['user-1', since.toISOString()]);
  });
});

describe('AssistantRepository', () => {
  it('writes one row per message sent, with nothing a person wrote in it', async () => {
    await AssistantRepository.recordUse('user-1', true);

    expect(inserted).toEqual([{ offTopic: true, userId: 'user-1' }]);
  });

  it('counts the window’s messages and its off-topic cuts in one row', async () => {
    counted = [{ messages: 7, offTopic: 2 }];

    await expect(AssistantRepository.usageSince('user-1', new Date())).resolves.toEqual({ messages: 7, offTopic: 2 });
  });

  it('reads an empty window as nothing used', async () => {
    await expect(AssistantRepository.usageSince('user-1', new Date())).resolves.toEqual({ messages: 0, offTopic: 0 });
  });

  it('reports a failed read or write as the domain’s own error, not the driver’s', async () => {
    failure = new Error('connection reset');

    await expect(AssistantRepository.usageSince('user-1', new Date())).rejects.toBeInstanceOf(DatabaseOperationError);
    await expect(AssistantRepository.recordUse('user-1', false)).rejects.toBeInstanceOf(DatabaseOperationError);

    failure = new ZodError([]);

    await expect(AssistantRepository.usageSince('user-1', new Date())).rejects.toThrow(/assistant_usage/);
  });
});

/**
 * The database's `CHECK` is written from its own list, because that package
 * cannot import this one. This is what keeps the two from drifting: a decline
 * code added in `core` and not in the constraint would make the route's write
 * fail in production, the first time it was used.
 */
describe('the decline codes', () => {
  it('are the same list in the domain and in the database’s check', () => {
    expect([...ASSISTANT_DECLINES]).toEqual([...AI_MESSAGE_DECLINES]);
  });
});
