# What free gets, what premium gets, and what a recurring meal costs us

> **Purpose**: the tier contract — every benefit premium has today, scored and judged, plus
> the number for the new recurring fixed meal. It names the limit for each of the five
> allowances and the reason the number is that number, so a future change argues with the
> reason rather than with the digit. It also says which of the five an admin may move from
> the console, how far, and what must be on screen beside it. The numbers themselves live
> in [`packages/core/src/domain/Allowance/Allowance.ts`](../../../packages/core/src/domain/Allowance/Allowance.ts)
> — as the default and the fallback, once the console can override them; this doc is why
> they are what they are.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that moves a number.
>
> Evidential content rule: facts below are labeled **confirmed** (with how) or
> **estimated** (with the hypothesis). Written 2026-10-12 against `main` at `c38d316d`.
> Costs and usage were counted in production the same day (§ *What production says*), but
> with eight beta accounts there is no usage *distribution* to read: a zero is strong
> evidence, a single maximum is not, and every claim about what people *do* says which it
> rests on.

## What this decides

**Free keeps one of everything that is free to serve and one of the only thing that costs
money; premium buys control rather than volume — and the two limits nobody can reach today
(twenty swaps, ten events) come down to numbers that bind.**

| Allowance | free now | free proposed | premium now | premium proposed | Supersedes |
| --- | --- | --- | --- | --- | --- |
| `eventsPerPlan` | 3 | **1** | 10 | **4** | [`0044`](../../decisions/0044-a-fortnight-rebuilt-for-an-event.md) |
| `mealSwapsPerPlan` | 5 | **3** | 20 | **10** | [`0015`](../../decisions/0015-one-redo-a-fortnight-five-swaps-a-plan.md), [`0042`](../../decisions/0042-what-a-paid-account-may-spend.md) |
| `midPlanEventsPerPlan` | 0 | 0 | 3 | 3 | keeps `0044` |
| `planRedosPerFortnight` | 1 | 1 | 3 | 3 | keeps `0015`, `0042` |
| `fixedMealsStanding` *(new)* | — | **1** | — | **3** | new |

> **Shipped on 2026-10-13 as `fixedMeals`**, free 1 and premium 3 as asked, the pair
> decided by the owner against [`0099`](../../decisions/0099-a-variety-cap-counts-the-meals-the-generator-chose.md)'s
> measurement. The name lost its `Standing` suffix for a reason this audit could not have
> known: `…Standing` already means *where you stand* in the code — `MealSwapStanding`,
> `PlanRedoStanding` — so the standing of `fixedMealsStanding` would have had to be called
> `fixedMealsStandingStanding`. `fixedMeals` keeps what the suffix was for, which was not
> looking like `…PerPlan`.

Three of the five numbers move. Two stay, and the audit below says why staying is a
decision and not an omission.

> **A sixth allowance is priced in its own file** (2026-10-13): the **dish request** — naming
> a dish the library does not have and having the model write it — in
> [`dish-requests.md`](./dish-requests.md). Free 0, premium 3 a calendar month, spent when a
> dish is stored rather than when a request is made. It is the second `financial` number after
> redos, the first whose money is too small to bound it, and the only one this audit's cost
> table did not already cover.

