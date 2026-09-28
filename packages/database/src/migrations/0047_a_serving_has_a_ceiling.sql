-- Hand-written, data only (`--custom`): no table or column changes, so the
-- snapshot drizzle-kit copied still describes the schema exactly.
--
-- A serving has a ceiling (docs/decisions/0070, amending 0047; owner,
-- 2026-09-29: "hacer las correcciones en el prompt y en los datos
-- existentes"). Until prompt 4.5.0 each dish was briefed per serving at the
-- person's whole share of the day, with no cap, and the model delivered a 3,700
-- kcal person's lunch as one 1-2 kg plate declared `servings = 1`: 350 g of dry
-- rice and 55 g of oil, 2,594 kcal "for one". Those dishes sit in the library
-- every other person is served from.
--
-- This repairs the dishes the new pool builder would refuse (`oversized`,
-- core/domain/Serving): model-made recipes whose one serving is past 1.5 x
-- its meals' cap (SERVING_KCAL_CAP: 900 kcal lunch and dinner, 700 breakfast,
-- 400 each snack and supper; a dish served at several meals takes the largest).
-- Each is split into k = ceil(kcal per serving / cap) servings: the grams stay
-- as they are and `recipes.servings` is multiplied by k, so one serving becomes
-- a plate under the cap. Seed and user recipes are not touched.
--
-- Every meal already planned with one of them has its `meals.servings`
-- multiplied by the same k, in the same statement. Every view scales a meal's
-- amounts by meal.servings / recipe.servings (PlanController presentMeal,
-- composition, loadMealDetail), so each meal keeps exactly the grams, the
-- shopping list and the stored kcal and macros it had: no active plan changes
-- under anyone. What a person does see change is the number of servings on the
-- meal's page — "3,75 raciones" where it said "1,25" — because it is now
-- counted in plates of the recipe's new size. Accepted by the owner's lead on
-- 2026-09-29: it is the truth about the plate.
--
-- Bounds. A recipe is skipped — left as it is — if its split would take any of
-- its meals past 4 servings (SERVING_BOUNDS.max, the most the scheduler ever
-- plans) or the recipe past 8 servings (what candidateDishSchema and the pool
-- schema allow). On the dev database none is skipped: 65 recipes, k = 2 for
-- 27 and 3 for 38, 193 meals, the largest meal 3.75 servings.
--
-- The per-serving energy below is the one sum this repository computes outside
-- core/domain/Composition, allowed here once: grams x kcal per 100 g / 100 over
-- the ingredients that are not optional (as the library is read,
-- RecipeRepository), divided by the recipe's servings. Before it was written
-- it was run read-only on dev beside `isOversized` / `composePerServing` over
-- every recipe, and selected exactly the same recipes with the same k.
--
-- A recipe with zero servings gives a null energy and is left out (NULLIF), so one bad
-- row cannot fail the migration and with it the production build.
--
-- One statement, one snapshot: the meals and their recipes move together, and
-- running it again selects nothing (every repaired serving is under its cap).
WITH "per_serving" AS (
  SELECT
    r."id",
    r."servings",
    SUM(ri."grams" * i."kcal_per100g" / 100) / NULLIF(r."servings", 0) AS "kcal",
    (
      SELECT MAX(
        CASE s
          WHEN 'lunch' THEN 900
          WHEN 'dinner' THEN 900
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
  WHERE r."source" = 'ai'
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
