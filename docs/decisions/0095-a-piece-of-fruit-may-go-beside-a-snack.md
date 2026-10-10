# 0095 — A piece of fruit may go beside a snack, and only afterwards

- **Date**: 2026-10-10
- **Status**: accepted
- **Amends**: [`0079`](./0079-meals-fit-by-cuisine-and-accompaniments-by-cuisine.md) § Table 3 (a
  fruit's meals now include the two snacks) and [`0093`](./0093-the-day-the-plan-builds-can-see-its-vegetables.md),
  which left this as the owner's to decide. [`0087`](./0087-bring-vegetables-and-fruit-beside-the-plate-after-the-day-is-sized.md)'s
  two fruit a day are unchanged; what changes is where they may come from.

## Context

`0087` asks for two portions of fruit a day. `0093` scheduled that ask and moved it from 34%
of plans to 66% — but it also measured where the rest of it was stuck, and left the lever
to the owner because it changes the shape of a meal.

A fruit could only ever arrive beside a lunch or a dinner, as a dessert. Two mains are
therefore the whole of a day's supply, and a dessert is the first thing a tight day drops to
stay inside its bands. For anyone whose day has no breakfast, there is nowhere else for it
to come from, and the library does not make up the difference: **9 of 132 morning-snack
dishes carry 120 g of fresh fruit** (7%; breakfast 10%, afternoon snack 8%).

Measured on the owner's own shape — a large mid-morning snack, a lunch and a dinner — the
rule held on **none of ten plans**, and on none at half his rate of loss or a quarter of it.
Not a draw: a floor nothing could reach.

## Decision

**A piece of fruit may go beside a morning or an afternoon snack** — the fruit entries of
Table 3 gain those two meals, and nothing else does. A snack is offered a fruit or nothing:
every other entry of Table 3 names only a breakfast, a lunch or a dinner, so the restricted
offer needs no rule of its own.

**And it is offered only to `meetSides`, never to the day's own search.** `Sides` answers in
two: `setsOf`, what `balancedDay` may choose from, which stays lunch and dinner alone; and
`repair`, what may be *added* afterwards, which includes the snack.

That second half is the whole of the care here, and it was measured both ways. Every set a
meal is offered multiplies the combinations a day prices, and `BALANCE_MAX_COMBOS` does not
move for a meal more — so the sets a snack is offered are paid for by every plate's window.
Offered inside the search, a three-meal day's plates fall from eight quarter-steps to four,
and **three days of 1,960 lost their macro band**. Offered to `meetSides`, which pins the one
set it is trying and keeps a day only when the day sized around it is as inside its bands as
it was, a fruit that would cost a band is simply not taken: **1,960 of 1,960**.

Breakfast is deliberately left out, and this is the record of that. Table 3 has written sides
for a breakfast since project 016, and four of its entries (`nueces`, `almendras`,
`queso-de-burgos`, `requeson`) name a breakfast and nothing else — so they have never once
been reachable. Turning them on is a visible change to every breakfast of every plan, nobody
has asked for it, and it is not this change's to make.

## Alternatives considered

- **Offer the snack its fruit inside the day's search.** The obvious shape, and it is in this
  record because it measured better on the rule and worse on the thing that is not for sale:
  fruit on the owner's shape went to 50% of plans, and the band went to 1,957 of 1,960.
- **Keep it in the search and cap the snack's sets.** Tried at two, three, five and six sets
  against ten for a main. The best of them put the owner's median plan at 88% — and still at
  1,957. The parameter reshuffles which plans succeed rather than buying room; there is no
  value of it that buys back the window.
- **Let every slot take whatever Table 3 allows it.** This is what the catalogue, read
  literally, already says. Rejected as a side effect: the slots were written under a gate
  that has always been there, so they are not a product decision by themselves.
- **Ask the model for snack dishes that carry their own fruit.** Already done, in prompt
  4.8.0 with `0093`, and it cannot be measured here because the evaluator never calls a
  model. The two are not alternatives: one fills the library, this one uses it.

## Consequences

- **1,960 of 1,960** days inside 5% on all four macros, 0 plates with a declared allergen,
  over 140 plans — the condition this was shaped around.
- Fruit holds on **69%** of plans where it held on 66%, and on the owner's shape it goes from
  **0 of 10 to 3 of 10**. Fish and shellfish (67% → 69%), meat (72% → 75%), starches (84% →
  85%) and whole grain (59% → 61%) all moved with it: a day that spends a fruit on a snack
  has one less dessert to find beside a main. The mean of the thirteen rules is 78.5%, from
  77.7%.
- A two-meal day still cannot reach two fruit a day and this does not change that: it has no
  snack to put one beside. That shape's floor remains out of reach until its dishes carry
  fruit themselves.
- `SNACK_ACCOMPANIMENT_SETS` is five against a main's ten, which now bounds only what the
  repair pass is offered. It is kept because a piece of fruit is much like another and
  pricing ten of them buys nothing.
- `ACCOMPANIED_SLOTS` is the one place that says which meals may be accompanied at all. A
  future change that wants a breakfast to take a side changes that set and the four entries
  above come alive with it.
