# What a dish request costs, who gets one, and how many

> **Purpose**: the number for the **dish request** — somebody names a dish the library does
> not have and the model writes it for a slot, against that day's budget, through the same
> gates as everything else. It prices the unit, sets free and premium, names the window the
> count resets in, writes the `ALLOWANCE_BOUNDS` entry, and says what the premium pitch may
> claim. It also names the one condition under which selling this is honest at all.
> **Audience**: the owner, and the lead who writes the constant. **Committed**: yes.
> **Maintained by**: agents draft, owner approves. Update it in the same change that moves
> the number.
>
> Evidential content rule: facts below are labelled **confirmed** (with how) or **estimated**
> (with the hypothesis). Written 2026-10-13 against `main` at `c38d316d`. Nothing of this
> feature is built, so there is **no usage to read**: every claim about demand is either a
> measurement from [`architecture/0011`](../architecture/0011-a-dish-the-library-does-not-have-2026-10-13.md)
> or an estimate that says so.
>
> Companion to [`tiers-and-allowances.md`](./tiers-and-allowances.md), which prices the other
> five allowances and whose cost table and production counts this one leans on.

## What this decides

**Free 0, premium 3 a calendar month, counted when a dish is stored and not when a request
is made — and not sold at all until the screen can first say *why* a dish was not offered,
because without that sentence a paid request is sold to people whose dish was never
missing.**

| | Value | Unit |
| --- | --- | --- |
| `dishRequestsPerMonth`, free | **0** | per account, per calendar month |
| `dishRequestsPerMonth`, premium | **3** | per account, per calendar month |
| `ceiling` | **6** | twice what shipped, the `planRedosPerFortnight` precedent |
| `floor` | **0** | zero is free's value, and the kill switch |
| `kind` | **`financial`** | it spends the month's pictures, from the pot everybody shares |

The lead offered one alternative explicitly — *"do not sell this, make it a flat small number
for everybody"*. It was weighed and is rejected in [Free gets none](#free-gets-none-and-what-free-gets-instead):
free accounts are the population that scales, and a flat number is a recurring bill per
signup against a pot that eighteen ordinary accounts already empty.

## 1. What one unit costs to serve

One **request** is one text call. One **successful** request is that call plus, later, one
picture — the dish it created is drawn on first view like any other
([`0066`](../../decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md)), and a
dish fixed to a weekday is viewed, so the picture is certain rather than probable.

| | Cost | Label |
| --- | --- | --- |
| The text call, 3 candidates for one slot | **0.0006–0.002 $** | **estimated**, scaled from [`architecture/0002`](../architecture/0002-which-model-generates-the-dishes-2026-09-25.md) § 4.2: a generation is 12 calls, ~60k input tokens and 28 dishes for 0.007 $ (no reasoning) or 0.017 $ (reasoning), at DeepSeek V4 Flash 0731 on DeepInfra, 0.06 / 0.18 $ per M. One call is ~5k input and ~3 × 600 output tokens → 0.0006 $; at the measured reasoning median → 0.0018 $ |
| The picture, drawn on first view | **0.0337 $** | **confirmed**, `IMAGE_COST_FLOOR_USD` (`apps/api/src/modules/ai/services/DishPicture.service.ts:32`), Vertex at 1K |
| Its two judge calls | **~0.001 $** | **confirmed** as a floor, `JUDGE_COST_FLOOR_USD = 0.001` (`:35`), *"twice what a judge call cost in the pilot"* |
| **One stored dish, all in** | **≈ 0.04 $** | sum of the above |
| **One request that stores nothing** | **0.0006–0.002 $** | the text call alone: the output gate refuses the name, so no recipe row exists and nothing is ever drawn |

Three things follow, and each decides something below.

- **The picture is the cost; the model call is a rounding error.** 94–98% of a stored dish is
  the picture. This is the same finding `tiers-and-allowances.md` made about redos — *the
  money in this product is pictures, not text* — and it holds a second time.
