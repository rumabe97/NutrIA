# A plan from what is already in the house

> **Purpose**: prices the feature the owner asked for on 2026-10-22 — *"el usuario premium
> aporta su lista de la compra o los ingredientes que tiene ya, y a partir de esos
> ingredientes, se le genera el plan correspondiente"* — and tests his own hypothesis that
> it is premium-only. It says what one unit costs, what a fortnight actually needs, what the
> free tier must keep answering, the number I would ship and the number I would refuse, how
> the thing must be named so the delivered thing is the promised thing, and what to measure
> after launch.
> **Audience**: the owner, and the lead who would otherwise write a constant. **Committed**:
> yes. **Maintained by**: agents draft, owner approves. Update it in the same change that
> gates any part of a pantry.
>
> Evidential content rule: facts below are labelled **confirmed** (with how) or **estimated**
> (with the hypothesis). Written 2026-10-22 against `main` at `837da423`. Nothing of this
> feature exists — there is **no usage to read**, and every claim about what people would do
> is an estimate that says so.
>
> **Where my counts come from.** Eight read-only queries against the **local** Postgres
> (`127.0.0.1:54329`, `default_transaction_read_only=on`, 2026-10-22): **1,638 recipes, 930
> ingredients, 10,040 recipe-ingredient rows**. I read no production data and ran no
> generation. The local library is **slightly larger** than production's — **1,638 recipes
> here against production's 1,426 es-ES dishes**, a gap of about **13%** (confirmed by the
> lead, 2026-10-22, from project 021's PRD § *Read on the live library, 2026-10-19*: es-ES
> dishes went 1,146 → 1,426 when the owner loaded the second kitchen batch on 2026-10-18,
> counted on production's own rows). So the coverage figures below are an **upper bound on
> what production could do today, but a close one**. Corrected on 2026-10-22: this paragraph
> first said 962 dishes, read on 2026-10-15 before that batch, which implied a gap of 70%
> and overstated the margin.
>
> **What the 13% changes in the argument below: nothing.** The coverage figures are ratios
> and the ratios do not move with a library a seventh smaller — if anything a smaller library
> cooks *fewer* dishes from a pantry, not more. Concretely, scaled to production: the 90
> fully-makeable dishes of 1,638 would be of the order of **78 of 1,426**, and the 22 lunches
> the architect must hold the macro bands against become about **19**. Both move the wrong way
> for the feature, so the verdict is if anything slightly firmer, and no sentence in § 2
> needed rewriting.
>
> Companion to [`the-kitchen-a-person-has.md`](./the-kitchen-a-person-has.md), whose
> question this one is a twin of, to [`tiers-and-allowances.md`](./tiers-and-allowances.md)
> (the cost table and the three currencies), to [`dish-requests.md`](./dish-requests.md)
> and to [`the-past-is-premium.md`](./the-past-is-premium.md) (the category-2 test applied
> below).

## What this decides

**Build a different thing: a free pantry that *steers* a plan, not a premium plan *built
from* a pantry — and the reason that decides it is arithmetic, not pricing.** A fortnight
needs **90–120 distinct ingredients** (estimated, § 2); a realistic household pantry of 17
staples that exist in the library fully covers **90 of 1,638 dishes, of which 22 are
lunches** (confirmed, § 2); and **513 of the 930 catalogue ingredients appear in no recipe
at all** (confirmed). So *"a partir de esos ingredientes se le genera el plan"* is a
sentence the product cannot keep, on any tier, at any price. What it **can** keep is *"el
plan aprovecha lo que ya tienes"* — and that version is one prompt line and one reordering
of the library read, which is the same mechanism `the-kitchen-a-person-has.md` ruled
unsellable seven days ago. By `Allowance.ts`'s own two categories, it is not for sale.