**Amended the same day** (owner, 2026-10-12: *"desde el panel del admin se tiene que poder
configurar todo, cuántos usos tiene cada subscripción, ya sea free o premium"*): the table
above stops being the law and becomes **the default shipped in code and the fallback** —
the console moves the numbers at runtime. [What the console may move, and how
far](#the-numbers-become-data-what-the-console-may-move) is the half of this doc that
answers that, and it changes none of the five numbers: it changes their status. One
consequence worth reading first: **with a console, every commercial cut below is
reversible in a second**, which removes the main risk of tightening free and premium now
rather than after the first euro.

## The ground, confirmed

- **The whole paywall is four numbers.** `tier === 'premium'` appears in exactly one file,
  `Allowance.ts` (**confirmed**, the lead's grep over the repository, reproduced here).
  Nothing about safety, the catalogue, the allergy gate, the nutrition maths, pictures,
  the shopping list or the check-in is gated. That is `0042`'s rule and it should never
  change: *what is sold is more of the thing that costs us money to produce*.
- **A linked practice client inherits premium** ([`0061`](../../decisions/0061-a-subscription-grants-what-its-price-says.md)):
  `PlanController.tierOf` answers `premium` for a client of an open practice before it
  reads the column. So every number below is also what a dietitian's client gets, at the
  practice's price, not at premium's.
- **Payments are not live and no price is agreed.** Stripe's live mode and the practice
  prices are deferred by the owner (memory, 2026-09-25). Nobody has paid for twenty swaps,
  so lowering a premium number today costs us no grandfathering and no refund. **This is
  the last moment the tier can be re-shaped for free**, which is the strongest argument
  for doing the whole audit now rather than after the first euro.
- **What the screen promises today** (`apps/web/src/i18n/dictionaries/es-ES.ts:2669`):
  *"Tres replanificaciones por quincena en vez de una, veinte cambios de comida por plan en
  vez de cinco, diez eventos por plan en vez de tres, y hasta tres eventos añadidos con el
  plan ya empezado."* Four clauses, of which three are bigger numbers and one is a
  capability. One of those numbers — ten events — **cannot be reached by anybody**, by
  construction (below, **confirmed**); a second — twenty swaps — is reachable but is a
  number nobody would approach (**estimated**). **The pitch sells arithmetic**, and
  arithmetic is the weakest thing a health product can sell.

### What things actually cost

| Thing | Cost | Label |
| --- | --- | --- |
| One plan generation (the model call) | **0.007–0.017 $** | **confirmed** — [`architecture/0002`](../architecture/0002-which-model-generates-the-dishes-2026-09-25.md) § 4.2, DeepSeek V4 Flash 0731 on DeepInfra fp8 at 0.06/0.18 $ per M tokens, prices read from OpenRouter's API |
| One dish picture | **0.0337 $** | **confirmed** — `IMAGE_COST_FLOOR_USD`, Vertex at 1K ([`0066`](../../decisions/0066-photograph-like-dish-pictures-drawn-on-first-view.md)) |
| Drawing the new dishes of one plan, as designed | **0.70–1.10 $** | **estimated** — project 006's PRD, for *every* new dish of a plan |
| **Drawing them as lived: pictures per generation** | **7.1 pictures, 0.237 $** | **confirmed** — production, the 30 days to 2026-10-12: 19 plans generated, 134 pictures drawn, 4.51 $ spent (counted by the lead through the Neon MCP, read-only) |
| A swap, an event, a mid-plan rebuild, a schedule | **0 $** | **confirmed** — served from the library by construction; `PlanLoadRebuildService` imports nothing from `ai/` (`0044`) |
| The monthly picture budget, for everybody | **10 $**, then drawing stops | **confirmed** — `AI_IMAGE_MONTHLY_CAP_USD` default in `Env.validation.ts:234` |

Three consequences the tier has never been priced against:

1. **The money in this product is pictures, not text.** A redo's model call is a cent; the
   pictures its fresh dishes pull are **23 times** it, measured (0.237 $ against 0.01 $).
   `0042` set premium's redos at three while reasoning about the generation call alone —
   that reasoning was written before pictures existed (`0066` is three days later).
2. **The fresh third never decays.** `FRESH_SHARE = 1/3` and seven fresh dishes a slot are
   asked of the model *every* generation, however full the library
   ([`0013`](../../decisions/0013-a-third-of-every-plan-is-fresh.md)) — so the picture cost
   of a generation is structural, not a transitional cost that a growing library retires.
   The production figure agrees with the design: **7.1 pictures per generation measured**
   against seven fresh dishes a slot asked by construction.
3. **The 10 $ cap, not the redo limit, is what bounds growth.** At 0.237 $ a generation the
   month's picture budget buys about **42 generations for the whole product**. The beta
   spent 4.51 $ of it — 45% — on 19 plans and 8 accounts. Every number below is set inside
   a budget that five premium accounts using their full allowance would exhaust (see
   [What production says](#what-production-says-measured-2026-10-12)).

## The three currencies an allowance is paid in

Every number in `Allowance.ts` spends one of three things, and the mistake `0042` and
`0044` both make is pricing them as if there were only one.

- **Money.** Model calls. Only redos spend it (and the one-off dish behind a fixed meal or
  a swap the library cannot fill). This is the currency that must be stingiest.
- **The scheduler's freedom.** The ±5% promise on all four macros, every day, is reached by
  choosing *which* dish fills a slot and *how big* each plate is — `improveDay`'s swap
  rounds, the spread pass, the exhaustive portion search, and a band-repair pass that works
  by swapping a dish from the pool (project 017 phase 3). Anything that forbids the
  scheduler a choice is paid for here. Only the new fixed meal spends this currency — and
  it spends it on every generation, for as long as the rule stands.
- **Churn on a lived plan.** Days already shopped for, meals already ticked. Mid-plan
  events and swaps spend this.

Project 017 bought the band promise expensively and measured it with the scheduler
completely free: **196/196 days within ±5% on all four macros**, 14 profiles, 871-recipe
reference library, accompaniments off and on (**confirmed**, project 017 LOG phases 3–4).
That number is the product. A fixed meal is the first allowance that can spend it.

## The new one: a fixed recurring meal

> *"Every Friday dinner is tortilla de patata."* The generator honours it — from the library,
> or by asking the model once when the library has nothing — and the day still lands inside
> its bands.

### What it costs to serve

- **Money: almost nothing, once.** A Spanish library of a couple of thousand dishes
  already holds what people will name. When it does not, it is one dish asked of the model
  (0.007–0.017 $) plus one picture (0.0337 $), after which the dish is in the library and
  the rule is free forever. A fixed meal is *cheaper* than a free slot in steady state: it
  reuses a drawn dish instead of pulling a fresh one.
- **Scheduler freedom: a standing tax, two days per fortnight per rule.** A weekly rule
  lands on two days of every fourteen, every generation, forever. On those days the
  scheduler loses the dish-choice lever at that slot and must land four macros with the
  slots that are left. On a three-meal day, one rule takes a third of the day's dishes —
  and if it takes lunch, about 40% of its energy, because three-meal days carry the load at
  lunch by design.
- **Variety: it must punch through the rule that forbids repeats.** Today nothing can
  repeat a dish weekly: a favourite ("me gusta" → `preferSlugs`) goes to the front of the
  pool but is *never* taken from last fortnight (`avoidSlugs`, `Rotation.ts`). So this is a
  genuinely new capability, not a bigger number — and the variety rules must be told to
  yield to it, in exactly the places `0065` and `0081` name.
- **Feasibility risk, which is the real cost.** A dish that cannot be sized into its slot's
  bounds — `PLATE_LIMIT` 0.5–1.5× the slot's share, the per-slot gram ceiling — *is not a
  candidate for that slot* today (`0076`, `0078`). A pinned dish is a forced candidate, so
  the product needs an answer for the day it does not fit.

### The numbers

**Free: 1. I agree with the owner.** One rule is two constrained days of fourteen — the
smallest non-zero tax — and it is the whole capability rather than a crippled version of
it. The free ladder below it already exists and is unlimited: "me gusta" biases every
future pool for nothing. The upgrade is the *second* routine, which is exactly where a
person feels the limit: they have a Friday habit and a Sunday one.

**Premium: 3.**

*The argument for more (5, or one a day):* it costs us no money, it is the most-felt
control in the whole set — felt every week rather than on the rare fortnight somebody
re-rolls a plan — and real routines are plural: Sunday family lunch, Friday dinner out, a
weekly legume day, the same lunchbox every weekday. A tier somebody pays for should not say
no to a habit, and five rules would still leave four days of fourteen untouched.

*The argument for 3, which wins:* each rule constrains two days of fourteen, so three rules
put a dish the scheduler did not choose on **six of fourteen days** — 43% of the fortnight,
against a band promise measured with none. At five rules it is ten of fourteen, and at that
point the person is authoring the plan and the ±5% promise is theirs, not ours. The product
has exactly one hard promise, the owner's own ("the macros have to be perfect or none of
this is any use", `0045`), and the allowance that can break it should be the most
conservative in the table, not the most generous. Three also happens to be enough: three
anchors describe nearly every routine a person names out loud.

**3 is a ceiling claim, and it is measurable before anybody commits to it.** See
[What to count](#what-to-count-before-the-owner-commits). If the evaluator loses days at
three pinned rules, the number is 2 — the measurement sets the ceiling and product judgment
stays at or below it. I would not raise it above 3 even if the evaluator holds at 4: the
run is 14 synthetic profiles, and the long tail of real profiles, dislikes and thin
libraries is not in it.

### The shape of the allowance, which is not the shape of the other four

The four existing numbers are **counters that reset** — per plan, per fortnight. A
recurring rule does not reset: it stands until the person removes it. So:

- The limit is on **concurrent standing rules**, checked when a rule is created and read
  again at every generation (a tier that lapses must not silently honour four rules).
- Name it `fixedMealsStanding`, not `…PerPlan`, so no future reader assumes it resets.
  *(Shipped as `fixedMeals`: same intent, and `…Standing` was already taken by the
  used/left shape. See the note under the table above.)*
- **Weekly cadence only, in v1.** A rule is (weekday, slot, dish). If a *daily* rule is
  ever asked for, the unit changes to constrained day-slots per fortnight — free 2, premium
  6 — under which a weekly rule costs 2 and a daily rule costs 14, i.e. it fits in neither
  tier. That is the honest way to say no to "the same breakfast every day", and it is the
  same unit either way.

### The invariants the number rests on

These are not UI polish; the limit above is only defensible with them.

1. **One fixed meal per day, ever.** At most one rule per weekday, both tiers, premium
   included. Two pins on a three-meal day leave the scheduler one dish and the portion
   search, and `0045` established that portions alone do not reach four macros — it took
   dish swaps judged on the re-sized day.
2. **Never the day's only slot.** `0036` allows a one-meal day. Pinning it pins the whole
   day; refuse at creation with a sentence, not a 500.
3. **Pin the dish, never the portion.** The scheduler sizes a pinned plate like any other,
   inside `PLATE_LIMIT` and the gram ceiling. Without this, feasibility collapses: the
   person asked for tortilla on Friday, not for 300 g of it.
4. **Precedence, once and in order.** Safety and the hard bounds — the allergy gate, the
   energy floor, `PLATE_LIMIT`, the per-slot gram ceiling — *refuse* the rule for that day;
   the day is built without it and the plan's advisories say why. An honoured rule
   **outranks** variety, the repeat rules and the starch and cuisine caps (`0065`, `0079`,
   `0081`). Where an honoured rule costs a macro band, the day is **delivered with its
   advisory naming the rule** — the person traded a band for a routine knowingly, which is
   `0045`'s standing answer (*a person handed no plan eats worse than one handed a day at
   7%*) and `0044`'s (*every "no" is the same "no"*).
5. **The model is asked once, for one dish, and only when the library has nothing** — the
   swap path's existing fallback shape, never a generation.

## What production says, measured 2026-10-12

Counted by the lead through the Neon MCP, read-only, the day this doc was written. All
**confirmed**; the inferences drawn from them are labeled where they are mine.

| Counted | Figure |
| --- | --- |
| Accounts | 8 |
| Plans, the product's whole history | 35 |
| Plans generated in the last 30 days | 19 |
| Pictures drawn in the last 30 days | 134 — **7.1 a generation** |
| Picture spend in the last 30 days | 4.51 $ — **0.237 $ a generation**, 45% of the month's cap |
| Events declared, the product's whole history | **2** |
| The busiest plan's swaps | **5**, on a premium account (limit 20 — so unconstrained demand) |
| Accounts that have ever reached any limit | **0** |

What each one settles:

- **The redo verdict stands, and is now measured rather than reasoned.** 0.237 $ a
  generation lands at the bottom of my 0.25–0.5 $ estimate. A premium account using its
  full allowance — a new fortnight plus three redos, every fortnight — costs **2.03 $ a
  month** in pictures; the average account today costs **0.56 $ a month**. So the price
  floor I named comes *down*: about **3 €/month** covers the worst case rather than the
  5 € I derived from the upper estimate. That is the only number in this doc the
  measurement moved.
- **Nothing in the current table is felt by anybody.** Zero accounts have reached any
  limit; two events exist in the product's entire history against a free allowance of
  three a fortnight. So every cut below costs no living user anything, and the whole table
  is a shape for when there are users rather than a response to a distribution. It also
  means the opposite is true of raises: there is no evidence for loosening anything.
- **One data point argues with one of my cuts, and I am keeping the cut.** The busiest
  plan took five swaps, on a premium account with a limit of twenty — so five is
  *unconstrained* demand, not a ceiling effect, and it is exactly the free limit I propose
  cutting to three. A free account behaving like that account would be refused twice. That
  is the intended effect of "muy limitado": the person who wants five changes to a
  fortnight is the person the paid tier is for. It is also now a one-second decision to
  undo from the console if it turns out to bind often — which is the argument for cutting
  now rather than waiting (**estimated**: one plan of 35 is a single observation, and I
  would not read a distribution into it).
- **Redo demand is modest and the headline benefit is not yet felt either.** 19 plans over
  8 accounts in 30 days is **1.11 generations per account-fortnight** (**estimated**: it
  assumes accounts are active, and dormant ones drag the figure down, so the real tail is
  busier than this). Against free's one redo a fortnight, nobody is near it.
- **The cap, not the redo limit, is the growth ceiling — and no number in this table can
  fix that.** The month's budget buys ~42 generations. Ordinary use today is ~2.4
  generations per account-month, so **about 18 accounts of ordinary use exhaust the 10 $
  cap with no redos at all**, and drawing then stops for everybody. A redo ceiling of six
  lets fewer than three accounts eat the month; a ceiling of three lets five. Both numbers
  are inside the same wall, which means the ceiling is a typo guard, not a budget guard.
  **The budget itself needs raising, or pictures metering per account, before premium has
  fifteen or twenty users** — independent of every number below, and worth the owner's
  attention sooner than the price is.

## The audit of what premium has today

### `eventsPerPlan` — free 3 → **1**, premium 10 → **4**

- **Is it felt?** Barely, at either end, and this is now measured: **two events exist in
  the product's entire history**, across 8 accounts and 35 plans (**confirmed**,
  2026-10-12). An event is a race, a match, a long session (`0043`); an amateur has none or
  one in a fortnight.
- **Is it bounded?** Premium's 10 **cannot be reached by anybody**. `daysBefore` is
  validated `min(1).max(3)` (`entities/Event/Event.ts:28`) and `overlaps` refuses two
  events whose `[loadStart, on]` intervals intersect, so each event occupies at least two
  days; at most **7** events can have a loaded day inside one fourteen-day window
  (**confirmed**, by reading `Event.ts` — events on alternate days, each loading the day
  before). `0044` said the overlap rule already bounds this and set 10 anyway: the cap was
  never a cap. Free's 3 is reachable and is the loosest of the four free numbers
  (**estimated**: with one or no events in a typical fortnight, three is a limit a free
  account would rarely meet).
- **Does it cost us?** Nothing. Pure scheduling.
- **Verdict.** A limit nobody can reach sells nothing and tells the reader we do not know
  our own product. Premium **4** is reachable, binds only on a schedule busier than any
  amateur's (two events a week, a fortnight running), and still reads as plenty beside
  free. Free **1** is the owner's "muy limitado" applied where it costs us nothing to be
  generous and therefore nothing to be strict: one race is a taste, the second is the
  upgrade. Supersedes `0044`'s numbers and the `0042` comment block.

### `mealSwapsPerPlan` — free 5 → **3**, premium 20 → **10**

- **Is it felt?** The most-used control of the four, by a distance — and the only one with
  any real usage behind it: five in the busiest plan, against two events in the product's
  whole history (**confirmed**, 2026-10-12). It is the only one reachable from a meal the
  person is looking at.
- **Is it bounded?** Premium's 20 is nearly half a three-meal fortnight's 42 plates — the
  thing `0015` wrote the limit to prevent (*"so a plan stays a plan rather than becoming a
  menu"*). It is also not felt as a benefit: nobody reaches 20, so it is a number that
  spends credibility without buying loyalty.
- **Does it cost us?** Almost never money — the library answers, and the model is asked
  only when a slot has nothing (`0015`), which gets rarer as the library grows. It does
  cost the band promise a little: a swap is matched to the plate it replaces on all four
  macros (`0045`), but a day the person edits ten times is a day they re-balanced, not one
  we did.
- **Verdict.** Premium **10** — a quarter of a three-meal fortnight, "a meal every day and
  a half", which nobody counts and which keeps the plan a plan. Free **3** — one a week
  plus a spare. Free can still express taste without limit: "no me gusta" is free and
  shapes every future plan (`0014`), so a tight swap count does not leave anybody stuck
  with food they dislike. Supersedes `0015` and `0042`.

### `midPlanEventsPerPlan` — free 0, premium 3. **Unchanged, deliberately.**

- **Is it felt?** It is the only clause in the pitch that names something a free account
  *cannot do at all*, and the one real reason to pay today. Keep it as the headline until
  the fixed meal takes that job.
- **Is it bounded?** By churn, which is the right bound: three rebuilds of a lived
  fortnight is about as much as a plan already shopped for can take (`0044`).
- **Does it cost us?** Nothing, by construction — no model call, library only.
- **Verdict.** Keep 0/3. One coherence rule: `midPlanEventsPerPlan ≤ eventsPerPlan` must
  hold, and with premium events at 4 it does. Keeps `0044`.

### `planRedosPerFortnight` — free 1, premium 3. **Unchanged, and the one that needs a price.**

- **Is it felt?** The most felt of the four. *A plan you cannot re-roll is a plan you are
  stuck with for two weeks* (`0015`), and that sentence is still true.
- **Is it bounded?** Yes, and tightly: free's 1 is the single tightest number in the table
  and should stay there.
- **Does it cost us?** **This is the only allowance that spends money, and it spends 23
  times more than `0042` believed.** Not the 0.01 $ generation: the pictures its fresh
  dishes pull, **0.237 $ a generation measured** (production, the 30 days to 2026-10-12).
  A premium account using the whole allowance — a new fortnight plus three redos, every
  fortnight — costs **2.03 $ a month** in pictures, against a **global** monthly budget of
  10 $ after which drawing stops *for everyone*.
- **Verdict.** Keep 1/3: it is the right benefit to sell, and cutting premium to 2 would
  take away the clause people actually want. It is still the one recommendation in this
  document that **touches a price**, but the measurement makes it comfortable rather than
  tight: the worst case is 2.03 $ a month of pictures, so about **3 €/month** covers it —
  not the 5 € I derived from the upper estimate — and a yearly discount still clears it.
  Every other number I recommend costs us nothing per user and is price-independent.
- **One risk worth the owner's eye, named not designed:** the picture cap is global, so the
  accounts that pay nothing and the accounts that pay both draw from one 10 $ pot, and
  about eighteen accounts of ordinary use empty it with no redos at all. Metering pictures
  per account is worth more than any change to this number. Keeps `0015` and `0042`.

## The numbers become data: what the console may move

The owner wants every limit configurable from `/admin`, per tier. That is right for most of
these numbers and dangerous for one, and the line between them is not a matter of taste:

> **A limit may be console-editable when its worst case is a bill, or a worse experience
> for the person who chose it. It must be code-bound when its worst case is a plan that
> misses its macros for everybody on the tier.**

### Three kinds of number

| Number | Kind | What the console may do |
| --- | --- | --- |
| `mealSwapsPerPlan` | **commercial** — raise it and somebody is happier; nothing else happens | move freely inside the ceiling |
| `eventsPerPlan` | **commercial**, with an arithmetic ceiling | move freely up to 7; above 7 is a number that cannot happen |
| `midPlanEventsPerPlan` | **commercial**, bounded by churn and by `eventsPerPlan` | move freely, resolved against events (below) |
| `planRedosPerFortnight` | **financial** — it spends real money from a budget shared by everybody | move, with the spend and the budget on screen |
| `fixedMealsStanding` | **structural** — it spends the band promise | **lower only** |

**Why swaps, events and mid-plan events are safe to hand over.** None of them spends money
(**confirmed**: library-served by construction, `0015`, `0044`) and none of them changes how
a plan is *built*. A swap re-fits one plate against the plate it replaces; an event's day is
built to targets the profile's own bounds have already approved, and a load the bounds
refuse is simply not applied (`0043`). The worst case of a too-generous number here is a
plan that reads like a menu — visible, reversible, nobody's health.

**Why redos are different.** They are the only allowance that spends money, and the money
comes from a pot everyone shares: `AI_IMAGE_MONTHLY_CAP_USD` (default 10 $) stops drawing
**for everybody** when the month's picture spend reaches it. An admin raising premium's
redos is not spending premium's money; they are spending the month's pictures, and the
people who notice are the accounts whose dishes stop having pictures. So this number is
editable, but it is the one that must never be edited without the spend in front of the
person editing it.

**Why the fixed meal is not a commercial dial, concretely.** The band promise holds on
**1,958–1,960 of 1,960 days** — 1,960/1,960 with accompaniments on, 1,958 off (**confirmed**,
project 019's closing runs, 140 plans of 14 days) — and every one of those days was built
with the scheduler free to choose any dish for any slot. A standing rule takes that choice
away on two days of every fourteen, and the console cannot know what that costs: the
failure is not an error, it is a day delivered with an advisory, for everybody on the tier,
found later. **Technical means a raise is a measurement, not a click.** So:

- the code ceiling is the shipped default (**3**, proposed);
- the console may only **lower** it — to 2, 1 or 0, which are all safe by construction,
  because fewer standing rules is strictly more freedom for the scheduler;
- the **first raise above 3 has a fixed path**: build the pin lever, run the evaluator at
  the new count on the reference library, ship the new ceiling in a deploy with the run
  recorded. Nothing is measured at any pin count today, because the lever does not exist
  yet (see [What to count](#what-to-count-before-the-owner-commits)).

One engineering consequence to hand on rather than decide here: `app_settings` holds *a key,
a boolean and a timestamp* (**confirmed**, `Flag.ts`), so the switches' table cannot store
these. Ten numbers (five allowances × two tiers) need their own storage and their own
registry entry, and whatever shape that takes must carry rule 1 below — which is the only
part of it that is a product decision.

### The ceilings, in code, that the console cannot exceed

| Number | Floor | Ceiling | Why that ceiling |
| --- | --- | --- | --- |
| `eventsPerPlan` | 0 | **7** | Two events may not share a loaded day and each occupies at least two days, so at most 7 can load a day in a fortnight (**confirmed**, `Event.ts`). An eighth is not a limit, it is a sentence on a screen that no account can ever reach. |
| `mealSwapsPerPlan` | 0 | **28** | The main meals of a fortnight (two a day). Past that, "a swap limit" names nothing: every main meal in the plan could be replaced. |
| `midPlanEventsPerPlan` | 0 | **min(`eventsPerPlan`, 7)** | A fortnight cannot be rebuilt for more events than it may hold. |
| `planRedosPerFortnight` | 0 | **6** | A typo guard, not a budget guard, and the measurement is why: at 0.237 $ a generation (**confirmed**) six a fortnight is 3.55 $ a month for one account, and three is 2.03 $ — both inside a 10 $ cap that about eighteen accounts of ordinary use empty anyway. Six is where a single account can eat a third of the month, which is as far as a slip should be able to go. |
| `fixedMealsStanding` | 0 | **the shipped default (3), raised only by a deploy**; absolute 7 | 7 is the one-per-day invariant against seven weekdays. Above the measured number, see above. |

### Four rules the editing must obey

1. **A bad row reads as the code's default, never as the ceiling.** A missing, unparseable
   or out-of-range number falls back to the table shipped in code — not clamped to the
   ceiling, which would silently grant the maximum. This is `0042`'s rule applied to
   numbers: *the failure that costs money is the one that grants too much, so the fallback
   is always the smaller number*. The flag registry already demands that every setting
   declare what its absence means (`Flag.ts`); a number must declare it too, and for all
   five the answer is the same.
2. **Premium ≥ free, always — enforced on write and resolved on read.** The console refuses
   a premium number below its free one, *and* the effective premium value is
   `max(premium, free)` where it is read, because an admin can otherwise make the pair
   invalid later by raising free. Nobody must ever pay for less than a free account; no
   price fixes that. The same shape applies to the cross-field pair: effective mid-plan
   events are `min(stored mid-plan, stored events)`.
3. **Zero is legitimate; a dead screen is not.** Zero on free is a real commercial lever —
   it makes a capability premium-only — and zero on both is a kill switch for a feature
   misbehaving in production. What zero must never produce is "0 of 0 left":
   `midPlanEventStanding` already answers `allowed: false, limit: 0` rather than being
   absent, *so the screen has one thing to read whichever tier is asking* (`0044`), and
   every other number must behave the same way, showing the premium card where the control
   would be. One number deserves a sentence on the page so nobody panics: free redos at 0
   does **not** stop free accounts getting plans — generating the next fortnight is always
   allowed, only *redoing* the one in progress is counted (`0015`).
4. **A lowered limit never takes back a spend.** `countDown` clamps `remaining` at zero, so
   lowering a limit mid-fortnight does not crash — it silently withdraws something the
   screen already promised. A raise applies at once; a cut applies to the next plan for the
   per-plan numbers, to the next fortnight for redos, and grandfathers existing rules for
   fixed meals (new ones refused until the person is under the new number).

### What the console must show beside each number

A number on its own is a number somebody guesses at. Five things beside it make the
decision informable, and four of the five were counted for this doc on 2026-10-12 — the
queries exist, which is the cheap part of making the numbers editable:

1. **The default and the ceiling, with the ceiling's reason in one line** — *"above 7 has no
   effect: two events cannot share a loaded day"*. This is what stops the owner from
   repeating the `0044` mistake of setting a cap above what can happen.
2. **What one unit costs us**: 0 € for a swap, an event and a mid-plan rebuild;
   **0.237 $** of pictures for a redo (measured, and the field should show the live figure
   rather than this one); two days of fourteen of scheduler freedom for a standing fixed
   meal.
3. **What this tier actually uses**: p50, p90 and max used over the last 30 days, and —
   the one figure that decides whether moving the number buys anything — **how many
   accounts reached the limit, out of how many on the tier**. A zero there means the limit
   is not felt, and raising it sells nothing.
4. **For redos only**: the month's picture spend against the cap, and this number's
   arithmetic — *"N accounts at this limit exhaust the month's pictures, after which no
   dish is drawn for anybody"*.
5. **For fixed meals only**: the shipped ceiling with the run and date it was measured at,
   and the share of live plan-days currently carrying a fixed meal.

And on the page itself, three things that are not per-number:

- **The audit row.** The mechanism exists: `setting.changed` with the setting's key in
  `entityId` (`0071`, `AUDIT_ACTIONS`). An allowance change must write one, with the tier,
  the old value and the new value in `metadata`. A limit that changes with no trace is a
  support question nobody can answer three weeks later — and these numbers decide what
  somebody may spend.
- **When a change takes effect**, in the words of rule 4 above, next to the save button.
- **The sentence that none of this is a health setting.** `premiumSafety` already exists in
  the dictionary (*"La seguridad alimentaria —alergias, intolerancias y nutrientes— es la
  misma con premium y sin él"*). It belongs on this page too: the day somebody edits
  numbers at speed is the day it matters that no number here can touch the allergy gate.

### One thing for `legal`, before Stripe goes live

Today these numbers are the owner's to move freely: nobody pays. The moment a subscription
exists, a premium allowance is **a term of a continuing contract** — `0061`'s own rule is
that *a subscription grants what its price says* — and lowering one under a paying
subscriber is a unilateral change to what they bought, which Spanish consumer law does not
treat as a settings edit. That needs `legal`'s read before live keys, and the likely
product answer is that premium numbers move **up** at any time and **down** only at
renewal, with notice. It blocks nothing now, which is exactly why it should be settled now.

## Sequencing: the free cuts should not land alone

Cutting free (events 3→1, swaps 5→3) with no checkout live makes the beta strictly worse
with no way to pay for the difference. Either the free cuts ship **with** Stripe live, or
the beta accounts are granted premium first (the owner already grants it from `/admin`,
`0042`) and the cuts ship immediately. The premium cuts (events 10→4, swaps 20→10) have no
such problem: nobody has paid for those numbers, and they should land now, before the first
euro makes them a promise.

## What to count before the owner commits

Two asks, in order of how much they would change the answer.

1. **The evaluator, with pinned rules** — this is the one that gates `fixedMealsStanding`.
   On the reference library (871 recipes, local Postgres, the 14 profiles of project 017),
   run the scheduler with 1, 2, 3 and 4 standing weekly rules — one per weekday, one per
   day at most, the pinned dish re-sizable — and report days within ±5% on all four macros,
   accompaniments off and on, plus which slot each lost day pinned. Baseline is 196/196.
   The largest count that holds 14/14 on every profile is the ceiling; my recommendation of
   3 stands if the ceiling is 3 or more, and becomes 2 if it is 2. If the lost days are
   lunch pins specifically, the limit should be shaped by slot (a fixed main meal costs
   more than a fixed breakfast) rather than lowered for everybody. Local Postgres only —
   never Neon (owner's rule, 2026-10-02).

   **This run cannot be ordered today.** `schedulePlan` has no pin lever: `placed` protects
   the placements of days it must *not* touch (`0044`), it does not force a dish into a
   slot of a day being built. So the measurement is the fixed meal's own project phase 1 —
   build the pin, measure it, then commit the number — not a report somebody can ask the
   evaluator for this afternoon.
2. **Production counts — done, 2026-10-12.** Read
   [What production says](#what-production-says-measured-2026-10-12). They settled the
   redo cost (0.237 $ a generation, which moved the price floor down to ~3 €/month),
   confirmed that no account has ever reached any limit, and produced the one data point
   that argues with a cut (five swaps in a plan, unconstrained). **These are the same
   queries the console needs** beside each field — per tier, p50/p90/max over 30 days and
   accounts-at-the-limit over accounts-on-tier. Counting them twice would be the mistake.
3. **Still open, small, and worth one more read** before the table is committed:
   - **how many of the 35 plans are `redo`-stamped**, which is the only direct measure of
     redo demand — my 1.11 generations per account-fortnight infers it from plan counts and
     assumes no account is dormant;
   - **mid-plan events used, ever** — the clause the pitch leads with, and the one number
     from the four that was not in the count.

With eight beta accounts these counts are weak evidence by construction, and the doc treats
them that way: a *zero* is strong evidence (a limit nobody has reached is not a benefit),
a single maximum is not a distribution, and no raise should be argued from this data.

## Copy and code that must move with the numbers

A number changed in `Allowance.ts` alone would leave the product contradicting itself:

- `apps/web/src/i18n/dictionaries/es-ES.ts:2669` — `premiumPitch`, which hardcodes *"tres
  replanificaciones… veinte cambios… diez eventos… hasta tres eventos añadidos"*. It needs
  rewriting anyway: it should lead with what premium lets you **do** (fix your routines, add
  a race to the plan already running) and mention the numbers second. That is the marketing
  finding of this audit — premium's four clauses are three bigger numbers and one
  capability, and one of those numbers is unreachable by construction.
  **Once the numbers are console-editable this stops being a copy choice and becomes a
  correctness one**: a pitch with digits written into the sentence will contradict the
  console the first time anybody moves a number, and the contradiction is on the page that
  asks for money. The numbers in the pitch must be interpolated from the effective
  allowances, like `premiumMonthly` already interpolates `{price}` — which is a second
  reason to lead with the capability and keep as few digits in the sentence as possible.
- `apps/web/src/i18n/dictionaries/es-ES.ts:41` — the admin `premiumHint`, same numbers.
- The English dictionary's equivalents, and `/condiciones` if it states any allowance.
- `docs/reference/payments.md` § 2, which tells the owner to price the tier against *"three
  redos a fortnight instead of one, twenty swaps instead of five"*.

## Open questions

- **The price.** Nothing here can be finished without one, and only the redo number
  depends on it (above). Everything else is shape.
- **A pool instead of a pin**, worth considering after v1: *"Friday dinner is one of these
  three"* gives the scheduler back two thirds of what a pin takes, for most of the felt
  benefit. If people want more routines than three, that is the cheap way to give them more
  — and it would let premium's number rise without touching the band promise.
- **The practice tier.** A dietitian's linked clients inherit every number above (`0061`).
  Three fixed meals per client is a selling point for a practice — a professional can encode
  a client's real routine — but the owner should see that it follows automatically before
  committing, since the practice price is not premium's.
