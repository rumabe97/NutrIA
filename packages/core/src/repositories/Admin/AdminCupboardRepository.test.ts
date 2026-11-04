import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cupboardGapQuerySchema } from 'core/entities/AdminQuery';

import { AdminCupboardRepository, UNRESOLVED_WORD_THRESHOLD } from './AdminCupboardRepository';

/** Every statement sent, as Postgres receives it: the real method's SQL, not a copy (see `AdminCatalogueRepository.test`). */
const sent = vi.hoisted(() => [] as { params: unknown[]; sql: string }[]);

vi.mock('database', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const answer = (sql: string, params: unknown[]) => {
    sent.push({ params, sql });

    return Object.assign(Promise.resolve([]), { values: () => Promise.resolve([]) });
  };

  const db = drizzle({ casing: 'snake_case', client: { options: { parsers: {}, serializers: {} }, unsafe: answer } as never });

  return { database: () => db };
});

const PAGE = cupboardGapQuerySchema.parse({});

beforeEach(() => {
  sent.length = 0;
});

describe('AdminCupboardRepository.unresolved', () => {
  it('groups the unresolved entries by their normalised word and keeps a word only above the threshold, in the query', async () => {
    await AdminCupboardRepository.unresolved(PAGE);

    const statements = sent.map(({ sql }) => sql);

    expect(UNRESOLVED_WORD_THRESHOLD).toBe(2);
    expect(statements).toHaveLength(2);

    for (const sql of statements) {
      expect(sql).toContain('"pantry_items"."ingredient_id" is null');
      expect(sql).toContain('group by "pantry_items"."normalised_label"');
      expect(sql).toContain('having count(distinct "pantry_items"."user_id") >= ');
    }
  });

  it('binds the threshold as the constant and never as anything a caller sent', async () => {
    await AdminCupboardRepository.unresolved({ ...PAGE, offset: 3, size: 7 });

    expect(sent.every(({ params }) => params.includes(UNRESOLVED_WORD_THRESHOLD))).toBe(true);
  });

  it('selects the word and the number of accounts and nothing that names one: no label, no user, no id', async () => {
    await AdminCupboardRepository.unresolved(PAGE);

    const page = sent.find(({ sql }) => sql.includes('limit'))?.sql ?? '';

    expect(page).toContain('"accounts"');
    expect(page).toMatch(/^select "accounts", "normalised_label" from \(/);
    expect(page).not.toMatch(/"pantry_items"\."label"/);
    expect(page).not.toMatch(/select[^()]*"pantry_items"\."user_id"/);
    expect(page).not.toMatch(/"pantry_items"\."id"/);
  });

  it('pages after the most held, then the word, so a boundary is stable', async () => {
    await AdminCupboardRepository.unresolved({ ...PAGE, offset: 50, size: 10 });

    const page = sent.find(({ sql }) => sql.includes('limit'));

    expect(page?.sql).toContain('order by "accounts" desc, "unresolved_words"."normalised_label" asc');
    expect(page?.params.slice(-2)).toEqual([10, 50]);
  });
});

describe('AdminCupboardRepository.uncooked', () => {
  it('reads the ingredients no recipe_ingredients row mentions, and floors the distinct-account count below the threshold, with no having', async () => {
    await AdminCupboardRepository.uncooked(PAGE);

    const page = sent.find(({ sql }) => sql.includes('limit'))?.sql ?? '';

    expect(page).toContain('not exists (select 1 from "recipe_ingredients" where "recipe_ingredients"."ingredient_id" = "ingredients"."id")');
    expect(page).toContain('case when count(distinct "pantry_items"."user_id") >= $');
    expect(page).toContain('left join "pantry_items"');
    expect(page).not.toContain('having');
    expect(sent.some(({ sql }) => sql.startsWith('select count(*)'))).toBe(true);
  });

  it('orders by the most held, then the name and the slug, and returns no person', async () => {
    await AdminCupboardRepository.uncooked(PAGE);

    const page = sent.find(({ sql }) => sql.includes('limit'))?.sql ?? '';

    // The order is by the floored figure: a raw count would put the 1-rows above the 0-rows and give the distinction back by position.
    expect(page).toMatch(
      /order by case when count\(distinct "pantry_items"\."user_id"\) >= \$\d+ then count\(distinct "pantry_items"\."user_id"\) else 0 end desc/
    );
    expect(page).not.toMatch(/"pantry_items"\."label"/);
    expect(page).not.toMatch(/"pantry_items"\."id"/);
  });
});
