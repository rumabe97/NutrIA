# 0099 — A variety cap counts the meals the generator chose, and that is what a fixed meal cost

- **Date**: 2026-10-13
- **Status**: accepted
- **Amends**: [`0081`](./0081-four-of-pasta-four-of-rice-four-of-grains-a-fortnight.md)'s terms, and
  [`0098`](./0098-a-meal-somebody-fixed-is-not-the-schedulers-to-change.md)'s second finding with
  it, and it **sets the number** `0098` deliberately left open — see § The number, decided.

## Context

`0098` built the fixed recurring meal and priced it. It found the cost in a place nobody
had predicted: not the macro bands, which survived four fixed meals, but **the starch
rule**, from the very first rule — 79% of plans met it with no fixed meal, 57% with one,
33% with two. The arithmetic was plain. A fortnight admits four pasta, four rice and four
grain mains (`0081`); a weekly rule lands on two days of every fourteen; and a Spanish main
carries rice or potato far more often than not. Three rules spend six of four before the
generator picks a single dish.

`0098` also named the way out and left it to this phase: *"The starch cap exists to stop the
generator being lazy, not to police the person: a cap that counted only the meals the
scheduler chose, and let what somebody fixed sit outside it, would remove the whole of
finding 2. It is a change to `0081`'s terms, it is measurable with this same lever, and it
is phase 3's to propose."*

## Decision

**A kind rule has two halves, and a fixed meal belongs to only one of them.**

- **The cap counts only the meals the generator chose.** A cap exists to stop the generator
  reaching for pasta a fifth time. Charging it for a Friday the person fixed measures the
  person instead, and reports a failure nobody can act on — the one meal the search may not
  touch is the one it is being billed for.
- **Keeping a kind apart counts every meal, fixed ones included.** That half is about what
  the plate looks like two days in a row, and a fixed meal is as much a part of that as any
  other. The penalty for a day beside a fixed one lands on the day the generator *can* still
  move, so the search can act on it: nobody asked for rice on the Thursday before their rice
  Friday.

**Which rule is which is written on the rule, and the field is required.** `KindRule`
gains `fixedSpendsCap`, so a rule added later has to answer rather than inherit an answer
it never considered:

- **`false` — the variety preferences**: `STARCH_RULES`, `LEGUME_RULES`, `SNACK_RULES`.
  These exist so a fortnight does not read as a machine's fortnight.
- **`true` — PRD 019's health maximums**: eggs, meat, red meat, processed meat, fish and
  shellfish. Red meat twice a fortnight is a statement about what a person eats, and a
  Friday they chose is still a Friday they eat. A person who fixes a chorizo dinner has
  chosen to eat processed meat twice a fortnight, and the rule that says so must keep
  saying it.

That line is the whole of the judgement here, and it is worth stating plainly: **a
preference about the generator forgives what the person fixed; a rule about the person's
health does not.**

### The two seams, both of which are the kind that fail silently

**`excessOfKind` is the one place a cap is spent**, so `fixedSpendsCap` is read there and
nowhere that matters. `kindPastCap`, `kindAtCap` and `kindCrowded` read it too, because they
ask the same question earlier.

**`placementOf` is now the only way a placement is built from a pick.** `Placement.fixed` is
what tells a kind rule whose choice a meal was, and the scheduler built placements as inline
literals in fifteen places. One that forgot the flag would charge somebody's fixed Friday to
the cap the generator is judged by, in one pass out of fifteen, and **no test would fail**.
Fifteen literals became one three-line function, named in `packages/core/AGENTS.md` beside
`0098`'s six guarded passes, for the same reason: the defence has to be the kind that does
not depend on remembering.

**The flag leaves the scheduler once**, onto `ScheduledMeal.pinned`, so the balance report
can keep a fixed meal out of the starch cap it judges the generator by. Nothing a person
sees reads it.

### Measured

14 profiles × 10 seeds, local Postgres, a library of 982 dishes, accompaniments on — the way
production plans. The same run twice: once with the rule as it was, once with it as decided
above. The whole table was re-measured rather than compared against `0098`'s printed figures,
because the library had grown 871 → 982 dishes in a day and that alone moved the baseline.

