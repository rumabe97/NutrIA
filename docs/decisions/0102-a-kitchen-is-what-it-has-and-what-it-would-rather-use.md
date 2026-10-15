# 0102 — A kitchen is what it has, and what it would rather use

- **Date**: 2026-10-15
- **Status**: accepted (structural choices; the numbers this project promises arrive with
  project 021 phase 6 and are written back here)
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
says nothing has **a normal kitchen** — stovetop, oven, microwave — because the alternative
is asking everybody about an air fryer at sign-up, and a question nobody has to answer is
one more reason to leave.

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

(who decided: the owner, 2026-10-15 — the feature, and that the time question is measured
separately; the planner, the shape above, with the library's numbers in hand.)
