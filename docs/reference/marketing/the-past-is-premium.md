# When a fortnight ends, who may still read it

> **Purpose**: the audit of the gate that shipped on 2026-10-20 — earlier fortnights are
> opened by premium and not by a free account (`0021` § *Amended*, `mayReadPastPlans`). It
> prices the unit, scores the benefit on the three things every premium benefit is scored
> on, says where the line should sit and why not one fortnight further in either direction,
> judges the sentence that sells it, and names what should change now that it is live, in
> the order I would do it.
> **Audience**: the owner, and the lead who writes the constant. **Committed**: yes.
> **Maintained by**: agents draft, owner approves. Update it in the same change that moves
> the line.
>
> Evidential content rule: facts below are labelled **confirmed** (with how) or
> **estimated** (with the hypothesis). Written 2026-10-20 against `main` at `3791b07e`.
> Production counts are the ones read on 2026-10-19 and recorded in `0021`; I did not read
> production myself and say so wherever a number comes from there. **Two production facts
> were read for this audit on 2026-10-20 by the lead, at my request**: the Vercel
> environment of `nutr-ia-api` holds **no `STRIPE_*` variable of any kind** on the
> Production target (names and targets only — values are never decrypted in this project —
> with nothing withheld), and `app_settings` read inside a read-only transaction has
> `premium` **ON**. PR #302 is deployed and serving.
>
> Companion to [`tiers-and-allowances.md`](./tiers-and-allowances.md), whose three
> currencies and cost table this one uses, and to [`dish-requests.md`](./dish-requests.md).

## What this decides

**Keep the gate and make it inert until there is a till behind it.** It crosses no line of
mine, it is the best-constructed paywall in the product, and it is the only one that costs
us nothing to serve — so the decision itself is sound and I would ship it the day a price
exists. But production holds **no Stripe configuration at all** and the `premium` flag is
**on**, which means the gate is live while premium cannot be bought by any route except
asking the owner in person: all of the cost of a paywall, none of the revenue, and a
padlock whose "Ver premium" leads to a page with no premium on it. The product has also
applied it before sending the email its own terms promise *before* a material change
applies. **Make `mayReadPastPlans` answer true until checkout exists** — one constant, one
deploy, flipped back in the deploy that lands the first price — or send that email today
and draw a read-only premium page. Then fix the plan-versus-fortnight defect, and then
decide between one fortnight and two; my number is **two**.

| Question | Answer |
| --- | --- |
| What one unit costs to serve | **0 €, 0 model calls, 0 scheduler freedom, 0 churn** — two database reads |
| Verdict | **right decision, wrong week**: fair as built, mean by one fortnight, and today pure cost with no upside |
| Is it felt? | **The most felt benefit in the table** — every retained free account meets it, in the same event as its first check-in, by construction |
| Is it bounded? | **Perfectly** — it is binary and cannot be overused |
| Does it cost us? | **Nothing.** It is the first premium benefit that spends none of the three currencies |
| Where the line should sit | **Two fortnights free**: the one being lived, and any whose last day is within the previous fourteen |
| What I would undo today | The gate's *effect*, not the change: the constant, until there is a checkout |
| The one defect | The code locks a plan that is *not active*; the terms promise it locks *fortnights that have ended*. A free account's own redo locks a plan whose fortnight has not ended, the minute it is used |

## 1. What one unit costs to serve

**Nothing, in any of the three currencies** (`tiers-and-allowances.md` § *The three
currencies*). **Confirmed** by reading the path: `PlanController.getPlan` is
`PlanRepository.findById` plus `findDaysWithMeals`, and `PlanController.ts` imports nothing
from `ai/` (grep over its imports, this checkout). No model call, no picture — the pictures
were drawn once, when the fortnight was lived, and the plan rows are written already. The
marginal cost of a free account reading its whole history for ever is a few indexed
`SELECT`s.

This matters more than it sounds. Every other number in `Allowance.ts` is defensible by
arithmetic: a redo costs 0.237 $ of pictures, a fixed meal costs the scheduler a choice on
two days of fourteen, a dish request costs 0.04 $. **This one costs zero, so no arithmetic
can defend it.** It is defended by value or not at all, which is the whole of question 2.

## 2. Is this the right thing to sell at all?

### The amendment, head on

`Allowance.ts` used to say *what is sold is more of the thing that costs us money to
produce, **which is the only honest thing to sell here***. The merged change struck the
subordinate clause and added a second category — *the record of what was already served*.
That is the real event of 2026-10-20, not the five fortnights.

