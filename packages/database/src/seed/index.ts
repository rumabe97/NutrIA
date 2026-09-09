import { config } from 'dotenv';
import { eq, sql } from 'drizzle-orm';

import { closeDatabase, database } from '../client';
import { allergens } from '../schemas/safety.schema';
import { ingredientAllergens, ingredientNames, ingredients, ingredientSubstitutions } from '../schemas/food.schema';

import { ALLERGEN_SEED } from './allergens';
import { INGREDIENT_NAMES_EN_GB } from './ingredient-names';
import { INGREDIENT_SEED } from './ingredients';
import { foodClasses } from './ingredients/classes';
import { substitutionPairs } from './substitutions';

config({ path: '.env' });

/**
 * Idempotent reference-data seed: allergens and the starter ingredient
 * catalogue. Safe to re-run — every write upserts on the natural key.
 *
 * This is **reference** data, not demo data. Allergy validation compares
 * against these rows in production, so an empty `allergens` table means the
 * safety layer has nothing to enforce. It is not optional.
 */
async function main(): Promise<void> {
  const db = database();

  const allergenRows = await db
    .insert(allergens)
    .values(ALLERGEN_SEED.map(a => ({ isEuMandatory: a.isEuMandatory, key: a.key, labelEs: a.labelEs })))
    .onConflictDoUpdate({ set: { labelEs: sql`excluded.label_es` }, target: allergens.key })
    .returning({ id: allergens.id, key: allergens.key });

  const allergenIdByKey = new Map(allergenRows.map(row => [row.key, row.id]));
  console.log(`[seed] allergens: ${allergenRows.length}`);

  let ingredientCount = 0;
  let linkCount = 0;
  let nameCount = 0;
  const idBySlug = new Map<string, string>();

  for (const seed of INGREDIENT_SEED) {
    const [row] = await db
      .insert(ingredients)
      .values({
        carbsPer100g: String(seed.carbs),
        category: seed.category,
        classes: [...foodClasses(seed)].sort(),
        defaultUnit: seed.defaultUnit ?? 'g',
        fatPer100g: String(seed.fat),
        fiberPer100g: String(seed.fiber ?? 0),
        gramsPerUnit: seed.gramsPerUnit === undefined ? null : String(seed.gramsPerUnit),
        kcalPer100g: String(seed.kcal),
        proteinPer100g: String(seed.protein),
        slug: seed.slug,
        source: seed.source ?? 'manual'
      })
      .onConflictDoUpdate({
        set: {
          carbsPer100g: sql`excluded.carbs_per100g`,
          classes: sql`excluded.classes`,
          fatPer100g: sql`excluded.fat_per100g`,
          fiberPer100g: sql`excluded.fiber_per100g`,
          kcalPer100g: sql`excluded.kcal_per100g`,
          proteinPer100g: sql`excluded.protein_per100g`
        },
        target: ingredients.slug
      })
      .returning({ id: ingredients.id });

    if (!row) {continue;}

    ingredientCount += 1;
    idBySlug.set(seed.slug, row.id);

    // Upserted per locale rather than deleted and reinserted: a name is what the
    // shopping list of an existing plan was built from, and a moment with no row
    // is a moment a lookup falls back to the wrong language.
    const english = INGREDIENT_NAMES_EN_GB[seed.slug];

    if (english === undefined) {throw new Error(`No en-GB name for ingredient "${seed.slug}"`);}

    await db
      .insert(ingredientNames)
      .values([
        { ingredientId: row.id, locale: 'es-ES', name: seed.name },
        { ingredientId: row.id, locale: 'en-GB', name: english }
      ])
      .onConflictDoUpdate({ set: { name: sql`excluded.name` }, target: [ingredientNames.ingredientId, ingredientNames.locale] });

    nameCount += 2;

    // Rewritten wholesale rather than merged: the seed file is the source of
    // truth for which allergens an ingredient carries, and a stale link here is
    // a safety bug, not a cosmetic one.
    await db.delete(ingredientAllergens).where(eq(ingredientAllergens.ingredientId, row.id));

    for (const link of seed.allergens ?? []) {
      const allergenId = allergenIdByKey.get(link.key);

      if (!allergenId) {throw new Error(`Unknown allergen key "${link.key}" on ingredient "${seed.slug}"`);}

      await db.insert(ingredientAllergens).values({ allergenId, ingredientId: row.id, presence: link.presence ?? 'contains' });
      linkCount += 1;
    }
  }

  console.log(`[seed] ingredients: ${ingredientCount}, names: ${nameCount}, allergen links: ${linkCount}`);

  // Rewritten wholesale, in one transaction: nothing references a pair, the seed
  // file is the source of truth for which swaps exist, and a half-written table
  // would offer some dishes their alternatives and others none.
  const pairs = substitutionPairs().map(pair => {
    const ingredientId = idBySlug.get(pair.ingredient);
    const substituteId = idBySlug.get(pair.substitute);

    if (!ingredientId || !substituteId) {throw new Error(`Substitution names an unseeded ingredient: "${pair.ingredient}" → "${pair.substitute}"`);}

    return { ingredientId, ratio: String(pair.ratio), substituteId };
  });

  await db.transaction(async tx => {
    await tx.delete(ingredientSubstitutions);
    await tx.insert(ingredientSubstitutions).values(pairs);
  });

  console.log(`[seed] substitutions: ${pairs.length}`);
}

main()
  .then(() => closeDatabase())
  .catch(async (error: unknown) => {
    console.error('[seed] failed:', error);
    await closeDatabase();
    process.exitCode = 1;
  });
