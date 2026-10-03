-- Hand-written, data only (`--custom`): no table or column changes, so the
-- snapshot drizzle-kit copied still describes the schema exactly.
--
-- A lunch or a dinner is one plate for one person (project 016 phase 6,
-- prompt 4.6.0, architect report 0008 § B; owner, 2026-10-02: yes to the
-- split). The plan now sets bread, fruit or a salad beside a main dish, so
-- SERVING_KCAL_CAP for lunch and dinner came down from 900 to 650 kcal, and
-- the `oversized` bound with it, from 1,350 to 975 (core/domain/Serving). The
-- library held dishes between the two bounds that the new pool builder would
-- refuse and the console counts as "should be zero".
--
-- This is migration 0047 again at the new caps (docs/decisions/0070): each
-- library recipe whose one serving is past 1.5 x its meals' cap
-- (SERVING_KCAL_CAP: 650 kcal lunch and dinner, 700 breakfast, 400 each snack
-- and supper; a dish served at several meals takes the largest) is split into
-- k = ceil(kcal per serving / cap) servings: the grams stay as they are and
-- `recipes.servings` is multiplied by k, so one serving becomes a plate at or
-- under the cap. Model-made and seed recipes both: since 4.6.0 the seed's
-- own 900–1,000 kcal lunches are past the bound too, and its load file inserts
-- ON CONFLICT DO NOTHING, so loading it again never undoes a split. A person's
-- own (`user`) recipes are not touched.
--
-- Every meal already planned with one of them has its `meals.servings`
-- multiplied by the same k, in the same statement. Every view scales a meal's
-- amounts by meal.servings / recipe.servings, so each meal keeps exactly the
-- grams, the shopping list and the stored kcal and macros it had: no plan
-- changes under anyone. What a person sees change is the number of servings
-- on the meal's page, now counted in plates of the recipe's new size, as 0047
-- accepted.
--
-- What sits beside a meal (`meal_accompaniments`, 0055) snapshots the meal's
-- recipe and servings, and the reads keep a row only while both still equal
-- the meal's. Every row set beside one of these recipes has its `servings`
-- multiplied by the same k as the meals: s x k = m x k exactly when s = m, so
-- a row that matched its meal still does and a stale one stays stale (never
-- brought back by its meal's new count). Its grams, kcal and macros are its
-- own, untouched.
--
-- Bounds. A recipe is skipped — left as it is — if its split would take any of
-- its meals past 4 servings (SERVING_BOUNDS.max, the most the scheduler ever
-- plans) or the recipe past 8 servings (what candidateDishSchema and the pool
-- schema allow).
--
-- The per-serving energy below is the one sum this repository computes outside
-- core/domain/Composition, allowed here as in 0047: grams x kcal per 100 g /
-- 100 over the ingredients that are not optional, divided by the recipe's
-- servings. It was run read-only on dev beside `isOversized` /
-- `composePerServing` over every recipe and selected exactly the same recipes.
-- On the dev database (read-only dry run, 2026-10-02): 41 recipes (40 ai,
-- 1 seed), k = 2 for 40 and 3 for 1, none skipped; 146 meals, the largest
-- 1.75 servings before and 3.5 after; 12 accompaniment rows, all matching
-- their meal. Before it runs on production, keep a read-only capture of the
-- repair set (recipes, k, skipped, meal ids and servings), as 0047 did.
--
-- A recipe with zero servings gives a null energy and is left out (NULLIF), so
-- one bad row cannot fail the migration and with it the production build.
--
-- Two windows it cannot close, accepted with the owner's lead:
-- - A generation or a swap already running on the previous API may read one
--   of these recipes before this commits and write its meal after, counted at
--   the old servings; that meal shows its amounts divided by k until the plan
--   is regenerated. Merge when `plan_generation_jobs` has nothing running.
-- - The seed's load file (docs/local, run by the owner) holds the one seed
--   lunch past the bound unsplit. Load it before this migration runs, or run
--   this statement again after loading it: it is idempotent.
--
-- One statement, one snapshot: the sides, the meals and their recipes move
-- together, every CTE reading the rows as they were before it, and running it
-- again selects nothing new (every repaired serving is under its cap, and a
-- skipped recipe is skipped again).
WITH "per_serving" AS (
  SELECT
    r."id",
    r."servings",
    SUM(ri."grams" * i."kcal_per100g" / 100) / NULLIF(r."servings", 0) AS "kcal",
    (
      SELECT MAX(
        CASE s
          WHEN 'lunch' THEN 650
          WHEN 'dinner' THEN 650
          WHEN 'breakfast' THEN 700
          WHEN 'morning_snack' THEN 400
          WHEN 'afternoon_snack' THEN 400
          WHEN 'supper' THEN 400
        END
      )
      FROM unnest(r."meal_slots") AS s
    ) AS "cap"
  FROM "recipes" r
  JOIN "recipe_ingredients" ri ON ri."recipe_id" = r."id" AND NOT ri."is_optional"
  JOIN "ingredients" i ON i."id" = ri."ingredient_id"
  WHERE r."source" IN ('ai', 'seed')
  GROUP BY r."id"
),
"oversized" AS (
  SELECT p."id", p."servings", CEIL(p."kcal" / p."cap")::int AS "k"
  FROM "per_serving" p
  WHERE p."cap" IS NOT NULL AND p."kcal" > p."cap" * 1.5
),
"repair" AS (
  SELECT o."id", o."k"
  FROM "oversized" o
  WHERE o."servings" * o."k" <= 8
    AND NOT EXISTS (SELECT 1 FROM "meals" m WHERE m."recipe_id" = o."id" AND m."servings" * o."k" > 4)
),
"repaired_sides" AS (
  UPDATE "meal_accompaniments" ma
  SET "servings" = ma."servings" * rp."k"
  FROM "repair" rp
  WHERE ma."recipe_id" = rp."id"
  RETURNING ma."id"
),
"repaired_meals" AS (
  UPDATE "meals" m
  SET "servings" = m."servings" * rp."k"
  FROM "repair" rp
  WHERE m."recipe_id" = rp."id"
  RETURNING m."id"
)
UPDATE "recipes" r
SET "servings" = r."servings" * rp."k"
FROM "repair" rp
WHERE r."id" = rp."id";
