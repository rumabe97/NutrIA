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

describe('the quality reads', () => {
  it('narrows the table to the recipes a check found, bound as parameters, and to none when it found none', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ source: 'ai' }), ['r-1', 'r-2']));

    expect(sql).toBe('("recipes"."id" in ($1, $2) and "recipes"."source" = $3)');
    expect(params).toEqual(['r-1', 'r-2', 'ai']);
    expect(render(recipeFilters(recipeCatalogueQuerySchema.parse({}), [])).sql).toBe('false');
    expect(recipeFilters(recipeCatalogueQuerySchema.parse({}), undefined)).toBeUndefined();
  });

  it('reads every recipe once, its served ingredients folded into arrays and the sweep’s own condition beside them', async () => {
    await AdminCatalogueRepository.qualityRecipes('2.8.0');

    const [statement] = sent;

    expect(statement?.sql).toContain(
      'from "recipes" left join "recipe_ingredients" on ("recipe_ingredients"."recipe_id" = "recipes"."id" and "recipe_ingredients"."is_optional" = $'
    );
    expect(statement?.sql).toContain('left join "ingredients" on "ingredients"."id" = "recipe_ingredients"."ingredient_id"');
    expect(statement?.sql).toContain('group by "recipes"."id"');
    expect(statement?.sql).toContain(`split_part("recipes"."steps_version", '+', 1)`);
    // A recipe, its dish and its steps' version: nothing that names a person.
    expect(statement?.sql).not.toMatch(/created_by|"user"/);
  });

  it('counts meals outside the serving bounds and returns nothing else of them', async () => {
    await AdminCatalogueRepository.mealsOutsideServingBounds();

    expect(sent[0]?.sql).toBe('select count(*) from "meals" where ("meals"."servings" < $1 or "meals"."servings" > $2)');
    expect(sent[0]?.params).toEqual(['0.5', '4']);
  });

  it('counts the pictures that failed for the dish’s own reasons with the same state the table shows', async () => {
    await AdminCatalogueRepository.picturesFailed();

    expect(sent[0]?.sql).toContain(`count(*) filter (where case`);
    expect(sent[0]?.sql).toContain(`= 'failed')`);
    expect(sent[0]?.sql).toContain('left join "recipe_images"');
  });
});

/* Project 009, phase 3: Imágenes' count links here, so "Retirar" is reachable without paging the whole catalogue. */
describe('the hand-accepted pictures as a filter', () => {
  it('matches exactly the ready rows the owner accepted, in SQL, and binds nothing', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ picture: 'accepted_by_hand' })));

    expect(sql).toBe(`coalesce("recipe_images"."status" = 'ready' and ("recipe_images"."provenance" ->> 'acceptedBy') = 'owner', false)`);
    expect(params).toEqual([]);
  });

  it('is the very expression the row’s flag is read with, so the filter and the flag cannot disagree', async () => {
    await AdminCatalogueRepository.recipePage(recipeCatalogueQuerySchema.parse({ picture: 'accepted_by_hand' }));

    const flag = `coalesce("recipe_images"."status" = 'ready' and ("recipe_images"."provenance" ->> 'acceptedBy') = 'owner', false)`;
    const [page, counted] = sent;

    expect(page?.sql.split(flag)).toHaveLength(3);
    expect(page?.sql).toContain(`where ${flag} order by`);
    // The total is counted over the same filter.
    expect(counted?.sql).toContain(`where ${flag}`);
  });

  it('leaves the four states as they were: `ready` still lists every ready picture, by hand or by the judge', () => {
    const { params, sql } = render(recipeFilters(recipeCatalogueQuerySchema.parse({ picture: 'ready' })));

    expect(sql).not.toContain('acceptedBy');
    expect(params).toEqual(['ready']);
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

  /* 0072: what lets the console offer "Retirar". A flag computed in SQL — a ready row's provenance itself is never selected. */
  it('reads whether a ready picture was accepted by hand as a flag, and a provenance only from a failed row', async () => {
    await AdminCatalogueRepository.recipePage(recipeCatalogueQuerySchema.parse({}));

    expect(sent[0]?.sql).toContain(
      `coalesce("recipe_images"."status" = 'ready' and ("recipe_images"."provenance" ->> 'acceptedBy') = 'owner', false)`
    );
    expect(sent[0]?.sql).toContain(`case when "recipe_images"."status" = 'failed' then "recipe_images"."provenance" - 'drawings' end`);
  });

  /* Project 010, phase 3: what the judge answered is kept in the row, and the console's reads leave it there. */
  it('never selects the judge’s answers: the list and the one-recipe read take the failed row’s provenance without its drawings', async () => {
    await AdminCatalogueRepository.recipePage(recipeCatalogueQuerySchema.parse({}));
    await AdminCatalogueRepository.recipe('6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f');

    // Each read of the column is a flag's (`->> 'acceptedBy'`, `->> 'released'`) or the failed row's, drawings taken off.
    const reads = sent.filter(({ sql }) => sql.includes('"recipe_images"."provenance" - '));

    expect(reads).toHaveLength(2);

    for (const { sql } of sent) {
      expect(sql).not.toMatch(/"recipe_images"\."provenance"(?! ->> ')(?! - 'drawings')/);
    }
  });

  it('selects a picture’s public address only from a ready row', async () => {
    await AdminCatalogueRepository.recipePage(recipeCatalogueQuerySchema.parse({}));

    expect(sent[0]?.sql).toContain(`case when "recipe_images"."status" = 'ready' then "recipe_images"."url" end`);
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
