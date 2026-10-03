-- Hand-written, data only (`--custom`): no table or column changes, so the
-- snapshot drizzle-kit copied still describes the schema exactly.
--
-- The broths declare celery (project 018 phase 2, architect report 0009
-- condition 6; lead's review, 2026-10-03). The catalogue's carton broths
-- carried no celery link, while a Spanish carton broth almost always lists it
-- and their sibling rows (`pastilla-de-caldo-de-verduras`,
-- `sopa-de-verduras-envasada`) already carry it as traces. A dish with one of
-- them reached a person allergic to celery with nothing to stop it. The
-- cautious reading wins on allergens: `contains`, a hard exclusion.
--
-- Four rows, the same as the seed (`seed/ingredients/starter.ts`, `pantry.ts`):
-- caldo-de-pollo, caldo-de-verduras, caldo-de-carne and caldo-de-pescado.
-- `caldo-dashi` (kombu and bonito) is left out; the rows that already carry
-- celery as `may_contain` keep it (project 018 LOG, phase 2).
--
-- Keyed by slug and allergen key, never by id: ids differ between databases.
-- Idempotent: the link's primary key is (ingredient, allergen), and a link
-- already there, whatever its presence, is left as it is. A slug a database
-- lacks inserts nothing. Celery derives no food class (`foodClasses`), so
-- `ingredients.classes` needs no update.
--
-- The previous API, still running during the deploy, reads these links on
-- every safety check, so it enforces them from the moment this commits.
--
-- The seed writes an ingredient's links wholesale (`seed/index.ts`), so the
-- seed change and this migration land and revert together, never one without
-- the other: a revert of the seed alone, then a seed run, deletes these links.
--
-- The check after the insert fails the migrate run (one transaction: nothing
-- of it commits, the build fails, the old API keeps serving) when a populated
-- catalogue still lacks one of the four links as `contains`: a slug renamed, no
-- `celery` key, or a link already there as `may_contain`, which DO NOTHING
-- leaves alone. An empty catalogue (a fresh database, CI) passes.
INSERT INTO "ingredient_allergens" ("ingredient_id", "allergen_id", "presence")
SELECT "ingredients"."id", "allergens"."id", 'contains'
FROM "ingredients"
CROSS JOIN "allergens"
WHERE "allergens"."key" = 'celery'
  AND "ingredients"."slug" IN ('caldo-de-pollo', 'caldo-de-verduras', 'caldo-de-carne', 'caldo-de-pescado')
ON CONFLICT ("ingredient_id", "allergen_id") DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ingredients") AND (
    SELECT count(*) FROM "ingredient_allergens"
    JOIN "ingredients" ON "ingredients"."id" = "ingredient_allergens"."ingredient_id"
    JOIN "allergens" ON "allergens"."id" = "ingredient_allergens"."allergen_id"
    WHERE "allergens"."key" = 'celery' AND "ingredient_allergens"."presence" = 'contains'
      AND "ingredients"."slug" IN ('caldo-de-pollo', 'caldo-de-verduras', 'caldo-de-carne', 'caldo-de-pescado')
  ) <> 4 THEN
    RAISE EXCEPTION 'broths_declare_celery: the four carton broths do not all contain celery';
  END IF;
END $$;
