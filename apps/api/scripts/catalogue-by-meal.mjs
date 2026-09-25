#!/usr/bin/env node
/**
 * What does each meal's catalogue become once an ingredient can name its meals
 * (`0062`) — and how much of the dish library can still be served at it?
 *
 * For every slot, and for two people — an omnivore with nothing declared and a
 * vegan — this reports:
 *
 * - the catalogue rows the pool prompt would show them for that slot, before
 *   (every row they may eat, as on prompt 3.4.0) and after (only the rows whose
 *   `meal_slots` is empty or names the slot);
 * - the approximate prompt tokens that catalogue costs: 6 per row, the ratio
 *   measured on 3.4.0 (930 rows, ~5,600 tokens of a lunch request);
 * - the library dishes servable at that slot, before and after a dish is
 *   narrowed to the meals every one of its ingredients belongs to, against
 *   `DISHES_NEEDED_PER_SLOT`;
 * - the ingredients that take the most dishes away from that slot, so a list
 *   that starves a meal is visible by name.
 *
 * The meal rule is `core/domain/MealFit`'s, imported from the build — the same
 * `belongsTo` and `fitSlots` the pool builder and the library's reuse apply, so
 * what this reports and what a generation does cannot drift. Since phase 3 of
 * project 005 `RecipeController.reusablePool` narrows the library itself, so
 * "before" is read from it over the same catalogue with every meal list
 * emptied — the library as it was served on prompt 3.4.0 — and "after" is
 * `fitSlots` over the real one.
 *
 * Before the dev database is re-seeded with the overlays, every list is empty
 * and "after" equals "before": that is the check that the seed has not run.
 *
 * Read-only and model-free, exactly as `evaluate-plans.mjs`: refuses production,
 * makes every read inside one `BEGIN ... READ ONLY` transaction (see that
 * script's "why one transaction" note for the mechanism), never reads
 * `AI_PROVIDER`, and builds its two people from a random id that names no
 * account.
 *
 * Usage (from apps/api, after a build):
 *   node --env-file-if-exists=.env scripts/catalogue-by-meal.mjs [--locale es-ES] [--json out.json]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

import { assertNotProduction } from '../../../.claude/skills/local-probe/scripts/guard.mjs';

import { RecipeController } from 'core/controllers/Recipe';
import { SafetyController } from 'core/controllers/Safety';
import { MEAL_SLOTS } from 'core/entities/Plan';
import { belongsTo, fitSlots } from 'core/domain/MealFit';
import { resolvePreferences } from 'core/domain/Preference';
import { DISHES_NEEDED_PER_SLOT } from 'core/domain/Variety';

/** Prompt tokens per catalogue row, measured on 3.4.0 (PRD § Problem). */
const TOKENS_PER_ROW = 6;

/** How many ingredients to name as the ones taking the most dishes off a slot. */
const TOP_CULPRITS = 5;

const PEOPLE = [
  { dietaryPatterns: [], slug: 'omnivoro' },
  { dietaryPatterns: ['vegan'], slug: 'vegano' }
];