| Question | Answer |
| --- | --- |
| Premium-only, as the owner supposes? | **No** — it fails both sellable categories: it costs no more to serve than an ordinary generation (category 1), and it is not the record of what was served (category 2). It also fails my category test: free would be left with no answer to the question the feature exists to answer |
| What one unit costs to serve | **0 €, 0 extra model calls.** It changes the *words* of a request that was going to be sent anyway. It can move picture spend **within** the 0.71 $ ceiling every generation already has — it cannot raise it |
| The new allowance row | **none.** The priced thing here is the *generation*, and generations are already metered by `planRedosPerFortnight` |
| What premium gets out of it anyway | **The first allowance anybody will actually feel.** The fortnight itself is never counted; the *re-roll* is. Free gets one re-roll toward its pantry a fortnight, premium three. Zero accounts have ever reached any limit (confirmed, 2026-10-12); this is the feature that makes a redo worth having |
| The number I would ship | **20 pantry items, the same on both tiers**, as a product bound like the kitchen's three preferred appliances — not a `tier_allowances` row |
| The number I would refuse | **Any `pantryPlansPerFortnight` counter**, and above all **a pantry size that differs by tier**: a bigger pantry makes a better-steered plan, so selling pantry size is selling plan quality, which is the one line I may not cross |
| The P0 | A *"generar desde mi despensa"* button that fires a generation **not stamped `redo`** is an unmetered model call that walks around the only `financial` number in the table |
| Sequencing | Free: shippable the week it is built — it opens **no new door**, so unlike the past-plans gate it does not trip my checkout P0. **Premium-only: must not ship until a checkout exists**, or it is a second padlock with no handle for the four free accounts in production |
| Is there a free version worth having? | **It already shipped.** `boughtGrams` typed against the whole plan (`0091`, `0096`, 2026-10-11) *is* "what I already have, read against the list of a plan I already have". The gap is framing, not code |

## 1. What one unit costs to serve

**There is no unit.** A pantry is a profile field — like an allergy, a disliked food, a
preferred cuisine, a maximum cooking time or a kitchen — and **not one of those is in
`Allowance.ts`**. The question therefore becomes the one the kitchen audit asked: *does
knowing a pantry make any priced thing happen more often?*

| Door | Does it cost? | Label |
| --- | --- | --- |
| Declaring a pantry, or changing it | **nothing** — profile writes, no provider call | **estimated** from the shape of every comparable field; the architect owns the mechanism |
| Asking the model to favour what somebody has | **nothing extra** | **confirmed** mechanism: the model is asked for `FRESH_DISHES_PER_SLOT = 7` dishes a slot regardless of how rich or poor that person's pool is (`Rotation.ts:58`, `freshFloorPerSlot` in `PlanGeneration.service.ts:230`). A preference changes the words of the request, not the number of them |
| Reordering the library read toward dishes you can already cook | **nothing** | **estimated**, same mechanism as `PREFERRED CUISINES:` and `LIKES:`, which have been tier-blind since before there were tiers |
| A thin pool pushing the plan toward written-now dishes | **pictures, within an existing ceiling** | **confirmed** bounds: 0.0337 $ a picture (`IMAGE_COST_FLOOR_USD`), **0.237 $ a generation measured** in production over the 30 days to 2026-10-12, ceiling **0.71 $** on a three-meal day because a generation cannot draw more than the fresh dishes it asked for (both recorded in `the-kitchen-a-person-has.md` § 1) |

**That fourth row is the only real cost, and it is the same cost the kitchen already has
— except more so.** The kitchen's hardest case removes under a tenth of the library
(estimated, PRD § *Problem*). A 17-item pantry, read as a **filter**, removes **94.5%** of
it (90 of 1,638, confirmed). A pool that thin cannot be served from stock, so the plan fills
itself with dishes written now, and a written-now dish that gets viewed is a new picture. So
a pantry-filtered generation plausibly sits near the **0.71 $** end rather than the 0.237 $
one — **three times an ordinary plan, every time it is used** (estimated, from the two
confirmed figures either side).

**That estimate is about the filter, which § 3 refuses — not about the steer I am
recommending.** The steer's effect on picture spend is **unmeasured and could go either
way**: a bias *toward* dishes the library can already cook with what somebody owns may pull
*fewer* written-now dishes than an ordinary generation, not more. I am not claiming a
direction. It is the first thing § 8 counts, and the only cost claim in this report that a
launch could falsify.

