# PRD — Project 016: A Spanish meal — a normal plate, with bread and dessert beside it

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief of 2026-10-02 and the `architect` report
> [`0008`](../../reference/architecture/0008-una-comida-a-la-espanola-2026-10-02.md);
> approved by the owner.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: done
- **Roadmap item**: none — from real plans the owner and a user received

## Problem

Today a meal is one dish, and the scheduler multiplies it to reach the meal's energy. A person who eats few times a day gets a single dish served 2–3 times over. Real production plans, before project 014, showed:

- plates of 0.8–1.4 kg;
- up to 925 g of potato in one meal.

Project 014 caps the plate at 750 g. But about 1,000 kcal still has to fit in it, which pushes the scheduler towards dense dishes or days out of band (`0008`).

A dietitian does it differently:
- more meals a day;
- each meal built from a dish at a normal serving plus bread, fruit or a yoghurt;
- no more than about two servings of any one food on a plate.

## Outcome

- **A meal is a dish plus its accompaniments.** The dish is served near a normal serving (0.75–1.5), and a short Spanish list closes the macros: bread, seasonal fruit, natural yoghurt, nuts, queso de Burgos. It reads "Lentejas estofadas + pan (60 g) + una naranja". The accompaniments are bought on the shopping list.
- **New dishes are designed for one person** at a normal serving of about 500–650 kcal, leaning to the plate method (half vegetables, a quarter protein, a quarter starch).
- **When the meal shape makes main meals big, the person is told before generating.** When a main meal would carry more than ~850 kcal, `/plan/generando` (and the profile) explains it in plain words: "with few meals, each one has to be large; it is the only way to fit your day". The person chooses to add a meal or keep the shape. Nothing is forced.
- **No plate holds more than about two servings of one food,** unless the meal itself is very large.

## Scope

**In:**
- the four pieces A–D of `0008`;
- an evaluator that measures serving distribution, plate and meal grams, grams per food group and time per profile;
- a feature flag for A;
- tests, reviews and docs.

**Out:**
- oil as an accompaniment;
- regional menus;
- primero + segundo as two dishes (accompaniments only);
- forcing a meal count.

## Acceptance criteria

1. **Measured base (phase 0).** 014 is in production. The evaluator reports:
   - servings per slot as a histogram;
   - plate and meal grams;
   - grams per food group;
   - time per profile.

   The read-only production simulation of the owner's profile on 014 is recorded.
2. **The choice (C).**
   - When a main meal's share of the day is over 850 kcal, `/plan/generando` shows the explanation before generating, with two actions: "Añadir una comida", which takes the person to edit their meals and comes back, and "Seguir así".
   - The choice is remembered until the meal shape or the targets change.
   - The same note appears, dismissible, on `/perfil`.
   - Checked at 320, 390 and 1280 px, light and dark.
3. **Per-food ceiling (D).**
   - No plate holds more than: meat 250 g, fish or seafood 300 g, cooked legumes 400 g, grains 160 g dry (by `0078`'s yields), potato or boniato 400 g.
   - For a main meal whose share is over 1,100 kcal, the ceilings scale up by share ÷ 1,100. That is the people of `0070`, who need 2–4 servings.
   - The energy floor outranks the ceilings, as with `PLATE_LIMIT`.
   - The evaluator shows no food over its ceiling, and no profile loses more than one day in band.
4. **Accompaniments (A).**
   - **The data.** A meal's dish and its accompaniments are one meal with one macro snapshot. The accompaniments are stored in `meal_accompaniments`, an additive migration.
   - **The list.** Fixed in code: bread (white or whole, 30, 60 or 90 g), gluten-free bread when it is allowed, one seasonal fruit, a 125 g yoghurt, nuts (15 or 30 g), queso de Burgos (60 g). No oil.
   - **How they are chosen.** In code, inside the day's portion search, under the existing combination ceiling. Only when a main slot's share is over 700 kcal; below that the meal is the dish alone, as today.
   - **What they must respect.** Every accompaniment passes the same safety (allergies, traces, unresolved labels), the person's exclusions (dislikes, dietary patterns including `traditional_spanish`), the season and the meal, and the dish-level rules applied to the whole meal (kosher).
   - **Servings** prefer 0.75–1.5 at a soft cost, not as a hard bound (`0070`).
   - **Everything else holds.** Swaps, event rebuilds and the professional's review flow keep working with accompaniments. The meal row, the meal page and the shopping list show them.
   - **The switch.** A global flag `accompaniments`: off produces exactly today's plans, and a test pins it.
   - **Measured with the flag on:**
     - days in band no worse than the base;
     - at least 80% of main servings within 0.75–1.5;
     - plates at or under 750 g;
     - zero allergens on any plate;
     - a fortnight scheduled in under about 60 s.
5. **Dishes for one person (B).**
   - Comes after A is live.
   - The pool prompt stops asking for bread or fruit beside the dish (the plan adds them).
   - It designs lunch and dinner at about 650 kcal per serving (`SERVING_KCAL_CAP`, and with it `oversized`), with the plate method as a preference below the macro split. Prompt 4.6.0.
   - The rate of `oversized` and `unwanted` rejections does not rise.
6. **Docs and reviews.**
   - Decision records for A–D. `ARCHITECTURE.md` describes the meal as a dish plus accompaniments.
   - `migration-reviewer` reviews the migration.
   - `invariant-reviewer` reviews every phase that touches the allergy layer or the prompt.

## Open questions

- None blocking. The owner decided on 2026-10-02:
  - all four pieces;
  - servings as a preference, not a hard bound;
  - ceilings that scale only for very large meals;
  - the note at plan creation with the person's choice;
  - queso de Burgos in, oil out (`0008`'s defaults);
  - thresholds of 700 kcal for A and 850 kcal for C.