- **A failure is 20–60× cheaper than a success.** That asymmetry is what makes
  [counting on the store](#3-what-the-counter-counts) nearly free to give away.
- **This allowance does not move the price.** One premium account at 3 a month is
  **0.11 $ a month**, against the **2.03 $ a month** its redo allowance may already spend in
  pictures (**confirmed** production figure, 0.237 $ a generation over the 30 days to
  2026-10-12). It adds **5%** to the worst case of a premium account. The ~3 €/month floor
  that audit derived is unchanged, which means this number can be set before the price is.
- **It is the only allowance whose money buys a durable asset.** `recipes` is global —
  *"Recipes are shared, not user-owned"* (`packages/database/src/schemas/recipe.schema.ts:13-17`),
  **confirmed** — so a dish written for one account is in everybody's pool afterwards, per
  locale (`recipes.locale`, reuse is scoped to it). A redo's 0.237 $ buys one person one
  fortnight; a request's 0.04 $ buys the product a dish for ever. In steady state the fixed
  meal it serves is then *cheaper* than a free slot, because it reuses a drawn dish instead
  of pulling one from the fresh third (**estimated**, the same argument `tiers-and-allowances.md`
  makes for fixed meals).

### What text spend is *not* visible in

`recipe_image_calls` records every picture and judge call with a `costUsd`
(`recipe.schema.ts:154-170`, **confirmed**) and the 10 $ monthly cap is computed from it.
**Nothing in our database meters a text call.** So the text side of this allowance is
auditable only on OpenRouter's own dashboard and bounded only by the key's spend cap
(`architecture/0002` § 4.3). That is acceptable at 0.002 $ a call and is why the backstop for
abuse is a rate limit rather than a counter — see [§ 6](#6-what-is-not-mine-to-decide).

## 2. What an ordinary fortnight actually needs

**The honest demand for this is small, and that is measured rather than argued.**
`architecture/0011` took the owner's own example and found the library was not the problem:

- Nine filters can remove a dish before it is offered. **Absence from the library is the
  ninth and rarest.** Of the owner's two examples, *patatas a la riojana* **was in the
  library** (plus two more "a la riojana") and *tostadas con tomate, pavo y queso fresco* had
  a near-identical dish already written (**confirmed**, 0011 § 1 and § 7).
- What actually excluded his dish was a **30-minute cooking preference** against a 50-minute
  recipe. Raising that one preference to 60 added **65 lunches and 37 dinners** for that
  profile (**confirmed**, 0011 § 3).
- The plate binds far more often than the library: for one person, on one day, **158 dishes
  are fixable at lunch and not at dinner** (**confirmed**, 0011 § 1).
- What a free account can already fix today, same profile, 982 recipes on local Postgres:
  **186 breakfasts, 263 lunches, 157 dinners** (**confirmed**, 0011 § 7).

So the ratio that matters: **a free preference change unlocked ~102 dishes for one real
profile; a month of paid requests produces 3.** Two orders of magnitude, and the free side is
the one that answered the owner's actual experience.

The second bound on demand is the feature the request serves. Premium may hold **3 standing
fixed meals** (`Allowance.ts`, shipped 2026-10-13). A person's lifetime demand is therefore
*the rules whose dish does not exist* — under one, on the evidence above — plus churn when
they change a routine. **Estimated**: an ordinary premium account asks **0–2 times ever**, and
the asks cluster in the week they set their routines up.

That clustering is the whole of the unit question.

## 3. What the counter counts

**An allowance is spent when a dish is stored, never when a request is sent.**

The legal entry's condition 4 (`docs/legal/analysis.md`, *P0-3's status at 2026-10-13*) means
a request can pass through the model and still return nothing storable: the output gate
refuses a name that carries anything beyond a dish. The lead asked for that to be priced.
It is, and the answer is that **the person must not pay for it**:

- it costs us **0.0006–0.002 $** — a twentieth to a sixtieth of a success (§ 1), so giving it
  away free costs essentially nothing;
- charging for it is the thing I am not allowed to propose: a counter that goes down when
  nothing came back is a limit the person cannot predict or verify, and it is not something
  the owner would print on the pricing page;
- and it is the interlock that makes a number sayable out loud. **The pitch may name "three a
  month" only because the three are three dishes, not three attempts.** If the counter were
  spent on attempts, the honest pitch clause would have to be *"three tries a month"*, which
  sells a lottery.

Counting stored dishes also happens to be the cheapest thing to implement, because the row
that proves it is the row that cost the money (§ 6).

**The edge where this is not clean, and the call on it.** A dish can pass the output gate,
be stored, and still fail the slot it was asked for — too big for that plate
(`PLATE_LIMIT`, `fitsPlate`), longer than the person's cooking time, out of season (0011
§ 1, filters 4, 7 and 8). The dish exists, the library gained it, the picture will be drawn,
the person's Friday rule did not happen.