**My answer: the category is legitimate, and the paragraph that introduces it is not yet a
constraint.** Both halves are load-bearing.

- **Legitimate**, because selling the continued *presentation* of a record is ordinary and
  is not a trick: the record exists, it is not deleted, the data is theirs, and the person
  is told plainly. Trackers do this routinely (§ *What the market does*). Nothing about
  safety, allergens, the catalogue, the nutrition maths or the fortnight on somebody's
  plate moves — **confirmed** by reading the three call sites: `getPlan`, `getDay` and
  `getMeal` throw only for `isPastPlan`, ownership is decided before any tier, a
  professional reading a client is exempt, and `/progreso` is ungated. **My stop clause
  does not trip.** A free account still gets a real plan: complete, safe, every day, every
  meal, for ever. The hard line holds, and so does its spirit.
- **Not yet a constraint**, because category 1 could refuse a proposal and category 2
  cannot. "Does it cost us money to produce?" has a *no*. "Is it the record of what was
  already served?" says yes to the shopping list of a fortnight, the recipe steps of a dish
  you ate, the picture it was drawn with, the check-in you wrote, the weight you logged —
  all of it is "the record of what was already served". The amendment's narrowness lives in
  its prose, and prose is not a gate.

**So category 2 needs a test, and I propose one in one line:** *a thing may be sold under
category 2 only if the free tier still answers the question that thing exists to answer.*
`/progreso` exists to answer *is this working?* — it still answers it for free, from the
marks, so gating the plan behind each card passes. The active fortnight's shopping list
exists to answer *what do I buy?* — gating it would fail. A dish on today's plate exists to
answer *how do I cook this?* — gating it would fail. That test would have let this change
through and will refuse the next three proposals that cite it as precedent. Without it, the
precedent is the dangerous part of this change, and the only part I would call a risk.

### What it does to trust in a friends beta

Small where the data is concerned, and smaller than the construction deserves — with two
exceptions, both of which are about timing rather than about the gate.

- The blast radius is **one account losing sight of one plan**, as `0021` states it from the
  read of 2026-10-19 (8 accounts, 4 free, 5 ended fortnights between them, at most 2 each).
  I did not read production and did not reconcile those two figures against each other;
  either way the order of magnitude is "one friend, one plan".
- The row stays, with its dates, its plan number and the word *Premium*. Nobody can mistake
  a paywall for a deletion. This is the single best decision in the change.
- **The exception, and it is the whole of question 4**: a friend who taps *Ver premium* is
  taken to `/perfil`, and `/perfil` draws the premium card **only** when `GET /billing`
  answers `available: true` (`apps/web/src/app/(app)/perfil/page.tsx:219` — **confirmed**,
  and it is the only mention of premium on that page). Production holds **no `STRIPE_*`
  variable at all** (**confirmed**, 2026-10-20, § header), so `Billing.service.open()` is
  `false` for everybody — the owner included — and that page says nothing about premium to
  anybody. My charter forbids a limit hidden until it is hit; this is the mirror image, a
  limit shown with no way past it, and in a beta of friends it reads worse rather than
  better: the friend asks the owner directly, and the owner has to say *you cannot, yet*.
- **And the notice the terms promise has not been sent.** `/condiciones` says *"Si cambiamos
  algo importante, lo diremos aquí con la fecha de la actualización y te avisaremos por
  correo **antes de que se aplique**"* (`es-ES.ts:3278`). `terms.updated` moved to
  2026-10-19 and the gate is applied and serving, while `0021` records that the email is
  still the owner's to send. So the product is, today, applying a material change ahead of
  the notice its own terms place before it. That is not a commercial argument and it does
  not wait for a price: it is closed either by sending the email — eight accounts, four
  free, all of them people he knows — or by making the gate inert until he does.

### What it does at a hundred paying accounts

It becomes the **most profitable benefit in the table**, because it is the only one whose
marginal cost does not grow: a hundred premium accounts reading their history cost about
what one does, while a hundred premium accounts using their redos would cost roughly
20 $/month of pictures against a 10 $ pot (`tiers-and-allowances.md`, measured). If
anything, at scale this gate *subsidises* the ones that cost money, and that is a genuine
argument in its favour that the decision record does not make.

Two things will hurt at that size, both cheap to pre-empt now:

1. **A cancellation re-locks the past.** Somebody pays for three months, reads their
   history, cancels, and the padlocks come back. That is correct behaviour and it is what
   the pitch's *se guardan siempre* is for — but it must be said at the moment of
   cancelling, not only in the terms.
