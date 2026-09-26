#!/usr/bin/env node
/**
 * Cleans up the method of recipes **already stored**, with the same
 * deterministic rules a newly generated dish now gets in `PoolBuilder`
 * (`core/domain/Method/StepCleanup.ts`, PR #118): a backtick stripped, a bare
 * English `minutes` after a number turned into the locale's own word, a
 * catalogue slug left in the prose read back as the ingredient's display
 * name, `minutes` filled from the one duration a step states, an English cue
 * dropped in a non-English request.
 *
 * That guarantee runs on every dish a generation writes from here on; it
 * never ran on what was already in the library — recipes generated (or
 * seeded) before it existed, whatever `source`. This applies it once, to
 * every recipe, regardless of `source` or `stepsVersion`: the bug it cleans
 * up was never scoped to "written by an old prompt", so this read is not
 * either — that scoping is `RecipeRewriter`'s (an AI rewrite of a *stale*
 * method); this is a deterministic text fix over *every* stored one.
 *
 * **Touches only `instructions`.** Not `stepsVersion` — that column answers
 * "which prompt wrote this method", and a deterministic clean-up is not a
 * rewrite by a prompt. Not ingredients, not names, not grams: nothing a past
 * plan already computed from this recipe.
 *
 * A recipe `cleanSteps` would reject outright — its *text* itself reads as
 * English in a non-English request — is never edited or deleted here: it is
 * listed, for the owner to look at and decide by hand.
 *
 * Default is a dry run: it prints counts (recipes scanned, recipes that
 * would change, steps changed by kind — backtick, a placeholder word, a
 * slug read back as its name, minutes filled, an English cue dropped) and a
 * few before/after examples. It never prints a connection string.
 *
 * `--yes` writes the cleaned `instructions` back, in batches of `--batch`
 * recipes (default 200), each batch its own transaction — a crash partway
 * through leaves whole batches done, not a recipe half-written. Idempotent: a
 * second run, dry or not, finds nothing left to change.
 *
 * Refuses to write against production unless it can prove this is not
 * production (`assertNotProduction`, `.claude/skills/local-probe/scripts/guard.mjs`
 * — the same guard `evaluate-plans.mjs` and `catalogue-by-meal.mjs` use) or
 * the owner passes `--i-know-this-is-production` alongside `--yes`. A dry run
 * is checked too, so a run against a wrongly-configured `.env` fails loudly
 * before anything is written, but never refuses to *read* on the "cannot
 * prove" branch — only a write does.
 *
 * Usage (from apps/api, after `pnpm --filter core build` and `pnpm --filter database build`):
 *   node --env-file-if-exists=.env scripts/clean-stored-steps.mjs [--yes] [--batch 200] [--json out.json] [--i-know-this-is-production]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { RecipeController } from 'core/controllers/Recipe';
import { cleanSteps, stepChangeKinds } from 'core/domain/Method';

/** How many recipes one write transaction covers. */
const DEFAULT_BATCH = 200;

/** How many before/after examples to print. */
const EXAMPLES_TO_SHOW = 5;

const KIND_LABELS = {
  backtick: 'backtick',
  englishCueDropped: 'English cue dropped',
  minutesFilled: 'minutes filled',
  placeholderWord: 'placeholder word',
  slugToName: 'slug → name'
};

