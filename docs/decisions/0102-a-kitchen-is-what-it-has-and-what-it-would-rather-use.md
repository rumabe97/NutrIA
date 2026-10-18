# 0102 — A kitchen is what it has, and what it would rather use

- **Date**: 2026-10-15
- **Status**: accepted, and **both halves are measured**. The constraint half on 2026-10-16
  (§ *What it costs, measured*). The preference half **twice**: **zero** from one real
  generation with an air fryer preferred (2026-10-16, same section), and **34%** when the
  model was asked for an appliance as hard as this machinery can ask (2026-10-17,
  § *Asking as hard as the machinery allows*). What is still owed is not a number but a
  **library**: 169 dishes are drafted for eight appliances and wait for the owner's load, so
  the prompt line cannot yet be re-measured against a library that has something to prefer.
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
  somebody reads it. The first batch is project 021 phase 8, drafted
  2026-10-17: **169 dishes through `PoolBuilder.build()` itself**, so each declares its own
  `equipment` and every one passed the gates a generation runs — the strict schema, the
  catalogue, the allergy gate, the serving ceiling (`0070`). **Not "tuned"**: this record and
  that plan both said "validated and tuned as the five hundred were", and no tuner exists in
  the tree; the four checks that phrase stood for are gates inside `PoolBuilder.judge`.
  **Eight of the ten appliances grew, the hob needed nothing, and the slow cooker got zero**
  for a reason that is not supply (§ *Asking as hard as the machinery allows*). The load is
  the owner's own command and is **still owed**: production held **0 dishes declaring an air
  fryer, a grill, a steamer, a rice cooker or a slow cooker of 972** on 2026-10-17, and 1
  pressure-cooker dish. The rehearsal on the local library ran clean — 1,130 → 1,299 dishes,
  no collision — so what stands between the promise and the library is one `psql`.
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

**The preference half, measured 2026-10-16, and the answer is zero.** The owner generated
a real fortnight on production with the air fryer marked *prefers* (his kitchen also says
`blender: missing`). Prompt **4.9.0** sent the line — `APPLIANCES THEY WOULD RATHER COOK
WITH — use these where the dish is as good for it: air_fryer` — to
`google/gemma-4-31b-it` over twelve calls and 84,996 input tokens. What came back: 21
dishes written, 9 distinct ones used by the plan, and **not one declares an air fryer or
so much as names one in its steps**. Across all 56 plates: **0 declaring, 0 naming.**
Every fresh dish declares `stovetop`, except two no-cook dishes that correctly declare
nothing at all.

So **`PREFERRED APPLIANCES:` changed nothing on this generation**, and three things have to
be said with it rather than after it:

- **The library half could not have helped.** 46 of the 56 plates were reused, and the
  library holds zero air-fryer dishes, so the preference could only ever have shown in what
  the model wrote.
- **The instruction is soft by design** — *"where the dish is as good for it"* — so a model
  judging that no dish was is not disobeying it. That softness is now a measured cost
  rather than a style choice.
- **The measurement covers what reached the plan, not everything the model wrote.** A dish
  is stored only if the plan used it, so the 12 unused dishes of the 21 are gone
  unexamined. And it is one generation on one model: it says what
  `google/gemma-4-31b-it` did, not what every model would do.

**What this does not undermine**: the constraint half, which was working on that same
account at that same moment. The plan came back **14 of 14 days inside 5% on all four
macros, zero advisories, no allergen**, with the owner's pinned tortilla honoured on both
of its weekdays — while `blender: missing` silently kept production's 20 blender dishes out
of his pool, and the gate recorded no `missing_equipment` refusal because the model never
proposed one. *Does not have* is enforced and demonstrated; *would rather use* asks, and on
this evidence is not yet answered. The honest reading is the one this record already
argued: **a preference is only real once the library can serve it**, so the catalogue grows
first (phase 8) and the prompt line is re-measured against a library that has something to
prefer.

## Asking as hard as the machinery allows (2026-10-17)

