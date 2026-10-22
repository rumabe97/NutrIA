# 0012 — A plan built from the ingredients somebody already has

> **Purpose**: the owner asked, on 2026-10-22, for a plan to be generated *from* the
> ingredients a person already has or is about to buy — *"el usuario premium aporta su lista
> de la compra o los ingredientes que tiene ya, y a partir de esos ingredientes, se le genera
> el plan correspondiente"*. This says which of three possible products that sentence is, which
> one the code can hold, what each costs, and what to do first. Nothing here is a plan or a
> decision: it is the analysis the owner asked for before either exists.
> **Audience**: the owner. **Committed**: yes. **Maintained by**: whoever revisits the
> question; once merged it is not edited, and a later review is a new report.
>
> **Base**: `origin/main` at `837da423` (#305). **Cut-off**: 2026-10-22.
>
> **Measured**, where it says measured: read-only SQL against the local Postgres library
> (`NUTRIA_LOCAL_PG`, 127.0.0.1:54329, `nutria_local`, session forced
> `default_transaction_read_only=on`) — **1,638 recipes, 1,594 of them `es-ES`**, 930 ingredient
> rows. No evaluator run, no generation, no model call, nothing read from or written to
> production. Where a figure can only come from the evaluator this report **names the
> measurement and stops**, which is what the lead asked for.

## 0. Verdict

**Three verdicts, because the owner's sentence is three products.**

| the reading | verdict |
| --- | --- |
| **(a) a plan made only of dishes I can cook from what I have** — a hard filter on the pool | **No.** Not at fourteen days. Measured below: a best-case pantry of 30 foods leaves the whole `es-ES` library with **41 lunches, 62 dinners and 5 dishes at each snack**, against a rotation that needs **19 per slot** — before any one person's allergies, way of eating, time limit and kitchen cut that further (0102 measured those at 35–79% of the library). What would make it possible: a library several times the size, or the filter applied to **one meal** instead of fourteen days, where it needs one dish and not nineteen. |
| **(b) use up what I have first** — an order and a share inside the pool, the appliance's shape | **Yes, on conditions.** The conditions are in § 4: it must be a **rank by how many items you would have to buy**, not a boolean "uses something I have" (measured: a pantry of 15 puts **86% of the library** in that bucket, so the boolean is a no-op); it must hold a share with a **rung on `narrowerShares`**, or it dies in the whole-library rescue exactly as the appliance did; and it must be priced by `plan-evaluator` over the cohort before any of it ships. |
| **(c) shop for the fortnight, but start from this list** — the arrow stays plan → list | **Yes**, and it is nearly built. `boughtGrams`, `perDay`, `rangeQuantity`, `carriedBought` and the manual row already model "I have this much of that" (`0091`, `0096`). What is missing is a pantry that **outlives one plan** and seeds those amounts. Zero model calls, zero new infrastructure, no change to the scheduler and no exposure to `0045`. |

**The sentence he wrote is (a).** *"A partir de esos ingredientes, se le genera el plan"* points
the arrow from the ingredients to the plan, which is the hard filter. **The appealing version
is not buildable at this library size, and the buildable version is a weaker promise.** The
weaker promise, said in the words a screen would have to use, is:

> *"Dinos lo que tienes y tu quincena se apoyará en ello: menos cosas que comprar, y lo que ya
> tienes aparece comprado en la lista."*

What that is worth is a number this report can bound and not yet settle. Measured: a fortnight's
shopping list is **99–115 rows**, of which **73–88 are real food** and the rest are salt, oil and
spices, and a **best-case** pantry of 30 items covers **26–28 of the real ones**, a top-60 pantry
**45–47**. So the
honest ceiling on "fewer things to buy" is **about one row in four at 30 items, one in two at
sixty** — and those are the rows somebody buys in bulk anyway. That is the promise to sell or
not sell; it is not nothing, and it is not what the sentence asked for.

### What I recommend, in six lines

- **(c) first**: a pantry that outlives a plan and seeds `boughtGrams` on the new list. No
  generation change, no model call, no exposure to `0045`, and it is the half of the promise
  that is true today.
- **then (b)**, and only if phase 0's sweep comes back green: the pantry as a **rank by items
  you would have to buy**, with a share of the per-slot cap and a **rung on the ladder**.
- **(a) only per meal**, through the swap path, where a filter needs one dish and not nineteen.
- **Never**: a hard filter on a fortnight's pool; a pantry inside `servable`; depletion in the
  scheduler; the typed text in a prompt.

And the alternatives, each with the one reason it lost:

| rejected shape | the one reason |
| --- | --- |
| a hard filter on the pool | the thinnest slot falls under 19 at every pantry size somebody would type (§ 4.1) |
| a boolean "uses something I have" leaning | a 15-item pantry puts 86% of the library in the bucket, and dilutes the appliance share that shares it (§ 4.2) |
| a prompt line and nothing else | it reaches the fresh third only, and `0102` measured steering at 34% (§ 2.3) |
| depletion across the fortnight | it couples 56 plates under a promise every single day has to keep (§ 3.1) |
| overloading `food_preferences` | a pantry has a lifetime and a preference does not (§ 6) |

## 1. Premises checked

| premise | verdict |
| --- | --- |
| The local library holds 930 ingredient rows and 1,638 recipes. | **confirmed.** 1,594 of the recipes are `es-ES`; the other 44 are `en-GB`. Only **417 of the 930 ingredients are used by any recipe at all**, which matters: a pantry entry naming one of the other 513 can never match a dish. |
| A dish's ingredient rows are per serving. | **imprecise, and the correction matters for amounts.** `recipe_ingredients.grams` is for the **servings the dish declares** (`recipes.servings`, 1–8, `pool.schema.ts:79`), and the scheduler then serves a *fraction or a multiple* of that — *"the stored library of 700–900 kcal dishes is served at about 0.75 of a serving"*, scaling up to 4 (`Serving.ts:5–30`). The plan's `meals` rows carry what was actually served, and the shopping list is built from those (`buildShoppingList`, `ShoppingList.ts:95`). So a pantry comparing itself to a plan compares against the **plan's** grams, never the recipe's. |
| `repositories/Search` is how a dish request matches free text against the catalogue today, so question 5 may already be answered there. | **wrong.** `packages/core/src/repositories/Search/Search.ts` is 33 lines of `ILIKE` helpers for the admin console's query strings (`likeLiteral`, `contains`, `ordered`). It has **no callers in `packages/core` or `apps/api` outside the admin paths** and knows nothing about ingredients. The real precedents are `matchCustomAllergen` (`Safety/CustomAllergen.ts:131`) and `isEnforceableDislike` (`Preference.ts:491`) — § 5. |
| The nearest precedent is the kitchen (`0102`), and its three lessons are the ones this feature will meet. | **confirmed, and all three bind.** A narrowing buys a band miss, the band miss buys the whole-library rescue, the rescue throws the constraint away (`0102` § *A rescued fortnight has no kitchen*); supply makes a share bind harder; a constant priced on one seed is not priced (`packages/core/AGENTS.md` § the rotation row). This report's § 4 is built on them. |
| The shopping list is one list per plan, a projection of it, never free-standing. | **confirmed.** `shopping_lists.planId` is `.notNull().unique()` with `onDelete: 'cascade'` (`shopping.schema.ts`). A pantry is the opposite shape and needs its own table. |
| The rotation needs `DISHES_NEEDED_PER_SLOT` per slot. | **confirmed**, 19 (`Rotation.ts:28`), and `REUSED_DISHES_PER_SLOT` is the same 19 (`:81`). The appliance already holds **14 of those 19** (`APPLIANCE_DISHES_PER_SLOT`, `:133`) — which is the arithmetic problem in § 4.3. |
| Health data and personal free text never reach the model, and a dish request is the one exception. | **confirmed**, and it is the line this feature must not cross. `0100`'s own comment calls it *"the only field in the product whose content a person writes and a model reads"* (`DishRequest.ts`), and `health-boundary.spec.ts` holds it. § 5's design keeps it at one field. |
| Zero euros of new infrastructure. | **confirmed as achievable** for every reading here: one table, one screen, library-side logic. No new provider, no new store, no new cron. |
| This feature costs a model call per use. | **wrong for (b) and (c).** Both are served from the library and from code; a prompt line, if one is wanted at all, rides the generation call that already happens. Only a "write me dishes from these ingredients" variant spends anything, and that is the `dish_request` shape (`0100`), which is already counted and already priced. |
| A pantry can be expressed as "foods they like", which already exists. | **confirmed as a wire, and measured as worthless.** `food_preferences` (label + nullable `ingredientId`) → `resolvePreferences` → `leaningSlugs` (`Preference.ts:829`) → `rotation.preferIngredientSlugs` (`PlanGeneration.service.ts:210`) → `isPreferredDish` (`Rotation.ts:247`) is **a pantry without amounts, already shipped**. It is also the diluted one-bucket-of-four leaning that `0102` measured as putting 3 air-fryer dishes in a pool of 672. So the answer to "is there a version that needs no amounts" is yes — and it is already there, and it is worth what `0102` says it is worth. |

## 2. What is there today

### 2.1 Where a pool can be narrowed, and what each place costs

```
RecipeRepository.findReusable        every es-ES dish, up to REUSE_FETCH_LIMIT
   │
   ├─ servable()            RecipeController.ts:370   ← the hard filters live here:
   │                                                     allergies, way of eating,
   │                                                     unresolved-allergy mentions,
   │                                                     withinTime, withinEquipment
   │
   ├─ rotateFor() → rotatePool()     Rotation.ts:362   ← the per-slot cap of 19, the
   │                                                     food-group reserve, the
   │                                                     appliance's share of 14
   │
   ├─ PoolBuilder.build()    the model writes the shortfall; the catalogue it is shown
   │                         is already cut per meal (0062, 0063) and per person
   │
   └─ the ladder, then the rescue    PlanGeneration.service.ts:511, :572
                                     narrowerShares → wider_rotation (whole library)
```

Four facts about this chain decide everything below.

1. **`servable` is for constraints only.** `packages/core/AGENTS.md` states it as a rule: *"A
   `prefers` stance may never shrink a pool, never filter a candidate and never refuse a
   reuse — otherwise somebody who said 'I'd rather use my air fryer' is served fewer dishes
   for having said so."* A pantry is a `prefers`-shaped fact, not an allergy. Putting it in
   `servable` is the mistake the kitchen record exists to stop.
2. **The per-slot cap is the only scarce thing a preference can be scarce against**, and 14 of
   its 19 are already spoken for by the appliance (`Rotation.ts:133`).
3. **A band miss ends the preference.** `narrowerShares` walks the appliance share down
   (`Rotation.ts:156`), and if no rung holds, `wider_rotation` schedules from the whole library
   (`PlanGeneration.service.ts:572`), where `pickBest` honours pool order only inside `FIT_TIE`.
   `0102` measured the consequence: asking for the air fryer returned **fewer** of its dishes
   than not asking.
4. **`0045` outranks all of it by construction**, and that is the right order. Every day inside
   ±5% on all four macros is the promise; a pantry is not.

So, for the question asked directly — **where does the constraint belong**:

| place | what it would do | what breaks | does it keep `0045`? |
| --- | --- | --- | --- |
| **the model's prompt** (`PoolPrompt.ts:492`) — mark pantry rows the way in-season produce is marked | steer the fresh dishes towards what they have | nothing breaks; it simply mostly does not work. It reaches 7 of 19 per slot, and `0102` measured steering at **34%** at best | **yes** — the gates and the scheduler are unchanged |
| **the pool filter** (`servable`, `RecipeController.ts:370`) | remove dishes needing something they lack | the library collapses per slot (§ 4.1), and `packages/core/AGENTS.md`'s rule that a preference may never shrink a pool | **no.** Below 19 a slot the scheduler cannot fit the bands, so every fortnight goes to the rescue |
| **the scheduler's pick** (`rotatePool`, `Rotation.ts:362`) — a rank and a share, after the food groups | reorder what each slot's cap takes | the appliance's 14 of 19 has to be re-apportioned (§ 4.3), and the quota can itself cause the band miss | **yes, and only here** — because `narrowerShares` takes the share away before the bands are missed, so the promise outranks the pantry by construction |
| **the rescue** (`wider_rotation`, `PlanGeneration.service.ts:572`) | nothing it could usefully do | it is where a constraint goes to die: the pool becomes the whole library and `pickBest` reads pool order only inside `FIT_TIE` | the rescue exists *to* keep `0045`; carrying a preference into it would be the thing that stops it |

### 2.2 The shopping list already models "I have this much"

`shopping_list_items` carries, per ingredient per plan: `totalGrams`, `perDay` (the grams every
day of the plan owes), `boughtGrams`, `gramsPerUnit`, `dryRounded` and `addedManually`. The
amount is typed as well as ticked (`0096`), `fromDisplay`/`toDisplay` are inverses
(`ShoppingList.ts:301`), and **a bought amount is already carried across a rebuild by
ingredient, capped at the new need** — `carriedBought` (`PlanRepository.ts:1417`) inside
`replaceGeneratedItems` (`:1454`), so a swap or an event does not undo a shop already done.

That is reading (c)'s whole machinery, already written and already tested. What it lacks is a
*free-standing* pantry: today the amounts belong to one plan and die with it.

### 2.3 The prompt is already a catalogue, and that is the cheapest lever on the fresh third

A request's prompt lists the ingredients the model may use, by slug, one aisle per line, with
produce split into three groups and **in-season rows marked as preferred and listed first**
(`aisleRows`, `PoolPrompt.ts:492`; `IN_SEASON_HEADING`, `:478`). A pantry could be marked the
same way with no new prompt line and **no free text reaching the model at all**. Two bounds on
what that buys:

- it reaches only the **fresh** share — `FRESH_DISHES_PER_SLOT` is 7 of 19 (`Rotation.ts:59`),
  so at most a third of the pool and less of the plates;
- `0102` measured the ceiling on steering a model towards a property of a dish: **34%**, asking
  as hard as this machinery can ask (`0102` § *Asking as hard as the machinery allows*). The
  rule in `packages/core/AGENTS.md` is blunt about it — *"never answer a thin appliance by
  strengthening the prompt"*.

## 3. Amounts, which is the hard part

### 3.1 The arithmetic, and why depletion does not fit

A pantry holds 300 g of rice; a fortnight of three-meal days needs upwards of a kilo. Measured,
on the local library: a 41-dish fortnight (the distinct-dish count `0102` reports for a real
plan) draws on **99–115 distinct ingredients**, of which **73–88 are not seasonings**, and a
day's plates are sized by the scheduler to that day's macros, not to a larder.

Depleting a pantry across fourteen days means a **budget shared by 56 plates**. Nothing in the
scheduler couples days that way today: it picks per slot against macro fit, plate limits and
the fortnight's food-group table, and a day is scheduled without knowing what another day
spent. Adding a consumable resource shared across the fortnight is not a constant to tune — it
is a different optimisation, and it would sit underneath `0045`, which every day must still
satisfy. On the evidence of what the appliance share did to the bands with a *static* 14-in-19
quota, a dynamic quota that changes as days are filled is the single most expensive thing this
feature could ask for, and the first to produce a `wider_rotation` rescue that throws the whole
thing away.

**So: no depletion, and no amounts in the scheduler.** A pantry entering generation is a
**set**, not a budget.

### 3.2 Where amounts do belong, and they already live there

On the list. `boughtGrams` is exactly "I already have this much of that", it is already capped
at the row's need, already carried across rebuilds, and already typed by the person in the row's
own unit. A pantry that says *"300 g de arroz"* becomes, at list-build time,
`boughtGrams = 300` on the rice row — and `rangeQuantity` then shows the remaining 900 g under
every filter, with no new arithmetic anywhere.

That is the version with amounts that needs no scheduler state, and it is reading (c).

### 3.3 Is there a version with no amounts, and is it still his feature?

Yes to the first — reading (b), a set of slugs ranking the pool. **No to the second.** Without
amounts, a pantry cannot say *"this is enough rice for four lunches"*, so the plan it produces
leans on foods the person has *some* of and the shopping list still asks for most of the weight.
Said plainly: the no-amounts version is *"your fortnight will use your rice"*, not *"your
fortnight is built from your rice"*.

### 3.4 Units, and "dos latas de atún"

`measurement_unit` is `g | ml | unit | tbsp | tsp | cup | slice | pinch` (`_enums.ts:52`).
There is no `can`, no `tin`, no `packet`. A tin of tuna is a `unit` whose `gramsPerUnit` the
catalogue row would have to carry, and most catalogue rows carry none. **Parsing "dos latas"
into grams is a guess with no data behind it**, and `food.schema.ts` says why `gramsPerUnit`
exists at all: *"so 'two eggs' becomes grams without a guess."*

The recommendation is therefore a number plus the row's own `defaultUnit`, offered after the
text has resolved to a catalogue row — the same shape `0096` chose for a typed bought amount,
and for the same reason. An amount nobody can convert is stored as **presence with no quantity**
and the screen says so; it still ranks, it just cannot pre-buy a row.

## 4. Does it defeat itself the way the appliance share did?

### 4.1 The hard filter, measured

Method, stated so the figures can be argued with. For each pantry size *K*, the pantry is the
**K most-used non-seasoning ingredients of the library** — the best pantry anybody could own,
chosen with knowledge nobody has. Seasonings are **presumed present and not declared**: the 75
ingredients whose median use is ≤ 10 g (salt, EVOO, pepper, paprika, cinnamon, oregano, bay,
garlic powder…), which is a design assumption and the generous one. A dish is *cookable* when
**every** non-seasoning ingredient it names is in the pantry. **Measured, library-level,
best-case pantry**, 1,594 `es-ES` dishes:

| pantry size | cookable dishes | share of the library |
| --- | --- | --- |
| 10 | 233 | 14.6% |
| 15 | 267 | 16.8% |
| 20 | 278 | 17.4% |
| 30 | 342 | 21.5% |
| 45 | 469 | 29.4% |
| 60 | 599 | 37.6% |
| 100 | 885 | 55.5% |
| 150 | 1,191 | 74.7% |

**And the number to watch is a slot, not a library** — `0102`'s own sentence. Per slot, same
method, against the **19 the rotation needs**:

| pantry size | breakfast | morning snack | lunch | afternoon snack | dinner | supper |
| --- | --- | --- | --- | --- | --- | --- |
| 15 | 232 | **2** | **10** | **2** | 21 | **0** |
| 30 | 240 | **5** | 41 | **5** | 62 | **0** |
| 60 | 264 | 33 | 132 | 80 | 141 | **11** |
| 100 | 291 | 49 | 266 | 105 | 272 | 19 |
| the whole library | 432 | 163 | 530 | 278 | 548 | 62 |

Read it three times before it is believed, because every reading makes it worse:

1. **It is an upper bound on the pantry.** A real person's fifteen items are not the library's
   fifteen most-used. Their pantry does strictly worse than this table.
2. **It is the library, not a person's pool.** `servable` has not run. `0102` measured each of
   the fourteen profiles' pools at **382–855 of 1,084 dishes** — 35% to 79%. Apply the thinnest
   of those to the 30-item row and a gluten-free account's lunch is around **17 dishes, under
   the 19 the rotation asks for, in the best case of the best case**.
3. **`avoidSlugs` has not run either.** Last fortnight's dishes and every dislike come out after
   that.

**So reading (a) fails at the slot, not at the library**, and it fails first at the snacks: 2 and
2 at fifteen items, 5 and 5 at thirty. A four- or five-meal profile — half of the evaluator's
fourteen — has no fortnight at all under a hard filter. That is a *No* that no constant can tune
away. Read precisely: **at 60 items every slot but supper clears 19 at library level** (33 at the
morning snack is the thinnest), and that is exactly where the second reading above bites — 33
multiplied by a thin profile's 41% is **about 13**, under the cap again. So the first pantry size
at which a hard filter is even arguable for a five-meal profile is somewhere **above sixty
typed items**, and nobody types sixty foods into a box.

### 4.2 And the boolean leaning is the opposite failure

The other end of the spectrum is what is already shipped: a dish that uses something you have
goes to the front of the pick. **Measured, same library, same staple assumption:**

| pantry size | uses ≥ 1 pantry item | ≥ 2 | half or more of its real ingredients | all of them |
| --- | --- | --- | --- | --- |
| 15 | 1,371 (86%) | 979 | 768 (48%) | 267 (17%) |
| 30 | 1,421 (89%) | 1,175 | 1,102 (69%) | 342 (21%) |
| 60 | 1,556 (98%) | 1,371 | 1,414 (89%) | 599 (38%) |

A boolean bucket holding 86% of the library is **not a preference, it is a no-op** — and worse
than a no-op, because `isPreferredDish` is one bucket for four leanings (`Rotation.ts:247`) and
a pantry entering it would **dilute the appliance share's own bucket** the way four liked
cuisines diluted the air fryer. `packages/core/AGENTS.md` asks for exactly this check: *"If you
add a fifth leaning, ask what it does to this one before you put it in the same bucket."* The
answer is: it swallows it.

**The only axis with a usable spectrum is a rank: how many items would I have to buy for this
dish.** It is 0 to 13 (max ingredients per dish, measured), it discriminates at every pantry
size, and it is not a filter. That is the primitive this feature needs, and the code does not
have it — `isPreferredDish` returns a boolean, and `applianceShare` (`Rotation.ts:282`) takes
the first *N* of a partition in shuffled order, with no rank inside it.

### 4.3 Which leaves one real design question, and it is arithmetic

`APPLIANCE_DISHES_PER_SLOT` is **14 of 19**, measured twice and saturating there. **A second
share cannot also be 14.** Three compositions are possible and this report deliberately does
not choose between them, because the choice is what a measurement is for:

| composition | what it means | the obvious objection |
| --- | --- | --- |
| **a sort key, no quota** | the pantry rank orders the dishes *inside* the appliance share and inside the remainder; it takes nothing | nothing is scarce for it, so it may be worth as little as the order alone was for the air fryer (`0102`: 3 dishes in a pool of 672) |
| **its own quota out of the 5 that are left** | the pantry gets a share beside the appliance's | 5 of 19 against an appliance's 14 is a very junior partner, and both still have to give way to the bands |
| **they compose** | dishes that are both preferred-appliance *and* pantry-cheap go first, then each alone | the most promising and the one with the most ways to go wrong; it changes `applianceShare`, which `0102` measured, so it re-opens a settled constant |

Whatever is chosen, two things are not optional:

- **a rung on the ladder.** `narrowerShares`, `withApplianceShare` and the stored `kitchenShare`
  are appliance-only today (`Rotation.ts:156`, `:174`; `PlanGeneration.service.ts:511`). A
  pantry quota with no rung is the cliff `0102` already paid for: the quota displaces the
  macro-fitting dishes, the day misses a band, `wider_rotation` fires, and the pantry is lost
  **along with the rotation's variety, its avoid list and its food-group reserves**.
- **a figure stored on the plan**, as `kitchenShare` is, so what the bands cost the pantry is
  countable rather than invisible.

## 5. Free text: «arroz, pollo, dos latas de atún»

### 5.1 What must be enforced in code

**Resolution to catalogue slugs, in code, with no model involved.** The two precedents already
in the tree bracket the problem, and they disagree on purpose:

- `matchCustomAllergen` (`Safety/CustomAllergen.ts:131`): normalised exact match plus a curated
  synonym list, **and nothing else** — no stemming, no substring, no edit distance, and *no
  group word*, because resolving «marisco» to one member leaves the rest on the plate under an
  interface claiming the allergy is enforced.
- `isEnforceableDislike` (`Preference.ts:491`): exact match plus `GROUP_LABELS` (`:461`), which
  deliberately **expands** a group word, with the reason written beside it: *"the risk runs the
  other way."*

**A pantry is the dislike side of that line, not the allergy side.** The failure mode of a wrong
match is a dish somebody cannot cook tonight — annoying, never harmful. So group words may
expand, and the matcher may be the generous one. What it may **not** do is claim a safety
property: a pantry never adds to and never subtracts from `SafetyProfile`, and
`SafetyController.getSafetyProfile` stays the only place one is assembled (an `ARCHITECTURE.md`
invariant).

### 5.2 What may be a model call: nothing, and that is the point

The prompt already lists the catalogue by slug (§ 2.3) and the `LIKES:` line already carries
*"the catalogue's own names — never the words they typed"* (`PoolPrompt.ts:326`, `:1023`). So a
pantry can reach the model **as marked catalogue rows and nothing else**, which:

- keeps `0100`'s exception at **one field** — the dish request stays the only free text a person
  writes and a model reads, and `health-boundary.spec.ts` keeps meaning what it says;
- needs **no new consent and no new recipient**, because nothing new leaves the process;
- costs nothing, because the marking rides a prompt that is already built.

A model call *would* be needed for one thing only — reading an unstructured paragraph into a
list — and that is a convenience worth refusing. A chips-and-autocomplete field against the
catalogue does the same job with a known answer, and the 417 ingredients that actually appear in
recipes are a short enough list to offer.

### 5.3 What happens to an entry the catalogue does not have

1. **It is stored as typed, with a null ingredient id** — exactly `food_preferences`' shape
   (*"Null when the user typed something not yet in the catalogue"*, `food.schema.ts`) and
   `custom_allergens`' shape.
2. **It is shown back, per entry, as not recognised.** `ARCHITECTURE.md`'s rule for a free-text
   allergy applies in spirit and is cheaper here: *"enforced or declared unenforceable — never
   quietly neither."* The interface must never aggregate "12 ingredients saved" over 9 that
   matched and 3 that did not.
3. **It reaches nothing.** No prompt, no rank, no list row. An unresolved word is a note to the
   person and, in aggregate on `/admin`, the best catalogue-gap signal this product could have.

## 6. Data and privacy

**A new table, user-owned.** The shopping list cannot carry it (`shopping_lists.planId` is
`notNull().unique()`), and `food_preferences` must not: a pantry is perishable and a preference
is not, and overloading `sentiment` would put a fact with a lifetime in a table built for one
without. `0102`'s precedent is the shape to copy — *"what a person said lives in rows"* —
`userOwned('pantry_items', …)` with `label`, nullable `ingredientId`, nullable `grams` and
nullable `unit`.

**The uniqueness is two indexes, not one**, and this is the detail a first draft gets wrong:
Postgres treats NULLs as distinct, so a plain `unique(userId, ingredientId)` lets every
*unresolved* label in twice over. It wants a **partial unique index on `(userId, ingredientId)
where ingredient_id is not null`** plus a second one on `(userId, <normalised label>)` for the
rows with no id. The reason it belongs in the database rather than in a read-then-insert is the
one `kitchen_equipment_one_per_appliance` is written down for: a double tap under READ COMMITTED
has both requests reading "no row yet".

**Lifetime is the design question, and the cheap answer is the honest one.** Food goes off, and
nothing in this product can know when. Three options, with a recommendation:

| lifetime | what it promises | verdict |
| --- | --- | --- |
| **an input to one generation**, cleared or marked spent afterwards | *"what do you have right now"* | **recommended.** It needs no freshness model, no reminder, no "is this still true", and it matches how a person would actually use it — you type your larder when you are about to generate. |
| a standing larder with per-row dates | *"we track your pantry"* | a second product, and one that goes wrong silently the first time somebody forgets to update it |
| a standing larder with no dates | *"we think you still have that yoghurt"* | the worst of the three: it ages into nonsense and the person cannot see it happening |

**Ownership and deletion** come free: `userOwned` references `user.id`, and every user-scoped
table cascades on delete — *"that cascade is the privacy control, not a convenience"*
(`ARCHITECTURE.md`). Deleting one row is the person's, like a kitchen stance.

**For `legal` to look at — named, not analysed.** (i) A new free-text field a person types,
stored under their account; whether `/privacidad`'s current description of what is collected
covers it, or needs a line. (ii) Retention: whether the recommended "spent after one generation"
lifetime is what the policy should say, and whether a spent list is deleted or kept. (iii) The
DSAR export and the account-data route: a new table that holds typed text has to appear in both.
(iv) Confirmation that resolving to slugs and sending **only slugs** leaves `0100`'s published
boundary — *the dish name is the only free text a model reads* — intact, so no consent version
moves. (v) Nothing here is health data and nothing may become it: a pantry entry must never be
read as an intolerance, a diet or a condition, and a screen must not invite that.

## 7. Cost and effort

**Infrastructure: zero.** One table, one screen, library-side logic, no new provider, no new
store, no cron, no quota. The Neon free tier carries a short per-user table; the Vercel function
limit is untouched because nothing new is generated.

**Model spend: zero**, for every shape recommended here. Reading (c) touches no prompt. Reading
(b)'s rank is computed from `CandidateDish.ingredients`, which the pool already holds. Marking
pantry rows in the catalogue listing adds tokens to a prompt that is already sent — a few dozen
slugs against a lunch request's ~4,100 tokens (`0062`), so it is noise rather than a cost, and
`catalogue-by-meal.mjs` can price it exactly if anybody doubts that.

**Effort, in ranges, with the variable that drives each.** These are **estimates**, and the
variable in every row is whether the measurement in § 8 comes back green.

| piece | effort | driver |
| --- | --- | --- |
| `--pantry` on the evaluator + the cohort sweep (no product code) | 0.5–1 day | whether the rank needs a new `PoolReserve` to be measurable at all |
| the table, the resolver, the screen, the API (reading (c) only) | 2–4 days | the screen: a chips field with catalogue autocomplete and an unresolved state |
| seeding `boughtGrams` from the pantry at list build | 0.5–1 day | small: `carriedBought` is the function to reuse |
| the rank, its share, its rung and `pantryShare` on the plan | 3–6 days | which composition § 4.3 wins; re-opening `applianceShare` is the expensive branch |
| the per-meal filter (*"¿qué hago hoy con lo que tengo?"*) | 2–3 days | the swap path already asks for 3 candidates (`MealSwap.service.ts:32`) and is library-first |

**The owner's time**: two decisions (§ 9), one `/local-probe` pass on the screen, and the usual
review of whatever reaches production.

## 8. Risks

Safety, privacy and quota first, as the ordering rule asks.

| risk | who it reaches | likelihood | how it is seen | how it is undone |
| --- | --- | --- | --- | --- |
| **A pantry read as a safety claim** — somebody types «sin gluten» or «nada de marisco» into the pantry box and believes it binds | anybody with an allergy | low with a careful screen, **catastrophic if it happens** | nothing mechanical sees it; the defence is that the field never reaches `SafetyProfile` and the screen never says "evitar" | the field is a list of foods you *have*, worded so, and the allergy screen is the only place an exclusion is typed |
| **Free text reaching a prompt** — a later edit passes the typed label instead of the resolved slug | every account, through the shared `recipes` table and the picture prompt | low, and exactly the proximity risk `0100` already carries | only a test: `health-boundary.spec.ts`'s shape, extended to drive this path and fail if a typed label comes out the other side | revert; nothing stored is shared, so the exposure ends with the deploy |
| **The band is spent and the pantry is lost anyway** — the measured `0102` failure, repeated | everybody who fills the pantry in | **high** if a quota ships without a rung | `plan-evaluator`'s rescue count, and `fallback` on the plan | the rung, and the stored share figure, before anything ships |
| **The feature is worse than silence** — asking for your pantry returns fewer of its dishes than not asking, as the air fryer did | the people who used it | moderate | the same sweep: plates with a pantry item, with and without | it is a defect and not a trade; it goes back to the order-only shape |
| **A promise the library cannot keep** — reading (a) shipped at any scale above one meal | a 4- or 5-meal profile first | certain, measured in § 4.1 | the thinnest-slot figure | do not ship reading (a) for a plan |
| **An unresolved entry read as resolved** — "12 saved" over 9 matched and 3 not | anybody with a food the catalogue lacks | moderate, and it is a UI failure not a logic one | the screen | per-entry state, never an aggregate |
| **Neon transfer** | development, which shares the quota | low | the Neon dashboard | measure on local Postgres, which is the standing rule anyway |

## 9. Plan

Phases small enough to ship one at a time, each with a success metric and a stop signal. **Phase
0 writes no product code and is the only phase that should start before the owner decides
anything.**

**Phase 0 — price it before building it.** `plan-evaluator` adds `--pantry <slugs>` to
`apps/api/scripts/evaluate-plans.mjs` in two modes, `filter` and `rank`, and runs the fourteen
profiles × three seeds with **realistic** pantries (not the top-K of § 4.1 — three or four
hand-written larders of 15, 30 and 60 items, the kind a person actually has) and with
`--flag accompaniments`, which `packages/core/AGENTS.md` says a kitchen measurement is not a
measurement without. It reports, per profile: the servable pool per slot against **19**, days in
band against **588/588**, rescues against the **8–9** baseline, plates using a pantry item, and
**shopping-list rows against the no-pantry run**.
*Success*: `rank` holds 588/588 with rescues **not above** baseline and moves list rows down by a
figure worth a screen. *Stop*: any slot under 19, or rescues above baseline — then the feature is
reading (c) only, and that is the honest outcome.

**Phase 1 — the pantry exists and the list reads it.** The table, the resolver (§ 5), the screen,
and `boughtGrams` seeded at list build through `carriedBought`. No generation change at all.
*Success*: a real fortnight's list comes back with the pantry's rows pre-bought and the remainder
correct under every range filter; the probe passes at 320/390/1280 in both appearances.
*Stop*: if the screen cannot make "not recognised" legible per entry, the field is not ready.

**Phase 2 — the rank, measured, behind a flag.** Whichever composition phase 0 priced, with its
rung on the ladder and its figure stored on the plan. *Success*: the phase-0 figures reproduced
on the cohort, plus plates using a pantry item with their **spread over at least eight seeds** —
a number quoted for one plan is quoted with its spread or not at all. *Stop*: rescues up, or
plates with a pantry item no better than the no-pantry run.

**Phase 3, optional — one meal from what you have.** The per-meal filter through the swap path,
where the filter needs one dish and not nineteen. *Success*: the route answers for every one of
the fourteen profiles with a 15-item pantry, from the library, with no model call. *Stop*: if it
cannot, the pantry is thinner than § 4.1 suggests and phase 2's figures should be re-read.

**Phase 4 — the catalogue gap.** Unresolved pantry entries, aggregated on `/admin`. It costs
almost nothing and it is the only part of this feature that pays for itself in the library.

## 10. What I do not know

- **What the rank is worth.** Every figure in § 4 is library-level and read with a best-case
  pantry. What a real pantry does to a real fortnight's plates, bands and rescues can only come
  from the phase-0 sweep. I did not run it, by instruction and because an unbuilt `core` measures
  nothing.
- **Which composition of § 4.3 wins.** Sort key, its own quota, or composed with the appliance's
  — that is a measurement, not an argument, and re-opening `applianceShare` has a settled
  constant behind it.
- **Whether the weaker promise is worth selling.** One row in four at thirty items is the bound;
  whether that reads as a feature or as an anticlimax is `marketing`'s and the owner's.
- **Whether a standing larder is wanted.** I recommend the one-generation lifetime because it
  needs no freshness model. If the owner wants a larder that persists, the question of what
  happens to a yoghurt nobody updated is his to answer first.
- **What `legal` says** about a new typed field, its retention and the DSAR export (§ 6). I named
  it and did not analyse it.
- **Production's own shape.** Every number here is the local library (1,594 `es-ES` dishes);
  production holds 1,426 `es-ES` dishes per the lead's brief, and the two are not the same
  library. The ratios should carry; the counts will not.

### The two decisions that are the owner's

1. **Which product this is.** (c) alone — *fewer things to buy* — or (c) then (b), the plan
   leaning on what you have. (a) at plan level is not on the table, and this report's § 4.1 is
   why.
2. **The lifetime** of the list: an input to one generation, or a standing larder.

Marketing owns the tier and the limit, and one note for them from the code side rather than a
decision: **a cap on pantry items hurts this feature**, which is the opposite of the appliance's
`MAX_PREFERRED_APPLIANCES`. Coverage rises monotonically with the number of items (§ 4.1), and
nothing in the code needs a bound — the rank works at any size and the per-meal filter works at
any size. If a number is wanted for a reason that is not the code's, the code will hold whatever
it is.