| rules | days in band, before | **after** | starch rule, before | **after** | 13-rule mean, before | **after** |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 1957/1960 | **1957/1960** | 79% | **79%** | 77.1% | **77.1%** |
| 1 | 1959/1960 | **1960/1960** | 57% | **84%** | 75.4% | **77.9%** |
| 2 | 1958/1960 | **1957/1960** | 33% | **83%** | 72.7% | **76.6%** |
| 3 | 1958/1960 | **1958/1960** | 29% | **89%** | 72.0% | **77.7%** |
| 4 | 1958/1960 | **1960/1960** | 28% | **91%** | 70.6% | **77.6%** |

Every one of the 2,800 pins was honoured in both runs, none was refused, and no pinned day
fell under the energy floor. At four rules the one day that had fallen outside a band no
longer does.

**Five things the table says.**

1. **The control holds exactly.** With no fixed meal the change is inert: every figure at
   nought rules is identical, down to the thirteen-rule mean and which rules were met. A
   rule that reads a flag nobody set must behave as it always did, and it does.
2. **Finding 2 is gone.** The starch rule goes from 57/33/29/28% to 84/83/89/91%, which is
   *above* the 79% baseline. The bands are untouched — 1960, 1957, 1958, 1960 against a
   baseline of 1957, which is inside the noise of this run.
3. **The plans are as balanced as plans with no fixed meal at all.** The thirteen-rule mean
   was the bill `0098` said the feature paid — 77.1% at nought rules falling to 70.6% at
   four. It is now 77.9%, 76.6%, 77.7% and 77.6%: at one, three and four rules it is *at*
   the no-rule baseline, and the shape of the old curve — a bill rising with every rule —
   is gone.
4. **So the measured ceiling is no longer 2, and this run does not find one.** Four is
   where the evaluator stops, not where the quality does: `--pins` is bounded by the
   fixture's own `PIN_DAYS`. What `0098` measured as the feature's cost was almost entirely
   the cost of billing the generator for somebody else's decision.
5. **Part of the gain above baseline is a loosening, and it should be read as one.** The cap
   is scaled to the plan's mains, and a pinned main still counts as a main. So the generator
   keeps a budget of four while spending it over 26 chosen mains instead of 28. That is the
   intended asymmetry — the person's Friday is not the generator's to be judged on — but it
   does mean 84% is not the same measurement as the baseline's 79%, and a future reading of
   the table has to know it.

**What it cost elsewhere, honestly.** The search spends the room it got back, and two rules
moved against it at one fixed meal: whole grains 54% → 50% and vegetables-at-every-main 58%
→ 56%. Red meat, legumes, meat and fruit moved the other way. The mean is up either way, and
the two that fell are the two the table has always been worst at (`0093`).

**On speed, what I can and cannot say.** The tally now carries two counts per kind per day
instead of one, in the search's innermost loop, so some slowdown is expected and 114 s
against 109 s with no fixed meal is about the right size for it. The pinned runs are not
readable: 111 s, 147 s, 229 s, 115 s against 107/109/106/116. Non-monotonic in the number of
rules, and 229 s followed by 115 s, which no property of the change explains — this machine
was doing other work. **It is not measured**, and it is recorded that way. Scheduling is not
on a person's critical path (generation is a model call measured in tens of seconds), so
nothing here was acted on; a run on a quiet machine would settle it.

**What was not re-measured.** `0098`'s `--pin-no-starch` configuration, which forced each
rule onto a dish with no capped starch and found that it saved the starch rule and broke the
bands instead. That trade existed only because a starchy fixed meal was expensive; it is not
expensive any more, so the configuration has stopped being the interesting question. The
flag still works and the run is two minutes if anybody wants the number.

## Alternatives considered

- **Leave the cap alone and set the number at 2.** `0098`'s own reading, and the honest one
  before this measurement. Rejected because the figure it protects was measuring the wrong
  thing: a generator billed for a meal it may not touch is not being told anything it can
  use.
- **Make a fixed meal invisible to the rule entirely**, days running included. It is the
  literal reading of `0098`'s sentence, and it is worse: rice on the Thursday before a fixed
  rice Friday is exactly the complaint `0081` exists to prevent, and it is a Thursday the
  search can still move.
- **Exclude fixed meals from every cap in the thirteen-rule table.** One sentence, no
  special cases, and wrong in the place that matters: it would stop counting the processed
  meat and the red meat a person actually eats, which is the half of the table that is about
  health rather than about variety.
