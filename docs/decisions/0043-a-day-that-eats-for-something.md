# 0043 — A day that eats for something

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

The owner's request, from a user: *"add the race, so there is more carbohydrate
and protein — or if I have a long training session, the same."* Not competitions
specifically. Any day that asks more of the body than the rest of the fortnight,
and the days before it that should eat for it.

Two things about this codebase made it cheaper than it sounds. `schedulePlan`
already loops day by day; it only computed its budgets once, outside the loop,
because nothing had ever needed a day to differ. And the pool a plan is built
from is the expensive half — the model call — while scheduling over it is
deterministic and free. A day that eats differently is a scheduling matter.

## Decision

### It is an event, not a goal

`goals` already means the direction of the whole plan. This is one dated thing,
named by the person — *media maratón*, *partido*, *Hyrox* — and nothing in the
code cares which. There is no type. What the code reads is the shape.

### The person chooses the shape; the code chooses the size

An event is a date, one to three days before it, and for each of carbohydrate,
protein and fat whether it goes **up, down or stays**. That is the whole input.

There is no field for how much, and this is the decision. "Up" is a fifth more
of that macro's grams, "down" a fifth less — `LOAD_STEP`, one constant in
`core/domain/Event`, argued about in one place and on no screen. A moderate
load, not an athlete's. The number is where the harm would live: "raise
carbohydrate" cannot hurt anybody within a bounded step, while "sixty percent
more" can, and the person who genuinely needs ten grams per kilo for a marathon
needs somebody watching them, not a text field. That is the boundary
`PRODUCT.md` already draws.

Energy is recomputed from the moved grams rather than scaled with them, so the
result always sums; fibre follows nothing.

### The bounds are the safety, and there is no new medical rule

A loaded day's targets pass through `targetViolations` against the same bounds
the profile's own targets are held to. A load the bounds refuse is not applied:
the day is built to the plan's targets like any other, and the refusal is
recorded with the plan's advisories so the person can be told.

Deliberately **no** refusal keyed on a health condition. Carbohydrate before a
race is exactly the kind of individualised decision
[`0008`](./0008-condition-exclusions.md) ruled this product does not make —
*"this product does not write prescriptions"*, with diabetes named as the case
in point. A recorded condition already raises the supervision notice; that is
the mechanism, and inventing a stricter one here would be a clinical judgement
nobody signed off.

### The plan day remembers

`plan_days` gains the targets it was built to and the name of what it ate for.
Stored, not looked up: the event may be deleted afterwards and the plan is
history (`0021`). The rule is the one `packages/database/AGENTS.md` already
states for `meals` — *snapshot what history must preserve*. The screen derives
its arrows from the stored numbers against the plan's `strategy`, so a plan from
last month explains itself without the event existing.

### Applied at the next generation

Declaring an event changes nothing about a plan already made. It is read when
the next fortnight is laid out, which runs from today, day after day — so an
event's date becomes a day index before anything is scheduled, and the
scheduler is handed a map of the days that eat differently.

Somebody who wants it in the fortnight under way regenerates, which spends a
redo. That is existing machinery, the honest price, and what the paid tier
(`0042`) just made more of. The screen says so rather than letting a race added
for Saturday sit beside an unchanged plan.

## What is left out, and why

- **Rescheduling a live plan in place.** It is the feature's best property —
  scheduling is free — and its riskiest part: meals already marked, a shopping
  list already bought against, a swap allowance already spent. Vacations move
  dates and never touch a plate; this would. Later, once the generation-time
  path has been lived with.
- **The days after** (recovery). Same mechanism; not asked for.
- **Recurring events**, **per-type suggestions**, **multi-week periodisation.**
  The last is a different feature: it changes how several fortnights generate.

## Consequences

The scheduler takes an optional per-day override map. With none, it produces
exactly the fortnight it always did — checked by a test that compares the two.
Everything else is one table, one domain module with its tests, and a chip on
the day.