function parseArgs(argv) {
  const options = { json: null, locale: 'es-ES' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--locale') {
      options.locale = argv[(index += 1)];
    } else if (arg === '--json') {
      options.json = argv[(index += 1)];
    } else {
      console.error(`unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  return options;
}

/** The same catalogue with every meal list emptied: every food at every meal, as on 3.4.0. */
function withoutMealLists(catalogue) {
  return new Map([...catalogue].map(([slug, ingredient]) => [slug, { ...ingredient, mealSlots: [] }]));
}

// ---------------------------------------------------------------------------
// Measuring one person
// ---------------------------------------------------------------------------
async function measurePerson(person, base) {
  const ingredients = [...base.catalogue.values()];
  const preferences = resolvePreferences({
    allergenIdsByKey: base.allergenIdsByKey,
    dietaryPatterns: person.dietaryPatterns,
    dislikedLabels: [],
    ingredients,
    maxMinutesPerDish: null
  });
  const context = { ...base, dietaryPatterns: person.dietaryPatterns, preferences };
  // What the pool prompt shows today: every row this person may eat. Nobody has
  // declared an allergy, so the safety filter keeps everything; the way of
  // eating is what removes rows.
  const eatable = ingredients.filter(ingredient => !preferences.excludedIngredientIds.has(ingredient.id));
  // The library before the meal lists: `reusablePool` over a catalogue whose
  // lists are empty narrows nothing, and every other filter reads ids and
  // allergens, which are untouched.
  const pool = await RecipeController.reusablePool(MEAL_SLOTS, { ...context, catalogue: withoutMealLists(base.catalogue) });
  const fitted = pool.map(dish => ({ dish, fit: fitSlots(dish, base.catalogue, person.dietaryPatterns) }));

  const slots = MEAL_SLOTS.map(slot => {
    const rows = eatable.filter(ingredient => belongsTo(ingredient, slot, person.dietaryPatterns));
    const before = fitted.filter(({ dish }) => dish.slots.includes(slot));
    const after = before.filter(({ fit }) => fit.includes(slot));
    const culprits = new Map();

    for (const { dish, fit } of before) {
      if (fit.includes(slot)) {
        continue;
      }

      for (const item of dish.ingredients) {
        const ingredient = base.catalogue.get(item.slug);

        if (ingredient && !belongsTo(ingredient, slot, person.dietaryPatterns)) {
          culprits.set(item.slug, (culprits.get(item.slug) ?? 0) + 1);
        }
      }
    }

    return {
      dishesAfter: after.length,
      dishesBefore: before.length,
      rowsAfter: rows.length,
      rowsBefore: eatable.length,
      shownSlugs: rows.map(ingredient => ingredient.slug).sort(),
      slot,
      tokensAfter: rows.length * TOKENS_PER_ROW,
      tokensBefore: eatable.length * TOKENS_PER_ROW,
      topCulprits: [...culprits]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP_CULPRITS)
        .map(([slug, dishes]) => ({ dishes, slug }))
    };
  });

  return { dishesDropped: fitted.filter(({ fit }) => fit.length === 0).length, librarySize: pool.length, slots, slug: person.slug };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function change(before, after) {
  return before === 0 ? 'n/a' : `${(((after - before) / before) * 100).toFixed(1)}%`;
}

function printPerson(result) {
  console.log(`\n${result.slug} — library ${result.librarySize} dishes, ${result.dishesDropped} left with no meal at all`);
  console.log('  slot              rows before→after   tokens before→after (change)   dishes before→after');

  for (const entry of result.slots) {
    const short = entry.dishesAfter < DISHES_NEEDED_PER_SLOT ? `  SHORT of ${DISHES_NEEDED_PER_SLOT}` : '';

    console.log(
      `  ${entry.slot.padEnd(17)} ${`${entry.rowsBefore}→${entry.rowsAfter}`.padEnd(19)} ${`${entry.tokensBefore}→${entry.tokensAfter} (${change(entry.tokensBefore, entry.tokensAfter)})`.padEnd(30)} ${entry.dishesBefore}→${entry.dishesAfter}${short}`
    );
  }

  for (const entry of result.slots) {
    if (entry.topCulprits.length > 0) {
      console.log(`  ${entry.slot}, dishes lost to: ${entry.topCulprits.map(culprit => `${culprit.slug} (${culprit.dishes})`).join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point — one read-only transaction; see `evaluate-plans.mjs` for why
// swapping the exported `database` makes every repository read run inside it.
// ---------------------------------------------------------------------------
async function main() {
  assertNotProduction();

  const options = parseArgs(process.argv.slice(2));
  const require = createRequire(import.meta.url);
  const databaseModule = require('database');
  const originalDatabase = databaseModule.database;
  const pooled = originalDatabase();

  let results;

  try {
    await pooled.transaction(
      async tx => {
        databaseModule.database = () => tx;

        try {
          const context = await RecipeController.nobodysContext();
          const allergenIdsByKey = new Map((await SafetyController.listAllergens()).map(allergen => [allergen.key, allergen.id]));
          // `reusablePool` reads recipes in `context.locale`; the random id has
          // no profile, so it is set here, as `evaluate-plans.mjs` does.
          const base = { ...context, allergenIdsByKey, locale: options.locale };

          results = [];

          for (const person of PEOPLE) {
            // eslint-disable-next-line no-await-in-loop -- one person at a time inside one transaction.
            results.push(await measurePerson(person, base));
          }
        } finally {
          databaseModule.database = originalDatabase;
        }
      },
      { accessMode: 'read only' }
    );
  } finally {
    await databaseModule.closeDatabase();
  }

  const catalogue = results[0].slots[0].rowsBefore;
  const tagged = results[0].slots.some(entry => entry.rowsAfter !== entry.rowsBefore);

  console.log(
    `Locale: ${options.locale}. Tokens estimated at ${TOKENS_PER_ROW} per catalogue row. Dishes needed per slot: ${DISHES_NEEDED_PER_SLOT}.`
  );

  if (!tagged) {
    console.log(`Every meal list is empty in this database (${catalogue} rows): re-run the seed to load the overlays.`);
  }

  for (const result of results) {
    printPerson(result);
  }

  if (options.json) {
    writeFileSync(
      options.json,
      JSON.stringify({ dishesNeededPerSlot: DISHES_NEEDED_PER_SLOT, locale: options.locale, results, tokensPerRow: TOKENS_PER_ROW }, null, 2)
    );
    console.log(`\nWritten to ${options.json}`);
  }

  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
