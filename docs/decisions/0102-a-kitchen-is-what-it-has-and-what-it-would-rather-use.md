# 0102 — A kitchen is what it has, and what it would rather use

- **Date**: 2026-10-15
- **Status**: accepted. **The constraint half's numbers are in** — measured 2026-10-16,
  § *What it costs, measured* below. **The preference half's are still owed**: it takes one
  real generation against the production provider (project 021 phase 6 step 3), which is
  the owner's to run.
- **Builds on**: [`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md) (every day
  to all four macros), [`0052`](./0052-a-supplement-is-for-the-people-who-take-it.md) (an
  exclusion the prompt, the library and the gate all agree on),
  [`0100`](./0100-a-person-may-name-a-dish-and-the-gate-is-on-what-comes-back.md) and
  [`0101`](./0101-a-day-can-hold-two-fixed-meals-and-the-second-is-offered-from-what-fits.md)
  (the screen a kitchen is described on, and the reasons a dish is not offered).

## Context

Nothing in this product knows what a kitchen has. The dish a model writes declares a name,
a cuisine, a difficulty, its slots, its minutes, its servings, its ingredients and its
steps — and no equipment, so the only mention of an oven anywhere is prose inside a step.

Measured by what the steps name, in both libraries (read 2026-10-15). **Production, 962
dishes** (500 seeded, 462 model-made): stovetop 630, oven 79, steam 45, microwave 21,
blender or processor 20, **pressure cooker 2, air fryer 1**. The development library, 1128
dishes: stovetop 824, oven 68, microwave 20, blender 20, pressure cooker 1, air fryer 1. Two things follow. Someone with no oven is being served oven
dishes. And someone who prefers an air fryer cannot be served one by filtering, because
there is one dish to filter down to — a preference is only real once the model is asked
for it.

The owner asked for both halves on 2026-10-15, and asked in the same breath whether the
cooking time serves any purpose, because every dish he sees is quick. It does: the prompt
carries `MAXIMUM TIME PER DISH`, `withinTime` gates what the model returns (the limit plus
a fifth, rounded up to the next ten) and filters what the library may reuse, and it is the
`too_slow` refusal in the fixed-meal offer. What it is not is expressive — one number for
fourteen days, no notion of technique, a default of 30 that admits 40 while the library's
stewed and roasted dishes run 50 to 90 — and `difficulty` is stored on every dish and read
by nothing. That is a second problem with a different shape, measured on its own after
this one (the owner, 2026-10-15).

## Decision

**A kitchen is three states per appliance: it is not there, it is there, or it is what they
would rather use.** "Would rather" implies having it. Silence is not a state: somebody who
says nothing has **a normal kitchen** — stovetop, oven, microwave **and a blender** —
because the alternative is asking everybody about an air fryer at sign-up, and a question
nobody has to answer is one more reason to leave.

**The blender was added on 2026-10-16, by the owner, after the measurement.** It was one of
the seven this record left out, and the backfill then found that **20 of production's 962
dishes require one** — smoothies, creams and purées, mostly at breakfast and the snacks —
while no screen exists to say otherwise until project 021 phase 5. So `missing` meant taking
those dishes from *every* account without asking, with no way for anybody to correct it. The
reasoning is this record's own asymmetry, pointed at the default instead of at an
unclassified dish: **the error that costs everybody is worse than the error that costs the
minority who can then say so**, and a hand blender is in most Spanish kitchens. Somebody
without one meets a gazpacho they cannot blend, sees the appliance on the dish (criterion 5)
and says "no tengo" once. What the default still lacks is the air fryer, the pressure
cooker, the grill, the steamer, the slow cooker and the rice cooker — against production
that is **one dish of 962**, which is the honest size of the constraint this feature turns
on today, and the reason phase 8's supply work is the half that matters.

**The catalogue is code, not reference data.** An appliance links to nothing in the
database — unlike an allergen, which links to ingredients — so it is an enum in
`packages/core` with its names in the dictionaries, where the screen needs them anyway. A
seeded table would buy a migration per appliance added and nothing else.

**What a person said lives in rows, the way a cuisine preference does**: one
`userOwned('kitchen_equipment', …)` row per appliance they spoke about, with two Postgres
enums (the appliance, the stance). No row is the default kitchen.

**A dish's equipment is `text[]`, exactly as its slots are** (`recipes.mealSlots`), so a
dish declares the appliances it cannot be cooked without — not the ones it may use.

**"Does not have" is enforced in code; "would rather use" is asked of the model.** The two
halves are different kinds of claim and they get different machinery:

- Missing equipment is a constraint, like an allergy and like the cooking time: it is a
  prompt line, a gate on what the model returns, and a filter on what the library may
  reuse — the three places `withinTime` already lives, so the plan, the offer and the model
  cannot disagree (`0052`'s rule).
- A preference is a prompt line and the order the library is read in, and nothing else. It
  may not remove a dish: a person who prefers an air fryer still eats on the days the
  library has none.

**A dish nobody has classified counts as stovetop.** The backfill reads prose, and prose
is not a declaration: a dish whose steps name no appliance is treated as a pan, which is
what 824 of 1128 are. The cost of being wrong is asymmetric and known — an unclassified
oven dish reaches somebody who has no oven until the model rewrites it with the field —
and it is stated rather than hidden, because the alternative (treating unknown as "needs
everything") would empty the library for every kitchen that is missing anything.

## Consequences

- **The declaration is shown to the person, not only used to filter** (the owner,
  2026-10-15): a dish's detail lists the appliances it needs, an icon and a name each. That
  raises the bar on the backfill rather than lowering it — an inference nobody checked is now
  something somebody reads, so a dish classified from prose that names no appliance shows
  nothing at all instead of claiming a pan, and the model's own declaration replaces the
  inference as the library is rewritten.
- **A ninth reason a dish is not offered** as a fixed meal, actionable, said apart from
  `too_slow` and `clashes_with_fixed` (`0101`) because the way forward differs: another
  dish, or an appliance they do not have.
- **The evaluator prices it.** It already resolves preferences through the same
  `resolvePreferences` and reads the same `reusablePool` the API does, so a flag naming a
  missing appliance measures the library each of the fourteen profiles loses, and whether
  their days are still inside 5% on all four macros (`0045`). No model is called.
- **The preference half owes a number, not a feeling.** With an air fryer preferred, a
  generation must come back with air-fryer dishes — measured once against a real provider,
  because a stubbed model cannot answer whether a prompt works.
- **Adding an appliance to the catalogue is adding a promise.** A preference the library
  cannot serve is a hint, which is what `marketing` refused to let this feature sell: so an
  appliance is in the catalogue once the library can offer what the rotation needs for a
  fortnight with it (`DISHES_NEEDED_PER_SLOT`, 19 today), or the shortfall is stated where
  somebody reads it. The first batch is project 021 phase 8 — drafted through the pool
  builder so each dish declares its own equipment, validated and tuned as the five hundred
  were, loaded by the owner on `develop` and then on production. Production held 1 air-fryer
  dish and 2 pressure-cooker dishes of 962 when this was written (2026-10-15).
- **What this does not do**: it does not convert a dish to another appliance ("hazme esto
  en airfryer"), does not model the hob (gas, induction, how many rings), does not ask
  about pans, knives, boards or scales, and does not touch the cooking time.
- **It is free, both halves, and it is not in `Allowance.ts`** (`marketing`, 2026-10-15:
  [the report](../reference/marketing/the-kitchen-a-person-has.md)). Nothing here is
  counted, so there is nothing to sell: the constraint half has the shape of the maximum
  cooking time and the preference half is the mechanism `PREFERRED CUISINES:` and `LIKES:`
  already are, all of them tier-blind. **The one bound is not a price**: at most three
  appliances may be marked *prefers*, the same on both tiers, said on the screen before it
  is hit; *does not have* is never capped. A tier would still be a row an admin edits
  (`0097`), which is why keeping this out of the table is a decision and not an omission.
  The sentence that report asks this record to carry, because a future reader needs the
  reason and not only the verdict: **a profile field that narrows or steers a plan has
  never been sold here, and this is not the first.**

## What it costs, measured (2026-10-16)

Four runs of `evaluate-plans.mjs` over the fourteen fixed profiles, on the real local
library, read-only, with no model called (`AI_PROVIDER=stub`): the default kitchen, then
the same kitchen saying *no oven*, *no blender*, and *no oven, no microwave, no blender*.
Project 021 phase 6; the files are named in that project's `LOG.md`.

**The counts below are the `equipment` column, not prose.** The Context section above
counts the appliances a dish's *steps name* (read 2026-10-15, before anything was stored);
these count what each dish now **declares**, after migration `0067`'s backfill, which only
classifies a dish when its steps name an appliance *and* do not offer it as one choice
among several. The two will not agree, and the declaration is the one the product obeys.
Local library, es-ES, 1,084 dishes (ai 584, seed 500): **stovetop 1,041, oven 58, blender
20, microwave 3** — the union of the three non-hob appliances is **81 dishes, 7.5%** — and
every es-ES dish declares something. Oven dishes sit at dinner (43) and lunch (34); the
blender's twenty are breakfasts (10), afternoon snacks (9) and morning snacks (7), and
none at lunch or dinner. Production, read the same day (962 es-ES dishes, **none
undeclared**): stovetop 917, **oven 65, blender 20, microwave 3, pressure cooker 1** — 89
dishes beyond the hob, 9.3%. **No dish anywhere needs two appliances beyond the hob**:
the 38 local dishes that declare more than one pair an appliance with the hob.

**Six of the ten appliances in the catalogue have no dish at all** — five in production —
and the air fryer is one of them: **zero** dishes declare an air fryer, a grill, a steamer,
a slow cooker or a rice cooker in either library, and the pressure cooker has one dish in
production and none locally. Four appliances carry the whole library: the hob, the oven, the
blender and the microwave. The "1 air-fryer dish of 1128" this record's Context reports
was counted from prose, and **the dish was read rather than assumed about**: it is
*Hamburguesa de ternera con queso cheddar, cebolla dorada y patatas gajo*, whose step says
*"Precalienta el horno **o** la freidora de aire a 200 °C"* — an alternative, so `0067`
declared it `{stovetop}` and dropped both the oven and the air fryer, which is the rule
working and not a gap in it. That makes § *Adding an appliance to the catalogue is
adding a promise* stricter, not looser: six appliances can be marked *prefers* today with
**nothing in the library to reuse for any of them**, so the preference half rests entirely
on the model writing new dishes — which is exactly what step 3 measures, and why no filter
could answer it.

**The default kitchen costs nothing, and that is now a measurement rather than an
argument.** A run with no kitchen at all and a run with the default kitchen produce
byte-identical pools, per-slot pools and days for all fourteen profiles — so of 1,084
local dishes, **none** is refused by a hob, an oven, a microwave and a blender. Against
production it refuses **one dish of 962**, the pressure-cooker beans. **Also measured: the
microwave is worth about nothing** (3 dishes, all breakfasts), so "the hardest kitchen"
below is really the oven plus the blender.

**What saying it costs, per profile** — the dishes the library may reuse, and in brackets
the share of that profile's pool:

| profile | the default | no oven | no blender | no oven, microwave or blender |
| --- | --- | --- | --- | --- |
| objetivo-bajo-3-comidas | 672 | 630 (−6.3%) | 666 (−0.9%) | 621 (−7.6%) |
| objetivo-alto-5-comidas | 855 | 813 (−4.9%) | 845 (−1.2%) | 800 (−6.4%) |
| alergia-lacteos | 456 | 424 (−7.0%) | 453 (−0.7%) | 421 (−7.7%) |
| patron-vegetariano | 549 | 543 (−1.1%) | 531 (−3.3%) | 522 (−4.9%) |
| quincena-con-evento | 831 | 789 (−5.1%) | 822 (−1.1%) | 777 (−6.5%) |
| alergia-personalizada | 684 | 649 (−5.1%) | 675 (−1.3%) | 637 (−6.9%) |
| alergia-personalizada-no-resuelta | 767 | 729 (−5.0%) | 759 (−1.0%) | 718 (−6.4%) |
| patron-halal | 794 | 754 (−5.0%) | 776 (−2.3%) | 733 (−7.7%) |
| patron-kosher | 720 | 688 (−4.4%) | 702 (−2.5%) | 667 (−7.4%) |
| patron-sin-gluten | 443 | 407 (−8.1%) | 435 (−1.8%) | **397 (−10.4%)** |
| patron-sin-lactosa | 480 | 447 (−6.9%) | 468 (−2.5%) | 435 (−9.4%) |
| imc-alto-2-comidas | 500 | 460 (−8.0%) | 499 (−0.2%) | 459 (−8.2%) |
| patron-tradicional-espanola | 566 | 534 (−5.7%) | 564 (−0.4%) | 529 (−6.5%) |
| tres-comidas-proteina-alta | 382 | 361 (−5.5%) | 381 (−0.3%) | 360 (−5.8%) |

**And it costs nobody a day.** Across the four runs — **56 profile-runs, 784 days** —
every profile reports `14 / 14 days inside 5% on all four macros` (`0045`), and every one
of the 56 reports no day out of band, no fall back to the whole library, no blocking
shortfall, no plate carrying a declared allergen, no variety violation, no plate over its
slot's ceiling and no share outside its limit. The energy floor (`0011`'s safety bound) was never
reached by any profile in any run.

**What it costs instead of a day is a little margin and a little variety.** The clearest
case is `patron-sin-gluten` in the hardest kitchen: mean absolute deviation on fat 1.0% →
2.2% and on protein 0.5% → 1.4% (both still well inside the 5% band), distinct dishes 52 →
50 of 56 slots, zero identical day pairs. Variety moves both ways across the fourteen —
`patron-kosher` improves to 56/56 — because what a missing appliance changes is the pick,
never a rule.

**The number to watch is a slot, not a library.** The rotation needs
`DISHES_NEEDED_PER_SLOT` (19 today) per slot, and the thinnest slot anywhere in the four
runs is `patron-sin-gluten`'s **breakfast: 37 → 29** without an oven, a microwave and a
blender — a 21.6% cut to the slot that was already the narrowest in the set (37 against
246–269 elsewhere), because the blender's dishes are breakfasts and the gluten-free
library is thin there. Nothing in 56 × slots fell below 19, so today it holds; ten more
gluten-free breakfasts classified as oven or blender dishes and **this is the profile that
breaks first**. It is the supply argument above, with a name on it.

**Still owed, and deliberately not faked**: the preference half. No run here calls a
model, so none of it says whether `PREFERRED APPLIANCES:` changes what comes back — that
is one generation against the production provider with the air fryer preferred, counting
air-fryer dishes in the fortnight against the **zero** production can reuse (phase 6 step
3, the owner's to run). The denominator makes the test sharp: every air-fryer dish in that
fortnight is one the model wrote because it was asked to.

(who decided: the owner, 2026-10-15 — the feature, and that the time question is measured
separately; the planner, the shape above, with the library's numbers in hand.)
