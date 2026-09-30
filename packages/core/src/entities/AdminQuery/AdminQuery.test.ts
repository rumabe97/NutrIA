import { describe, expect, it } from 'vitest';
import { planGenerationJobs } from 'database/schema/plan';
import { recipes } from 'database/schema/recipe';

import {
  accountQuerySchema,
  GENERATION_STATUSES,
  generationQuerySchema,
  ingredientCatalogueQuerySchema,
  RECIPE_PICTURE_FILTERS,
  RECIPE_SOURCES,
  recipeCatalogueQuerySchema,
  retentionQuerySchema
} from './AdminQuery';

describe('the admin tables search', () => {
  it('trims the text and treats a blank one as absent', () => {
    expect(accountQuerySchema.parse({ q: '  ana  ' }).q).toBe('ana');
    expect(accountQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });

  it('refuses a NUL character, which Postgres cannot hold in text', () => {
    expect(accountQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
    expect(recipeCatalogueQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
    expect(ingredientCatalogueQuerySchema.safeParse({ q: 'a\u0000b' }).success).toBe(false);
  });
});

describe('the enums the console filters by', () => {
  it('are the database’s own, so a filter can never ask for a state that does not exist or miss one that does', () => {
    expect([...GENERATION_STATUSES]).toEqual(planGenerationJobs.status.enumValues);
    expect([...RECIPE_SOURCES]).toEqual(recipes.source.enumValues);
  });
});

describe('generationQuerySchema', () => {
  it('pages the latest 25 when nothing is asked, and answers the paged shape', () => {
    expect(generationQuerySchema.parse({})).toEqual({ offset: 0, size: 25 });
  });

  it('reads every filter the log offers', () => {
    expect(
      generationQuerySchema.parse({
        code: 'GENERATION_AI_UNAVAILABLE',
        from: '2026-09-01',
        offset: '50',
        q: ' ana@',
        since: '7',
        size: '100',
        status: 'failed',
        to: '2026-09-28'
      })
    ).toEqual({
      code: 'GENERATION_AI_UNAVAILABLE',
      from: '2026-09-01',
      offset: 50,
      q: 'ana@',
      since: '7',
      size: 100,
      status: 'failed',
      to: '2026-09-28'
    });
  });

  it('takes the last 24 hours or a console period as `since`, and nothing else', () => {
    for (const since of ['24h', '7', '30', '90']) {
      expect(generationQuerySchema.safeParse({ since }).success).toBe(true);
    }

    for (const since of ['1h', '14', '48h', '']) {
      expect(generationQuerySchema.safeParse({ since }).success).toBe(false);
    }
  });

  it('refuses a status that is not a job state, a code that is not a code, and a day that is not a day', () => {
    expect(generationQuerySchema.safeParse({ status: 'done' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ code: 'generation_failed' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ code: "X' or 1=1" }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ from: '2026-02-30' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ to: '28/09/2026' }).success).toBe(false);
  });

  it('refuses a range that ends before it starts, and takes a range of one day', () => {
    expect(generationQuerySchema.safeParse({ from: '2026-09-28', to: '2026-09-01' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ from: '2026-09-28', to: '2026-09-28' }).success).toBe(true);
  });

  it('holds the page to 1–100 and a whole offset', () => {
    expect(generationQuerySchema.safeParse({ size: '0' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ size: '101' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
    expect(generationQuerySchema.safeParse({ offset: '1.5' }).success).toBe(false);
  });
});

describe('recipeCatalogueQuerySchema', () => {
  it('reads by name from the start of the alphabet when nothing is asked', () => {
    expect(recipeCatalogueQuerySchema.parse({})).toEqual({ dir: 'asc', offset: 0, size: 25, sort: 'name' });
  });

  it('sorts by name or a macro per serving — and not by a creation time recipes do not record', () => {
    for (const sort of ['name', 'kcal', 'protein']) {
      expect(recipeCatalogueQuerySchema.safeParse({ sort }).success).toBe(true);
    }

    expect(recipeCatalogueQuerySchema.safeParse({ sort: 'createdAt' }).success).toBe(false);
    expect(recipeCatalogueQuerySchema.safeParse({ sort: 'created_by' }).success).toBe(false);
  });

  it('filters by slot, allergen key, picture state, source and locale, each from its own grammar', () => {
    expect(
      recipeCatalogueQuerySchema.parse({ allergen: 'tree_nuts', locale: 'en-GB', picture: 'none', slot: 'afternoon_snack', source: 'seed' })
    ).toMatchObject({ allergen: 'tree_nuts', locale: 'en-GB', picture: 'none', slot: 'afternoon_snack', source: 'seed' });
    expect(recipeCatalogueQuerySchema.safeParse({ slot: 'brunch' }).success).toBe(false);
    expect(recipeCatalogueQuerySchema.safeParse({ allergen: 'Gluten' }).success).toBe(false);
    expect(recipeCatalogueQuerySchema.safeParse({ picture: 'released' }).success).toBe(false);
    // 0072: the ready pictures the owner accepted by hand, a filter value beside the four states.
    expect(recipeCatalogueQuerySchema.parse({ picture: 'accepted_by_hand' }).picture).toBe('accepted_by_hand');
    expect(RECIPE_PICTURE_FILTERS).toEqual(['none', 'drawing', 'ready', 'failed', 'accepted_by_hand']);
    expect(recipeCatalogueQuerySchema.safeParse({ source: 'import' }).success).toBe(false);
    expect(recipeCatalogueQuerySchema.safeParse({ locale: 'es_ES' }).success).toBe(false);
  });
});

describe('ingredientCatalogueQuerySchema', () => {
  it('reads by name when nothing is asked, and sorts only by an allowed column', () => {
    expect(ingredientCatalogueQuerySchema.parse({})).toEqual({ dir: 'asc', offset: 0, size: 25, sort: 'name' });
    expect(ingredientCatalogueQuerySchema.safeParse({ sort: 'fiber' }).success).toBe(false);
  });

  it('filters by a category the catalogue has', () => {
    expect(ingredientCatalogueQuerySchema.parse({ category: 'dairy' }).category).toBe('dairy');
    expect(ingredientCatalogueQuerySchema.safeParse({ category: 'meat' }).success).toBe(false);
  });
});

describe('retentionQuerySchema', () => {
  it('cuts by month unless asked for the week, and refuses anything else', () => {
    expect(retentionQuerySchema.parse({})).toEqual({});
    expect(() => retentionQuerySchema.parse({ grouping: 'week' })).toThrow();
    expect(() => retentionQuerySchema.parse({ grouping: 'month' })).toThrow();
  });
});
