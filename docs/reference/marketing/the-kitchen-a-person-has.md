# What a kitchen is worth, and why it is not sold

> **Purpose**: prices the tier of project 021 ("Cooked with what you have") — whether
> knowing a person's appliances is free, premium or split, and which half gets which. It
> prices both halves per use, runs the standing audit on the one alternative worth weighing
> (constraint free, preference paid), and says what number belongs in
> [`Allowance.ts`](../../../packages/core/src/domain/Allowance/Allowance.ts): none.
> **Audience**: the owner, and the lead who would otherwise write a constant. **Committed**:
> yes. **Maintained by**: agents draft, owner approves. Update it in the same change that
> gates any part of a kitchen.
>
> Evidential content rule: facts below are labelled **confirmed** (with how) or **estimated**
> (with the hypothesis). Written 2026-10-15 against `main` at `dd1520c7`, against
> [`021/PRD.md`](../../projects/021-cooked-with-what-you-have/PRD.md) at status *draft*.
> Nothing of this feature is built, so there is **no usage to read**; every claim about what
> people do is either a production count borrowed from
> [`tiers-and-allowances.md`](./tiers-and-allowances.md) or an estimate that says so.
>
> Companion to [`tiers-and-allowances.md`](./tiers-and-allowances.md) (the six allowances and
> the cost table) and [`dish-requests.md`](./dish-requests.md) (the one allowance that spends
> money per use).

## What this decides

**Both halves of a kitchen are free, for everybody, and neither becomes a row in
`Allowance.ts` — because neither spends a unit of anything, and the one thing this product
sells is more of what costs money to produce.** I agree with the owner's instinct and the
planner's recommendation, and the reason is stronger than the analogy they used: the
preference half is not *like* an existing free thing, it is *the same mechanism* as two
existing free things.

