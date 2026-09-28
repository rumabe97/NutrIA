import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { PgDialect } from 'drizzle-orm/pg-core';
import { user } from 'database/schema/auth';

import { accountQuerySchema } from 'core/entities/AdminQuery';

import { ACCOUNT_COLUMNS, accountFilters, accountOrder, UserRepository } from './UserRepository';

import type { AccountQuery } from 'core/entities/AdminQuery';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect({ casing: 'snake_case' });

/** What each query was given: the page's `WHERE`, order, limit and offset, and the count's `WHERE`. */
const seen: { countWhere?: SQL; limit?: number; offset?: number; order?: SQL[]; where?: SQL } = {};

vi.mock('database', () => ({
  database: () => ({
    select: (fields: Record<string, unknown>) => {
      const counting = 'n' in fields;
      const chain = {
        from: () => chain,
        limit: (limit: number) => {
          seen.limit = limit;

          return chain;
        },
        offset: (offset: number) => {
          seen.offset = offset;

          return Promise.resolve([]);
        },
        orderBy: (...order: SQL[]) => {
          seen.order = order;

          return chain;
        },
        where: (where: SQL) => {
          if (counting) {
            seen.countWhere = where;

            return Promise.resolve([{ n: 7 }]);
          }

          seen.where = where;

          return chain;
        }
      };

      return chain;
    }
  })
}));

function render(fragment: SQL | undefined): { params: unknown[]; sql: string } {
  if (!fragment) {
    return { params: [], sql: '' };
  }

  const { params, sql } = dialect.sqlToQuery(fragment);

  return { params, sql };
}

function query(raw: Record<string, string> = {}): AccountQuery {
  return accountQuerySchema.parse(raw);
}

/*
 * The account table's filters (`0068`). Each one narrows by a fact about the
 * account — its address, its locks, its milestones, its tier and role — and
 * every value reaches Postgres as a parameter.
 */
describe('accountFilters', () => {
  it('is no condition at all when nothing is asked', () => {
    expect(accountFilters(query())).toBeUndefined();
  });

  it('searches the address as a literal, case-insensitive "contains", bound as a parameter', () => {
    const { params, sql } = render(accountFilters(query({ q: '  50%_off\\x ' })));

    expect(sql).toBe('"user"."email" ilike $1');
    expect(params).toEqual(['%50\\%\\_off\\\\x%']);
  });

  it('reads confirmed as the address being verified, either way', () => {
    expect(render(accountFilters(query({ confirmed: 'yes' })))).toEqual({ params: [true], sql: '"user"."email_verified" = $1' });
    expect(render(accountFilters(query({ confirmed: 'no' })))).toEqual({ params: [false], sql: '"user"."email_verified" = $1' });
  });

  it('reads activated as the owner having opened the account', () => {
    expect(render(accountFilters(query({ activated: 'yes' }))).sql).toBe('"user"."activated_at" is not null');
    expect(render(accountFilters(query({ activated: 'no' }))).sql).toBe('"user"."activated_at" is null');
  });

  it('reads professional as the grant standing', () => {
    const grant = 'exists (select 1 from "professionals" where "professionals"."user_id" = "user"."id")';

    expect(render(accountFilters(query({ professional: 'yes' }))).sql).toBe(grant);
    expect(render(accountFilters(query({ professional: 'no' }))).sql).toBe(`not ${grant}`);
  });

  it('reads onboarded as onboarding finished — the funnel’s definition — and reads no answer', () => {
    const finished =
      'exists (select 1 from "onboarding_state" where "onboarding_state"."user_id" = "user"."id" and "onboarding_state"."completed_at" is not null)';

    expect(render(accountFilters(query({ onboarded: 'yes' }))).sql).toBe(finished);
    expect(render(accountFilters(query({ onboarded: 'no' }))).sql).toBe(`not ${finished}`);
  });

  it('filters the tier and the role by value', () => {
    expect(render(accountFilters(query({ tier: 'premium' })))).toEqual({ params: ['premium'], sql: '"user"."tier" = $1' });
    expect(render(accountFilters(query({ role: 'admin' })))).toEqual({ params: ['admin'], sql: '"user"."role" = $1' });
  });

  it('puts every asked filter together with "and"', () => {
    const { params, sql } = render(accountFilters(query({ activated: 'no', confirmed: 'yes', q: 'ana', role: 'user', tier: 'free' })));

    expect(sql).toBe(
      '("user"."email" ilike $1 and "user"."email_verified" = $2 and "user"."activated_at" is null and "user"."tier" = $3 and "user"."role" = $4)'
    );
    expect(params).toEqual(['%ana%', true, 'free', 'user']);
  });
});