**And that is still not a reason to sell it, for the reason the kitchen audit already
established**: pictures come out of `AI_IMAGE_MONTHLY_CAP_USD`, a **10 $ pot everybody
shares**, which stops drawing for *everyone* when it empties (confirmed,
`Env.validation.ts:234`). Moving a picture-pulling behaviour behind premium does not make
premium pay for it — the same pot empties, for the same people, just with fewer hands on it.
At 0.71 $ the month's pot buys about **14 generations, roughly six accounts of hard-steered
use** where eighteen ordinary ones fit (estimated, recorded in the kitchen audit). **The
control this feature needs is a per-account picture meter or a bigger pot, not a tier** —
and that is the owner's next money decision whatever he does with the pantry.

**The build cost is not a per-use cost.** Whatever the architect's plan turns out to be —
a picker, a mapping from a cupboard to catalogue rows, a prompt line, a scoring pass — it is
paid once, by whoever writes it. Nobody should later read "the pantry cost us something" as a
reason to charge for it. What this product sells is per-use cost, and it has never sold
anything else.

## 2. What an ordinary fortnight actually needs — and why the feature as asked cannot exist

This is the section that decides the verdict, and all of it is countable.

**A fortnight needs about a hundred distinct ingredients.** Eight random 40-dish draws from
the local library needed **95, 111, 107, 120, 90, 107, 90 and 112** distinct ingredients
(confirmed as a count; **estimated** as a stand-in for a real fortnight — there are no plans
in the local database, so I sampled 40 dishes at random per draw rather than measuring a
scheduled plan. 40 is the order of a 14-day, three-meal plan under the variety cap; a real
plan repeats more, so the true figure is somewhat lower and certainly not near twelve).

