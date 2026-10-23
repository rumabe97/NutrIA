# PRD — Project 022: A plan that leans on your cupboard

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, 2026-10-22 — approved by the owner before the plan is written.

- **Status**: **approved** — by the owner on **2026-10-23** (*«lo apruebo»*), who had already
  taken on 2026-10-22 the two decisions it could not be planned without, both recorded below.
  [`PLAN.md`](./PLAN.md) follows from it and awaits his approval in turn.
- **Roadmap item**: none yet — this is the owner's own ask of **2026-10-20**, clarified on
  **2026-10-22**. A line in [`docs/ROADMAP.md`](../../ROADMAP.md) § *Next* comes with the
  plan, not with this file.

## Problem

The owner, 2026-10-20: *«el usuario premium aporta su lista de la compra o los ingredientes
que tiene ya, y a partir de esos ingredientes, se le genera el plan correspondiente»*. Two
analyses were commissioned before anything was planned, and both came back against that
sentence as written. He then said what he had actually meant, 2026-10-22, and it is what this
project builds:

> *«no quiero que me genere un plan con solo esos ingredientes, sino que me genere un plan con
> los ingredientes que tengo en mi lista de la compra, y añada lo necesario. Es simplemente
> una base»*

**What hurts today.** There is no way to tell NutrIA what is already in the house before it
decides what to cook. The shopping list is a projection of a meal plan that was built without
knowing ([`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md),
[`0096`](../../decisions/0096-what-is-bought-can-be-typed.md)): somebody can tick off what they
already have, and `boughtGrams` records it honestly — but only *after* the fortnight has
already chosen lentils when the chickpeas were the thing going off. The information arrives
one step too late to be worth anything, and the shop is as long as if nothing had been said.

**Why the first sentence cannot be kept, and this one can.** Both reports measured it rather
than argued it:

- [`architecture/0012`](../../reference/architecture/0012-a-plan-from-the-ingredients-somebody-already-has-2026-10-22.md)
  — a hard filter is **No** at fourteen days: a best-case pantry of 30 foods leaves the whole
  `es-ES` library with **41 lunches, 62 dinners and 5 dishes at each snack** against
  `DISHES_NEEDED_PER_SLOT` = **19** (`Variety/Rotation.ts:28`), before one person's allergies,
  way of eating, time limit and kitchen cut it to 35–79% again
  ([`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)).
  The snacks fail first. A **rank** — order the library by how many items you would have to
  buy — is **Yes on conditions**, and the shopping-list half is **Yes and nearly built**.
- [`marketing/a-plan-from-what-is-already-in-the-house`](../../reference/marketing/a-plan-from-what-is-already-in-the-house.md)
  — a fortnight needs **90–120 distinct ingredients**; a household pantry of 17 real staples
  fully covers **90 of 1,638 dishes, 22 of them lunches**; **513 of the 930 catalogue
  ingredients appear in no recipe at all**. So no tier and no price makes *«a partir de»*
  true. What is true is *«aprovecha lo que ya tienes»*, and the verb is the whole of whether
  the feature is honest.

**The honest promise, and its ceiling, written down before anybody builds it.** A fortnight's
list is **99–115 rows**, of which **73–88 are real food**; a best-case 30-item pantry covers
**26–28** of those, a 60-item one **45–47**. The ceiling on *"fewer things to buy"* is
therefore **about one row in four at thirty items, one in two at sixty** — and they are the
rows people buy in bulk anyway. This project is worth doing at that size or it is not worth
doing; it may not be sold as more.

### The owner's two decisions, 2026-10-22

1. **Free, on both tiers.** He first supposed premium. `marketing` found it fails both of
   [`Allowance.ts`](../../../packages/core/src/domain/Allowance/Allowance.ts)'s sellable
   categories — it costs no more to serve than an ordinary generation, and it is not the record
   of what was served — and fails its own category test, because free would be left with no
   answer to the question the feature exists to answer. **No new allowance row**, and the thing
   premium gains is that its existing re-roll (`planRedosPerFortnight`, free 1 / premium 3,
   [`0099`](../../decisions/0099-a-variety-cap-counts-the-meals-the-generator-chose.md)) becomes
   the first limit in this product anybody has a reason to meet: *«no, usa los garbanzos, no las
   lentejas»*.