describe('accountOrder', () => {
  const sqlOf = (order: readonly SQL[]) => order.map(term => render(term).sql);

  it('is newest first, then the id, when nothing is asked', () => {
    expect(sqlOf(accountOrder(query()))).toEqual(['"user"."created_at" desc nulls last', '"user"."id" asc']);
  });

  it('sorts the address either way, ties falling newest first', () => {
    expect(sqlOf(accountOrder(query({ dir: 'asc', sort: 'email' })))).toEqual([
      '"user"."email" asc nulls last',
      '"user"."created_at" desc',
      '"user"."id" asc'
    ]);
  });

  it('sorts by the latest event, an account with none last either way', () => {
    const [first] = sqlOf(accountOrder(query({ sort: 'lastActiveAt' })));
    const [ascending] = sqlOf(accountOrder(query({ dir: 'asc', sort: 'lastActiveAt' })));

    expect(first).toBe(
      '(select max("analytics_events"."created_at") from "analytics_events" where "analytics_events"."user_id" = "user"."id") desc nulls last'
    );
    expect(ascending).toMatch(/ asc nulls last$/);
  });

  it('sorts by how many plans, counted and never read', () => {
    const [first] = sqlOf(accountOrder(query({ sort: 'plans' })));

    expect(first).toBe('(select count(*) from "meal_plans" where "meal_plans"."user_id" = "user"."id") desc nulls last');
  });
});

/*
 * Drizzle drops the table name from columns in a query over one table, and a
 * bare `"id"` inside a sub-select binds to the inner table. The first version
 * correlated `meal_plans.user_id = meal_plans.id` and counted nothing, while
 * every fragment rendered alone looked right. Rendered here as the real query.
 */
describe('the account query over the one table', () => {
  it('always names the outer account as "user"."id" inside the sub-selects', () => {
    const { sql } = drizzle
      .mock({ casing: 'snake_case' })
      .select(ACCOUNT_COLUMNS)
      .from(user)
      .where(accountFilters(query({ onboarded: 'yes', professional: 'no' })))
      .orderBy(...accountOrder(query({ sort: 'plans' })))
      .toSQL();

    expect(sql).toContain('where "onboarding_state"."user_id" = "user"."id"');
    expect(sql).toContain('where "professionals"."user_id" = "user"."id"');
    expect(sql).toContain('(select count(*) from "meal_plans" where "user_id" = "user"."id")');
    expect(sql).toContain('(select max("created_at") from "analytics_events" where "user_id" = "user"."id")');
    expect(sql).not.toMatch(/= "id"/);
  });
});

describe('UserRepository.findAll', () => {
  beforeEach(() => {
    for (const key of Object.keys(seen)) {
      delete seen[key as keyof typeof seen];
    }
  });

  it('pages by the query and counts under the same conditions', async () => {
    const result = await UserRepository.findAll(query({ offset: '50', q: 'ana', size: '50', tier: 'free' }));

    expect(result).toEqual({ rows: [], total: 7 });
    expect(seen.limit).toBe(50);
    expect(seen.offset).toBe(50);
    expect(render(seen.countWhere)).toEqual(render(seen.where));
    expect(render(seen.where).params).toEqual(['%ana%', 'free']);
  });
});