**A person will type ten to twenty-five things.** (**Estimated**, and I have nothing to read:
nobody has ever done this here. It is the size of a cupboard inventory somebody will tolerate
typing, and it is the owner's own example — *"los ingredientes que tiene ya"*.)

**The owner named two inputs — *«su lista de la compra o los ingredientes que tiene ya»* —
and the arithmetic is the same for both.** A shopping list somebody is about to buy is a list
of twenty-odd things exactly as a cupboard inventory is; neither reaches a hundred. So
nothing below depends on which of the two he meant, and the verdict does not move if he meant
both.

**So the gap is a factor of five, and it is not closable by a better mechanism.** The
following is what the library can actually cook from a pantry, in both the most favourable
and a realistic reading.

| Pantry | Dishes fully makeable, of 1,638 | By slot |
| --- | --- | --- |
| The library's **10 most-used** ingredients (the most favourable 10 that exist) | **238** | **233 breakfast, 5 dinner, 0 lunch** |
| Its 20 most-used | 274 | — |
| Its 50 most-used | 388 | — |
| Its 100 most-used | 695 | — |
| **A hand-built household pantry** — 20 staples I wrote down, of which **17 exist** in the library | **90** | **34 breakfast, 34 dinner, 22 lunch** |

All confirmed by query, 2026-10-22, local library. The hand-built list is **mine** and is the
one estimate in the table: salt, extra-virgin olive oil, garlic, onion, potato, carrot, egg,
chicken breast, cooked lentils, tomato, crushed tomato, red pepper, courgette, semi-skimmed
milk, Greek yoghurt, wholemeal bread, black pepper — plus rice, pasta and tinned tuna, whose
slugs as I guessed them **do not exist** (§ 5).

Three things follow, and each of them on its own kills *"a plan from my ingredients"*.

1. **The favourable case is porridge, not a plan.** Of the 238 dishes the top-10 pantry
   covers, **71 have one ingredient and 157 have two** (confirmed), and 233 of them are
   breakfasts. A pantry-only pool is a breakfast menu with five dinners attached.
2. **The realistic case gives the scheduler 22 lunches, 34 dinners and 34 breakfasts to
   choose from** — before the allergy gate, dislikes, season, cooking time, the kitchen and
   the variety cap (`0099`) have taken anything. **The problem is not the row count**: a
   fortnight may repeat, so 22 lunches can fill 14 days by arithmetic. The problem is the
   **band**. Every day must land inside ±5% on all four macros, and that is reached by
   *choosing which dish fills a slot* — `improveDay`'s swap rounds, the spread pass, the
   band-repair pass that works by swapping a dish out of the pool. **So the single
   discriminating measurement, and it is the architect's**: *does a pool of that composition
   still land fourteen days in band on all four macros, and how often does band repair run
   out of dishes to try?* I would be surprised if it held, because project 017 bought that
   promise with the scheduler completely free over an 871-recipe reference library. **My
   answer on either side**: if **no**, the library half of this feature is decoration and the
   only shippable version is the prompt steer, which is free by § 1. If **yes**, the
   library-first version is real, costs nothing, and is *still* free by § 1 — the fork
   changes the mechanism, not the tier.
3. **More than half of what somebody names cooks nothing.** Only **417 of 930** catalogue
   ingredients appear in any recipe at all, and **156 of those 417 appear in three or fewer**
   (confirmed). So on the library's own distribution, a person naming fifteen things from
   their cupboard has named, on average, **seven that no dish in the product uses** — and
   the ones that do land are disproportionately salt (53.9% of dishes) and olive oil (50.2%).
   A screen that accepts those seven silently and then ignores them is the dark-pattern
   version of this feature: the person believes they have told us something and the plan
   does not change. **Whatever ships must say, per item, that this one cooks nothing yet.**

## 3. What the free tier must keep answering

My own test, proposed in [`the-past-is-premium.md`](./the-past-is-premium.md) § 2 and written
precisely so that it would refuse the next three proposals citing category 2 as precedent:

> *A thing may be sold only if the free tier still answers the question that thing exists to
> answer.*

**The question this feature exists to answer is:** *"tengo la nevera llena y dos semanas que
planificar — ¿qué cocino con esto antes de que se eche a perder?"*

**Free's answer today, if the feature were premium-only:** nothing. There is no catalogue
screen (confirmed in the past-plans audit: a recipe is reachable only through a meal in a
plan), so a free account cannot even browse for "what can I make with courgette". The
nearest free thing is **the shopping list typed by amount** (`0091`, `0096`): a person who
already has 400 g of rice types it and the list stops asking them to buy it. That answers a
**different and narrower** question — *"don't make me buy what I already own"* — and it
answers it well. It does not answer *"cook what I have before it spoils"* at all.

**So the test refuses the gate.** Premium-only would leave the free tier with no answer to
the question the feature exists to answer, which is the condition I wrote the test to catch.
And category 1 does not rescue it: § 1 shows the steer costs us nothing a plan was not
already going to cost.

**The line this feature must never cross, stated before anybody designs it.** A plan steered
by a pantry is still a *complete, safe, balanced* plan. If the mechanism is a filter and the
filter cannot reach the macro bands, the answer is **not** "serve a free account the
unbalanced version and premium the balanced one" — that is selling the nutrition maths, and
it is the one thing `Allowance.ts` forbids outright. The answer is that the filter does not
ship, on either tier, and the steer does.

## 4. The number, and why not one higher

### The row I would add to `Allowance.ts`: none

Nothing here is counted, so there is nothing to limit. **My method does not survive this
question for the second time**, and — as with the kitchen — that is the finding rather than a
failure: steps that ask "what does one unit cost" and "how many does an ordinary fortnight
need" presuppose a unit, and a profile field has none.

**The priced thing is the generation, and it already has a counter.** Generating the next
fortnight is always allowed — *"that is the product"*, `planRedoStanding` — and re-rolling
the fortnight in progress costs a redo: free 1, premium 3. A pantry changes **what** a
generation is asked for, not **how many** are allowed. So:

- Somebody who declares a pantry and generates their next fortnight spends nothing new, on
  either tier. Correct: that was their fortnight.
- Somebody who looks at the result, moves three things in the cupboard and wants another go
  **spends a redo**. Free gets one, premium gets three. That is the shape, and it needs no
  new constant.

**This is the most useful thing in the whole analysis for premium**, and it is worth saying
plainly: zero accounts have ever reached any limit, two events exist in the product's entire
history, and the busiest plan ever took five swaps against a limit of twenty (all confirmed,
2026-10-12). **Nothing premium sells is felt.** A pantry is the first feature in this product
that gives somebody a reason to re-roll a plan on purpose — *"no, use the chickpeas, not the
lentils"* — which turns `planRedosPerFortnight` from arithmetic on a pitch into the number
somebody meets on a Sunday. Premium does not need a new benefit here. It needs its existing
one to start mattering, and this is what makes it matter.

### The one bound worth having: 20 pantry items, both tiers

Recommended, not required, and **not** a `tier_allowances` row — a product bound checked
where it is written, exactly as `MAX_PREFERRED_APPLIANCES` is (`KitchenController.ts:97`:
*"the same on both tiers, a product bound and not a price"*).

**Why 20.** It is the size of the pantry I could write down without inventing things (§ 2),
and it is already enough to be thin: 17 real staples covered 22 lunches. A steer carrying 20
ingredient names is also about as much as one prompt line can usefully say.

**Why not fewer.** At **10** the bound would bite on an ordinary kitchen before the feature
could show anything: a household that has salt, oil, garlic, onion, potato, egg, milk, bread,
rice and pasta has spent the entire allowance on things that are in every dish anyway, and
has not yet named the courgette that is actually going off. Ten is the number that makes the
feature feel broken for the people it works for.

**Why not more.** At **40** the list stops being a preference and becomes a supermarket:
nothing is prioritised, every dish matches something, and the steer says nothing. The
failure is silent — a plan that ignores you while looking like it listened — which is worse
than a refusal. If the architect finds that the mechanism reads a *subset* rather than a
preference, the argument for a lower bound gets stronger, not weaker, and I would move to 15.

**It must be a refusal with the field named (422), not a quota error** — nothing here is
spent or counted, there is no tier to upgrade to and no time at which it frees up. The
request simply says one thing too many. Same reasoning, same words, as the kitchen's bound.

### The numbers I would refuse

1. **`pantryPlansPerFortnight`, free 0 / premium N.** A fifth counter on a thing that costs
   nothing to serve, measuring a generation that is already metered. It would be the first
   number in the table with no cost behind it and no honest category to sit in.
2. **A pantry size that differs by tier** — free 5 items, premium 20, or anything of that
   shape. This is the one I would argue against hardest, because it looks like ordinary
   packaging and is not: a bigger pantry produces a **better-steered plan**, so a
   tier-dependent pantry size sells the quality of the plan. That is the line in
   `Allowance.ts` I am not permitted to propose crossing, and I am not proposing it.
3. **A dedicated model call behind a *"genera desde mi despensa"* button that is not stamped
   `redo`** (the P0). Every path that spends a provider call must land on an existing
   counter: the generation it belongs to, a redo if it re-rolls a live fortnight, or a dish
   request if what it really asks is *"write me a dish with these three things"* — which is
   exactly `dishRequestsPerMonth`, premium 3 a month, already priced at ~0.04 $ a stored
   dish, already `financial` in `0097`'s terms. **No new financial allowance is needed for
   any version of this feature**, and if the architect's design seems to need one, the design
   is the thing to change.

## 5. The promise problem: how it must be named, and what I would refuse to ship

Somebody types twelve ingredients and expects fourteen days. § 2 says they will not get them.
**Naming is therefore not decoration here; it is the whole of whether this feature is honest.**

### What I would refuse to let ship

| Refused | Why |
| --- | --- |
| «Un plan **a partir de** tus ingredientes» | The owner's own phrase, and the one thing the product cannot do: a fortnight needs ~100 distinct ingredients |
| «Cocina **solo con** lo que tienes» / «sin comprar nada más» | False on the measured library — and it is the version somebody will test on day one |
| «Tu despensa, tu plan» | Reads as *all of it*, denies nothing, and cannot be falsified until the plan arrives |
| Any **count promised before** generation — *"haremos 8 comidas con tu despensa"* | Nobody can know that number before the scheduler has run |
| A pantry item accepted **silently** when nothing cooks it | 513 of 930 ingredients cook nothing (confirmed). Accepting them without a word is a dark pattern: the person has told us something and nothing happened |
| «Premium planifica con lo que tienes» (while free has nothing) | § 3: it sells the only answer to the question the feature exists to answer |

### What I would ship, as the screen would say it

The verb has to carry the honesty. **`aprovechar`**, never `a partir de`: it promises
*priority*, which is deliverable, instead of *origin*, which is not.

- **The option, on the generation screen** —
  ES: **«Aprovecha lo que ya tienes en casa»**
  EN: *"Make the most of what you already have."*
- **The sentence under it, before anybody commits** —
  ES: **«Daremos prioridad a los platos que usen lo que nos digas. No todo el plan saldrá de
  tu despensa: catorce días necesitan unos cien ingredientes distintos, así que la compra
  seguirá existiendo — más corta.»**
  EN: *"We will favour dishes that use what you tell us. Not all of the plan will come out of
  your cupboard: a fortnight needs about a hundred different ingredients, so there will still
  be a shop — a shorter one."*
- **Per item, when nothing cooks it** —
  ES: **«Todavía no cocinamos nada con esto.»** (and it stays in the list, because tomorrow
  the library may)
- **After the plan exists, as a measured fact and not a promise** —
  ES: **«9 de 42 comidas usan solo lo que ya tenías. La compra baja de 38 a 27 cosas.»**
  This is the sentence that makes the feature felt, and it is the only number in the whole
  feature I would let anybody see, because it is the only one that is true when it is shown.

**One naming trap the data names for me.** A person has *rice* in the cupboard; the library
has **16 rice rows** — `arroz-integral-crudo`, `arroz-integral-cocido`, `arroz-basmati-crudo`,
`arroz-bomba-crudo` and so on — and **10 pasta rows and 6 tuna rows** (confirmed). Three of
the 20 staples I wrote down did not exist under the slug I guessed. So whatever the picker
is, it must accept the coarse thing a person owns (*arroz*, *pasta*, *atún*) and the
raw/cooked distinction (`0078`) must be the product's problem, not theirs. **That is the
architect's**, and it is the second question I would put to him after the pool size: *can a
cupboard word be mapped to a catalogue row without asking somebody whether their rice is
cooked?* There are 1,860 rows in `ingredient_names` to work with (confirmed), which is where
I would look first.

**And it cannot be a free-text box.** The live Spanish text says the model is sent food and
dish names *«siempre con los nombres de nuestras listas»* and never *«nada que escribas a
mano —salvo el nombre de un plato, si tú se lo pides—»* (**confirmed, read 2026-10-22**:
`apps/web/src/i18n/dictionaries/es-ES.ts:2971`, and the longer version at `:2789`). So the
promise has **exactly one** hand-written exception, and `0100` is it: a dish name you asked
for, whose words are prompt input only — never stored, never logged — with `dishRequest`
added deliberately to the allowed-keys list that `health-boundary.spec.ts` holds the line
with. A typed pantry would need a **second** exception: a second allowed key, a changed
policy, `privacy.updated` moved, and `analysis.md` P0-3 reopened a second time. A **picker
over names the code already owns** needs none of that — a catalogue slug *is* a name from
our lists. **My recommendation: picker.** If the owner wants the text box anyway, it is a
`legal` question before it is an engineering one, and `0100` is the precedent for how
expensive that conversation is.

## 6. Where this sits against what premium already sells

| Against | Effect |
| --- | --- |
| **Redos** (free 1 / premium 3 — the number that costs money) | **Complementary, and this is the find.** A pantry gives somebody the first concrete reason to re-roll a fortnight. It does not replace the headline: it makes the headline felt for the first time |
| **Dish requests** (premium 3 a month) | **Feeds them, does not cannibalise them.** With 513 of 930 ingredients cooking nothing, a pantry is the clearest generator of *"you have something we cannot cook — shall we write a dish for it?"* — which is a dish request, already premium, already priced. This is the strongest answer yet to my own worry in `dish-requests.md` that premium's requests would go unused |
| **The shopping list** (free, and never sold) | It **shortens** the list, which is the point. The list is not sold and must not become sellable because a pantry made it shorter |
| **Fixed meals** (1 / 3) | Neutral. Two different wants: a routine, versus a cupboard |
| **The kitchen** (free, both tiers, `0102`) | **Its twin**, and the precedent I am following. *What appliances I have* steers the rotation and is free; *what food I have* steers the pool and should be free for the same reason, in the same place, at the same cost |

**Would it become the headline reason to pay?** No — and it should not, because it cannot
carry a price: there is no cost behind it, and a benefit with no cost behind it is one the
free tier can always be argued back into. **It would become the headline reason to *use the
product*, which is more valuable than a line on a pricing page.** If the owner nonetheless
decides it is the headline — his call, not mine — then the implication for the price nobody
has set is this: the thing he would be charging for is a **profile field**, and the first
competitor to give it away for free makes his pricing page look mean overnight. Charging for
redos survives that; charging for a text field does not.

## 7. Sequencing, in one unambiguous recommendation

**If it ships free, ship it the week it is built.** It opens **no new door**: there is no
padlock, no *Ver premium*, nothing to buy. So it does not trip the P0 that
`the-past-is-premium.md` raised 48 hours ago, and that is a genuine point in its favour that
nothing else about it supplies.

**If the owner keeps it premium-only against this report, then it must not ship until a
checkout exists.** Production holds **no `STRIPE_*` variable of any kind** on the API's
Production target and premium is granted by hand from `/admin` (confirmed by the lead,
2026-10-20). Four of the eight accounts are free. Shipping a premium-only pantry today
builds a second locked door with no handle, in the same month as the first, and the friend
behind it has to ask the owner in person. **Build it, leave the gate inert, flip it in the
deploy that lands the first price** — the same remedy, for the same reason, as the past-plans
gate.

## 8. What I would measure after launch, and the figure that says pull it

All of these need the admin console to count them; none needs a new model call.

| Measure | Why | Pull threshold |
| --- | --- | --- |
| **Owned share of the shopping list** — rows on a pantry-steered plan already covered by what the person declared, against the same figure for unsteered plans | It is the single thing the feature exists to move | **If the lift is smaller than the architect's measured noise on pool composition, it is decoration.** My prior line: under **15%** of the list covered, it is not worth the screen |
| **Pantry items that cook nothing** — the share of declared items with zero matching recipes | The library's own distribution predicts over half | Over **50%** and the picker is misleading people even with the per-item sentence; the fix is library supply, not copy |
| **Pictures per generation, pantry versus not** | The only cost channel (§ 1), against 0.237 $ measured and a 0.71 $ ceiling | Sustained above **0.45 $ a pantry generation** — roughly twice the measured figure and two-thirds of the way to the ceiling, **a chosen line and not a derived one** — and the 10 $ pot needs raising or metering **before** the feature is promoted anywhere |
| **Redos spent per fortnight, pantry accounts versus not** | Whether it makes the existing allowance felt (§ 4) | If free accounts hit their one redo and premium accounts do not reach three, premium's number is right. If premium accounts hit three, that is the first real evidence for moving a number in this table — and the first time any of them has been reached |
| **Plans where the band promise was missed** on pantry-steered generations | The structural currency. A steer must not quietly cost the ±5% promise | **Any** day delivered with an advisory on a pantry plan that would not have had one: stop steering that hard. This one has no tolerance, because it is the half that may never be sold or spent |

## Not checked against the market for this report, and why

**I ran no search.** So I am not citing a competitor's number, and I would not
use one as a reason anyway — their cost base is not ours and nobody else is holding a ±5%
four-macro promise on every day of a fortnight. What I will say from the shape of the
category: "cook what is in your fridge" is a well-trodden single-recipe feature and a
notoriously bad **multi-week-plan** feature, for exactly the arithmetic in § 2. If the owner
wants a comparison before deciding, the useful one is a recipe app's "pantry search" against
*one meal* — and that is a different product from a fortnight, which is the point.

## What is not mine to decide

- **Whether it is built at all, and in what order** — the owner's. My verdict is on shape and
  tier, not on his roadmap.
- **The price**, if he overrules § 3 and sells it. His, and still unset. The roadmap's own
  advice stands: *"choosing what to charge for is the most expensive guess on this page to
  undo"*, and the feedback box is the input to read first.
- **Whether the pool can hold the bands** (§ 2, point 2), **whether a cupboard word can be
  mapped to a catalogue row** (§ 5), and **what the mechanism is** — the architect's, all
  three. My answer forks on the first and is unchanged by the other two.
- **Whether a free-text pantry may reach a model** — `legal`'s, before it is anybody else's.
