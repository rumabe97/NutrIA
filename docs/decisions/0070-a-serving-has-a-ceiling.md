# 0070 — A serving has a ceiling; people who eat more get more servings

- **Status**: accepted. Amends [`0047`](./0047-dishes-are-designed-to-the-whole-split.md): the split stands, and the size of one serving is now capped.
- **Date**: 2026-09-29
- **Deciders**: owner ("Haz todo lo que me has recomendado… hacer las correcciones en el prompt y en los datos existentes"); agent, the caps and the measurement

## Context

`0047` briefs each dish per serving at the person's own share of the day
("a large brief is a large plate"), and nothing put a limit on that share.
A read-only investigation of the dev library (1,710 recipes, 2026-09-29) found
the following:

- **49 model-made recipes come to more than 1,500 kcal per serving.** 17 are over 2,000 and the largest is 2,693.
  All of them have `servings = 1`, 47 of them are lunches, and each weighs 700–2,000 g.
  The 500 seed dishes never go past 1,000 kcal.
- **An example, "Arroz basmati de carga…".** It is 350 g of raw basmati, 300 g of chickpeas, 55 g of oil and 250 g of turkey:
  2,594 kcal declared as one serving.
- **The model did what it was asked.** For a 3,100–3,700 kcal day with a large lunch, a light dinner and a light
  snack, lunch takes 0.72 of the day. `briefFor` asked one serving of lunch for
  2,251 kcal on an ordinary day, and for 2,574 and 2,698 kcal on the two event days.
  The stored dishes are within a few per cent of those briefs. The prompt's own
  lines ("250 g dry is three" plates, "a plate a person would recognise as one")
  lost to the number every time.
- **Nothing downstream bounded it.** The pool schema allows 2,000 g per ingredient and 1–8 servings,
  no `DishRejection` concerned energy, and `insertRecipes` stored the dish as it came.
- **The dishes reach plans.** They filled 128 meals in 16 plans for 5 dev accounts.
  For everyone else they take up places in the pool: reuse has no energy filter, and even
  at `SERVING_BOUNDS.min` (0.5) the heaviest cannot fit a normal day.

## Decision

**One serving has an energy ceiling per meal. A person whose share of a meal is
larger is served more than one serving of the dish, not a bigger serving.**

- **The caps** are `SERVING_KCAL_CAP` in `core/domain/Serving`:
  - 900 kcal for lunch and dinner;
  - 700 for breakfast;
  - 400 for each snack and for supper.

  They are the validated seed library's own ceiling, measured on dev.
  In the seed, lunch and dinner never pass 1,000 kcal and 95% are under about 870.
  Breakfast tops out at about 810, with 95% under about 700. No snack passes about 450,
  and 95% are under about 400. A dish served at several meals takes the largest of their caps.
- **The brief is capped, and its split kept exactly** (prompt `4.5.0`):
  - `briefFor` multiplies the slot's share by `servingFactor`, which is 1 under the cap and cap ÷ brief over it.
    It applies the same factor to energy, protein, carbohydrate, fat and fibre, so `0047`'s split is untouched.
  - The protein straddle (`0048`) is computed from the capped figure.
  - The event-day lines are capped the same way.
  - A capped meal is told that the person eats more there and is served more than one serving.
  - Every request carries the rule "one serving has a ceiling".
- **Big eaters are served by the scheduler**, as `Scheduler.ts` already says
  they are: `SERVING_BOUNDS.max` is 4, so 900 kcal lunches serve up to 3,600 kcal.
  The diagnosis's worst brief (2,698 kcal) is three servings.
- **A bound after the prompt.** `PoolBuilder` refuses a dish whose one serving is past
  1.5 × its meals' cap, with the reason `oversized`.
  - The check is `isOversized`, composed by `composePerServing`, never by a second formula.
  - It runs last, on the meals the dish is kept for.
  - The cap is what the prompt asks for. The bound only refuses a pot declared as one plate, not a dish
    that lands a little over, which the scheduler sizes anyway.
  - `oversized` is not about the person, so the admin log keeps it on the addressed row.
- **The stored library is repaired by migration `0047`**, which is data only and runs on deploy:
  - **What it changes.** Each model-made recipe past the bound is split into k = ceil(kcal per serving ÷ cap) servings.
    The grams are unchanged, `recipes.servings` is multiplied by k, and every meal planned with it has `meals.servings` multiplied by the same k, all in one statement.
  - **Why nothing else moves.** Every view scales amounts by meal servings ÷ recipe servings, so each meal keeps its
    grams, its shopping list and its stored kcal and macros. No active plan changes under anyone.
  - **What a person does see change.** The number of servings on the meal's page: "3,75 raciones" where it said
    "1,25", because it now counts plates of the recipe's new size. That is the truth about the plate, and it was accepted.
  - **What it leaves alone.** A recipe is skipped if its split would take a meal past 4 servings or the recipe past 8.
    Seed and user recipes are not touched.
  - **On dev.** 65 recipes: k = 2 for 27 and k = 3 for 38. They cover 193 meals, and the largest meal becomes 3.75 servings.
    None is skipped. Run read-only beside `isOversized`, the migration's SQL selected exactly the same 65 recipes with the same k.

## Alternatives considered

- **Repair at the cap rather than the bound.** On dev that is 196 recipes, 25 of them seed dishes
  between 900 and 1,000 kcal that nobody finds too big, and 446 meals. Six meals would go
  past 4 servings, the largest to 6.5. The repair is for dishes the new code
  would refuse, not for those it asks a little smaller.
- **The bound alone, with no prompt change.** It would refuse every lunch the
  current brief asks of a 3,700 kcal person and leave their generation with
  nothing.
- **Exclude heavy dishes from reuse.** A stop-gap that the repair makes redundant, and the
  heavy eater would lose dishes that suit them.
- **Energy-aware rotation** (`0047`, "left for later"). It still stands on its own
  merits, but it does not change the size of the plate.

## Consequences

- **Big eaters.** A day for someone who eats a lot is built from dishes of normal size served at 2–4
  servings. The scheduler's portion search covers it, but those days now depend
  on the upper range of `SERVING_BOUNDS`. `plan-evaluator` measures the
  high-target and event-day profiles before this ships.
- **Production** may hold its own oversized dishes. The migration repairs them on deploy
  by the same rule; the number is known only after it runs.
- **Old API during the deploy.** An API still on the old code could write a meal for one of these recipes
  in the seconds the deploy runs, with its servings counted at the old size. That
  meal would show its amounts divided by k until the plan is regenerated. The
  window is the build's migration step.
- **Changing the caps.** They are a product figure, in one place (`SERVING_KCAL_CAP`). Changing
  them changes the prompt (a `PROMPT_VERSION` bump) and the bound together. It does
  not re-repair the library, which would take a new migration.
