import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ZodError } from 'zod';

import { AI_MESSAGE_DECLINES } from 'database/schema/ai';

import { ASSISTANT_DECLINES } from 'core/domain/Assistant';
import { DatabaseOperationError } from 'core/entities/Error';

import { AssistantRepository, ownedConversation, usageWindow } from './AssistantRepository';

const dialect = new PgDialect({ casing: 'snake_case' });

/** What each kind of statement answers, and every row a write was handed. */
let answers: { deleted: unknown[]; inserted: unknown[]; selected: unknown[]; updated: unknown[] } = {
  deleted: [],
  inserted: [],
  selected: [],
  updated: []
};
let locks = 0;
let writes: unknown[] = [];
let updates = 0;
let failure: unknown = null;

/** A chain that resolves to `value` however far it is followed: `.from().where().orderBy().limit()` and the rest. */
function chain(value: () => unknown): unknown {
  const settle = (): Promise<unknown> => (failure ? Promise.reject(failure) : Promise.resolve(value()));

  return new Proxy(settle, {
    get: (_target, property) => (property === 'then' ? (ok: never, ko: never) => settle().then(ok, ko) : () => chain(value))
  });
}

function fake(): unknown {
  return {
    delete: () => chain(() => answers.deleted),
    execute: () => {
      locks += 1;

      return Promise.resolve();
    },
    insert: () => ({
      values: (row: unknown) => {
        writes.push(row);

        return chain(() => answers.inserted);
      }
    }),
    select: () => chain(() => answers.selected),
    transaction: (fn: (tx: unknown) => Promise<unknown>) => (failure ? Promise.reject(failure) : fn(fake())),
    update: () => {
      updates += 1;

      return chain(() => answers.updated);
    }
  };
}

vi.mock('database', () => ({ database: () => fake() }));

beforeEach(() => {
  answers = { deleted: [], inserted: [], selected: [], updated: [] };
  locks = 0;
  writes = [];
  updates = 0;
  failure = null;
});

function rendered(fragment: unknown): { params: unknown[]; sql: string } {
  const { params, sql } = dialect.sqlToQuery(fragment as never);

  return { params, sql };
}

describe('the ownership a 404 is made of', () => {
  it('reads a conversation by its id **and** by the person, both bound', () => {
    expect(rendered(ownedConversation('user-1', 'c-1'))).toEqual({
      params: ['c-1', 'user-1'],
      sql: '("ai_conversations"."id" = $1 and "ai_conversations"."user_id" = $2)'
    });
  });

  it('counts the ledger for this person since the window began', () => {
    const since = new Date('2026-11-10T00:00:00Z');

    expect(rendered(usageWindow('user-1', since))).toEqual({
      params: ['user-1', since.toISOString()],
      sql: '("assistant_usage"."user_id" = $1 and "assistant_usage"."created_at" >= $2)'
    });
  });
});

describe('the usage ledger', () => {
  it('claims a message under a lock on the person, with nothing a person wrote in the row', async () => {
    answers.selected = [{ messages: 3 }];
    answers.inserted = [{ id: 'u-1' }];

    await expect(AssistantRepository.claimUse('user-1', new Date(), 4)).resolves.toBe('u-1');
    expect(locks).toBe(1);
    expect(writes).toEqual([{ offTopic: false, userId: 'user-1' }]);
  });

  it('claims nothing, and writes nothing, once the allowance is spent', async () => {
    answers.selected = [{ messages: 4 }];

    await expect(AssistantRepository.claimUse('user-1', new Date(), 4)).resolves.toBeNull();
    expect(writes).toEqual([]);
  });

  it('counts the window’s messages and its off-topic cuts in one row, and an empty window as nothing', async () => {
    answers.selected = [{ messages: 7, offTopic: 2 }];

    await expect(AssistantRepository.usageSince('user-1', new Date())).resolves.toEqual({ messages: 7, offTopic: 2 });

    answers.selected = [];

    await expect(AssistantRepository.usageSince('user-1', new Date())).resolves.toEqual({ messages: 0, offTopic: 0 });
  });
});

