# PRD — Project 021: Cooked with what you have

- **Status**: approved — the owner answered every open question on 2026-10-15
- **Roadmap item**: none yet — proposed by the owner on 2026-10-15 ("saber qué
  electrodomésticos tiene el usuario, y cuáles prefiere usar"). The `docs/ROADMAP.md` line
  is the owner's to add when he approves this.

## Problem

**Nothing in this product knows what a kitchen has.** A dish's only mention of an oven is
prose inside its steps: the dish a model writes declares a name, a cuisine, a difficulty,
its slots, prep and cook minutes, servings, ingredients and steps — and no equipment
(`apps/api/src/modules/ai/prompts/pool.schema.ts`). So a person with no oven is served
oven dishes, and a person who bought an air fryer is served a frying pan.

How little the kitchen is used today, measured on the development library of 1128 dishes
(500 seeded, 628 written by the model), by what their steps actually name:

| named in the steps | dishes |
| --- | --- |
| stovetop (sartén, cazo, olla, plancha, hervir) | 824 |
| oven (horno, hornear, gratinar, asar) | 68 |
| microwave | 20 |
| blender or food processor | 20 |
| **pressure cooker** | **1** |
| **air fryer** | **1** |

So the constraint half of this project is cheap and the preference half is not: filtering
an oven out changes 68 dishes, while telling somebody "we know you prefer the air fryer"
and then serving them the one air-fryer dish in the library would be a worse answer than
saying nothing. **A preference is only real if the model is asked for it.**

**The cooking time is not the lever, and it is not broken either.** It is obeyed in three
places — the prompt line `MAXIMUM TIME PER DISH: N minutes (prep + cooking)`, the gate on
what the model returns (`PoolBuilder`, through `withinTime`), and the filter on what the
library may reuse (`RecipeController`) — and it is the reason a dish can be refused as
`too_slow` in the fixed-meal offer. What it lacks is expressiveness:

- it is **one number for all fourteen days**, so "20 minutes on a weekday, an hour on
  Sunday" cannot be said;
- `timeAllowance` admits the limit plus a fifth rounded up to the next ten, so the default
  30 admits 40 — and the library's 50 stewed, roasted and potted dishes run 50 to 90
  minutes, structurally out of reach;
- the model's own dishes average **17 minutes** and never exceed 45, which a ceiling alone
  does not explain;
- `difficulty` is stored on every dish and **read by nothing** — 89% of the model's dishes
  are `easy`.

That is a second problem with a different shape, and it gets its own measured change
(owner's decision, 2026-10-15): this project does not touch it.

## Outcome

When this ships:

1. A person says, in onboarding and afterwards in their profile, **what their kitchen has
   and what they prefer to cook with**.
2. A dish that needs an appliance they do not have is **never served, never offered as a
   fixed meal, and never written for them** — enforced in code, the way an allergy is, not
   asked of a prompt.
3. A dish that uses what they prefer is what the model is **asked for**, and what the
   library is read for first, so "prefiero la airfryer" changes dinner instead of only
   being recorded.
4. **Every dish carries its equipment as data**, the new ones because the model declares
   it and the existing ones because a reviewed migration read their prose.
5. The cost is **measured, not assumed**: how much of the library each missing appliance
   removes, for each of the evaluator's fourteen profiles, and whether every day is still
   inside 5% on all four macros (`0045`) for the most restricted kitchen there is.

## Scope

**In**

- An appliance catalogue with stable keys, **ten items**: stovetop, oven, microwave, air
  fryer, pressure cooker, blender or food processor, grill or griddle, steamer, slow cooker,
  rice cooker. A toaster and a kettle are deliberately not in it: no dish in either library
  needs one, and a catalogue entry is a promise to serve dishes for it (`0102`).
- **Three states per appliance**: *does not have* · *has* · *prefers to use*. "Prefers" is
  a preference and implies having it; "does not have" is the constraint. **At most three
  appliances may be *prefers*** — the same on both tiers, a product bound rather than a
  price (`marketing`, 2026-10-15); *does not have* is never capped.
- The onboarding step and the profile screen that read and write them, in both languages —
  **both optional**: a kitchen nobody described is a normal one (stovetop, oven,
  microwave).
- `equipment` on a dish: declared by the model in the pool schema, stored on the recipe,
  returned where a dish is read.
- **A dish's detail says what it is cooked with**, one icon and one name per appliance
  (inline SVG sized to the text, never an emoji — `apple-web-design`), and nothing where a
  dish needs only a pan. The owner asked for it on 2026-10-15: the declaration stops being
  only a filter and becomes something a person reads before they start.
- A reviewed data migration that infers `equipment` for the existing library from the
  prose of its steps, with its pattern list written in the migration's own header.
- Enforcement in the three places the cooking time already uses — the prompt, the gate on
  generated dishes, the library filter — so the plan, the offer and the model agree.
- A ninth reason a dish is not offered as a fixed meal (`whyNotFixable`), actionable, said
  apart from `too_slow` and `clashes_with_fixed`.
- An evaluator flag that prices a missing appliance over the real library.
- **A first batch of dishes for the appliances the library lacks**, drafted through the
  existing pool builder so each one declares its own equipment, validated and tuned the way
  the five hundred were, written as a SQL file the owner runs on `develop` and then on
  production (the owner asked for it on 2026-10-15). Sized per appliance **per slot** against
  the twelve a slot the library's rotation can meaningfully hand over — about a hundred dishes,
  of which ~30 air fryer and ~24 pressure cooker, and **none at all for the oven or the
  steamer**, which production already holds past that cap (35 and 44 lunches and dinners, 21
  and 23). Fifty per appliance would be six hundred dishes and most of them unnecessary.

**Out**

- The time and elaboration model (a weekday/weekend budget, a quota of elaborate dishes,
  making `difficulty` mean something): its own project, after this one, measured.
- Converting an existing dish to another appliance ("hazme esto en airfryer").
- Anything about the hob itself (gas, induction, how many rings), pans and pots as
  consumables, and knives, boards, scales or a mortar — utensils everybody has are noise
  on that screen.
- Equipment in the shopping list, and buying advice of any kind.

## Acceptance criteria

1. The catalogue exists with stable keys; `GET` of the profile returns the kitchen; the
   onboarding step stores it. The screen renders every appliance with its three states at
   320, 390 and 1280 px, light and dark, with no sideways scroll (`/local-probe`), says the
   three-preference bound before it is hit, and the route refuses a fourth with the field
   named.
2. A dish the model writes declares its equipment, and a dish that names an appliance the
   person said they do not have is **rejected by the gate**, in the same place and shape as
   a dish that is too slow — with the rejection's reason in the metadata that a generation
   already records.
3. The library filter excludes dishes needing a missing appliance, and it is the **same**
   filter the fixed-meal offer reads: a dish the offer still names can always be fixed, and
   one it dropped for the kitchen comes back with the new reason, `actionable`.
4. The migration backfills the existing library, and its header states the pattern list and
   the measured hit rate. Read on 2026-10-15, by what the steps name: **production, 962
   dishes** (500 seeded, 462 model-made) — 630 stovetop, 79 oven, 45 steam, 21 microwave, 20
   blender, **2 pressure cooker, 1 air fryer**; the development library, 1128 dishes — 824
   stovetop, 68 oven, 20 microwave, 20 blender, 1 pressure cooker, 1 air fryer. A dish it
   could not classify is left as unknown and treated as stovetop, which the record says out
   loud.
5. **A dish's detail shows its equipment**: the appliances it declares, each with an icon
   and a name, legible at 320 px, in both languages, with the name carrying the meaning so
   the icon is decoration an assistive technology may ignore.
6. **Measured with the evaluator** (`apps/api/scripts/evaluate-plans.mjs`, local Postgres,
   no model call): for each of the fourteen profiles, the share of the library lost per
   missing appliance, and **every day still inside 5% on all four macros** with the hardest
   kitchen — no oven, no microwave, no blender — or, where a day cannot be built, the
   number of days that fail and the reason, as `0101` reported its own.
7. **A preference has something behind it**: for every appliance the catalogue holds, the
   library offers at least what the rotation needs for a fortnight, or the shortfall is
   stated per appliance with its reason. Measured before and after the load, on `develop`
   and then on production, with the query that produced each number.
8. **A preference changes what is written, by a number**: with the air fryer preferred, one
   generation yields at least as many air-fryer dishes as the plan has days in it, against
   the 1 dish in 1128 the library holds today. The figure goes in the record.
9. End to end: a person with no oven receives a fortnight with no oven dish in it; the
   fixed-meal offer refuses an oven dish with the new reason and offers it to an account
   that has one; and another account's kitchen narrows nothing of theirs (`0019`).
10. A decision record (`docs/decisions/`) states what a kitchen is, why "does not have" is
   enforced in code while "prefers" is asked of the model, and what the measurement cost.

## Decided

The three questions this PRD was approved on (the owner, 2026-10-15):

1. **Free, both halves, and no new allowance row** — the owner's instinct, confirmed by the
   `marketing` agent on a stronger ground than the allergy analogy
   ([the report](../../reference/marketing/the-kitchen-a-person-has.md)): the preference
   half is *the same mechanism* as two things that are already free and tier-blind,
   `PREFERRED CUISINES:` and `LIKES:`, and the constraint half has the exact shape of the
   maximum cooking time, which is free too. Nothing here is counted, so there is nothing to
   limit — "a limit on a boolean is a feature flag wearing a paywall's clothes" — and per
   use it spends nothing: the model is asked for its seven fresh dishes a slot either way,
   so a preference changes the words of a request and not how many are sent. The split
   (constraint free, preference paid) is rejected on the record.
   **The one bound it proposes is not a price**: at most **three** appliances may be marked
   *prefers*, identical on both tiers, said on the screen — a preference naming a quarter of
   a twelve-item catalogue has stopped steering anything. "No tengo" is never capped.
2. **Optional, in both places.** Nobody is stopped at sign-up by a question about their air
   fryer: the onboarding step may be skipped, the profile screen may be left alone, and
   silence means **a normal kitchen** — stovetop, oven, microwave and a blender, the last
   added by the owner on 2026-10-16 once the backfill measured what leaving it out cost
   (`0102`).
3. **"Would rather use" does not reorder the fixed-meal offer** in this project. It steers
   what the model is asked for and the order the library is read in; the offer keeps one
   order and one explanation.

Structural choices are recorded in
[`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md).