2. **The pantry is the input to one generation and is spent with it.** Not a standing larder:
   a larder needs a freshness model, a screen to maintain and answers about the yoghurt nobody
   updated, none of which he asked for. It is typed *before* the fortnight exists, so while it is
   being written it lives in a **user-owned table** — `architecture/0012` § 6, with the two
   partial unique indexes a nullable `ingredientId` forces, because Postgres counts NULLs as
   distinct and a plain `unique(userId, ingredientId)` would let every unresolved label in twice.
   The generation then **spends** it: what it was asked with is recorded on the meal plan the way
   `kitchenShare` is, so a re-roll pre-fills from the last ask and the record dies with the plan,
   and the draft is cleared. No per-row dates, no expiry, nothing that ages into nonsense.

## Outcome

When this project ships:

1. On the generation screen, somebody can say what is already in the house — **«Aprovecha lo
   que ya tienes en casa»** — by picking from the catalogue, and the screen says before they
   commit that the plan will *favour* those dishes and that there will still be a shop, a
   shorter one.
2. The fortnight's shopping list comes back with what they said already **bought**: the amounts
   they already have are seeded into `boughtGrams` through the same machinery a person's own tick
   uses, so what is left to buy is the remainder and nothing else.
3. If and only if the measurement in phase 0 holds: the generation **leans** on those
   ingredients — the library is read in order of how many items somebody would have to buy,
   with a share of each slot's rotation that **yields by degrees** before the rotation does —
   and every day is still inside all four macros.
4. After the plan exists, and never before it, the product states what it actually did: *«9 de
   42 comidas usan solo lo que ya tenías. La compra baja de 38 a 27 cosas.»*
5. Nothing anybody does here spends a model call that is not already counted, and no tier gets
   a bigger cupboard than another.

## Scope

**In**

- A pantry: a list of catalogue ingredients, with amounts where a person knows them, typed before
  a generation, spent by it, and recorded on the meal plan it produced.
