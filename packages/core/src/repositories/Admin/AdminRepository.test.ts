import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCEPTED_BY_OWNER } from 'core/entities/DishPicture';

import { AdminRepository } from './AdminRepository';

/** Every statement sent, as Postgres receives it, and what each answers in order: rows as the driver gives them, a value per selected column. */
const sent = vi.hoisted(() => [] as { params: unknown[]; sql: string }[]);
const answers = vi.hoisted(() => [] as unknown[][][]);

vi.mock('database', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const answer = (sql: string, params: unknown[]) => {
    sent.push({ params, sql });

    const rows = answers.shift() ?? [];

    return Object.assign(Promise.resolve(rows), { values: () => Promise.resolve(rows) });
  };

  const db = drizzle({ casing: 'snake_case', client: { options: { parsers: {}, serializers: {} }, unsafe: answer } as never });

  return { database: () => db };
});

beforeEach(() => {
  sent.length = 0;
  answers.length = 0;
});

/* Project 009, phase 3: Imágenes counts the pictures the owner accepted by hand. A count: no dish is named. */
describe('AdminRepository.pictures', () => {
  it('counts the ready pictures accepted by hand apart, inside the ready ones, grouping by the very expression it selects', async () => {
    // by hand, n, released, status — and the month's spend.
    answers.push(
      [
        [false, 30, false, 'ready'],
        [true, 2, false, 'ready'],
        [false, 4, false, 'failed'],
        [false, 3, true, 'failed'],
        [false, 1, false, 'drawing']
      ],
      [['3.2']]
    );

    await expect(AdminRepository.pictures(new Date('2026-09-01T00:00:00Z'))).resolves.toEqual({
      acceptedByHand: 2,
      drawing: 1,
      failed: 4,
      ready: 32,
      released: 3,
      spentUsd: 3.2
    });

    const byHand = `coalesce(("recipe_images"."provenance" ->> 'acceptedBy') = '${ACCEPTED_BY_OWNER}', false)`;
    const states = sent.find(statement => statement.sql.includes('group by'));

    expect(states?.sql).toContain(`select ${byHand}`);
    expect(states?.sql).toContain(`, ${byHand}`);
    // A literal, not a parameter: Postgres would not take `$1` selected and `$2` grouped as the same expression.
    expect(states?.params).toEqual([]);
  });

  it('counts none when no picture was accepted by hand', async () => {
    answers.push([[false, 5, false, 'ready']], [['0']]);

    await expect(AdminRepository.pictures(new Date('2026-09-01T00:00:00Z'))).resolves.toMatchObject({ acceptedByHand: 0, ready: 5 });
  });
});

/* Project 010, phase 3: the failed pictures' counts — `/admin/pictures` and the owner's mail — read no judge's answers. */
describe('AdminRepository.failedPictures', () => {
  it('reads a failed row’s provenance without its drawings, and whether it was given back', async () => {
    answers.push([[{ reason: 'judge_allergen' }, false]]);

    await expect(AdminRepository.failedPictures(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-30T00:00:00Z'))).resolves.toEqual([
      { provenance: { reason: 'judge_allergen' }, released: false }
    ]);

    expect(sent[0]?.sql).toMatch(/^select "provenance" - 'drawings', /);
    expect(sent[0]?.sql).not.toMatch(/"provenance"(?! ->> ')(?! - 'drawings')/);
  });
});