2. **The right of access is a mailbox, not a button.** `GET /me` and `DELETE /me` are the
   only account routes; no export exists (**confirmed**, grep over `apps/api/src/modules`).
   The terms now lean on *puedes pedirnos una copia de tus datos cuando quieras* to make
   this gate fair, and today that sentence is answered by the owner's inbox within a legal
   month. At 8 accounts that is fine and I would not spend a day on it. At a hundred paying
   accounts it is a standing obligation on one person, and a self-serve export is the thing
   that makes category 2 permanently honest rather than conditionally honest.

## 3. The number: two fortnights, not one

The line is a **date**, not a count of actions, and that changes where the argument happens:
not "how many is generous" but **"when does a free account meet the padlock"**.

| Line | When the padlock arrives | What free can do with it |
| --- | --- | --- |
| Active only (**shipped**) | the moment the next plan is created — **the same transaction as the first check-in** — and immediately for anyone who uses their free redo (§ 4, P1) | reads nothing it has finished |
| **Any plan whose last day is today or in the previous 14 days** (**recommended**) | a fortnight after that, ~day 29 | a 28-day rolling window; the fortnight gone six weeks is premium |
| Last 30 days | ~day 31 | the same generosity, in a unit nobody counts in |
| The first N ever | unchanged, for the fortnight they want | keeps the beginning nobody asks for |

**The rule, so the lead can write it in one line:** *a past plan opens for free when its
`endDate` is the person's today or within the fourteen days before it.* Not "the last two
plans" — a count of plans breaks under redos, locking a replaced version of the very
fortnight still being lived, which is the defect P1 exists to remove. The same mechanism
serves both: one comparison against the person's today.

**Why 2 and not 1.** The padlock does not arrive on a calendar day; it arrives **in the
same event as the check-in** — the plan being lived stays `active` past its own end date
until the next one is created (`0021` § *Consequences*), and that creation is both when
the check-in happens and when `completesActive` closes the old plan. So the padlock and the
question *is this working for you?* reach the person in one step, and the thing the padlock
closes is **the fortnight they just lived** — the exact evidence anybody would use to answer
it. Locking it there is not strict pricing, it is strict pricing at the worst possible
moment, and it buys nothing we could not buy a fortnight later: the want for "last
fortnight" decays fast, so the padlock still lands while the product is being judged — just
after the judgement rather than during it. (It is also not reliably day 15: somebody who
generates late meets it on day 19, which is a second reason to argue the moment and not the
date.)

**Why not 3 or "the last month".** The third fortnight back is worth almost nothing to the
person and visibly weakens what premium sells: the recipes somebody wants back are
last-fortnight's, not those of six weeks ago (**estimated**; production has no usage data
on history reads at all — if the admin console can count opens of `/plan/historial/:id`,
that estimate is checkable and I would check it before moving off 2). A 42-day window also
starts to read as a cookbook archive, which is the thing free should leave undone. And
"the last 30 days" is worse than "a fortnight back" at nearly identical generosity, not
because it drifts — my own rule drifts in exactly the same way — but because of the
**unit**: a fortnight is what this entire product is built on and a person knows which one
they are in, while a 30-day edge falls somewhere inside a plan and cannot be counted by the
person it applies to.

**Why not "the first N ever".** It keeps the fortnight nobody asks for. The *before* picture
that matters is the weight chart, which `/progreso` keeps from day one for free. And a list
where plans 1 and 2 open but 5 does not cannot be explained in a sentence.

**What breaks if I am wrong in each direction.** Too mean (shipped): a free account meets
its first padlock on the day it decides, cannot pay to pass it, and the product reads as
smaller than it is — the loss is retention, and it is invisible, because nobody writes to
say they left. Too generous (3+): nothing breaks financially, ever — this costs zero — the
loss is that the benefit stops being felt, and the clause in the pitch becomes decoration.
**That asymmetry is the reason to be generous here and strict on redos**: the only currency
at risk in this one is attention, and the only currency at risk in redos is money.

**This is the owner's call and he has already made it once.** He chose "only the plan being
lived" from the options he was given, and "the last two" was among them. What I am adding is
the one thing those options did not say: *the padlock and the first check-in are the same
event*. If that was priced knowingly, 1 stands and the rest of this document is unaffected
— P0, P1 and P2 do not depend on which number wins.

### The cell this benefit sits in

