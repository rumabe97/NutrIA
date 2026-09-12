-- Hand-written, data only: no table or column changes, so the snapshot drizzle-kit
-- copied for `--custom` still describes the schema exactly.
--
-- Seven seed dishes were filed under both supper and afternoon snack: a quinoa or
-- rice bowl with fish or tofu, prawn skewers with rice, a roast sweet potato with
-- tuna, a chickpea and tuna salad. As a late light meal they fit; as a snack
-- between lunch and dinner they are a plated main, and a real plan served the
-- skewers with rice as somebody's merienda. They stay suppers. Seed rows only, by
-- slug, and only where supper remains, so no dish is left with no meal at all.
UPDATE "recipes"
SET "meal_slots" = array_remove("meal_slots", 'afternoon_snack')
WHERE "source" = 'seed'
  AND 'supper' = ANY ("meal_slots")
  AND "slug" IN (
    'bol-de-pollo-desmenuzado-con-maiz-tomate-y-aguacate',
    'bol-de-quinoa-con-caballa-tomate-y-limon',
    'bol-de-quinoa-con-salmon-ahumado-aguacate-y-eneldo',
    'bol-de-tofu-salteado-con-edamame-arroz-integral-y-jengibre',
    'boniato-asado-con-atun-aguacate-y-lima',
    'brochetas-de-gambas-con-pimiento-arroz-y-limon',
    'ensalada-de-garbanzos-tostados-con-pepino-tomate-y-atun'
  );