The zero above is one generation, and it leaves a question open: is `PREFERRED APPLIANCES:`
weak, or was it asked weakly? Project 021 phase 8 asked as hard as this machinery can ask —
the appliance marked `prefers`, **every other non-default appliance marked `missing`** so a
draft cannot need one nobody has, **and** a wish whose rendered line ends *"Every dish
proposed must satisfy that"*. 343 calls, 24 cells of appliance × slot, 0.3168 USD.

**The answer is 34%.** Of the dishes that came back and passed every gate, 177 declared the
appliance they were steered towards and **341 declared something else** — each one a good
dish answering a question nobody asked. Per appliance, dishes kept against calls made:

| appliance | kept / wanted | declared something else | declare rate |
| --- | --- | --- | --- |
| grill | 23 / 24 | 23 | 50% |
| blender | 33 / 34 | 36 | 48% |
| steamer | 23 / 24 | 25 | 48% |
| air_fryer | 30 / 36 | 40 | 43% |
| rice_cooker | 19 / 24 | 32 | 37% |
| microwave | 28 / 33 | 50 | 36% |
| pressure_cooker | 17 / 23 | 39 | 30% |
| oven | 4 / 24 | 58 | 6% |
| slow_cooker | **0 / 24** | 38 | **0%** |
| **total** | **177 / 246** | **341** | **34%** |

So the prompt line moves the number **off zero and no further**: three dishes in five still
come back cooked some other way, with the preference stated three times over. That is the
honest size of the preference half, and it settles the argument this record opened — **a
kitchen preference is worth what the library holds for it, not what the prompt asks for.**
Steering is a third; supply is the other two.

**Two of those rows are not supply problems, and saying which matters.**