- **Special-case `STARCH_RULES` alone** and leave legumes and snacks charging for fixed
  meals. It would measure the same, because the starch rule is where the cost was. Rejected
  as a rule nobody could state: the reason the cap forgives a fixed Friday has nothing to do
  with starch, so three rules sharing one mechanism would have had two different answers for
  no reason a reader could find.
- **Scale the cap down with the fixed meals** — four of pasta over 26 chosen mains becomes
  3.7 — so the figure stays comparable to the baseline. It removes finding 4's caveat and
  adds a fractional cap to a rule people reason about in whole plates. Left undone, and
  named in the table instead.

## Consequences

- **`0081`'s terms change**: its four a fortnight is four *of the generator's own*, and the
  record says so.
- **`0098`'s "measured ceiling is 2" no longer holds**, and no ceiling replaces it: at four
  fixed meals — the most this fixture can ask for — the plans are as balanced as plans with
  none. The number stops being a measurement and becomes a product decision. See below.
- **A new kind rule has to answer `fixedSpendsCap`**, and the compiler asks. Three guard
  tests that pin the shape of `LEGUME_RULES`, `SNACK_RULES` and `legumeCapCheck` failed when
  the field arrived, which is what those tests are for.
- **A thirteen-rule table from before today is not comparable to one after it** when the
  plans behind it carried fixed meals. Noted in `packages/core/AGENTS.md`.
- **Nothing is wired to a person yet.** No limit, no route, no screen: `0097`'s structural
  kind still has no member.

## The number, decided

**Free 1, premium 3** (owner, 2026-10-13), with the cap change taken as decided above.

Both were his by rules already written: `STARCH_RULES` is a rule he set himself on
2026-10-02, and `0097` makes a structural limit's ceiling the number shipped in the code.
He was given the measurement, the two readings of it, and four candidate pairs with the
figures each one is supported by.

Three is the `marketing` audit's own ask, from before the lever existed. It is **not** the
number the measurement stops at — the measurement refuses nothing up to four, which is as
far as the fixture asks. It is the number the audit priced as worth paying for, and it
leaves eleven days of every fourteen to the planner. The reason to stop below the
measurement is a product judgement and is recorded as one: a fortnight with eight of its
fourteen days carrying a meal decided in advance is not obviously a thing somebody asked a
planner for.

So, in the registry:

- `fixedMeals`, `kind: 'structural'` — the only structural member `0097` has. The console may
  **lower** it and not raise it, because raising it spends the band promise and the console
  cannot know what a raise costs. Lowering it needs no deploy; raising it is a constant and a
  measurement, and both now exist.
- `ceiling: 3`, which is premium's shipped number, as `0097` requires of a structural limit.
  A test now pins that equality: a ceiling set a little above the default "to leave room" is
  exactly how this would be broken quietly.
- `floor: 0`. Zero is a value and not an absence (`0097`): free at 0 makes the feature
  premium-only, which the audit considered and rejected — a feature nobody can try is harder
  to sell than one they try once.
- Named `fixedMeals` and not the audit's `fixedMealsStanding`. The audit's reason for the
  suffix was to stop a reader assuming the limit resets with each plan, which `fixedMeals`
  does as well; and `…Standing` was already taken by the other meaning — `MealSwapStanding`
  and `PlanRedoStanding` are *where you stand*, used and left, so the standing of
  `fixedMealsStanding` would have had to be `fixedMealsStandingStanding`.

**And the pitch stops carrying hand-written numbers.** The sentence on the page that asks
for money promised *ten events* for three weeks after the domain stopped allowing them,
because the figure was typed into the dictionary and `0044`'s number moved underneath it
(`0097` found it). Every figure in that sentence is now interpolated from the resolved
allowances, which travel to the card on the billing status it already reads. A number the
console moves moves there too, and `interpolate` leaves an unknown placeholder visible —
a `{redos}` on screen is a bug report; "undefined" is a mystery.

## What is still not built

The standing rule itself: there is no table, no route and no screen, so **nothing a person
can do spends this allowance yet**. That is the next change, and it is where the migration
lives. `pinnable` (`0098`) is the seam the screen will use, and the refusal it encodes is the
one the product has to say out loud before a rule is written: *this dish cannot be fixed to
this meal.*