function parseArgs(argv) {
  const options = { batch: DEFAULT_BATCH, iKnowThisIsProduction: false, json: null, yes: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--yes') {
      options.yes = true;
    } else if (arg === '--i-know-this-is-production') {
      options.iKnowThisIsProduction = true;
    } else if (arg === '--batch') {
      options.batch = Number(argv[(index += 1)]);
    } else if (arg === '--json') {
      options.json = argv[(index += 1)];
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  if (!Number.isInteger(options.batch) || options.batch < 1) {
    console.error('--batch takes a positive integer');
    process.exit(2);
  }

  return options;
}

/**
 * The production guard, applied the way its own module intends: a dry run is
 * checked loosely (refuses only when this is provably production), a write
 * is checked strictly (refuses also when it cannot tell) unless the owner
 * says so explicitly.
 */
function guard(options) {
  if (options.yes && !options.iKnowThisIsProduction) {
    console.log(`[clean-stored-steps] ${assertNotProduction({ strict: true })}`);
  } else {
    console.log(`[clean-stored-steps] ${assertNotProduction()}`);
  }
}

/** One recipe's plan: its cleaned steps when something would change, or why it is left alone. */
function planRecipe(recipe, names) {
  const options = { ingredientNames: names, locale: recipe.locale };
  const cleaned = cleanSteps(recipe.instructions, options);

  if (cleaned === null) {
    return { kind: 'rejected' };
  }

  const kindsPerStep = recipe.instructions.map(step => stepChangeKinds(step, options));
  const kinds = kindsPerStep.flat();

  if (kinds.length === 0) {
    return { kind: 'unchanged' };
  }

  return { changedStepIndexes: kindsPerStep.map((k, i) => (k.length > 0 ? i : -1)).filter(i => i >= 0), cleaned, kind: 'changed', kinds };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  guard(options);

  const require = createRequire(import.meta.url);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();

  let recipes;
  const namesByLocale = new Map();

  // One read-only transaction for the whole read: the catalogue a locale's
  // recipes are read against must be the one they were actually read beside,
  // not one a concurrent write moved on between two separate queries.
  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          recipes = await RecipeController.allStepsForCleanup();

          const locales = new Set(recipes.map(recipe => recipe.locale));

          for (const locale of locales) {
            // eslint-disable-next-line no-await-in-loop -- one locale's catalogue at a time inside one transaction.
            namesByLocale.set(locale, await RecipeController.catalogueNames(locale));
          }
        } finally {
          databaseModule.database = originalDatabase;
        }
      },
      { accessMode: 'read only' }
    );

    const summary = {
      examples: [],
      kinds: Object.fromEntries(Object.keys(KIND_LABELS).map(kind => [kind, 0])),
      recipesChanged: 0,
      recipesRejected: [],
      recipesScanned: recipes.length,
      stepsChanged: 0,
      toWrite: []
    };

    for (const recipe of recipes) {
      // Only this dish's own ingredients, read against the current catalogue —
      // never the whole catalogue as the map (see `RecipeRepository.listForStepCleanup`
      // for the corrupted-recipe example that rules that out).
      const catalogue = namesByLocale.get(recipe.locale) ?? new Map();
      const names = new Map(recipe.ingredientSlugs.map(slug => [slug, catalogue.get(slug) ?? slug]));
      const plan = planRecipe(recipe, names);

      if (plan.kind === 'rejected') {
        summary.recipesRejected.push({ id: recipe.id, name: recipe.name });
        continue;
      }

      if (plan.kind === 'unchanged') {
        continue;
      }

      summary.recipesChanged += 1;
      summary.stepsChanged += plan.changedStepIndexes.length;

      for (const changeKind of plan.kinds) {
        summary.kinds[changeKind] += 1;
      }

      summary.toWrite.push({ id: recipe.id, steps: plan.cleaned });

      if (summary.examples.length < EXAMPLES_TO_SHOW) {
        const index = plan.changedStepIndexes[0];

        summary.examples.push({ after: plan.cleaned[index], before: recipe.instructions[index], name: recipe.name });
      }
    }

    console.log(`Recipes scanned: ${summary.recipesScanned}`);
    console.log(`Recipes that would change: ${summary.recipesChanged} (${summary.stepsChanged} steps)`);
    console.log('By kind:');

    for (const [kind, label] of Object.entries(KIND_LABELS)) {
      console.log(`  ${label}: ${summary.kinds[kind]}`);
    }

    if (summary.recipesRejected.length > 0) {
      console.log(`\nEnglish method, left for the owner to decide (${summary.recipesRejected.length}):`);

      for (const recipe of summary.recipesRejected) {
        console.log(`  ${recipe.id}  ${recipe.name}`);
      }
    }

    if (summary.examples.length > 0) {
      console.log('\nBefore / after:');

      for (const example of summary.examples) {
        console.log(`  ${example.name}`);
        console.log(`    before: ${example.before.text}`);
        console.log(`    after:  ${example.after.text}`);
      }
    }

    if (options.json) {
      writeFileSync(
        options.json,
        JSON.stringify(
          {
            examples: summary.examples,
            kinds: summary.kinds,
            recipesChanged: summary.recipesChanged,
            recipesRejected: summary.recipesRejected,
            recipesScanned: summary.recipesScanned,
            stepsChanged: summary.stepsChanged
          },
          null,
          2
        )
      );
      console.log(`\nWritten to ${options.json}`);
    }

    if (!options.yes) {
      console.log(`\nDry run only. Pass --yes to write ${summary.toWrite.length} recipe(s) back.`);

      return;
    }

    let written = 0;

    for (let start = 0; start < summary.toWrite.length; start += options.batch) {
      const batch = summary.toWrite.slice(start, start + options.batch);

      // eslint-disable-next-line no-await-in-loop -- batches are written one after another on purpose.
      await pooled.transaction(async tx => {
        databaseModule.database = () => tx;

        try {
          for (const change of batch) {
            // eslint-disable-next-line no-await-in-loop -- one transaction per batch, its writes in order.
            await RecipeController.setCleanedSteps(change.id, change.steps);
          }
        } finally {
          databaseModule.database = originalDatabase;
        }
      });

      written += batch.length;
      console.log(`Wrote ${written}/${summary.toWrite.length}`);
    }

    console.log(`\nDone. ${written} recipe(s) written.`);
  } finally {
    await databaseModule.closeDatabase();
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
