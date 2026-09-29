import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { feedbackQuerySchema } from 'core/entities/AdminQuery';

import { feedbackFilters, feedbackOrder, FeedbackRepository } from './FeedbackRepository';

import type { FeedbackQuery } from 'core/entities/AdminQuery';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect({ casing: 'snake_case' });

/** What `setHandled`'s guarded `UPDATE … RETURNING` answers inside its transaction. */
let updated: Record<string, unknown>[] = [];

vi.mock('database', () => ({
  database: () => ({
    transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve(updated) }) }) }) })
  })
}));

function render(fragment: SQL | undefined): { params: unknown[]; sql: string } {
  if (!fragment) {
    return { params: [], sql: '' };
  }

  const { params, sql } = dialect.sqlToQuery(fragment);

  return { params, sql };
}

function query(raw: Record<string, string> = {}): FeedbackQuery {
  return feedbackQuerySchema.parse(raw);
}

/* The inbox's filters (`0037`, `0068`): the text or the sender, and the state. */
describe('feedbackFilters', () => {
  it('is no condition at all for every message', () => {
    expect(feedbackFilters(query())).toBeUndefined();
    expect(feedbackFilters(query({ q: '   ', state: 'all' }))).toBeUndefined();
  });

  it('searches the message or the sender’s address, literally, bound as parameters', () => {
    expect(render(feedbackFilters(query({ q: 'no_va' })))).toEqual({
      params: ['%no\\_va%', '%no\\_va%'],
      sql: '("feedback"."message" ilike $1 or "user"."email" ilike $2)'
    });
  });

  it('reads waiting as not yet marked, and seen as marked', () => {
    expect(render(feedbackFilters(query({ state: 'waiting' }))).sql).toBe('"feedback"."handled_at" is null');
    expect(render(feedbackFilters(query({ state: 'seen' }))).sql).toBe('"feedback"."handled_at" is not null');
  });

  it('puts the search and the state together', () => {
    expect(render(feedbackFilters(query({ q: 'plan', state: 'waiting' }))).sql).toBe(
      '(("feedback"."message" ilike $1 or "user"."email" ilike $2) and "feedback"."handled_at" is null)'
    );
  });
});

describe('feedbackOrder', () => {
  it('is newest first by default, oldest first when asked, the id breaking ties', () => {
    expect(feedbackOrder(query()).map(term => render(term).sql)).toEqual(['"feedback"."created_at" desc nulls last', '"feedback"."id" asc']);
    expect(feedbackOrder(query({ dir: 'asc' })).map(term => render(term).sql)).toEqual([
      '"feedback"."created_at" asc nulls last',
      '"feedback"."id" asc'
    ]);
  });
});

/** `setHandled` (`0071`): the trail's row goes in the same transaction as the mark, and only when a row was actually touched. */
describe('FeedbackRepository.setHandled', () => {
  beforeEach(() => {
    updated = [];
  });

  it('calls the record in the same transaction as a real mark', async () => {
    updated = [{ id: 'fb-1' }];
    const record = vi.fn(async () => {});

    await expect(FeedbackRepository.setHandled('fb-1', true, record)).resolves.toBe(true);
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('calls no record when there was no such message', async () => {
    updated = [];
    const record = vi.fn(async () => {});

    await expect(FeedbackRepository.setHandled('fb-missing', true, record)).resolves.toBe(false);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects, wrapped, when the caller’s own record rejects — a mark that is not also that row did not happen', async () => {
    updated = [{ id: 'fb-1' }];
    const record = vi.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(FeedbackRepository.setHandled('fb-1', true, record)).rejects.toThrow();
  });
});