describe('the conversations', () => {
  it('creates one titled by the service, and returns its id', async () => {
    answers.inserted = [{ id: 'c-1' }];

    await expect(AssistantRepository.createConversation('user-1', '¿Por qué tanto almuerzo?')).resolves.toBe('c-1');
    expect(writes).toEqual([{ title: '¿Por qué tanto almuerzo?', userId: 'user-1' }]);
  });

  it('finds this person’s own conversation, and reads somebody else’s as nothing', async () => {
    const row = { id: 'c-1', createdAt: new Date(), title: null, updatedAt: new Date() };

    answers.selected = [row];

    await expect(AssistantRepository.findConversation('user-1', 'c-1')).resolves.toEqual({ ...row, title: '' });

    answers.selected = [];

    await expect(AssistantRepository.findConversation('user-2', 'c-1')).resolves.toBeNull();
  });

  it('lists conversations with an untitled one named as empty, not null', async () => {
    answers.selected = [{ id: 'c-1', createdAt: new Date(), title: null, updatedAt: new Date() }];

    await expect(AssistantRepository.listConversations('user-1')).resolves.toMatchObject([{ id: 'c-1', title: '' }]);
  });

  it('reads turns oldest first, with a decline as its code', async () => {
    answers.selected = [{ id: 't-1', content: '', createdAt: new Date(), decline: 'off_topic', role: 'assistant' }];

    await expect(AssistantRepository.turns('user-1', 'c-1')).resolves.toMatchObject([{ id: 't-1', decline: 'off_topic' }]);
  });

  it('appends a turn and marks the conversation continued, in one transaction, only to the owner’s', async () => {
    answers.inserted = [{ id: 't-1' }];
    answers.updated = [{ id: 'c-1' }];

    await expect(AssistantRepository.appendTurn('user-1', 'c-1', { content: '', decline: 'clinical', role: 'assistant' })).resolves.toBe('t-1');
    expect(writes).toEqual([
      { content: '', conversationId: 'c-1', decline: 'clinical', role: 'assistant', tokensIn: undefined, tokensOut: undefined }
    ]);
    expect(updates).toBe(1);

    answers.updated = [];
    writes = [];

    await expect(AssistantRepository.appendTurn('user-2', 'c-1', { content: 'x', decline: null, role: 'user' })).resolves.toBeNull();
    expect(writes).toEqual([]);
  });

  it('says whether a delete found something of this person’s to delete', async () => {
    answers.deleted = [{ id: 'c-1' }];
    answers.selected = [{ id: 't-1', conversationId: 'c-1', role: 'assistant' }];

    await expect(AssistantRepository.deleteConversation('user-1', 'c-1')).resolves.toBe(true);
    await expect(AssistantRepository.deleteTurn('user-1', 't-1', title => title)).resolves.toBe(true);

    answers.deleted = [];
    answers.selected = [];

    await expect(AssistantRepository.deleteConversation('user-2', 'c-1')).resolves.toBe(false);
    await expect(AssistantRepository.deleteTurn('user-2', 't-1', title => title)).resolves.toBe(false);
  });

  it('refuses a write that came back empty rather than inventing an id', async () => {
    await expect(AssistantRepository.createConversation('user-1', 'x')).rejects.toBeInstanceOf(DatabaseOperationError);
    answers.updated = [{ id: 'c-1' }];

    await expect(AssistantRepository.appendTurn('user-1', 'c-1', { content: 'x', decline: null, role: 'user' })).rejects.toBeInstanceOf(
      DatabaseOperationError
    );
  });
});

describe('failures', () => {
  it('report as the domain’s own error, never the driver’s', async () => {
    failure = new Error('connection reset');

    for (const call of [
      () => AssistantRepository.claimUse('user-1', new Date(), 4),
      () => AssistantRepository.markOffTopic('user-1', 'u-1'),
      () => AssistantRepository.releaseUse('user-1', 'u-1'),
      () => AssistantRepository.usageSince('user-1', new Date()),
      () => AssistantRepository.createConversation('user-1', 'x'),
      () => AssistantRepository.findConversation('user-1', 'c-1'),
      () => AssistantRepository.listConversations('user-1'),
      () => AssistantRepository.turns('user-1', 'c-1'),
      () => AssistantRepository.appendTurn('user-1', 'c-1', { content: 'x', decline: null, role: 'user' }),
      () => AssistantRepository.deleteConversation('user-1', 'c-1'),
      () => AssistantRepository.deleteTurn('user-1', 't-1', title => title)
    ]) {
      await expect(call()).rejects.toBeInstanceOf(DatabaseOperationError);
    }

    failure = new ZodError([]);

    await expect(AssistantRepository.usageSince('user-1', new Date())).rejects.toThrow(/assistant_usage/);
  });
});

/**
 * The database's `CHECK` is written from its own list, because that package
 * cannot import this one. This keeps the two from drifting: a code added here
 * and not there would make the route's write fail in production the first time
 * it was used.
 */
describe('the decline codes', () => {
  it('are the same list in the domain and in the database’s check', () => {
    expect([...ASSISTANT_DECLINES]).toEqual([...AI_MESSAGE_DECLINES]);
  });
});
