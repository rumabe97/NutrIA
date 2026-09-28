import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeRepository } from './RecipeRepository';

/**
 * `loadCatalogue` is the loader the allergy layer reads the shelf through. The console
 * gave it an optional `slugs` (`0068`); these pin that without one it reads the whole
 * shelf exactly as before — no filter on ingredients, none on their allergen links —
 * so the gate never sees a narrowed catalogue by accident. Every statement is captured
 * as Postgres receives it, through the real query builder (see `AdminCatalogueRepository.test`).
 */
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

function statements() {
  const shelf = sent.find(statement => statement.sql.includes('from "ingredients"') && !statement.sql.includes('"ingredient_allergens"'));
  const links = sent.find(statement => statement.sql.includes('from "ingredient_allergens"'));

  return { links: links?.sql ?? '', shelf: shelf?.sql ?? '' };
}

describe('RecipeRepository.loadCatalogue — the allergy layer reads the whole shelf', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('without slugs or a country, filters neither the ingredients nor their allergen links', async () => {
    await RecipeRepository.loadCatalogue('es-ES');

    const { links, shelf } = statements();

    expect(shelf).not.toBe('');
    expect(shelf).not.toMatch(/\bwhere\b/i);
    expect(links).not.toBe('');
    expect(links).not.toMatch(/\bwhere\b/i);
  });

  it('with a country, filters the ingredients by where they are sold and nothing else', async () => {
    await RecipeRepository.loadCatalogue('es-ES', 'ES');

    const { links, shelf } = statements();

    expect(shelf).toMatch(/where .*cardinality/i);
    expect(shelf).not.toMatch(/"slug" in/i);
    expect(links).not.toMatch(/\bwhere\b/i);
  });

  it('with slugs, narrows both reads to those ingredients', async () => {
    await RecipeRepository.loadCatalogue('es-ES', null, ['arroz', 'pollo']);

    const { links, shelf } = statements();

    expect(shelf).toMatch(/"slug" in/i);
    expect(links).toMatch(/\bwhere\b/i);
  });
});