- **Counted.** Something was produced and stored at full cost, and it is reusable by them and
  by everybody.
- **And the screen owes them the sentence 0011 § 2 writes anyway** — *"it fits your lunch, not
  your dinner"*, *"50 min, longer than the 30 you usually want"*. A stored dish with a reason
  is a thing they can act on; a stored dish with silence is the current defect with a counter
  attached.
- *Rejected alternative*: discard the dish and refund the count. It throws away a dish we paid
  for and that nothing is wrong with, and it hides the one piece of information the person
  needs.

## 4. The unit: per account, per calendar month

The lead is right that neither existing unit is obviously correct. Each was tested:

| Unit | Why not |
| --- | --- |
| **Per plan** | A standing fixed meal is not per-plan — a rule outlives every fortnight, so there is no plan window to attach the count to. It is also **farmable**: free gets a generation plus a redo per fortnight, so a per-plan number is doubled by anybody who re-rolls. |
| **Per fortnight** | No farming, and it matches `planRedosPerFortnight` — but it is the worst fit for the demand's actual shape. Demand clusters at setup (§ 2); a person with two missing dishes on day one is told to come back in two weeks, which is the "too mean" failure for the sake of smoothing a 0.08 $ bill. |
| **Per account, never resetting** | Perfect for setup, hopeless afterwards: *"you have used your three, for ever"* on an account whose routine changes next year, and nothing to offer them but a sentence we refuse to write (no "upgrade to keep going" — there is no tier above premium). |
| **Per calendar month** | **Chosen.** It is the only predictable window left once the plan is not the unit: everybody knows when a month starts, nobody has to be told how our fortnights chain. It absorbs the setup cluster (three rules, three dishes, one month) and it costs us a bounded 0.11 $ per account per month at the shipped number. |

Two supporting facts rather than reasons: the pot this spends is itself metered by **calendar
month** (`AI_IMAGE_MONTHLY_CAP_USD`, **confirmed**), so the limit and the budget it draws on
reset together; and the registry already holds three different units — per plan, per
fortnight, and `fixedMeals` per account — so a fourth is not an anomaly, it is the third kind
of thing being counted.

**The reset must be on the screen**, as a date. A counter whose window the person cannot name
is a dark pattern by this doc's own standard, and a calendar month is the one window that
needs no explaining.

## 5. The numbers

### Free gets none, and what free gets instead

**Free 0.** This is the second zero on the free tier, after `midPlanEventsPerPlan`, and it
deserves the uncomfortable sentence: *free accounts are told we will not write them a dish.*
I am proposing it anyway, for three reasons in descending weight.

1. **It is a recurring bill per signup against the pot that is already the growth wall.**
   Premium's exposure is bounded by the number of people paying; free's is bounded by nothing.
   At one request per free account ever and 100 new free accounts a month, that is
   **4 $ a month, for ever** — 40% of the 10 $ cap, after which **no dish is drawn for
   anybody** (**confirmed**: `AI_IMAGE_MONTHLY_CAP_USD` default 10 $,
   `Env.validation.ts:234`). The month to 2026-10-12 was already 45% spent by 8 accounts
   (4.51 $, **confirmed**). The flat-number-for-everybody option fails exactly here, and it
   fails worse the better the product does.
