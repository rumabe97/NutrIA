import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

import { ingredientCatalogueQuerySchema, recipeCatalogueQuerySchema } from 'core/entities/AdminQuery';

import { AdminCatalogueRepository, ingredientFilters, recipeFilters } from './AdminCatalogueRepository';

/** Every statement sent, as Postgres receives it: the real method's SQL, not a copy (see `AdminGenerationsRepository.test`). */
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

const dialect = new PgDialect({ casing: 'snake_case' });

function render(fragment: ReturnType<typeof recipeFilters>): { params: unknown[]; sql: string } {
  return fragment ? dialect.sqlToQuery(fragment) : { params: [], sql: '' };
}

beforeEach(() => {
  sent.length = 0;
});

describe('recipeFilters', () => {
  it('is no condition at all when nothing is asked', () => {
    expect(recipeFilters(recipeCatalogueQuerySchema.parse({}))).toBeUndefined();
  });

  it('searches the name as a literal "contains" and binds every value', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ locale: 'es-ES', q: '100%', slot: 'lunch', source: 'seed' })));

    expect(sql).toBe('("recipes"."name" ilike $1 and $2 = any("recipes"."meal_slots") and "recipes"."source" = $3 and "recipes"."locale" = $4)');
    expect(params).toEqual(['%100\\%%', 'lunch', 'seed', 'es-ES']);
  });

  it('reads an allergen as one a served ingredient of *this* recipe contains', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ allergen: 'gluten' })));

    expect(sql).toContain('where "recipe_ingredients"."recipe_id" = "recipes"."id"');
    expect(sql).toContain('"recipe_ingredients"."is_optional" = false');
    expect(sql).toContain(`"ingredient_allergens"."presence" = 'contains'`);
    expect(sql).toContain('"allergens"."key" = $1');
    expect(params).toEqual(['gluten']);
  });

  it('reads a picture state from the one picture row, a released drawing reading as none', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ picture: 'failed' })));

    expect(sql).toContain(`when "recipe_images"."status" = 'ready' and "recipe_images"."url" is not null then 'ready'`);
    expect(sql).toContain(`when "recipe_images"."status" = 'failed' and ("recipe_images"."provenance" ->> 'released') is null then 'failed'`);
    expect(sql).toContain(`else 'none' end = $1`);
    expect(params).toEqual(['failed']);
  });
});

describe('AdminCatalogueRepository.recipePage', () => {
  it('selects what a dish is — never who made it — over its one picture row, by name with a stable tail', async () => {
    await AdminCatalogueRepository.recipePage(recipeCatalogueQuerySchema.parse({ allergen: 'milk', dir: 'desc', offset: '25', size: '25' }));

    const [page, counted] = sent;

    expect(page?.sql).toMatch(/^select "recipes"\."id", "recipes"\."locale", "recipes"\."meal_slots", "recipes"\."name", case/);
    expect(page?.sql).toContain('from "recipes" left join "recipe_images" on "recipe_images"."recipe_id" = "recipes"."id"');
    expect(page?.sql).not.toContain('created_by');
    expect(page?.sql).not.toContain('user');
    expect(page?.sql).toContain('order by "recipes"."name" desc nulls last, "recipes"."slug" asc limit $2 offset $3');
    expect(page?.params).toEqual(['milk', 25, 25]);
    expect(counted?.sql).toMatch(/^select count\(\*\) from "recipes" left join "recipe_images"/);
    expect(counted?.sql).toContain('= "recipes"."id"');
  });

  it('never lets a sub-select correlate on a bare "id"', async () => {
    await AdminCatalogueRepository.matchingRecipes(recipeCatalogueQuerySchema.parse({ allergen: 'milk', picture: 'none' }));

    expect(sent[0]?.sql).not.toMatch(/= "id"/);
  });
});

describe('AdminCatalogueRepository.recipeCounts', () => {
  it('counts a recipe once per slot it names, per source, and without a ready picture', async () => {
    await AdminCatalogueRepository.recipeCounts();

    const texts = sent.map(statement => statement.sql);

    expect(texts).toContain(
      'select count(*), "slots"."slot" from "recipes" cross join lateral unnest("recipes"."meal_slots") as "slots"("slot") group by "slots"."slot"'
    );
    expect(texts).toContain('select count(*), "source" from "recipes" group by "recipes"."source"');
    expect(texts.find(text => text.includes("<> 'ready'"))).toContain('left join "recipe_images"');
  });
});

describe('AdminCatalogueRepository.compositions', () => {
  it('reads only the served ingredients, the optional ones left out as the app serves them', async () => {
    await AdminCatalogueRepository.compositions(['r-1', 'r-2']);

    expect(sent[0]?.sql).toContain('where ("recipe_ingredients"."recipe_id" in ($1, $2) and "recipe_ingredients"."is_optional" = $3)');
    expect(sent[0]?.params).toEqual(['r-1', 'r-2', false]);
  });

  it('asks nothing for no recipes', async () => {
    expect(await AdminCatalogueRepository.compositions([])).toEqual([]);
    expect(await AdminCatalogueRepository.ingredientAllergens([])).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('ingredients', () => {
  it('searches a name in any language or the slug, and correlates on the outer ingredient', () => {
    const { params, sql } = dialect.sqlToQuery(
      ingredientFilters(ingredientCatalogueQuerySchema.parse({ allergen: 'milk', category: 'dairy', q: 'queso' }))!
    );

    expect(sql).toContain(
      '"ingredients"."slug" ilike $1 or exists (select 1 from "ingredient_names" where "ingredient_names"."ingredient_id" = "ingredients"."id"'
    );
    expect(sql).toContain('"ingredients"."category" = $3');
    expect(sql).toContain('where "ingredient_allergens"."ingredient_id" = "ingredients"."id"');
    expect(params).toEqual(['%queso%', '%queso%', 'dairy', 'milk']);
  });

  it('correlates on "ingredients"."id" in the count over one table too, where drizzle drops table names', async () => {
    await AdminCatalogueRepository.ingredientPage(ingredientCatalogueQuerySchema.parse({ allergen: 'milk', q: 'queso' }));

    const [, counted] = sent;

    expect(counted?.sql).toMatch(/^select count\(\*\) from "ingredients" where/);
    expect(counted?.sql).toContain('"ingredient_allergens"."ingredient_id" = "ingredients"."id"');
    expect(counted?.sql).not.toMatch(/= "id"/);
  });

  it('pages by the Spanish name with the slug as its tail, and by a figure with the name and slug after it', async () => {
    await AdminCatalogueRepository.ingredientPage(ingredientCatalogueQuerySchema.parse({}));
    await AdminCatalogueRepository.ingredientPage(ingredientCatalogueQuerySchema.parse({ dir: 'desc', sort: 'protein' }));

    const [byName, , byProtein] = sent;

    expect(byName?.sql).toContain(
      `left join "ingredient_names" "spanish_name" on ("spanish_name"."ingredient_id" = "ingredients"."id" and "spanish_name"."locale" = $1)`
    );
    expect(byName?.sql).toContain('order by coalesce("spanish_name"."name", "ingredients"."slug") asc nulls last, "ingredients"."slug" asc');
    expect(byName?.params[0]).toBe('es-ES');
    expect(byProtein?.sql).toContain(
      'order by "ingredients"."protein_per100g" desc nulls last, coalesce("spanish_name"."name", "ingredients"."slug") asc, "ingredients"."slug" asc'
    );
  });
});