`tiers-and-allowances.md` flags two bad cells: generous **and** costs money (a risk) and
generous **and** never reached (a lie). This gate is in the third: **strict and costs
nothing.** That cell has its own failure mode — you are spending goodwill to buy nothing but
conversion pressure, because there is no bill on the other side to justify the no. Strictness
there must earn itself on felt value alone, which is why the day it arrives is the whole
argument.

## 4. What should change, in the order I would do it

**P0 — Make the gate inert until there is a checkout behind it, or send the email and draw
the door.** Both production facts are **confirmed** (§ header), so this is not a branch:
there is no `STRIPE_*` variable of any kind in the production API and the `premium` flag is
on. **Today, in production, the padlock leads to a page with no premium on it** — `GET
/billing` answers `{ available: false }` for everybody including an admin, so `/perfil`
draws no premium card and mentions premium nowhere, and the gate is live with nothing to
buy and no notice sent. Two ways to close that, and the owner picks one:

- **The one I recommend: `mayReadPastPlans` answers `true` until checkout exists.** One
  constant, one deploy, flipped back in the same deploy that lands the first price. It
  keeps every line of #302 — the 409, the kept row, the chip, the terms, the tests — and
  removes only the effect, which is the part that is premature. Nothing is wasted and
  nothing needs rebuilding: the gate is not wrong, it is early.
- **Or: send the notice the terms promise, and give the padlock an answer.** Draw premium
  on `/perfil` **without** a checkout — what it gives (the pitch string exists and
  `resolveAllowances` needs no Stripe) plus one honest line that it is not on sale yet and
  how to ask. This is more work than the first option and it buys the owner something the
  first does not: friends who know what premium will be before it is for sale.
- **`/progreso` has nowhere to go at all**, and this applies to whichever option wins. The
  `PremiumChip` on each locked fortnight card (`FortnightList.tsx:97`) carries no call to
  action — not even the one that leads nowhere. It is the screen a free account opens most
  often with past fortnights on it, so it is where the padlock is seen most.
- **Do not reach for the `premium` flag to do any of this.** There is no per-gate switch —
  `mayReadPastPlans` is a shipped constant — and the only runtime lever is the global flag,
  which would also demote the four hand-granted premium accounts from every *counted*
  allowance (redos 3→1, swaps 20→5, events 7→3, fixed meals 3→1, mid-plan 3→0, dish
  requests 3→0) to fix a visibility gate that costs one free account one plan. Wrong lever,
  by a wide margin. The fail-open design is right; it just protects against a different
  failure than this one.

**Why this is "undo the effect" and not "undo the change".** The decision is sound and I
would ship it unaltered the week a price exists: the code is written, reviewed, tested,
deployed and in the terms, and re-landing it will cost one constant. What it earns today is
zero — there is no checkout, no price, and conversion happens by asking the owner, which
works with or without a padlock. What it costs today is one friend's plan, a dead-end CTA on
the two screens a free account uses most, and a notice promise applied out of order. **A
paywall with no till behind it is all of the cost and none of the benefit**, and that is the
whole of my objection to its timing — not to its substance.

**P1 — Gate the fortnight, not the plan.** The code locks any plan that is `completed` or
`archived`. The terms promise something narrower: *las quincenas que ya terminaron*. Those
are not the same set, and a free account is the one that finds the difference: a redo
started today sets the outgoing plan to `status: 'completed'` in the same transaction
(**confirmed**, `PlanRepository.ts:290–293`, `shape.completesActive`) and **leaves its
`endDate` alone** — `cutsActiveTo` is non-null only for a plan that is `scheduled`
(**confirmed**, `PlanRepository.ts:1586`), so the replaced plan keeps a last day that is
still in the future. A free account that uses its one free redo on day 2 therefore sees
*Plan 1 · Sustituido · Premium* the same minute: a padlock on a fortnight that has not
ended, placed there by the product inviting them to re-roll.

The remedy is one comparison and it is the same one § 3 needs: **a plan opens whenever its
`endDate` is the person's today or later**, whatever its status — and, if § 3 is taken, for
the fourteen days after that too. Because the same-day redo leaves `endDate` untouched, this
fixes the day-2 case exactly. It costs nothing, it makes the code say what the terms already
say, and it removes the worst first impression the gate can make.

**P2 — Say the line before it bites.** My charter forbids a limit hidden until it is hit,
and in the app this one is: a free account on its first fortnight reads `historyIntro` —
*"Cada plan queda tal como fue, con lo que comiste y lo que no. No se puede cambiar."* —
which says permanence and nothing about premium. `historyLockedIntro` replaces it only once
`anyLocked` is true, which is to say only once the padlock already exists. The terms say
the line; the screen says it the moment it costs something. `0021` already argues against
exactly this shape — *"a door that appears only once there is something behind it is a door
nobody learns exists"* — so this is the record's own principle applied to its amendment.
One clause in the first-fortnight intro, naming what premium opens later, costs a dictionary
key and buys the difference between a paywall and a surprise.