2. **The free tier's answer to "my dish is not there" is better than a request, and
   measured.** The sentence that names the filter, and letting a fixed meal ignore the
   cooking-time preference (0011 § 2 and § 3), unlocked **102 dishes** for one profile against
   a request's 3 a month — and both are free for everybody. A free account that cannot find
   its dish is, on the measured evidence, far more often a filter problem than an absence
   problem.
3. **The trial argument that won for fixed meals does not transfer.** `fixedMeals` went free 1
   / premium 3 *so the feature could be tried before it is paid for*. The feature here is the
   **fixed meal**, and free can already try it against 157–263 fixable dishes per slot
   (**confirmed**, 0011 § 7). A dish request is not a feature to sample; it is a unit of
   production, and the only one of the six allowances that spends money every single time it
   is used.

**What free must keep, and it is not negotiable from my side.** None of this touches the line:
free keeps the whole shared catalogue — *including every dish premium's requests add to it, in
their locale* — the same allergy gate, the same macro maths, a complete plan. And **the
explanation of why a dish was not offered is not for sale.** If that sentence were premium's,
a free account would be left with an unexplained short list, which is the defect 0011 found,
and the paid request would be selling the answer to a question we chose not to answer. That
would be the dark pattern version of this feature, and it is a short walk from here.

### Premium 3 a month

**Why 3.** One for each standing rule the tier may hold. That is what makes the number
non-arbitrary: premium holds 3 fixed meals, so 3 a month is *every routine you may have,
answered in the month you set them up*, and the limit binds precisely when demand exists
instead of idling at a figure nobody meets.

**Why not 4 or 5.** Four a month is 48 a year against 3 rules you may hold. It cannot be felt
— no real account reaches it — and an unreachable number on the page that asks for money is
the exact defect this team already shipped once: `0044` wrote ten events on a fortnight that
admits seven, and the pitch promised them for three weeks. A number nobody can reach is not a
benefit, and I will not put a second one in the table.

**Why not 1 or 2.** Not because of money — 1 a month is 0.04 $ and 3 is 0.11 $, both noise
beside 2.03 $ of redos. Because of the shape of demand: the asks cluster in the week somebody
sets up their routines (§ 2, **estimated**). At 1 a month, a person with three routines and
two dishes we lack is served one and told to wait a month for the second, having just paid.
Two has the same failure one rule later. Three is the smallest number that does not break at
the only moment the feature is wanted.

**What breaks if I am wrong, in each direction.**

- **Too mean (free 0, premium 3).** A free account meets a wall on a feature it has just been
  shown. That is mitigated and measurable: the free explanation and the cooking-time escape
  answer most of those cases, and the console can set free to 1 in a second if the support
  questions say otherwise. **Nobody is grandfathered into anything**: payments are not live,
  so no number here is a term of a contract yet.
- **Too generous (free > 0, or premium ≥ 5).** The pot empties and **pictures stop for
  everybody**, free and paying alike, which is the worst failure in this product's cost model
  because it is invisible to the person it happens to and global. At 20 premium accounts
  maxing 3 a month that is 2.16 $ — 22% of the month — on top of generations that already
  spend more than that.

### The arithmetic the owner should see beside this number

| Scenario | Stored dishes / month | Cost / month | Share of the 10 $ cap |
| --- | --- | --- | --- |
| One premium account, maxed | 3 | 0.11 $ | 1% |
| One premium account at the ceiling (6) | 6 | 0.22 $ | 2% — about what one redo's pictures cost |
| 20 premium accounts, all maxed | 60 | 2.16 $ | 22% |
| Free at 1-ever, 100 new signups a month | 100 | 4.00 $ | 40%, recurring |
| One practice of 50 clients, all maxed | 150 | 5.40 $ | **54%** |

The last row is the one to flag, and it is **confirmed** in the code rather than feared:
`PlanController.tierOf` answers `premium` for a client of an open practice before it reads the
column (`:962-974`, [`0061`](../../decisions/0061-a-subscription-grants-what-its-price-says.md)),
and the registry has exactly two tiers. **So a practice's clients get premium's dish requests
at the practice's price, and the console cannot give them a different number without moving
premium's.** Nothing to fix today — at 3 a month and the practice sizes in sight it is cents —
but it is the row where this allowance can become a real bill, and it is the second time the
practice tier has inherited a premium number by construction (`fixedMeals` was the first).

