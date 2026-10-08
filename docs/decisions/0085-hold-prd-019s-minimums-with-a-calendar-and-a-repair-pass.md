# 0085 — Hold PRD 019's minimums with a reservation calendar and a repair pass that never trades a day

- **Status**: proposed
- **Date**: 2026-10-08
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 4)
- **Extends**: `0084`

## Context

PRD 019's table sets minimums a fortnight: legumes at 8 lunches and dinners, fish at 6, oily fish at 2 of those. Phase 2 put the dishes in the rotation; the scheduler still served fewer (a profile with 6 legume dishes in every rotation served a median of 4 or 5), because nothing in it wanted a legume or a fish. The PRD also says no minimum exceeds what the person's filtered pool can supply: a dislike, an allergy or a way of eating that removes a group removes its minimum.

## Decision

- `heldMinimums` (`core/domain/Balance`) names three minimums, each capped by the pool: legumes by the dishes of each legume at three a kind (`LEGUME_RULES`), fish and oily fish by the dishes the pool holds. A group the pool cannot serve has no minimum.
- **A reservation calendar** (`floorCalendar`) says which lunches and dinners owe which group, spread evenly over the days being laid out: legumes at lunch first, fish at dinner first (`0079`), oily fish on some of the fish meals. It reserves three quarters of what a minimum still lacks after the meals already placed (`CALENDAR_SHARE`). A meal that owes a group is first served from the dishes that carry it, when one fits within `FLOOR_FIT_TOLERANCE` of the best fit and is not beside its own legume.
- A day inside its bands pays `HELD_MINIMUM_WEIGHT` (20) for each meal it owes and does not carry, in `improveDay` and `repairOutOfBand`. That is above any fit, **below the maximums' 30** (so a fish bought for the minimum is never bought with a shellfish past the cap), and below the bands. A swap that raises a priced variety rule is not credited the minimum.
- **`meetFloors`**, a final repair pass before the distinct-days and side-starch passes: a plan still short takes the missing group one lunch or dinner at a time, from the days that owe it first. A swap is made only if it lowers the plan's total shortfall, leaves its day as inside its bands as it was (a day inside stays inside), keeps the floor, the order of the meals and the energy, and breaks no held rule, priced rule or maximum it did not already break.
- A swap (`pickReplacement`, `replaced`) keeps the minimum the old plate carried, when the rest of the plan does not meet it without it and a dish can.
- `bandNeededExceptions` (read-only, for the evaluator's `--exceptions`) counts, per rule, the meals past a maximum or short of a minimum and how many no single swap could have removed with the day kept inside its bands (PRD criterion 3). It is an estimate: each meal is asked alone.

## Alternatives considered

- **Pricing without a calendar.** Per day the shortfall of the whole plan looks the same on every day, so the first days take every legume. The calendar is what spreads them.
- **Reserving every meal a minimum lacks.** One profile of the reference library lost six days from their bands that three quarters did not; `meetFloors` makes up the rest without trading a day.
- **The minimums at the maximums' price (30).** Fish and shellfish held on fewer plans.
- **Holding a legume's days running at the starch caps' price (100).** It would change `0082`'s decision for every plan; the guard on the minimum's credit costs nothing elsewhere.

## Consequences

- On the reference library (`--rotate 10`), legumes are held on 135 and 132 of 140 plans (phase 3: 128 and 112), fish on 116 and 112 of 120 (84 and 99), oily fish on 116 and 105 (103 and 98), off and on. Every day stays in band and `schedulePlan` stays within +10%.
- The minimums raise fish with the shellfish a pool serves beside it: fish and shellfish ≤ 8 holds on 73 of 140 plans off (79) and 69 on (69). Most of those exceptions were not needed by the bands (213 meals, 20 needed, off); a later pass that repairs a maximum the way `meetFloors` repairs a minimum is where they go.
- A new minimum is one more `FloorCheck` in `heldMinimums`.
