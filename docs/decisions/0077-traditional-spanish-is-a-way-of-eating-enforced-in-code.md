# 0077 — Traditional Spanish is a way of eating, enforced in code by ingredient, cuisine and dish name

- **Status**: accepted
- **Date**: 2026-10-01
- **Deciders**: owner ("quiero introducir tradicional español… más lentejas, alubias, arroz, verduras como brócoli o pella, pimientos"; kept avena, aguacate, cuscús, basmati and the modern dairy and seeds); agent: the definition, the lists, measured on the dev library
- **Project**: docs/projects/013-traditional-spanish

## Context

A real user who eats Spanish home cooking was served skyr, seitán and edamame, and a dish labelled "asiática" they never chose. The cuisine a person picks is only a lean (`Rotation.isPreferredDish`). A recipe's `cuisine` is model free text: about 1,400 of 2,035 dev recipes say "mediterránea", skyr bowls included. No pattern rules out foods foreign to Spanish cooking.

## Decision

`traditional_spanish` is a dietary pattern, enforced like halal and kosher, by three rules. All three hold in reuse, in swaps and in validating generated dishes. The model is not shown the excluded rows.

1. **Ingredients out**: 157 exact catalogue slugs, not runs. As a run, `ostra` would take `seta-ostra`.

   `aceite-de-coco`, `aceite-de-sesamo`, `agua-de-coco`, `alga-kombu`, `alga-nori`, `alga-wakame`, `alubias-negras-cocidas`, `amaranto`, `arroz-jazmin-crudo`, `arroz-para-sushi`, `arroz-salvaje-cocido`, `arroz-salvaje-crudo`, `arroz-tres-delicias-congelado`, `azukis`, `baba-ganoush`, `bagel`, `bebida-de-proteinas`, `bebida-de-proteinas-vegetal`, `brotes-de-alfalfa`, `brotes-de-soja`, `bulgur-cocido`, `bulgur-crudo`, `caldo-dashi`, `chile-chipotle-seco`, `chutney-de-mango`, `cinco-especias-chinas`, `coco-fresco`, `col-china`, `col-rizada`, `crema-agria`, `crema-de-anacardos`, `crema-de-coco`, `curry-en-polvo`, `daikon`, `edamame-cocido`, `edamame-congelado`, `espirulina`, `fideos-de-arroz-cocidos`, `fideos-de-arroz-secos`, `fideos-de-cristal`, `fideos-soba`, `filete-de-panga-congelado`, `freekeh`, `frijoles-refritos`, `garam-masala`, `ghee`, `gochujang`, `guacamole`, `hamburguesa-vegetal`, `harina-de-trigo-sarraceno`, `harissa`, `heura`, `hierba-limon`, `hummus`, `hummus-de-remolacha`, `jackfruit`, `jalapeno`, `jengibre-en-polvo`, `jengibre-fresco`, `judia-mungo`, `kimchi`, `kombucha`, `leche-de-almendra`, `leche-de-avena`, `leche-de-coco`, `leche-de-coco-ligera`, `leche-de-soja`, `lentejas-rojas-cocidas`, `levadura-nutricional`, `lichi`, `mango`, `mango-congelado`, `mantequilla-de-cacahuete`, `maracuya`, `mijo`, `mijo-cocido`, `miso`, `nachos`, `noodles-de-trigo`, `noodles-udon`, `nuggets-vegetales`, `okra`, `pak-choi`, `pan-bao`, `pan-de-pita`, `pan-naan`, `papaya`, `papel-de-arroz`, `pasta-de-curry-rojo`, `pasta-de-curry-verde`, `pate-vegetal`, `pesto-vegano`, `pitaya`, `platano-macho`, `proteina-de-guisante`, `proteina-de-suero`, `queso-cheddar`, `queso-cottage`, `queso-feta`, `queso-halloumi`, `queso-havarti`, `queso-raclette`, `queso-scamorza`, `queso-vegano`, `quinoa-cocida`, `quinoa-cruda`, `quinoa-hinchada`, `ramen-instantaneo`, `ras-el-hanout`, `salchichas-vegetales`, `salsa-agridulce`, `salsa-barbacoa`, `salsa-de-chile-dulce`, `salsa-de-ostras`, `salsa-de-pescado`, `salsa-de-soja`, `salsa-de-soja-baja-en-sal`, `salsa-hoisin`, `salsa-pico-de-gallo`, `salsa-ponzu`, `salsa-satay`, `salsa-sriracha`, `salsa-teriyaki`, `sazonador-para-tacos`, `seitan`, `sesamo`, `seta-shiitake`, `sirope-de-agave`, `sirope-de-arce`, `sirope-de-datiles`, `skyr`, `soja-cocida`, `soja-en-grano`, `soja-texturizada`, `sumac`, `tahini`, `tamari`, `te-matcha`, `tempeh`, `tilapia`, `tofu-ahumado`, `tofu-firme`, `tofu-sedoso`, `tortilla-de-maiz`, `tortilla-de-trigo`, `tortitas-americanas`, `tortitas-de-maiz`, `trigo-sarraceno`, `trigo-sarraceno-cocido`, `tzatziki`, `vinagre-de-arroz`, `wasabi`, `wrap-integral`, `yogur-de-coco`, `yogur-de-soja`, `yuca`, `zaatar`