## The `ALLOWANCE_BOUNDS` entry

```ts
dishRequestsPerMonth: {
  ceiling: 6,
  floor: 0,
  kind: 'financial',
  why: 'Six a month is every standing rule rewritten twice over, which is churn and not a routine; the money does not bound this one — at about 0.04 $ a stored dish, nearly all of it the picture, even six a month costs what a single redo’s pictures do.'
}
```

**`kind: 'financial'` — the lead's reading is right, with one nuance worth keeping.** It does
spend from the pot everybody shares, so `0097`'s rule applies in full: movable, never without
the spend in front of whoever moves it. The nuance is that **this is the first financial number
whose money is too small to bound it.** `planRedosPerFortnight`'s ceiling of 6 was derived from
the money — *"where a single account can eat a third of the month"*. The same derivation here
gives **92 a month** (a third of 10 $ at 0.04 $ a dish), which is not a product number at all.
So the ceiling is a **product** bound wearing a financial kind: 6 is twice the shipped value,
which is the ratio `planRedosPerFortnight` already uses (3 shipped, 6 ceiling), and twice the
rules a tier may hold.

**`floor: 0`**, and zero is doing two jobs: it is free's shipped value, and it is the kill
switch if the output gate misbehaves in production — the one allowance where a bad month is a
name in the shared library that nobody can unsay.

**The screen rule that comes with a zero** (`0097` rule 3): free must render the premium card
where the control would be, never *"0 of 0 left"*. `countedStanding` already answers
`allowed: false, limit: 0` rather than being absent, which is what gives the screen one thing
to read whichever tier is asking.

**The one coherence rule.** The sensible ceiling is the fixed-meal allowance a tier holds, and
I considered resolving it that way — `min(dishRequestsPerMonth, fixedMeals)` — as
`midPlanEventsPerPlan` resolves against `eventsPerPlan`. **I do not recommend it.** `0097` says
the resolution order is *"the whole of the correctness here"*, and the failure a hard coupling
would prevent is harmless: an admin who sets requests above rules has granted somebody a few
extra dishes at 0.04 $ each, with nowhere standing to put them. A ceiling of 6 and the reason
in the `why` do the same work with no new order to get wrong.