- A picker over the catalogue — never a free-text box — that accepts the coarse word somebody
  owns (*arroz*, *pasta*, *atún*) over a catalogue that holds **16 rice rows, 10 pasta rows and
  6 tuna rows**, with **1,860 `ingredient_names` rows** to match against. The raw/cooked
  distinction ([`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md))
  is the product's problem, not the person's.
- Per-entry honesty: an entry nothing in the library cooks says so — *«Todavía no cocinamos nada
  con esto»* — and **stays in the list**, because tomorrow the library may.
- The shopping list seeded from the pantry (`boughtGrams`, `perDay`, `rangeQuantity`,
  `carriedBought`), which is the half of the promise that is already true in code.
- The steering rank, **behind a flag and behind phase 0's numbers**: ordered by items you would
  have to buy, with its rung on `narrowerShares` and a figure stored on the plan so what the
  bands cost the pantry is countable.
- The measured sentence after generation, and the unresolved entries aggregated on `/admin`,
  which is the only part of this feature that pays for itself in the library.
- `legal`'s review of the picker, the retention and the export, before any of it ships.

**Out**

- **A hard filter at plan level** — *«solo con lo que tengo»*. Measured impossible at this
  library size (§ *Problem*); it may not be reintroduced as an option, a switch or a "strict
  mode".
- **Depletion across the fortnight**: 300 g of rice spent plate by plate over 56 plates couples
  every day under a promise each day has to keep on its own
  ([`0045`](../../decisions/0045-a-day-is-built-to-all-four-of-its-numbers.md)). Amounts belong
  to the shopping list, which already models them, and not to the scheduler.
- **A typed pantry.** `/privacidad` promises the model is sent food and dish names *«siempre con
  los nombres de nuestras listas»*, with exactly one hand-written exception — a dish name
  ([`0100`](../../decisions/0100-a-person-may-name-a-dish-and-the-gate-is-on-what-comes-back.md)).
  A catalogue slug is a name from our lists and needs no second exception.
- **Any new allowance row**, any `pantryPlansPerFortnight`, and any pantry size that differs by
  tier — a bigger cupboard makes a better-steered plan, so selling cupboard size is selling plan
  quality.
- **A standing larder** with freshness, expiry or a maintenance screen.
- **One meal from what you have**, the per-meal filter through the swap path, where a filter
  needs one dish and not nineteen. It is the honest follow-on to this project and
  `architecture/0012` § 9 holds its shape; it is **not** in this one.

## Acceptance criteria

1. **Phase 0 decides whether criterion 3 of § *Outcome* exists at all, and (c)-only is a
   delivered outcome and not a failure.** `--pantry <slugs>` on
   [`apps/api/scripts/evaluate-plans.mjs`](../../../apps/api/scripts/evaluate-plans.mjs) in
   `filter` and `rank` modes, **14 profiles × 3 seeds**, three or four hand-written larders at
   **15 / 30 / 60** items, with `--flag accompaniments`. Reported per profile: servable pool per
   slot against **19**, days in band against **588/588**, rescues against the **8–9** baseline,
   plates using a pantry item, and shopping-list rows against the no-pantry run.
   **Stop signal**: any slot under 19, or rescues above baseline. If it fires, the project
   delivers the pantry and the list and **drops the steering** — that is the honest result, it is
   recorded in `LOG.md` and the PRD is amended, and nobody pushes it through.
2. **A number is never quoted without its spread.** Any figure this project claims about plates,
   rows or bands is a cohort figure over at least **eight seeds**, never one plan
   (`packages/core/AGENTS.md`'s rotation row, and 021's criterion 8).
3. **The steering does not regress the kitchen.** Whichever composition phase 0 picks — a sort
   key, its own quota out of the five left, or composed with the appliance's —
   `APPLIANCE_DISHES_PER_SLOT` = **14 of 19** and 021's measured **median 20 air-fryer plates of
   56** hold, re-measured on the same cohort. The composition is phase 0's to choose, not the
   owner's and not the executor's.
4. **The share has a rung on the ladder and a figure on the plan.** A pantry quota reaching
   `wider_rotation` with no rung is the cliff `0102` already paid for, where the pantry is lost
   together with the rotation's variety, its avoid list and its food-group reserves.
5. **Every path that spends a provider call lands on an existing counter**: the generation it
   belongs to, or a `redo` if it re-rolls a live fortnight. A *«generar desde mi despensa»*
   button whose generation is not stamped `redo` is a P0 and fails this criterion.
6. **Nothing here becomes a standing larder.** The draft a person types is user-owned and is
   spent by the generation it feeds; what that generation was asked with is recorded on the meal
   plan and dies with it; a re-roll pre-fills from that record. No per-row dates, no expiry, no
   reminder, and nothing that survives to be read as still true a month later. Deleting the
   account takes both, through the cascade `ARCHITECTURE.md` calls the privacy control rather
   than a convenience.
7. **Nothing hand-written reaches the model.** Only catalogue slugs leave the product, and
   `health-boundary.spec.ts`'s allowed-keys line holds with no new exception.
8. **A pantry entry is never read as a restriction.** What somebody has is not what somebody may
   eat: it may not be inferred into an intolerance, a dislike, a diet or a health condition, and
   it may never remove a dish (`0102`'s rule for a preference, same reason).
9. **`legal` has reviewed it** — the picker against `/privacidad`, retention and the DSAR export
   of a spent pantry, and criterion 8 — and its findings are answered before the screen ships.
10. **The screen says the honest thing.** The Spanish surface uses **`aprovechar`** and never
    *«a partir de»*, promises no count before generation, states the ~100-ingredient fact before
    anybody commits, and shows exactly one number — the measured one, after the plan exists.
    Reviewed with the `apple-web-design` skill and looked at with `/local-probe` at 320/390/1280
    in both appearances and both languages, P0 and P1 fixed.
11. **The bound is a limit and not a price.** A generous technical ceiling, checked where it is
    written and refused as a **422 naming the field** the way `MAX_PREFERRED_APPLIANCES` is
    (`KitchenController.ts:97`), the **same on both tiers**. Provisional value to code against:
    **60**, the top of what `architecture/0012` § 4.1 measured; phase 0's larders set the final
    number. `marketing` recommends 20 as a product bound and `architecture/0012` finds that a cap
    hurts the feature because coverage rises monotonically — the measurement settles it, and
    whatever it settles on is not a `tier_allowances` row.
12. **The gap is reported.** Pantry entries the catalogue could not resolve, and entries resolved
    to an ingredient no recipe uses, are aggregated on `/admin` — the library's own to-do list,
    which is what this feature pays back.

## Open questions

**None.** The two that were his were answered on 2026-10-22: **free on both tiers**, and **the
pantry is the input to one generation, spent with it**. What this project still does not know —
whether the steering is worth having, which composition wins, and what the final bound is — is
deferred to the phase-0 measurement by criteria 1, 3 and 11, and the privacy half is deferred to
`legal` by criterion 9. Neither is his to answer.
