# 0098 — A meal somebody fixed is not the scheduler's to change, and what it costs is measured

- **Date**: 2026-10-12
- **Status**: accepted
- **Amends**: nothing yet. It builds the lever [`0097`](./0097-what-each-subscription-allows-is-data-the-owner-edits.md)
  named a *structural* allowance for and could not price, and it measures what
  [`docs/reference/marketing/tiers-and-allowances.md`](../reference/marketing/tiers-and-allowances.md)
  said could not be ordered until the lever existed. **The limit itself is not set here.**

## Context

The owner asked for a recurring fixed meal — *"todos los viernes ceno tortilla de patata"* —
honoured by the generator, with the day still landing inside its macro bands. The `marketing`
agent priced it at **free 1, premium 3**, and said plainly that 3 was a claim rather than a
measurement: *"the largest count that holds is the ceiling; my recommendation of 3 stands if
the ceiling is 3 or more, and becomes 2 if it is 2."*

That run could not be ordered. `schedulePlan` had no pin: `placed` protects the days a
mid-plan rebuild must **not** touch (`0044`), it does not force a dish into a slot of a day
being built. So the measurement was the feature's own first phase — build the lever, price
it, then choose the number.

## Decision

### The lever

**`SchedulerInput.pinned` is a dish fixed to one slot of a day, keyed by day index.** The
caller expands a weekly rule into the fortnight's days, so the scheduler never learns what a
weekday is, and **one fixed meal per day is structural** — a map cannot hold two — rather
than a check somebody can forget. `0045` is why that matters: two pins on a three-meal day
leave the search one dish and the portions, and portions alone do not reach four macros.

**A pin outranks variety, the repeat rules and the kind caps**, and is decided *before* any
of the choosing happens. It is not a candidate that wins a ranking: a rule somebody is paying
for must not lose a tie-break.

**It yields to the hard bounds, and only to those** — `honouredPin`: the pool it is drawn
from (which is the allergy gate's own answer), the slot the dish declares, and `fitsPlate`
(`0076`, `0078`). A pin that fails one of those is not honoured **that day**, and the day is
built as though no rule existed.

**The plate is sized like any other.** The person asked for tortilla on Friday, not for 300 g
of it, so `balanceDay`, the portion search and the sides treat a pinned plate as they treat
every other.

**Six passes could have taken the dish back and all six are guarded** — `improveDay`,
`spreadAcrossDays` (**both ends** of the exchange), `repairOutOfBand`, `repairToRule`,
`enforceDistinctDays`, and `couldChange`, through which `bandNeededExceptions` asks whether a
meal could have been another. The rule is in `packages/core/AGENTS.md` because a seventh pass
that forgets it does not fail a test: it serves somebody else's dinner on the day they fixed
theirs, once a fortnight, for ever. `spreadAcrossDays` is named twice there because it builds
its replacement by *spreading* the pick it replaces, so a missed guard hands `pinned: true`
to a dish nobody fixed.

**`pinnable` answers which dishes a person could fix to a slot**, before a rule is written.
A screen that offers every dish and then quietly serves something else once a fortnight is
worse than one that never offered it.

### What it costs, measured

`--pins N [--pin-slot <slot>] [--pin-no-starch]` on the evaluator: 14 profiles × 10 seeds,
local Postgres, a library of 982 dishes, N standing weekly rules each landing on two days of
every fourteen. The rules are written once from the person's whole library and the pinned
dish is injected into every seed's pool — a rotation that dropped it would measure plans with
no rule in them and call it a result. **Every one of the 1,120 pins at four rules was
honoured; none was refused, and no pinned day fell under the energy floor.**

Today's baseline, on this library, is **1957/1960** (the 1960/1960 of 2026-10-11 was measured
on 871 dishes; the three lost days are all one profile, `tres-comidas-proteina-alta`).

| rules | days in band, **sides on** | days in band, sides off | starch rule | the 13-rule mean |
| --- | --- | --- | --- | --- |
| 0 | 1957/1960 | 1958/1960 | 79% | 77.1% |
| 1 | **1959**/1960 | 1919/1960 | 57% | 75.4% |
| 2 | **1958**/1960 | 1912/1960 | 33% | 72.7% |
| 3 | **1958**/1960 | 1860/1960 | 29% | 72.0% |
| 4 | **1958**/1960 | 1864/1960 | 28% | 70.6% |

**Three findings, and the second is the one nobody predicted.**

