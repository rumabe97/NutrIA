-- Every dish already in the library says what it needs, read from the prose of
-- its own steps (`0102`, project 021 phase 2).
--
-- reviewed-destructive: it rewrites `recipes.equipment` on every row that still
-- holds the empty default, and nothing else — no column is dropped, no row is
-- deleted, no other column is touched. What it overwrites is the value `0066`
-- gave every row (`'{}'`), so the data it destroys is one release old and
-- carries no information. It cannot fail on the rows already there: the
-- statement reads `instructions`, which is `NOT NULL DEFAULT '[]'`, writes only
-- strings from the catalogue, and falls back to `stovetop` when no pattern
-- matches, so no row can come out empty or invalid. `WHERE equipment = '{}'`
-- means a dish that already declares something — one the model wrote itself from
-- phase 3 on — is never overwritten, and running this twice changes nothing the
-- second time. **The same guard means this file can never correct a row it got
-- wrong**: a correction needs its own migration with its own `WHERE`.
--
-- **This file must not reach production in the same deploy as `0066`**, and
-- nothing in the file can make that true — only the merge order can. Drizzle
-- wraps every pending migration in one transaction, so if both are pending at
-- once this `UPDATE` runs inside the `ACCESS EXCLUSIVE` that `0066`'s `ADD
-- COLUMN` takes on `recipes`, and every library read, plan screen, meal detail
-- and picture sweep queues behind it — the case `AGENTS.md` § Migrations and
-- `0061` exist to prevent. So: `0066` merges on its own, its production
-- deployment reaches `Ready`, and only then does this one merge, with its `when`
-- re-stamped at that merge (a `when` at or before the last applied migration is
-- **skipped in silence**, which would leave every production row `'{}'` with
-- nothing failing anywhere). Nothing is lost or corrupted if they do land
-- together — DDL is transactional in Postgres, so the `UPDATE` sees the column —
-- it is readers waiting that is being avoided, about 200 ms of it at this size.
--
-- **What the column means, and the one rule this inference follows.** It holds
-- the appliances a dish **cannot be cooked without**. So an appliance named
-- beside an alternative — *"caliéntalo al vapor o en el microondas"*, *"en el
-- horno o la freidora de aire"*, *"(en olla rápida)"* — is **not** a
-- requirement: that dish can be made with what everybody has, and declaring the
-- appliance would take it from somebody who could have eaten it. Each appliance
-- below therefore has two patterns: what names it, and what shows it being
-- offered as a choice.
--
-- Measured on the development library of 1128 dishes, which is 871 of
-- production's 962 rows by slug (the 500 seeded dishes and the 371 of
-- `reference-ai-recipes.sql`, exported from production on 2026-10-02):
-- **58 dishes need an oven, 20 a blender, 3 a microwave, and nothing needs
-- anything else** — not one requires an air fryer, a pressure cooker, a grill, a
-- steamer, a slow cooker or a rice cooker. 1085 declare a hob; 1091 dishes
-- declare one appliance and 37 declare two; no row comes out empty and no key
-- falls outside the catalogue. The oven's word patterns name 59 dishes and the
-- alternative drops 2 of them, and only 2 dishes in the library name both an oven
-- and a microwave at all — so the gap between 59 and 58 is the alternative, and
-- the `asar` branch below puts one dish back. 17 of the microwave's 20 mentions
-- are alternatives; the library's single air-fryer mention is *"Precalienta el
-- horno **o** la freidora de aire"*, and its single pressure-cooker mention is
-- *"cuece en agua con sal durante 20 minutos **(en olla rápida)**"*.
--
-- **The patterns.** Spanish and English, accented and not, matched against
-- `lower(instructions::text)` — the steps' own prose, `cue` and `text` both.
-- Written out here because a pattern list nobody can read is an inference nobody
-- can audit, and kept word for word in step with the statement below:
--
--   oven             horno · hornea(r) · horneado · gratina(r) · función grill ·
--                    bajo el grill · al grill · oven · bake(d) · baking ·
--                    preheat the oven — and a verb form of `asar` within 120
--                    characters of a tray or an oven temperature (see below)
--   microwave        microondas · microwave
--   air fryer        freidora de aire · freidora sin aceite · air fry
--   pressure cooker  olla a presión · olla rápida · olla exprés · pressure cook ·
--                    instant pot
--   blender          batidora · licuadora · robot de cocina ·
--                    procesador de alimentos · thermomix · blender ·
--                    food processor
--   steamer          vaporera · cestillo · estuche de vapor · steamer
--   slow cooker      olla lenta · cocción lenta · slow cook · crock pot
--   rice cooker      arrocera · rice cooker
--   grill            barbacoa · barbecue · parrilla de carbón · parrilla de gas ·
--                    grill de carbón
--   stovetop         sartén · cazo · cazuela · olla · puchero · hervir · hierve ·
--                    hirviendo · cocer · cuece · cuécel(a/o) · cuécal(a/o) ·
--                    saltea(r) · sofríe · sofrito · pochar · plancha · freír ·
--                    fríe · frie · frito · frita · fuego medio/alto/bajo/fuerte ·
--                    skillet · saucepan · frying pan · boil · sauté · simmer · wok
--
-- Each appliance's "offered as a choice" pattern covers **every** synonym above
-- and not only the first, which is not a detail: `cuece las lentejas en olla
-- rápida o en una cazuela normal` would otherwise have claimed a pressure
-- cooker, and `en freidora sin aceite o en el horno` an air fryer — and both of
-- those are `missing` in the default kitchen, so the dish would have vanished for
-- every account that never opened the screen (`migration-reviewer`, 2026-10-16).
--
-- Three of the lists are deliberately narrower than the words they could have
-- matched, and each narrowing is argued from the text that prompted it:
--
-- - **A participle of `asar` is an ingredient, not an instruction.** 38 dishes
--   use the family; the participles are *pimientos asados de conserva*, *piña
--   asada*, *manzana asada* — a food that arrives already roasted. **The verb
--   forms are instructions**, though, and three of them name no vessel but a tray
--   or a temperature (*"ásalos en bandeja a 210 grados 18 minutos"*), so the oven
--   branch above reads a verb form within 120 characters of `bandeja` or of 150 to
--   299 degrees. The range is load-bearing: a bare `grados` would have caught the
--   21 dishes whose cue is *"75 °C en la parte más gruesa"*, which is a
--   thermometer in a piece of meat. **Two verb-form dishes are deliberately left
--   as a hob** — *"Asar la coliflor y la zanahoria troceadas con un chorrito de
--   aceite durante 12 minutos"* and the same shape at 20 minutes — because they
--   name no vessel and no temperature, and 12 minutes is a pan's timing more than
--   a roast's. Claiming an oven there would be a guess that removes the dish from
--   every oven-less kitchen, which is the direction `0102` tells this inference
--   not to err in. It is where the boundary of what prose can say honestly sits.
-- - **`plancha` is a stovetop word, not a grill.** It is what the PRD's own
--   reading counted it as, and it is what a home cook does in a pan. The
--   catalogue's *grill or griddle* is a barbecue or a charcoal grill, so only
--   those words claim it.
-- - **`grill` and `parrilla` claim nothing on their own.** Every one of the five
--   dishes naming them means either the oven's grill function (*"calienta el
--   horno al máximo con la función grill"*, *"gratinar bajo el grill"*) or an
--   alternative to a pan (*"una parrilla o plancha estriada"*, *"otra sartén o
--   parrilla"*). None requires a grill. The oven's grill function is read as an
--   oven, which is what it is.
--
-- Likewise **steaming is not a steamer**: *"cuece el brócoli al vapor o en agua
-- hirviendo"* and *"cuécelas al vapor en otra cazuela"* are a pot, so only a
-- named steaming device (`vaporera`, `cestillo`) counts. One dish in 1128 names
-- one.
--
-- **The error rate is not zero in either direction**, and the honest version of
-- that is a number: the first reading made four microwave claims and one was wrong until the
-- alternative pattern grew a window — *"deja atemperar los frutos rojos
-- congelados a temperatura ambiente **o** dales un golpe muy breve de
-- microondas"*. The window (`o` within 45 characters of the appliance, inside one
-- JSON string) is also why an alternative in a *different* step can no longer be
-- read as this step's.
--
-- **The English half of the list has never matched a row**, and a reader should
-- know it: the library holds 44 `en-GB` dishes, and their steps are written in
-- Spanish — the locale column is ahead of the prose. The English patterns are
-- there for the dishes the model will write in English, untested against real
-- rows until then.
--
-- **A text[] cannot say "either".** Two dishes offer a choice of two appliances
-- and nothing else — *"precalienta el horno o la freidora de aire"*, *"ásala en el
-- horno o al microondas"* — so they declare neither and are offered to a kitchen
-- that has neither, which is the lesser of the two available errors (`0102`'s
-- asymmetry: treating the unknown as "needs everything" empties the library).
-- Phase 3 inherits the same limit the moment `generatedDishSchema` gains
-- `equipment`: the model will be asked for a list of requirements and has no way
-- to say "one of these".
--
-- **A dish that matches nothing is stovetop** (`0102`), which is 240 of 1128 —
-- and the measurement says plainly what they are: bagels, avocado with cheese,
-- carrot sticks with hummus, tinned tuna with cucumber. **They are no-cook
-- dishes, not unclassifiable pan dishes**, which is not the premise `0102` wrote
-- the fallback on ("treated as a pan, which is what 824 of 1128 are" — the pan
-- dishes turn out to match pan words by themselves, 845 of them). The plan's
-- contract is followed here rather than quietly improved: the fallback stays
-- `stovetop`, every row comes out non-empty, and nothing behaves differently for
-- it today — `stovetop` is `has` in the default kitchen and phase 5 shows nothing
-- for a dish whose only appliance is a hob. **The number phase 9 needs in order
-- to decide**: with this fallback, a kitchen that marks the hob `missing` keeps
-- 43 of 1128 dishes — by slot, dinner 21, lunch 15, afternoon snack 12,
-- breakfast 11, morning snack 8, supper 3, against the 19 a slot the rotation
-- needs (`DISHES_NEEDED_PER_SLOT`), so every slot but dinner is short and no plan
-- can be built at all. If those 240 declared nothing instead, the same kitchen
-- would keep 47 breakfasts, 28 lunches, 37 dinners, 106 morning snacks, 181
-- afternoon snacks and 45 suppers — above the need everywhere, because the
-- no-cook dishes are exactly what a hob-less kitchen can make. Changing it is a change to `0102`, so it is
-- the owner's and phase 9's; phase 4 should decide in the same breath whether
-- `stovetop: missing` may be offered on the screen at all.
--
-- **Locks.** One `UPDATE` over 962 rows in production, inside the transaction
-- drizzle wraps the file in, taking `ROW EXCLUSIVE` on `recipes` — which does not
-- block readers. `EXPLAIN` shows a sequential scan filtered on `equipment =
-- '{}'`, so the regexes run only for the rows that need rewriting; `instructions`
-- is untouched, so no TOAST is rewritten, and there is no index on `equipment`,
-- so the rows update in place. At this size it is milliseconds.
--
-- **The old build survives it, and rolling back is safe.** The build serving
-- requests while this applies is `0066`'s, which **does** declare the column —
-- and that is why it is safe rather than why it would be: it maps every value
-- through `appliancesOf`, which drops anything it does not recognise, and no
-- screen renders the result until phase 5. Going back leaves the column populated
-- and unread, which is what it was before. Re-landing this file after a revert
-- needs a fresh `when`, as `0066`'s header says.

UPDATE recipes r
SET equipment = coalesce(nullif(classified.kit, '{}'::text[]), ARRAY['stovetop']::text[])
FROM (
  SELECT
    id,
    array_remove(ARRAY[
      CASE
        WHEN (
          p ~ 'horno|hornea|hornear|horneado|gratina|gratinar|funcion grill|función grill|bajo el grill|al grill|\yoven\y|\ybaked?\y|\ybaking\y|preheat the oven'
          -- A verb form of `asar` beside a tray or an oven temperature, within one
          -- step's own text: `ásalos en bandeja a 210 grados`. 150-299 degrees, so
          -- that a thermometer reading in a piece of meat (`75 °C`) is not an oven.
          OR p ~ '(\yasa|\yásal|\yasar|\yasándo)[^"]{0,120}(bandeja|(1[5-9][0-9]|2[0-9][0-9]) ?(grados|°|º))'
          OR p ~ '(bandeja|(1[5-9][0-9]|2[0-9][0-9]) ?(grados|°|º))[^"]{0,120}(\yasa|\yásal|\yasar|\yasándo)'
        )
          AND p !~ '\yo (en |al |a la )?(el |la )?horno|horno o |\((en |al )?(el )?horno|\yo [^"]{0,45}horno|\yor (in )?(the )?oven|oven or '
        THEN 'oven'
      END,
      CASE
        WHEN p ~ 'microonda|microwave'
          AND p !~ '\yo (en |al )?(el )?microonda|microondas? o |\((en |al )?(el )?microonda|\yo [^"]{0,45}microonda|\yor (in )?(the )?microwave|microwave or '
        THEN 'microwave'
      END,
      CASE
        WHEN p ~ 'freidora de aire|freidora sin aceite|air ?fry'
          AND p !~ '\yo (en |con )?(la )?freidora|freidora (de aire |sin aceite )?o |\((en |con )?(la )?freidora|\yo [^"]{0,45}freidora|\yor (in )?(the )?air ?fry|air ?fryer or '
        THEN 'air_fryer'
      END,
      CASE
        WHEN p ~ 'olla a presi|olla rapida|olla rápida|olla expres|olla exprés|pressure cook|instant pot'
          AND p !~ '\yo (en )?(la )?olla (a presi|r[aá]pida|expr)|olla (a presi[oó]n|r[aá]pida|expr[eé]s) o |\((en )?(la )?olla (a presi|r[aá]pida|expr)|\yo [^"]{0,45}olla (a presi|r[aá]pida|expr)|\yor (in )?(a |the )?pressure cook'
        THEN 'pressure_cooker'
      END,
      CASE
        WHEN p ~ 'batidora|licuadora|\yrobot de cocina|procesador de alimentos|thermomix|\yblender|food processor'
          AND p !~ '\yo (con |en )?(la |el )?(batidora|licuadora|robot de cocina|procesador de alimentos|thermomix)|(batidora|licuadora|robot de cocina|procesador de alimentos|thermomix) o |\((con |en )?(la |el )?(batidora|licuadora|robot|procesador|thermomix)|\yo [^"]{0,45}(batidora|licuadora|robot de cocina|procesador de alimentos|thermomix)|\yor (a |the )?blender|blender or '
        THEN 'blender'
      END,
      CASE
        WHEN p ~ 'vaporera|cestillo|estuche de vapor|\ysteamer'
          AND p !~ '\yo (en )?(una |la )?(vaporera|cestillo)|(vaporera|cestillo) o |\((en )?(una |la )?(vaporera|cestillo)|\yo [^"]{0,45}(vaporera|cestillo)'
        THEN 'steamer'
      END,
      CASE
        WHEN p ~ 'olla lenta|coccion lenta|cocción lenta|slow cook|crock ?pot'
          AND p !~ '\yo (en )?(la )?olla lenta|olla lenta o |\((en )?(la )?olla lenta|\yo [^"]{0,45}olla lenta'
        THEN 'slow_cooker'
      END,
      CASE
        WHEN p ~ 'arrocera|rice cooker'
          AND p !~ '\yo (en )?(la )?arrocera|arrocera o |\((en )?(la )?arrocera|\yo [^"]{0,45}arrocera'
        THEN 'rice_cooker'
      END,
      CASE
        WHEN p ~ 'barbacoa|barbecue|parrilla de carb|parrilla de gas|grill de carb'
          AND p !~ 'sarten o parrilla|sartén o parrilla|parrilla o plancha|plancha o (al )?grill|\yo (en |a la )?(la )?(parrilla|barbacoa)|(parrilla|barbacoa) o |\yo [^"]{0,45}(parrilla|barbacoa)'
        THEN 'grill'
      END,
      CASE
        WHEN p ~ 'sarten|sartén|\ycazo\y|cazuela|\yolla\y|puchero|hervir|hierve|hirviendo|cocer|cuece|cuécel|cuécal|saltea|saltear|sofre|sofri|sofrí|pochar|plancha|freir|freír|fríe|\yfrie|frito|frita|fuego medio|fuego alto|fuego bajo|fuego fuerte|skillet|saucepan|frying pan|\yboil|saut|simmer|\ywok'
        THEN 'stovetop'
      END
    ], NULL)::text[] AS kit
  FROM (SELECT id, lower(instructions::text) AS p FROM recipes) prose
) classified
WHERE classified.id = r.id
  AND r.equipment = '{}'::text[];