- **A slow cooker cannot be expressed in this product.** `generatedDishSchema` bounds
  `cookMinutes` at 180 and a step's `minutes` at 240
  (`apps/api/src/modules/ai/prompts/pool.schema.ts:38`, `:94`), and `PoolBuilder.validate`
  parses that schema **before anything reads `equipment`**
  (`apps/api/src/modules/ai/services/PoolBuilder.service.ts:541`). An honest four-hour braise
  is therefore dropped as `schema` and never reaches its own declaration: **60 of the run's
  79 `schema` rejections are that one bound**, every one a slow cooker. What survives it is
  the model's fallback, a stew inside 180 minutes, which is a pot on the hob and declares
  `stovetop` — 38 of the 341. **No number of calls fixes this, and no cooking-time preference
  was involved** (the batch passed none). Nor is a raised constant the fix: lifting the bound
  hands a 480-minute dish straight to `withinTime`, which refuses it for everybody who set a
  limit. It needs the idea that **an unattended cook is not time at the stove**, which is the
  question this record already carved out for its own measurement ("the time question is
  measured separately", the owner, 2026-10-15) — now arriving with evidence, since **129 of
  the batch's 169 dishes fit a 30-minute limit and 40 do not**. Until that is answered the
  slow cooker's supply is zero, which § *Adding an appliance to the catalogue is adding a
  promise* permits as a stated shortfall. **Whether the catalogue keeps the appliance is the
  owner's call**, and it is cheap either way: production held **no slow-cooker stance at all**
  when this was written, the whole `kitchen_equipment` table being two rows.
- **An oven snack is a bad snack.** The oven's lunch and dinner are past the cap already, so
  the batch asked for its empty cells: breakfast came back **4 of 4** and the two snack cells
  **0 of 20**. The reason is in what the drafts declared instead — **53 of the 54 off-target
  snacks declared `none`, no appliance at all.** Asked for an oven snack the model writes
  yogurt, fruit, nuts and toast, because that is what a mid-morning snack is. The oven's 6% is
  not a shortfall to be drafted away; it is a fact about what an oven is for, and the model's
  refusal was better product judgement than the plan amendment it was answering.

**What this does not say.** Nothing here re-measures the preference half against a library
that has something to prefer — that needs the load and then one generation, and until both
have happened the 34% is a statement about **drafting**, not about a plan somebody is served.
On 2026-10-17 the owner generated a real fortnight on production with the air fryer still
`prefers`: 56 plates, **0 declaring an air fryer**, 53 hob-only — the 2026-10-16 result
again, for the same reason, because the library had not changed. What **did** show on that
plan is the other half working unremarked: **0 plates with a blender**, his `missing` stance
silently keeping production's 20 blender dishes out of his pool.

## A preference nobody can see is not a preference (2026-10-18)

The library arrived. The owner ran the load at 02:53 UTC — 169 dishes, 0 collisions,
production at 1,141 es-ES dishes with **30 declaring an air fryer** where it had none — and
generated a fortnight five minutes later, with the air fryer still `prefers`. It came back
with **0 air-fryer plates of 56**, and not one of the 169 new dishes on any plate.

**What it was not.** Each ruled out on the real rows rather than reasoned about: the stored
method (an array with cue, text and minutes, 2–8 steps, so `hasUsableMethod` passes);
`fitSlots`, which keeps 165 of the 169 and takes a dinner from only 4 (stewed pulses at a
Spanish dinner, `0079`); the season, which judges fresh fruit alone; the free-from
substitutes, the country scope, the time limit and his missing blender, which together
exclude none of the 24 air-fryer dishes servable to him; and any cache, of which there is
none. `servable` does drop 117 of the 169 **and that is the constraint half working**: a
rice cooker, a steamer and a pressure cooker are `missing` for him by the default kitchen,
so their dishes are correctly invisible.

**What it was: one bucket for four leanings.** `isPreferredDish` returns true for a liked
dish, a liked cuisine, a liked ingredient **or** a preferred appliance, and `rotatePool`
takes the per-slot cap from the front of that one partition. He had named four cuisines, so
the partition held **548 of his 672 servable dishes** and an air-fryer dish was **one in
22.8** of what the cap took. Measured with the real code, his real context and the seed his
plan used: **3 air-fryer dishes reached the pool and none reached a plate** — while the same
code with the kitchen as the only leaning put **24 in the pool and 22 on plates**. The
preference was not weak. It was diluted, and by the feature that was supposed to sit beside
it.

**The fix is a share, not a stronger prompt.** `APPLIANCE_DISHES_PER_SLOT` keeps a third of
every slot's cap for the appliances they would rather use — after the food groups, never
instead of them, because a legume minimum is what validation refuses a fortnight for and a
preference is not. A third because it is measured: on his own fortnight the share buys 0
plates at zero, 6 at three, 7 at five and 7 at seven, and above seven nothing — his air
fryer holds twelve lunches and twelve dinners, so the supply runs out before the cap does. It remains an **order and
never a filter**: the tail is still behind the share, and a kitchen nobody filled in rotates
exactly as it did before — asserted, not assumed (`Rotation.test.ts`).

**What it is worth, on his own fortnight, re-scheduled with everything the generation passes**
(accompaniments, the energy floor, the same seed, the same avoid list): the pool goes from 3
air-fryer dishes to 14, the plates from **0 to 8 of 56**, and the product's own validator
says **12 of 14 days in band — the same 12 of 14 the plan he was served scored**, missing on
the same two fat days his two fixed meals already cost him (71.4 g against 68). 41 distinct
dishes of 56, nothing served more than twice.

> **Read this figure with the next section.** That reproduction passed his pool, his seed and
> his avoid list but **not his two fixed meals**, and the pins are precisely what sends his
> fortnight down the rescue the next section is about. Eight plates is what the share is
> worth to a fortnight the rotation's own pool can keep in band. His cannot.

**What a preference costs, measured against saying nothing** (the same fourteen profiles and
three seeds, with and without `--prefer air_fryer`, 42 fortnights each): the bands hold —
**588 of 588 days in band without it, 587 of 588 with it**, no blocking violation either way
— and the fortnight's balance score falls from **0.846 to 0.769**. The movement is a trade
and worth naming rather than averaging: whole grain is met 14 points more often, eggs 13,
starches 7, and legumes, fish and oily fish each 2–3 — while **fish and shellfish together
fall 21 points, vegetables 19, meat 13 and processed food 10** (the last being an
improvement). The air fryer's 24 dishes are roast-and-crisp plates of tofu, cod, chicken and
root vegetables, so a fortnight that leans on them eats narrower. That is the honest price of
asking for one appliance out of a library of 24 dishes for it, and it is an argument for the
second batch rather than against the share: `vegetables` was already met on only 26 of 42
fortnights before any preference existed.

**What is still owed.** Eight plates of 56 is not criterion 8's fourteen, and no share can
buy them: the air fryer holds 12 lunch dishes and 12 dinner dishes, and the rotation asks for
19 a slot (`DISHES_NEEDED_PER_SLOT`). From here the lever is supply, exactly as
§ *Adding an appliance to the catalogue is adding a promise* says, and a second batch costs
0.32 USD. The other three leanings keep their one bucket, which is a question this record
does not answer: whether a chosen cuisine should hold a share of its own is the owner's, and
nothing measured here says it is hurting anybody.

(who decided: the owner, 2026-10-18, authorised the fix and the measurement overnight; the
share's size is the planner's, on the curve above — measured again once supply arrived, in
§ *The share's size is seven of nineteen*.)

(who decided: the owner, 2026-10-15 — the feature, and that the time question is measured
separately; the planner, the shape above, with the library's numbers in hand.)

## A rescued fortnight has no kitchen, and the share is what sends it there (2026-10-18)

The share shipped, production served it, and the next plan the owner generated had **zero of
56 plates from the air fryer** — with the appliance preferred, thirty of its dishes in the
library and the fix live. The share is not weak. On his library it is **self-defeating**, and
the measurement that said otherwise was reading the wrong plan.

**What cancels it.** `generation_metadata.fallback` on that plan reads `wider_rotation`: the
fortnight missed a macro band on the rotation's pool, so it was scheduled again from
`rotatePool(everything, slots, rotation, Infinity)` (`0046`). The share survives that call —
`applianceShare` still runs per slot and still puts its dishes first — but with no cap there
is no scarcity left for it to work in: the pool becomes the person's whole library, and
`pickBest` honours the pool's order only between dishes whose fit costs sit within `FIT_TIE`
(0.05) of each other. Fourteen dishes at the front of six hundred, judged on macro fit alone,
buy nothing. **A share is a quota in a pool, and a rescue replaces the pool.**

**The first explanation was wrong, and measuring it is what showed that.** His own series
looked conclusive — one standing fixed meal until 2026-10-17 00:59, no rescue, 14 of 14 days
in band; a second rule on the same weekday, and v26, v27 and v28 rescued every time with 0,
0 and 0 air-fryer plates. So his fortnight was re-run against production with his seed, his
avoid list and his rules arranged five ways, through the same chain the service runs (the
rotation's pool, then the uncapped rescue, kept only when it misses by less):

| his standing rules | the rotation's pool alone | what would be served |
| --- | --- | --- |
| both on one weekday (today) | 10/14, worst 14.7%, **6 plates** | 12/14, worst 6.7%, **0 plates** (rescued) |
| the two on different weekdays | 13/14, worst 7.6%, **6 plates** | 13/14, worst 5.0%, **0 plates** (rescued) |
| only the tortilla (until 17 Oct) | 12/14, worst 5.0%, **7 plates** | 14/14, worst 4.7%, **0 plates** (rescued) |
| only the riojana | 13/14, worst 5.0%, **7 plates** | 14/14, worst 4.5%, **0 plates** (rescued) |
| none at all | 12/14, worst 5.0%, **6 plates** | 14/14, worst 4.9%, **0 plates** (rescued) |

**Every arrangement ends rescued at zero, including no rules at all.** The pins are not the
cause; they only change how badly the pre-rescue plan misses.

**What the cause is.** The same fortnight, with nothing moved but whether the kitchen is
read at all:

| | the rotation's pool alone | what would be served |
| --- | --- | --- |
| air fryer preferred | 12/14 in band, 6 plates | 14/14, **0 plates** (rescued) |
| kitchen not read | **14/14 in band**, 3 plates | 14/14, **3 plates** (no rescue) |

The share takes 7 of every slot's 19 and the dishes it displaces are the ones that were
fitting the macros. His capped pool goes from holding the bands to missing them by two days,
that miss is the entry fee to the rescue, and the rescue is where the preference dies. **So
asking for the air fryer leaves him with fewer air-fryer plates than not asking** — 0 against
the 3 the library hands him by chance. A preference that is worse than silence is a defect,
not a trade.

**Why the measurement that shipped did not see it.** *What a preference costs, measured
against saying nothing* above reads 587 of 588 days in band with the preference and 588 of
588 without, and concluded the bands held. They did hold — **because the rescue held them**.
What that run also recorded, and what was not read, is that the preference raised the rescues
from **5 of 42 fortnights to 8**, and that **7 of those 8 rescued fortnights served zero
preferred plates** against a median of 16 everywhere else. The aggregate was measured on the
delivered plan, after the rescue; the damage is upstream of it. A measurement of a preference
must count the rescues it causes, not only the bands that survive it.

**What follows, and what does not.** The ordering is not in question: the bands outrank the
preference (`0045` before `0102`), and a plan that can only reach its macros from the whole
library must be allowed to. What was wrong is the **shape**. The preference was given up as a
cliff rather than a gradient, and it was given up *after* the rotation itself was given up
rather than before — which is backwards, because giving up an appliance costs a person less
than giving up the rotation's variety, its avoid list and its food-group reserves all at once.

**So the share is now a ceiling with a ladder under it.** On a band miss, before the pool
becomes the whole library, the share walks down `narrowerShares` — half of it, then none of
it — rebuilt by `RecipeController.rotateFor` from the library already read, with the same
seed, the same avoid list, the same reserves and the model's fresh dishes still first. The
first rung that holds every band wins and nothing below it is tried; a rung that does not
miss by *less* is discarded, which is the same test the rescue applies, so the ladder can
never hand back a worse plan than the cliff did. The bottom rung is not "no share" but **no
preference**: `withApplianceShare(rotation, 0)` empties `preferAppliances`, because the
front-of-the-queue bucket is a share by another name and was itself enough to keep a
fortnight out of band. Which rung a plan ended on is stored as `kitchenShare` on the plan, so
the cost of keeping the bands is a figure somebody can count rather than a thing that happens
quietly.

**What it is worth, on his own fortnight** (read from production, his seed, his avoid list,
his standing rules, through the chain the service runs):

| his standing rules | before, the cliff | after, the ladder |
| --- | --- | --- |
| only the tortilla | 14/14, 0 plates | 14/14, **2 plates** (share 0) |
| only the riojana | 14/14, 0 plates | 14/14, **3 plates** (share 3) |
| none at all | 14/14, 0 plates | 14/14, **3 plates** (share 0) |
| both on one weekday (today) | 12/14, 0 plates | 12/14, 0 plates (rescued) |

Across the 42 measured fortnights, three seeds each, on the library as it stands today and
against this morning's run of the same shape: **rescues 8 → 5**, fortnights serving zero
preferred plates **7 → 5**, plates served **580 → 583**, days inside all four macros
**587/588 either way**. All three rungs that held were **0**, not the half rung — so what the
ladder reliably buys is not plates but the plan's **own rotation**: its variety, its avoid
list and its group reserves survive where the whole library used to replace them, and the cost
is recorded as `kitchenShare` instead of being invisible.

The plates come from supply, and supply makes the share **bind harder**. With the second batch
loaded (280 dishes, 2026-10-18) the same 42 fortnights serve **877** preferred plates instead
of 583, only **1** serves none instead of 5, and every day is inside all four macros
(**588/588**) — while the share has to give way on **10** fortnights instead of 3 and 8 are
still rescued, because a quota of 7 in 19 that could not be filled displaced nothing and now
fills completely. In the owner's own shape (two standing rules on one weekday, the rules held
identical with `--pins-from`): plates **394 → 928**, fortnights serving none **14 → 0**,
rescues **14 → 8**, bands unchanged at **576/588**. **The share's size is now a real choice
rather than an unreachable ceiling**: 7 of 19 costs `objetivo-alto-5-comidas` 29 plates in that
shape — 42 with no rules at all — and a rescue it did not have before. That reading is of the
pool as it stood this morning; § *The share's size is seven of nineteen* sets the four sizes
against each other on the loaded library, where the cost is gone and the size is settled.

**It does not reach his own fortnight as he has it configured**, and that is said plainly
rather than rounded away: with two rules on one weekday no rung of the rotation holds the
bands, so the whole library is still what answers, and the kitchen is still lost. For him the
lever is supply — the second batch — or one rule on a different day. Everybody whose rotation
*can* hold its bands now keeps part of the kitchen they asked for instead of none of it.

(who decided: the finding and the ladder are the planner's, 2026-10-18, from the owner's own
plan v28 read in production and his fortnight re-run seven ways, under his standing
authorisation to fix what the plan showed; the share's size remains his to revisit, and the
two rules on one weekday are his to arrange.)

## The share's size is seven of nineteen, and that is measured rather than left open (2026-10-18)

The size was handed back to the owner on a curve read when the library held 24 air-fryer
dishes. With the second batch loaded it was measured instead: the same 42 fortnights
(fourteen profiles, three seeds), `--prefer air_fryer --flag accompaniments`, at four sizes of
the first rung — and the same four in his own shape, with the rules held identical
(`--pins 2 --per-day 2 --pins-from`). The evaluator grew `--share N` for it, which sets
`Rotation.applianceShare` the way the ladder does on the way down; `shareOf` clamps it to the
constant, so only a smaller share can be seen from here.

| first rung | plates | serving none | days in band | rescued | rungs held |
| --- | --- | --- | --- | --- | --- |
| **7 of 19, today** | **877** | 1 | 588/588 | **8** | 10 |
| 4 | 874 | 1 | 588/588 | 8 | 10 |
| 2 | 868 | 1 | 588/588 | 8 | 10 |
| 0 — the order without the quota | 842 | 1 | 588/588 | **18** | 0 |

In his own shape, in the same order: **928 / 927 / 926 / 954** plates, **576/588** days in band
for the three sizes and 575 for the last, **8** rescues against **11**, and the 24 pinned days
out of band unchanged throughout.

**Halving the share changes nothing worth seeing.** 877, 874 and 868 are the same number three
times; the bands, the rescues and the rungs given way are identical. The cost the thin library
showed is **gone**: `objetivo-alto-5-comidas` serves 7 plates at every size (38 in his shape,
against 37 with no quota at all), where before the batch the full quota cost it 29. One profile
reads the size at all — `patron-tradicional-espanola`, 46 / 43 / 37 / 34 — and it reads it the
way the feature intends: more quota, more plates.

**The last row is not "the kitchen unread".** `narrowerShares` returns nothing at or below
zero, so a share of zero keeps the appliance inside `isPreferredDish`'s bucket — the order,
without the quota — and leaves the ladder no rung to spend. It is the shape that stood *before*
#295 gave the appliance a quota, which is what `0102` § *An order is not enough* measured on the
thin library, priced here on the loaded one. Losing 35 plates is the small half of what it costs. The other half is
**18 rescues instead of 8**, and a rescued fortnight is scheduled from the whole library, which
takes the rotation's variety, its avoid list and its group reserves with it. His own shape shows
that as a *symptom* rather than a gain: the extra plates at zero are `quincena-con-evento`
jumping 79 → 109 by being rescued, and paying a day of band for it.

So **the share is what gives the ladder something to give way with**, and the constant stays at
`Math.ceil(REUSED_DISHES_PER_SLOT / 3)`. The paragraphs above are left as they were written:
they were true of a library holding 24 air-fryer dishes, and supply is what stopped them being
true.

**And asking now costs nothing at all.** The same 42 fortnights with no preference whatever,
on the same library and the same seeds: **588/588** days in band and **9** rescues, against
588/588 and **8** with the full share; in his own shape **576/588** and **16** rescues, against
576/588 and **8**. Asking for the air fryer is rescued *less* often than not asking for it,
because the ladder is an extra attempt and only a plan with a leaning gets one. That also
answers what the rungs are worth, and corrects how the question was asked. Exactly **one**
fortnight in 42 holds at the half rung — `patron-tradicional-espanola`, his pinned shape, and
only when the first rung is the full share — and it was already holding there in the run phase
11 shipped: the earlier tally **counted** the rungs that held and did not **read** them, so ten
zeros in the plain run were generalised over five in the pinned one. Every other rung that held
was zero. The rungs are not too coarse — a partial share
does not help once a band is missed, and what the ladder buys is the extra attempt rather than
the partial quota.

(who decided: the planner, 2026-10-18, on the measurement above and under the owner's standing
authorisation to decide what he hands back; he asked for the size to be his, and it still is —
nothing measured here needs him to move it.)

## The slow cooker stays, with a zero and the reason (2026-10-18)

Phase 9 left the owner two questions and he handed both back to the planner the next day
("el 3 lo que recomiendes tú"). Answered here so they stop being open:

- **The slow cooker keeps its catalogue entry, with zero dishes and this reason beside it.**
  It is the one appliance this product cannot express: `generatedDishSchema` bounds
  `cookMinutes` at 180 and a step's `minutes` at 240, and `PoolBuilder.validate` parses that
  schema before anything reads `equipment`, so an honest four-to-eight-hour braise is refused
  as `schema` — 60 of one run's 79 schema rejections, every one a slow cooker. § *Adding an
  appliance to the catalogue is adding a promise* permits an entry whose shortfall is written
  where somebody reads it, and that is what this is. **Taking it out would be the worse
  answer**: it is a real appliance in real kitchens, somebody who owns one and says *does not
  have* an oven is giving us a true fact worth keeping, and removing it would mean a screen
  change and `kitchen_equipment` rows pointing at an appliance that no longer exists. The way
  in is not a raised bound — lifting it hands the dish straight to `withinTime`, which refuses
  480 minutes for everybody who set a limit — but the idea that an **unattended** cook is not
  time at the stove, which is the cooking-time work § *Next* 6 of the roadmap now carries with
  phase 8's evidence behind it. Until then the slow cooker is a kitchen fact we record and
  cannot cook with, and the `--skip slow_cooker` in the second batch is that written down.
- **The raw-salt-cod creams do not come back, and now a rule says so rather than a reviewer.**
  Phase 8's review struck two dishes that blended desalted cod without cooking it, on the
  reasoning that *esqueixada* is a dish a person **chooses** and this library's dishes are
  **assigned** by a scheduler on a Tuesday. The second batch produced five more of the same
  shape — one of them the same slug again — so the review is no longer a reading of a list
  but a rule in the batch's own review script: a dish that **blends**, whose name carries a
  fish and whose steps never cook it, is struck and the reason printed. The rule is scoped to
  the blender on purpose — read over every dish it struck sixteen grilled, steamed and
  rice-cooked plates whose appliance plainly cooks the fish, because an appliance dish names
  the fish in one step and starts the cycle in the next. The six cod creams production already
  holds all cook theirs (checked read-only, 2026-10-18); none of them is affected.

(who decided: the owner delegated both to the planner, 2026-10-18 — *"el 3 lo que recomiendes
tú"* — and either is his to overturn; the schema bound and the review's rule are facts the
record carries rather than choices.)