| | Verdict | Why, in one line |
| --- | --- | --- |
| **"No tengo"** — the constraint | **free** | A plan with an oven dish in it, served to somebody with no oven, is not a thinner plan: it is a wrong one. `Allowance.ts` forbids selling the correctness of a plan. |
| **"Prefiero usar"** — the preference | **free** | It is one prompt line and one reordering of the library read — the same two places `PREFERRED CUISINES:` and `LIKES:` already occupy, tier-blind, since before there were tiers. |
| A new allowance row | **none** | Nothing here is counted, so there is nothing to limit. A limit on a boolean is a feature flag wearing a paywall's clothes. |
| The only bound I would add | **3 appliances may be marked *prefers*** — the same for both tiers, so **not** a `tier_allowances` row | A preference naming a quarter of a twelve-item catalogue has stopped steering anything. Recommended, not required; see [The one bound worth having](#4-the-number-and-why-not-one-higher). |

**My method does not survive this question, and that is the finding rather than a failure.**
Steps 2 to 5 below presuppose a counted unit — a redo, a swap, a request. A kitchen has no
unit: it is a profile field, like an allergy, a disliked food, a preferred cuisine or a
maximum cooking time, and **not one of those is in `Allowance.ts`**. The honest answer to
"what number" is *there is no number, keep it out of the table, and what is not in the table
is not sold*.

## 1. What one unit costs to serve

There is no unit, so the question becomes: **does knowing a kitchen make any priced thing
happen more often?** Three doors, and all three are closed or bounded by numbers that
already ship.

| Door | Does it cost? | Label |
| --- | --- | --- |
| Declaring a kitchen, or changing it | **nothing** — a profile write, no model call | **confirmed**: the PRD's scope is reference data, a profile column, a prompt line and a filter. Nothing in it calls a provider |
| Asking the model for what somebody prefers | **nothing extra** — it changes the *words* of a request, not how many are sent | **confirmed**: the model is asked for `FRESH_DISHES_PER_SLOT = 7` dishes per slot regardless of how rich or poor the library is for this person (`packages/core/src/domain/Variety/Rotation.ts:58`, and `freshFloorPerSlot` in `PoolBuilder.service.ts`). A preference does not add a request |
| A dish the gate refuses because it needs a missing appliance | **a text call, sometimes** | **confirmed** mechanism: a shortfall drives another round, `MAX_ATTEMPTS = 3` (`PoolBuilder.service.ts:26`), and a round with under 15 s of budget left never starts (`MIN_ROUND_MS`). **Estimated** size: a text call is 0.0006–0.002 $ ([`dish-requests.md` § 1](./dish-requests.md)), so three rounds instead of two is **under a third of a cent** |

**Why that third row is the whole of the cost, and why it is small.** The money in this
product is pictures, not text — measured twice already, and it holds a third time here. A
picture costs **0.0337 $** (**confirmed**, `IMAGE_COST_FLOOR_USD`,
`apps/api/src/modules/ai/services/DishPicture.service.ts:32`) and is drawn only for a
*stored* dish, on first view ([`0066`](../../decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md)).
A dish the equipment gate refuses is never stored, so it is never drawn: **a rejection is
the cheap outcome**, exactly as it is for a dish request.

**The one figure that could move, with its ceiling.** Production draws **7.1 pictures a
generation, 0.237 $** (**confirmed** — 19 plans, 134 pictures, 4.51 $ over the 30 days to
2026-10-12, counted by the lead through the Neon MCP, read-only; recorded in
`tiers-and-allowances.md` § *What production says*). A restricted or strongly steered
kitchen shifts which dishes a plan picks — more written-now, fewer reused-from-the-library —
and a written-now dish that gets viewed is a new picture. So 7.1 could rise. **It cannot
rise past the fresh dishes the generation already asked for**, which is
`FRESH_DISHES_PER_SLOT` × the slots that person's meal shape has — **21 on a three-meal
day** (**confirmed**: `freshFloorPerSlot: FRESH_DISHES_PER_SLOT` in
`apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts:230`, over
`slotsIn(shape)`), and 021 does not touch that number. A dish nobody asked for cannot be
drawn. So the ceiling on a three-meal generation is **0.71 $ against 0.237 $ measured**
(**estimated**, from the two confirmed figures either side), and the measured figure shows
only about a third of the fresh dishes asked for are ever drawn today. **The headroom is
real but it is headroom that already exists** — a kitchen can move spend *within* that
ceiling, it cannot raise it.

(**Confirmed** that a drawing is triggered by a dish being viewed **in a plan**: the only
callers of the picture service are `MealPlans.service.ts` and the owner's own
`AdminCatalogue.service.ts`. A candidate dish the plan never used is never drawn, which is
what makes the fresh-dish floor a real ceiling rather than an estimate.)

That doubling is worth *watching*, and it is not worth *selling*, for a reason the tier
table already knows: pictures come from `AI_IMAGE_MONTHLY_CAP_USD`, a **10 $ pot everybody
shares**, which stops drawing for everyone when it empties (**confirmed**,
`Env.validation.ts:234`). Moving a picture-pulling behaviour behind premium does not make
premium pay for it — the same pot empties, for the same people. `tiers-and-allowances.md`
already names this as premium's real blocker: *the budget itself needs raising, or pictures
metering per account, before premium has fifteen or twenty users.* 021 is one more reason
that is the owner's next money decision, and it is not a reason to gate 021.

**The pot, in accounts, is the number worth writing down.** At the measured 0.237 $ the
10 $ buys about 42 generations a month, which `tiers-and-allowances.md` turned into *about
18 accounts of ordinary use*. At the 0.71 $ ceiling it buys about **14 generations** —
roughly **six accounts** of hard-steered use empty what eighteen ordinary ones do
(**estimated**: the confirmed cap and the confirmed per-generation figures, assuming ~2.4
generations per account-month, which is the same assumption the eighteen rests on). Nobody
is near that today, and it is the tripwire rather than the forecast: see § 5.

**Two costs that are real and are not per-use.** Seeding the catalogue and the reviewed
backfill migration (PRD scope, acceptance criterion 4) are **build cost**, paid once by
whoever writes them. Nobody should later read "the kitchen cost us something" as a reason to
charge for it: fixed cost is not per-use cost, and the thing being sold here has always been
the latter.

## 2. What an ordinary fortnight actually needs

There is no demand figure to read — nothing is built, and with eight beta accounts there
would be no distribution even if it were. What *is* measured is the supply side, by the
planner, on the development library of 1128 dishes (500 seeded, 628 model-written), by what
their steps name (**confirmed** by that measurement; recorded in the PRD § *Problem*):

| named in the steps | dishes | share |
| --- | --- | --- |
| stovetop | 824 | 73% |
| oven | 68 | 6.0% |
| microwave | 20 | 1.8% |
| blender or food processor | 20 | 1.8% |
| pressure cooker | 1 | 0.09% |
| air fryer | 1 | 0.09% |

Two things follow, and they pull in opposite directions.

- **The constraint half removes almost nothing.** The hardest kitchen the PRD names — no
  oven, no microwave, no blender — removes at most 108 of 1128, **under a tenth**
  (**estimated** as an upper bound: the counts are per-appliance and a dish naming two is
  counted twice, so the true share is lower). There is nothing there to ration. A tier that
  sold the right to remove 6% of a catalogue would be selling a rounding error.
- **The preference half has nothing to point at yet.** One air-fryer dish in 1128 is not a
  preference anybody can be served from stock. This is why the PRD's acceptance criterion 6
  exists — *with the air fryer preferred, one generation yields at least as many air-fryer
  dishes as the plan has days*. **Until that measurement passes, a paid preference would be
  selling a hint**, and the honest version of this report would be the one that says so and
  stops. (It is also self-extinguishing: the first air-fryer dishes written become library
  stock everybody reuses, so the cost in § 1 is front-loaded, not recurring. **Estimated**,
  from how reuse works in `0006` and `0009`; measurable after a fortnight of real use.)

## 3. What the free tier must leave undone

A free limit's job is to be enough to prove the product works and not enough to live on for
ever. **A kitchen is not where that job can be done**, and the line in `Allowance.ts` says
why without needing me:

> Nothing about safety, allergies or the quality of a plan is behind this, and nothing ever
> should be.

A dish needing an appliance somebody does not have is not a *worse* dish for them. It is a
dish they cannot cook, which makes the day it sits in undeliverable and the fortnight's
"every day inside 5% on all four macros" a claim about food nobody ate. That is the quality
of a plan, in the plainest sense the sentence has. **The free tier leaves undone the things
`Allowance.ts` already names** — a second redo, a sixth swap, a fourth event, a second
standing fixed meal, a dish written to order, a fortnight rebuilt mid-flight. Those are
enough. It does not also need to leave undone the question of whether the food can be
cooked.

There is also a precedent I confirmed in the code rather than argued from taste. Every
profile field that narrows or steers a plan is **tier-blind today**:

| Field | Where it acts | Tier? |
| --- | --- | --- |
| allergies, intolerances, way of eating | the safety gate, in code | free |
| dislikes | the catalogue and the prompt | free |
| **maximum cooking time** | **the prompt line `MAXIMUM TIME PER DISH`, the gate on what the model returns (`withinTime`), and the library filter** | **free** |
| preferred cuisines | the prompt line `PREFERRED CUISINES:` (`PoolPrompt.ts:963`) and the library's own ordering (`isPreferredDish`, `Rotation.ts`) | free |
| liked foods | the prompt line `LIKES:` (`PoolPrompt.ts:964`) and the same ordering | free |

(**Confirmed**: those line numbers, and a grep for `tier` or `premium` across
`packages/core/src/domain/Preference/` which returns nothing — the preference domain has
never heard of a tier.)

The maximum cooking time is the exact shape of 021's constraint half: a profile number that
acts in **the same three places** the PRD names for equipment, and it is free. Preferred
cuisines are the exact shape of 021's preference half: a prompt line plus a reordering of
the library read, and they are free. **"Prefiero la airfryer" gated while "prefiero la
cocina japonesa" is free is a number somebody picked, not a decision.**

## 4. The number, and why not one higher

**On the tier: there is no number, and the argument runs both ways.**

- *Argued down*: could free get **less** than a whole kitchen — say three appliances
  declared, more for premium? Only by hiding from a free user that a fourth answer exists
  until they want it, which is the first thing on my no-dark-patterns list and the one I may
  never propose. And it would gate a constraint, which is § 3.
- *Argued up*: is there anything above "free" to give premium here at all? No, and that is
  the right outcome rather than a gap. Premium sells volume and control over the things that
  cost money. A kitchen costs nothing and is not volume.

**The one bound worth having, and it is not sold: at most 3 appliances marked *prefers*,
identically on both tiers.**

- **Why a bound at all.** "Prefers" earns its place by making a prompt line mean something.
  A person who marks eight of twelve has described their kitchen a second time and steered
  nothing; a person who marks the stovetop has preferred 73% of the library, which is a
  no-op. An uncapped third state also maximises the only cost in § 1, for no benefit anybody
  can feel.
- **Why 3 and not 4.** Three preferred appliances over a fortnight's 28 lunches and dinners
  is about nine dishes each — still visible as a leaning. Four is *defensible* (seven each)
  and I would not fight it; five is a quarter of the whole catalogue called a preference.
- **Why 3 and not 2.** Two cannot hold the ordinary real answer — *"la airfryer y la
  plancha"* plus one more — and a bound that refuses the common case is a bound that teaches
  people the feature is broken.
- **Where it does not apply.** **"No tengo" is never capped.** However many appliances
  somebody lacks, every one is enforced; a cap there would be a cap on correctness.
- **What it is not: a paywall line.** That part is not negotiable — it is the same number
  for both tiers, so it can never appear in a pricing table or in `Allowance.ts`, whose
  table is *by tier* by definition. **Where it lives is a design judgement, and mine is a
  constant beside `MAX_START_DAYS_AHEAD`** precisely because it is not sold and has no tier
  to resolve against. If the owner would rather every product bound be editable, the console
  can hold it as a single tierless number; nothing in my verdict changes. Either way it must
  be **on the screen in words** ("puedes marcar hasta 3 como preferidos") rather than
  discovered on the fourth tap.
- **The alternative** — no cap at all, with wording on the screen that makes the stovetop
  no-op obvious — is acceptable. I recommend the cap; this one is the owner's to take or
  leave.

## 5. What breaks if this is wrong, in each direction

| If I am wrong by being | What breaks | How we would know |
| --- | --- | --- |
| **too generous** (this should have been paid) | Premium gains nothing from 021 and the free tier gets better, which lowers the pull to pay — *and* the picture pot takes up to the full 0.71 $ a generation its own fresh-dish floor already allows, from accounts that pay nothing | Pictures per generation, read monthly against the 7.1 baseline, segmented by whether the account declared a rare preference. **The tripwire: above about 10 a generation, sustained** — that is halfway to the ceiling and the point at which the pot stops buying eighteen accounts. If it trips, the control is the pot — raise `AI_IMAGE_MONTHLY_CAP_USD` or meter pictures per account — **not** a tier on the kitchen, because the pot is shared either way |
| **too mean** (should not even have the cap of 3) | Somebody with a genuinely appliance-led kitchen is refused a fourth preference for no reason they can see | One complaint is enough; it is one constant, and nothing in the paywall has to change to raise it |
| **wrong about there being nothing to sell** | We shipped a felt, differentiating feature and charged nobody for it | The PRD's criterion 6 is the test. If a preference turns out to change dinner dramatically *and* ordinary accounts lean on it hard, the thing to sell is the conversion in § *Where a paid version honestly lives* — a model call per use — and never the preference itself |

## The audit of the split, scored like every other benefit

The lead asked whether the halves price differently. The split worth weighing is
**constraint free, preference premium** — it is the only one that is not obviously a gate on
correctness. Scored on the three things I owe:

- **Is it felt?** **Not yet, and possibly never.** With 1 air-fryer dish in 1128, a paid
  preference delivers nothing until criterion 6 passes. A benefit nobody notices is
  decoration.
- **Is it bounded?** **There is nothing to bound.** It is a boolean per appliance. Every
  other row in the table is a count with a ceiling and a reason; a boolean has neither, which
  is how you know it is a feature flag and not an allowance.
- **Does it cost us?** **Nothing per use**, § 1. By my own rule a zero-cost benefit is cheap
  goodwill: give it away.

And it fails a fourth test that matters more than the three. A free user who sets *prefiero
la airfryer* and sees nothing change has met **a limit hidden until it is hit** — the exact
pattern I may never propose. To avoid it you would have to put a visible lock on the third
state and sell *a hint to the model*, which this product has never sold and could not print
on a pricing page without embarrassment. **Rejected on the record.**

Two softer variants, rejected faster: *free gets a kitchen but premium's is read first* (a
hidden two-speed generator; the plan's quality by tier), and *free declares N appliances*
(§ 4, argued down).

## Where a paid version of this honestly lives

021 puts it out of scope and it should stay out of scope, but the owner should know the
premium angle exists so nobody later reaches for the free tier instead: **"hazme esto en
airfryer"** — converting a dish that exists to an appliance the person prefers — is a model
call and a stored dish per use, which is 0.04 $, which is the shape of `dishRequestsPerMonth`
exactly ([`dish-requests.md`](./dish-requests.md)). If a kitchen ever earns premium a line,
that is the line.

Meanwhile **021 free makes two paid things worth more, which is the right kind of
interaction**:

- A **dish request** (premium 3 a month) is most valuable precisely where the library is
  thinnest, and a declared kitchen is what makes that thinness visible and nameable. Watch
  for the flip side: a restricted kitchen raises dish-request demand, and that allowance is
  the `financial` one. If requests per premium account climb after 021, the number to revisit
  is `dishRequestsPerMonth`'s ceiling of 6, not the kitchen.
- A **standing fixed meal** (free 1, premium 3) gets a better refusal: the PRD's ninth
  `whyNotFixable` reason turns "no" into "not with your kitchen", which is the actionable
  sentence `dish-requests.md` made a *precondition* of selling requests at all.

## What this is not: the ship gate is correctness, not a tier

The PRD's acceptance criterion 5 — the hardest kitchen, every day still inside 5% on all
four macros across the evaluator's fourteen profiles — decides **whether the constraint half
ships at all, for everyone**. It is not a tier question, and it must never be answered by
gating. If removing 108 dishes breaks a profile's days, that is a correctness finding about
the library's supply, and the fix is the library or the rule — because a premium-only
constraint would mean a free account is knowingly served food it cannot cook, which is the
one line this product does not cross.

## What I could not read, and the one number to ask for

- **The production library's own equipment distribution.** Every count above is the
  **development** library (1128 dishes, 500 of them the seed). Production's library was
  loaded from `docs/local/nutria-seed-500.sql` and has grown differently. Nothing in my
  verdict turns on the exact share — free is free whether the oven is 6% or 16% — but the
  PRD's criterion 5 does, and so does the picture-spend watch in § 5. **Asked and answered** by the lead the
  same day, read-only against the production branch: **962 recipes** (500 seeded, 462
  model-written), whose steps name a stovetop 630 times, an oven 79, a steamer 45, a
  microwave 21, a blender 20, a pressure cooker **2** and an air fryer **1**. Per slot, the
  oven holds 35 lunches and 44 dinners and the steamer 21 and 23 — both already past the
  rotation's cap — while the air fryer and the pressure cooker hold almost nothing, which is
  what sized project 021's phase 8. Nothing in this verdict changes: free is free whether
  the oven is 6% or 8%.
- **Any demand figure at all.** Nothing is built, and nobody has reached any limit in the
  product's history (**confirmed**, 2026-10-12). Every behavioural claim here is labelled
  estimated and says from what.

## Answers to the PRD's open questions, where they are mine

1. **Free or premium?** **Free, both halves** — § *What this decides*. Nothing is gated, so
   no limit, no `tier_allowances` row and no line in the pricing table. The only number I
   propose is the cap of 3 on *prefers*, equal on both tiers, which is a product bound and
   not a sale.
2. **Is the onboarding step required?** The planner's recommendation (optional, defaulting
   to a normal kitchen) is also the right packaging answer, and that is the only part of it I
   own: a required question about an air fryer at sign-up is a conversion cost paid by
   everybody to serve a minority, and the profile screen is where a real kitchen gets
   described. The rest of the question is the planner's.
3. **Does "prefers" reorder the fixed-meal offer?** Not mine. No tier reads differently
   either way, so nothing in this report changes with the answer.

## Supersedes nothing, and what it adds

No decision record is superseded: `0015`, `0042`, `0043`, `0044`, `0097`, `0098`, `0099` and
`0100` set numbers, and this report proposes no number in `Allowance.ts`. What it adds is
the reason a future reader needs: **a profile field that narrows or steers a plan has never
been sold here, and 021 is not the first.** The decision record the PRD's criterion 8 asks
for should carry that sentence.
