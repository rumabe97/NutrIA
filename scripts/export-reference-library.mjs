#!/usr/bin/env node
// Exports production's model-made recipes as a SQL file the local Postgres loads on top of
// the seed library, so the scheduler is measured on dishes like the ones people get
// (decision 0080, project 017 phase 1).
//
//   node scripts/export-reference-library.mjs                           production, read-only — the lead, once a project
//   node scripts/export-reference-library.mjs --from-local [--source seed] [--out file]
//                                                                         the local Postgres, to test the format
//
// Production is opened read-only: `DATABASE_URL_PRO` from packages/database/.env (never
// printed, nor its host), and every statement inside `sql.begin('read only')`, which the
// engine enforces. It reads `recipes` with `source = 'ai'` and their `recipe_ingredients`
// joined to the catalogue for the ingredient's slug, nothing else: no user table, and the
// recipe's maker is written as NULL.
//
// The file is one transaction. It aborts, writing nothing, if any ingredient slug is not in
// the catalogue it is loaded into — a missing row would silently drop an ingredient and
// change the dish's macros. Each recipe goes in by slug with ON CONFLICT DO NOTHING, its
// ingredients only with it: loading twice, or over a seed dish of the same slug, changes
// nothing. Loaded by `pnpm db:local reset --reference`.
import { createRequire } from 'node:module';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { LOCAL_DATABASE_URL, readEnv, ROOT } from '../.claude/skills/local-probe/scripts/guard.mjs';

const OUT = 'docs/local/reference-ai-recipes.sql';
/** A test run's file, never the reference one: a local export must not stand in for production's. */
const LOCAL_OUT = 'docs/local/reference-ai-recipes.from-local.sql';
const SOURCES = new Set(['ai', 'seed', 'user']);

function parseArgs(argv) {
  const options = { fromLocal: false, out: null, source: 'ai' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--from-local') {
      options.fromLocal = true;
    } else if (arg === '--source') {
      options.source = argv[(index += 1)];
    } else if (arg === '--out') {
      options.out = argv[(index += 1)];
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }

  if (!SOURCES.has(options.source)) {
    throw new Error(`--source is one of ${[...SOURCES].join(', ')}`);
  }

  // Production gives its model-made recipes and nothing else; the other sources are for
  // testing the format against the local seed.
  if (!options.fromLocal && (options.source !== 'ai' || options.out)) {
    throw new Error('--source and --out are for --from-local only');
  }

  return options;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/** The URL to read from, its host checked before the first query. Neither is printed. */
function target(options) {
  if (options.fromLocal) {
    if (hostOf(LOCAL_DATABASE_URL) !== '127.0.0.1') {
      throw new Error('the local URL is not loopback — refusing');
    }

    return LOCAL_DATABASE_URL;
  }

  const url = readEnv(`${ROOT}packages/database/.env`, 'DATABASE_URL_PRO');
  const host = hostOf(url ?? '');

  if (!host) {
    throw new Error('no readable DATABASE_URL_PRO in packages/database/.env');
  }

  if (host === '127.0.0.1' || host === 'localhost') {
    throw new Error('DATABASE_URL_PRO points at this machine — that is not production; use --from-local');
  }

  return url;
}

/** A SQL literal. Standard-conforming strings: only the quote is doubled. */
function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);

  return `'${String(value).replaceAll("'", "''")}'`;
}

/** A numeric column as postgres.js hands it over (a string), checked to be a plain number. */
function numeric(value) {
  if (!/^-?\d+(\.\d+)?$/.test(String(value))) {
    throw new Error(`not a number: ${value}`);
  }

  return String(value);
}

function textArray(values) {
  return values.length > 0 ? `ARRAY[${values.map(literal).join(',')}]::text[]` : `'{}'::text[]`;
}

const RECIPE_COLUMNS =
  'cook_minutes, created_by, cuisine, description, difficulty, instructions, locale, meal_slots, name, prep_minutes, servings, slug, source, steps_version';

