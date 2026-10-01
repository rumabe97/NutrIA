# PRD — Project 013: Traditional Spanish

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief of 2026-10-01; approved by the owner.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Roadmap item**: none — a quick project at the owner's request, from a real user's complaints

## Problem

A real user who eats Spanish home cooking complains about two things:

- **"Strange things" on the plate:** skyr, seitán, edamame.
- **A dish labelled "asiática"** that they never chose.

Both are true of the code:

- **Cuisine is only a lean, never a filter.** The cuisine a person picks moves that cuisine's dishes forward (`Rotation.isPreferredDish`). It never takes the others out. A stir-fry that fits the macros is served.
- **Cuisine is model free text.** About 1,400 of the 2,035 dev-library recipes say "mediterránea", including skyr bowls, quinoa salads and tacos. A filter on cuisine alone would let most of them through.
- **Nothing rules out an ingredient that is foreign to Spanish cooking.** Tofu, seitán, tamari, quinoa and the like reach anyone who has not declared a pattern against them.

## What "traditional Spanish" means here

This is the definition the rule implements.

**Sources:**
- The AESAN's 2022 sustainable dietary recommendations: at least 4 servings of legumes a week, 3 or more of fish, up to 4 eggs, and at most 3 of meat (preferably poultry and rabbit). Olive oil is the cooking fat, and food is seasonal and local.
- The Spanish home recipe book: platos de cuchara (lentejas, cocido, potajes, fabada, alubias), rice dishes, patatas guisadas, verduras de huerta, tortilla, fish a la plancha or in sauce, and stews.

**Kept:**
- **Legumes:** lentils, chickpeas, white, pinto and red beans, broad beans.
- **Starches:** rice, potato, bread, pasta.
- **Vegetables of the huerta:** judía verde, acelga, espinaca, coliflor ("pella"), brócoli, pimiento, calabacín, berenjena, alcachofa, puerro, tomato.
- **Fish and seafood:** merluza, bacalao, sardina, boquerón, atún and the like.
- **Meat and eggs:** eggs, poultry, pork, beef, lamb, rabbit, embutido in moderation.
- **Dairy:** yogur natural and griego, requesón, cuajada, queso fresco and curado.
- **Fats, seasonings and the rest:** olive oil, pimentón, laurel, azafrán, comino; nuts and fruit.

**Kept by the owner's choice** (2026-10-01; common in Spain today, though not from the old recipe book):
- avena;
- aguacate (guacamole stays out);
- cuscús and arroz basmati;
- queso batido, kéfir, yogur proteico, seeds and tortitas de arroz.

**Out** (157 catalogue rows, listed in `0077`):
- **Soy and meat substitutes:** tofu, tempeh, seitán, heura, edamame, soja texturizada, vegetable burgers and nuggets.
- **Foreign grains and noodles:** quinoa, bulgur, mijo, amaranto, trigo sarraceno, noodles, rice noodles, sushi rice.
- **Asian and Latin American sauces and seasonings:** soja, tamari, teriyaki, curry, miso, kimchi, sriracha, tacos seasoning, guacamole, pico de gallo, hummus, tahini, za'atar, ras el hanout.
- **Foreign breads:** tortillas de maíz and de trigo, wraps, pita, naan, bao, bagel, American pancakes.
- **Tropical produce:** mango, papaya, maracuyá, coco, yuca, plátano macho, pak choi, kale.
- **Foreign cheeses and ferments:** skyr, cottage, feta, halloumi, cheddar.
- **Plant milks and "superfoods":** soy, oat and almond drinks; spirulina, matcha.

Two more rules apply to dishes:
- **Foreign cuisine:** a dish whose stated cuisine is foreign (mexicana, asiática, india, japonesa, peruana, marroquí…) is out.
- **Foreign name:** a dish whose name gives it away (curry, wok, ramen, burrito, shakshuka…) is out.

A dish with no stated cuisine, or "mediterránea", passes on its ingredients alone.

**How much is left:** measured on the dev library (2,035 recipes), the rule keeps 426 lunches, 413 dinners, 586 breakfasts, 79 morning snacks and 114 afternoon snacks. That is far above what a fortnight needs. Of the lunches and dinners, 137 have legumes, 153 rice and 179 fish.

## Outcome

- A person can choose **"Tradicional española"** as a way of eating, in onboarding and in their profile.
- Whoever chooses it never gets an excluded ingredient, a dish of a foreign cuisine, or a foreign-named dish. This holds whether the dish comes from the library, from the model or from a swap.
- Their meal plans lean to legumes, rice, fish and vegetables of the huerta. The model is asked for Spanish home cooking, with Spanish names.
- The evaluator measures a profile like theirs.

## Scope

**In:**
- the pattern value (DB enum migration, core, the onboarding validation);
- its enforcement in core (reuse, swaps) and in the pool builder (catalogue shown to the model, validation of what it returns);
- the prompt;
- the rotation lean;
- the onboarding and profile labels in es-ES and en-GB;
- the privacy text, because the model now receives this choice;
- an evaluator profile;
- tests and docs.

**Out:**
- re-labelling stored dishes' cuisine;
- a cuisine filter for people without the pattern;
- a hard weekly minimum of legumes in the scheduler (the lean and the prompt ask for it, and the evaluator measures it);
- regional variants (andaluza, gallega…).

## Acceptance criteria

1. **Selectable.** `traditional_spanish` is a dietary pattern. It is offered in onboarding and in the profile as "Tradicional española" / "Traditional Spanish", it is saved, and the profile shows it translated.
2. **Ingredients enforced.** With the pattern, no plate, library dish, generated dish or swap contains any of the 157 rows in `0077`. They are excluded through `resolvePreferences`, like halal and kosher.
3. **Cuisine and name enforced.** With the pattern, no dish is served whose normalised `cuisine` is in the foreign list or whose name matches the foreign-name rule, in reuse, swaps or generation. A generated dish that breaks either rule is rejected as `unwanted`.
4. **The prompt does not reveal it** (amended 2026-10-01, owner). The pool prompt is byte-identical with and without the pattern, and `PROMPT_VERSION` does not change. Naming the pattern to the model would make the accepted consent text untrue ("vegetariano o vegano") and force every user to consent again. Enforcement lives entirely in code: the model is never shown an excluded row, and a generated dish that breaks a rule is rejected. *Superseded text:* **The prompt asks for it.**
   - The model is told the person eats traditional Spanish home cooking: platos de cuchara at least 4 times a week, fish 3 times, rice, vegetables of the huerta, olive oil, Spanish dish names, cuisine "española".
   - It is not offered the excluded rows.
   - `PROMPT_VERSION` moves to 4.6.0.
5. **The lean.** With the pattern, the library pick puts first dishes with legumes, fish, rice and vegetables of the huerta, through the same `Leaning` the cuisine preference uses.
6. **Measured.** An evaluator profile `patron-tradicional-espanola`:
   - 0 forbidden ingredients, foreign cuisines or foreign names on any plate;
   - at least 13/14 days inside 5% on all four macros;
   - at least 8 lunches or dinners with legumes and at least 6 with fish in the fortnight;
   - variety no worse than the omnivore profiles.
   No existing profile loses a day.
7. **Legal and docs.** `/privacidad` and the consent texts do not change, because the model does not receive the pattern (`legal` confirmed the consent finding; owner decision 2026-10-01). Decision `0077` records the definition and the lists, and `docs/ARCHITECTURE.md` mentions the pattern.

## Open questions

- None. The owner chose on 2026-10-01 to keep avena, aguacate, cuscús, basmati and the modern dairy and seeds.
