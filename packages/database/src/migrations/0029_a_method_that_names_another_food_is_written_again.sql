-- Hand-written, data only: no table or column changes, so the snapshot drizzle-kit
-- copied for `--custom` still describes the schema exactly.
--
-- Read back against the catalogue (`methodMentions`), twenty stored methods in
-- production named a food their dish does not contain: salt in eleven, "lemon if
-- you like" in two, honey, a fish stock, and a few borderline wordings. Their
-- stamp is cleared, so the rewrite sweep writes them again under the rule that
-- the ingredient list is the whole kitchen, and stores only a method that passes
-- the same read-back. By slug, so a database without one of them is untouched.
UPDATE "recipes"
SET "steps_version" = NULL
WHERE "slug" IN (
  'aguacate-relleno-de-gambas-con-lima-y-cilantro',
  'arroz-caldoso-de-congrio-y-almejas',
  'bowl-mediterraneo-de-skyr-con-granola-mango-y-aguacate',
  'fideos-de-arroz-salteados-con-gambas-y-verduras',
  'gachas-de-avena-con-queso-batido-proteina-de-guisante-y-platano',
  'huevo-revuelto-con-pan-de-espelta-y-tomate',
  'huevos-rellenos-de-queso-fresco-de-cabra-pimenton-ahumado-y-tomate',
  'huevos-revueltos-con-aguacate-y-queso-feta-sobre-pan-integral',
  'mini-bocadillo-de-pan-de-pita-con-hummus-huevo-y-pepino',
  'salmon-y-gambas-a-la-plancha-con-patatas-y-calabacin-salteado',
  'tofu-revuelto-con-champinones-espinacas-y-tostada-integral',
  'tortilla-abierta-de-huevo-y-claras-con-patata-y-pimientos-y-brotes-frescos',
  'tortitas-de-avena-y-claras-con-frutos-rojos',
  'tortitas-de-maiz-con-queso-cottage-y-tomate-alinado',
  'tosta-de-centeno-con-requeson-dulce-de-membrillo-y-avellanas',
  'tostada-de-centeno-con-garbanzos-tahini-y-tofu-ahumado',
  'tostadas-integrales-con-revuelto-de-huevo-claras-y-pavo-con-queso-curado',
  'wok-de-arroz-integral-con-pollo-pimiento-y-jengibre',
  'wrap-de-platano-con-crema-de-cacahuete-y-canela',
  'wrap-integral-de-hummus-huevo-duro-y-zanahoria'
);