1. **With accompaniments on — which is how production plans — the macro bands survive four
   fixed meals.** Without them a single fixed dinner costs 39 days. The sides are the
   continuous lever that absorbs what a forced dish takes away, which is the same mechanism
   `0093` and `0095` measured from the other side. Every number below is therefore the
   sides-on one; the sides-off column is kept because it says what the lever is worth.
2. **A fixed meal does not cost a band. It costs the starch rule, and from the first rule.**
   79% → 57% → 33%. It is arithmetic, not a weak search: a fortnight admits four
   pasta-rice-grain mains (`0081`), a weekly rule lands two, and a Spanish main carries rice
   or potato far more often than not — of the 42 dishes the measurement picked as plausible
   routines, nearly all do (*arroz caldoso de bacalao*, *tortilla de patatas con espinacas*,
   *cuscús marroquí con pollo*). Three rules spend six of four.
3. **Forcing the rule onto a dish with no capped starch inverts the trade exactly.** The
   starch rule is saved — 91% at two rules, *above* the baseline — and the **bands** break
   instead: 1931/1960 at two rules, 1920 at three, concentrated in the small three-meal
   profile (20 of its 26 lost days). A starchy main is macro-flexible, because its carbs
   scale with the portion; a lean one is rigid, and a small day with two rigid meals has
   nowhere left to put its carbohydrate.

And, as the audit suspected, **the slot matters**: three rules all at lunch cost 1950/1960,
all at dinner 1956, all at breakfast 1959 — a three-meal day carries about 40% of its energy
at lunch by design (`0036`).

### What the measurement says about the number, which is still the owner's

**The measured ceiling is 2, not 3.** At one rule nothing is lost on either side of the
trade. At two, one of the two configurations holds and the other loses 26 days — 1.3% of
them, delivered with an advisory rather than refused, which is `0045`'s standing answer. At
three, the starch rule is at 29% or the bands are at 1920. So **free 1, premium 2** is what
this run supports, below the audit's 3, and the audit's own rule says product judgment stays
at or below the measured ceiling.

**There is a cheap way to buy the third, and it is a product decision rather than a
measurement.** The starch cap exists to stop the *generator* being lazy, not to police the
person: a cap that counted only the meals the scheduler chose, and let what somebody fixed
sit outside it, would remove the whole of finding 2. It is a change to `0081`'s terms, it is
measurable with this same lever, and it is phase 3's to propose.

## Alternatives considered

- **Thread a "may this pick change" predicate through the seven passes.** Rejected for the
  flag on the pick: the predicate would have to be passed, correctly, into each pass and each
  helper under it, and the one that forgets is silent. The flag travels with the plate.
- **Let the pin force past `fitsPlate` too.** It would honour every rule and serve a plate the
  product refuses to serve anybody — half a portion of a dish sized for a whole slot. The
  refusal has to exist somewhere, and the honest place is before the rule is written, which
  is what `pinnable` is for.
- **Choose the measured dish by best fit.** It would flatter every number here. The pin is a
  hash over the dishes `pinnable` allows, so the scheduler is handed a dish it did not choose
  — which is the entire point of a person choosing.
- **Measure with the rotation's pool as it comes.** `rotatePool` drops what was served last
  fortnight, so by the third seed the pinned dish is gone and the run measures plans with no
  rule in them. Injecting it is also the product's own shape: a pinned dish is a forced
  candidate.
- **Stop at the free-choice measurement.** It says four rules are free, and it is the
  comfortable answer. The `--pin-no-starch` run is in this record because it is the one that
  found the cost, and a ceiling argued from the flattering half of a measurement is not a
  ceiling.

## Consequences

- **The band promise survives the feature**, which was the open question: 1958 of 1960 days
  at four fixed meals, against a baseline of 1957, with every rule honoured.
- **The thirteen-rule table pays instead**, and the bill is concentrated in one rule. Any
  future reading of the table has to know whether the plans behind it carried fixed meals.
- `pinnable` is the seam the screen will use, and the refusal it encodes is the one the
  product must say out loud: *this dish cannot be fixed to this meal*, before the rule exists.
- **Nothing is wired to a user yet.** No limit, no route, no screen, no `fixedMealsStanding`
  — `0097`'s structural kind still has no member, deliberately, until the number is chosen.
- The evaluator can answer the same question again whenever the library changes, which it
  will: the library grew from 871 to 982 dishes in a day, and that alone moved the baseline.