**P3 — Decide the line: 1 fortnight or 2** (§ 3). One reading, one number.

**P4 — Say what happens when premium ends, where it ends.** The cancellation path should
say that earlier fortnights stop opening and are kept whole, so resubscribing brings them
back at once. The sentence exists in the terms; the moment it is needed is the cancel
button.

**P5 — A self-serve export, before a public launch and not today.** It is what turns *the
data is still yours* from a promise into a thing a person can do at midnight. Condition it
on the first paid cohort, not on this week.

**What I would leave exactly as it is.** Every one of these is correct and some are better
than correct: the locked row keeping its dates and plan number rather than disappearing;
**409 and never 404**; ownership decided before any tier; the professional's read of a
client exempt; `/progreso` keeping every number; the fail-open on the switch; and the
`PremiumChip` carrying its meaning in a word with the padlock `aria-hidden`. That list is
what makes the gate defensible, and nothing in this audit touches it.

## 5. The pitch

Today: *"Premium abre además tus quincenas anteriores: se guardan siempre, las veas o no."*

**The first half earns its place; the second half does not belong in a sales line, and the
clause is in the wrong position.**

- **Position.** It is the fifth clause of six in one long sentence of numbers. It is also
  the **only** benefit in that sentence a reader may have already *met*, at a padlock, five
  minutes earlier. It should lead.
- **The reassurance.** *Se guardan siempre, las veas o no* is a promise not to throw your
  data away, inside the sentence that asks for money. A pitch that has to say that is a
  pitch that knows the gate reads as a threat. It is true and it must be said — on the lock
  screen, where it already is (*se guarda completa*), and in the terms, where it already
  is. Printed on a pricing page beside a price, it raises a question nobody had asked.
- ***Además* / *also*** frames this as an addition. For the reader standing at the padlock it
  is the removal of a wall. Drop the word.

What I would say instead, first clause of the pitch, both dictionaries:

- ES: **«Premium abre tus quincenas anteriores: cada plan que ya terminaste, día a día, tal
  como fue.»**
- EN: **"Premium opens your earlier fortnights: every plan you have finished, day by day, as
  it was."**

One caveat on all of § 5: `premiumPitch` renders only inside `PremiumCard`, which is drawn
only when billing is available — and with no Stripe configured, `Billing.service.open()` is
false even for an admin. So **today that sentence is seen by nobody at all, the owner
included**. Until P0, the wording is a rehearsal — which is also the cheapest moment to
change it.

## What the market does, as context and not as a reason

Checked once, 2026-10-20, on the nearest comparable I could document: **Hevy**, whose
[help centre article](https://help.hevyapp.com/hc/en-us/articles/38279350428695) is
reported to say that its free tier shows **stats** for the past 30 days or 3 months, that
premium shows a year and all time, that the raw workout log is kept on their servers either
way, and that resubscribing restores the full view immediately. **Label: as summarised by a
web search on 2026-10-20; I did not read the article directly**, and plan tables change —
so treat the shape as context and not the numbers as facts.

NutrIA has made the **opposite split**: the stats are free for ever and the record is gated.
That is the kinder half if what brings a person back is *am I doing this?*, and the harsher
half if what brings them back is *what was that dish?*. Their cost base is not ours and
their number is not a reason for ours; what the comparison does establish is that neither
the gate nor the kept-but-locked row is unusual, and that *restores on resubscribe* is
table stakes rather than a kindness (P3).

## The one thing free has instead, which is worth knowing before § 3 is decided

There is **no catalogue screen**: a dish's recipe is reachable only through a meal in a plan
(**confirmed** — the web app has no recipe route outside `/plan/comida/[id]` and
`/admin/catalogo`). So *"I want that lentil dish from last month again"* is, on a free
account, answered by neither history nor browsing. It is answered by the two free things
that shape future plans: *me gusta* (unlimited, biases every future pool) and the one free
standing fixed meal, whose picker already lists the dishes it may pin (`GET
/fixed-meals/fixable`). That is the right answer to that want and it is already free — which
is precisely why § 3's argument is about the retention moment and not about recipes. If the
owner keeps the line at one fortnight, the route back to a liked dish is the thing to make
more visible, not the history.