2. **Foreign cuisine**: a dish whose `cuisine`, normalised (lower case, no accents), is one of these is out. `mexicana, asiatica, oriental, india, indio, japonesa, tailandesa, china, coreana, vietnamita, peruana, latina, venezolana, americana, estadounidense, hawaiana, tropical, nordica, escandinava, marroqui, magrebi, arabe, libanesa, oriente medio, fusion`. A null cuisine, "mediterránea", "española" and its regions, "italiana", "francesa" and "griega" pass on their ingredients.
3. **Foreign name**: a dish whose name matches this pattern is out. It is case-insensitive and on word boundaries: `curry|shakshuka|wok|poke|sushi|ramen|burrito|fajitas?|quesadilla|teriyaki|pad thai|falafel|tabul[eé]|nachos|hummus|guacamole|chipotle|tikka|masala|noodles?|bibimbap|kimchi`, or "tacos" at the start of the name or followed by "de pollo / de ternera / de pescado / mexicanos / al pastor". The last rule keeps the Spanish "tacos de jamón".

**Kept by the owner's choice:** avena, aguacate (guacamole stays out), cuscús, arroz basmati, queso batido, kéfir, yogur proteico, seeds (chía, lino, cáñamo, calabaza, girasol) and tortitas de arroz.

**The lean.** With the pattern, the library pick puts first dishes with:
- legumes (lentejas, garbanzos, alubias, judiones, habas);
- fish and seafood (the `fish` and `shellfish` classes);
- rice (any `arroz-*` slug outside the list above);
- huerta vegetables (judía verde, acelga, espinaca, coliflor, brócoli, pimientos, calabacín, berenjena, alcachofa, puerro, cardo, borraja).

**The model is not told** (owner, 2026-10-01). The pool prompt is the same for everyone. The accepted consent text says the model learns only whether a person is vegetarian or vegan, and naming this pattern would have meant re-asking every user. The weekly aims of the AESAN's 2022 recommendations (legumes at least 4 times a week, fish 3 times) are pursued through the lean and measured by the evaluator, not asked of the model.

## Alternatives considered

- **A cuisine filter alone.** Rejected: cuisine is free text, and "mediterránea" covers skyr bowls and tacos. Ingredients are the reliable signal.
- **A strict list that also takes out avena, aguacate, cuscús, basmati and the modern dairy.** Rejected by the owner: they are everyday food in Spain now. Avena alone sits in 438 dev breakfasts.
- **A hard weekly legume minimum in the scheduler.** Deferred: the lean and the prompt ask for it, and the evaluator measures it first.

## Consequences

- On the dev library, the rule keeps 426 lunches, 413 dinners, 586 breakfasts, 79 morning and 114 afternoon snacks.
- Among the lunches and dinners kept: 137 have legumes, 153 rice and 179 fish.
- The rule loses 21 dishes by cuisine alone (chili con carne, ceviche, arepas, a Moroccan chicken) and 2 by name alone (a shakshuka, a curry).
- A new catalogue row foreign to Spanish cooking is not excluded until it is added to the list. The seed-subset test keeps the list honest in the other direction.