function recipeStatement(recipe, ingredients) {
  const values = [
    literal(recipe.cook_minutes),
    'NULL',
    literal(recipe.cuisine),
    literal(recipe.description),
    literal(recipe.difficulty),
    `${literal(JSON.stringify(recipe.instructions))}::jsonb`,
    literal(recipe.locale),
    textArray(recipe.meal_slots),
    literal(recipe.name),
    literal(recipe.prep_minutes),
    literal(recipe.servings),
    literal(recipe.slug),
    literal(recipe.source),
    literal(recipe.steps_version)
  ].join(', ');
  const insert = `INSERT INTO recipes (${RECIPE_COLUMNS})\n  VALUES (${values})\n  ON CONFLICT (slug) DO NOTHING`;

  if (ingredients.length === 0) {
    return `${insert};`;
  }

  const rows = ingredients
    .map(item => `(${numeric(item.grams)}, ${literal(item.is_optional)}, ${literal(item.note)}, ${numeric(item.quantity)}, ${literal(item.slug)}, ${literal(item.unit)})`)
    .join(', ');

  return [
    `WITH r AS (${insert} RETURNING id)`,
    'INSERT INTO recipe_ingredients (grams, ingredient_id, is_optional, note, quantity, recipe_id, unit)',
    `SELECT v.grams, i.id, v.is_optional::boolean, v.note::text, v.quantity, r.id, v.unit::measurement_unit FROM r, (VALUES ${rows}) AS v(grams, is_optional, note, quantity, slug, unit) JOIN ingredients i ON i.slug = v.slug;`
  ].join('\n');
}

async function readLibrary(url, source) {
  const require = createRequire(join(ROOT, 'packages/database/package.json'));
  const postgres = require('postgres');
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    return await sql.begin('read only', async tx => {
      const [{ transaction_read_only: readOnly }] = await tx`show transaction_read_only`;

      if (readOnly !== 'on') {
        throw new Error('the transaction is not read-only — refusing');
      }

      const recipes = await tx`
        select id, cook_minutes, cuisine, description, difficulty, instructions, locale, meal_slots, name, prep_minutes, servings, slug, source, steps_version
        from recipes where source = ${source} order by slug`;
      const ingredients = await tx`
        select ri.recipe_id, i.slug, ri.grams::text as grams, ri.quantity::text as quantity, ri.unit, ri.is_optional, ri.note
        from recipe_ingredients ri
        join recipes r on r.id = ri.recipe_id
        join ingredients i on i.id = ri.ingredient_id
        where r.source = ${source}
        order by i.slug`;

      return { ingredients, recipes };
    });
  } finally {
    await sql.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const url = target(options);

  console.log(`[export] reading ${options.fromLocal ? 'the local Postgres' : 'production, read-only'}: recipes with source = '${options.source}'`);

  let library;

  try {
    library = await readLibrary(url, options.source);
  } catch (error) {
    // A connection error names the host ("getaddrinfo ENOTFOUND …"); this never prints it.
    throw new Error(String(error.message).replaceAll(hostOf(url), '<host>'));
  }

  const { ingredients, recipes } = library;
  const byRecipe = new Map(recipes.map(recipe => [recipe.id, []]));

  for (const item of ingredients) {
    byRecipe.get(item.recipe_id).push(item);
  }

  const slugs = [...new Set(ingredients.map(item => item.slug))].sort();
  const out = join(ROOT, options.out ?? (options.fromLocal ? LOCAL_OUT : OUT));
  const lines = [
    `-- NutrIA reference library: ${recipes.length} recipes with source '${options.source}', exported ${new Date().toISOString().slice(0, 10)} (decision 0080).`,
    '-- No personal data: recipes and their ingredients, created_by NULL, no user table read.',
    '-- One transaction. A recipe whose slug already exists is skipped, and so are its ingredients.',
    '-- Ingredients are found by catalogue slug; if any is missing, the whole load aborts and nothing is written.',
    'BEGIN;'
  ];

  if (slugs.length > 0) {
    lines.push(
      'DO $$ DECLARE missing text; BEGIN',
      `  SELECT string_agg(s, ', ') INTO missing FROM unnest(${textArray(slugs)}) AS s WHERE s NOT IN (SELECT slug FROM ingredients);`,
      "  IF missing IS NOT NULL THEN RAISE EXCEPTION 'reference load aborted, ingredients not in the catalogue: %', missing; END IF;",
      'END $$;'
    );
  }

  for (const recipe of recipes) {
    lines.push(recipeStatement(recipe, byRecipe.get(recipe.id)));
  }

  lines.push(`SELECT source, count(*) AS recipes FROM recipes GROUP BY source ORDER BY source;`, 'COMMIT;', '');

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join('\n'));

  const withoutIngredients = recipes.filter(recipe => byRecipe.get(recipe.id).length === 0).length;
  const kib = (statSync(out).size / 1024).toFixed(1);

  console.log(`[export] ${recipes.length} recipes, ${ingredients.length} ingredient rows, ${slugs.length} catalogue slugs, ${withoutIngredients} recipes without ingredients`);
  console.log(`[export] wrote ${relative(ROOT, out)} (${kib} KiB)`);
}

main().catch(error => {
  console.error(`[export] ${error.message}`);
  process.exit(1);
});