**And the day the coupling stops being true, this number is wrong.** The reason "one per rule"
only holds while a dish request is reachable *only* from the fixed-meal screen. The seam it
would use already exists on the swap path (`promptPreferences`' `swapWish`,
`MealSwap.service.ts`'s `wishFor`), and the day somebody can ask for a written dish from a
meal they are looking at, demand becomes per-plan and much larger than three a month. **That is
a new number and a new decision, not a raise of this one.**

## The pitch

**Yes, one clause — the capability first, the number second, and no promise of success.**

The benefit scores: **felt** intensely but rarely (it is felt at the one moment somebody wants
a dish we lack, which 0011 measured is rarer than it feels); **bounded** honestly at 3 (it
binds at setup, the moment it is wanted); **costs us** every time, though trivially, and it is
the only allowance that buys the product something permanent. That is worth a dictionary line.

Three constraints on the wording, and the first two are correctness rather than taste:

1. **It may name the number only because failures do not count** (§ 3). If that ever changes,
   the clause must lose the digit.
2. **It must not promise the dish lands on the day asked.** A stored dish can still miss the
   plate, the cooking time or the season. *"Pídenoslo y lo escribimos"* is a promise;
   *"podemos escribirlo"* is the product.
3. **It must not invite free text beyond a dish name.** Legal condition 5 puts a notice at the
   field saying only a dish name belongs there; a pitch that reads as *"tell us what you
   want"* fights its own notice two screens later.

One new placeholder, `{dishRequests}`, in `pitchValues` — `premium.dishRequestsPerMonth` — and
one line per language. Shape, for `frontend` and the owner to word:

> …and if the dish you always make is not in the library, premium can ask us to write it:
> {dishRequests} a month, and it only counts when you get a dish.

That second half is unusual in a pitch and it should stay: it is the sentence that makes the
number true, and printing it is cheaper than answering the support question.

**Optional, and the owner's call because it is a claim about the product's character rather
than an allowance**: every dish a premium account asks for stays in the shared library, in its
locale, for everybody — free accounts included (**confirmed**, `recipe.schema.ts:13-17`). It is
true, it is the nicest thing about this feature, and it is the honest answer to *"why does free
get none?"*.

## The condition this is sold under, which is not a number

**Do not sell a dish request before the screen can say why a dish was not offered** (0011 § 2),
and preferably not before a fixed meal may ignore the cooking-time preference (§ 3).

The evidence is the owner's own case: he looked for a dish that **was in the library** and was
shown nothing, because of a preference he could have changed in two taps. Ship the paid request
without the explanation and the product's first sale on that screen is a model call sold to
somebody whose dish was never missing — **a false negative converted into revenue**. Nobody
would have intended it and the pricing page could not be written honestly around it.

With the explanation shipped first, the request becomes the honest residue: the person has been
told *"we do not have this one"*, and that is the only person who should be offered a way to
have it written. 0011 § 6 recommends the same order for engineering reasons; this is the
packaging reason, and it is the stronger of the two. **The order is the owner's to set** — I am
saying what each order sells.

## What is not mine to decide

Named for the lead, with the reason, and not designed here:

- **A marker that distinguishes a requested dish from a generated one.** The counter should be
  derived from the rows that cost the money — stored recipes by this account this month —
  which needs a way to tell them apart: `recipes.createdBy` is written as the requesting user
  for *every* generated dish (`PlanRepository.ts:1743`, **confirmed**) and `recipe_source` is
  `'seed' | 'ai' | 'user'` (`_enums.ts:58`, **confirmed**), so today they are indistinguishable.
  A new enum value would also keep **legal condition 2** — the typed string is never stored
  anywhere — because the count then needs no record of what was typed, only of what came back.
- **A per-account rate limit on attempts**, not an allowance, as the guard against somebody
  farming failed requests. The cost is 0.002 $ a go and no picture, so the allowance is the
  wrong instrument; [`0094`](../../decisions/0094-a-rate-limit-is-not-an-empty-account.md) is
  the precedent for how a rate limit should read to the person who meets it.
- **The OpenRouter key's spend cap** stays the only real backstop on text, because nothing in
  our database meters a text call (§ 1).
- **The price.** Unchanged by this: 0.11 $ a month on top of a 2.03 $ worst case leaves the
  ~3 €/month floor where `tiers-and-allowances.md` left it.
- **The decision record.** A number that ships supersedes nothing — this allowance is new — but
  it rests on [`0097`](../../decisions/0097-what-each-subscription-allows-is-data-the-owner-edits.md)
  (kinds, ceilings, zero as a value, the fallback is the smaller number),
  [`0099`](../../decisions/0099-a-variety-cap-counts-the-meals-the-generator-chose.md) and the
  shipped `fixedMeals` pair (the 3 it is one-per-rule against), `architecture/0011` (the demand
  measurement and the sequencing condition) and `docs/legal/analysis.md`'s five conditions
  (condition 4 is why the counter counts stored dishes).

## What I would read before this ships, if it can be read

Two counts, both the lead's to take from production, neither blocking:

1. **How big the production library is**, per locale and per slot. Every demand claim above
   rests on **982 recipes on local Postgres** (0011). If production holds materially fewer,
   absence is a commoner cause than 0011 measured and free 0 deserves re-reading — the number
   would move to free 1, not higher.
2. **How often a swap already falls through to the model** — the share of swaps that could not
   be answered from the library. It is the only existing measurement of "the library has
   nothing for this slot" and the closest thing to a prior for how often a dish request will
   be wanted at all. If that share is near zero, this feature is smaller than it looks and the
   sequencing condition above matters more than the number.
