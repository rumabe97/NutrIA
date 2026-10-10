# 0093 — The day the plan builds can see its vegetables, its fruit and its whole grain

- **Date**: 2026-10-10
- **Status**: accepted
- **Amends**: [`0087`](./0087-bring-vegetables-and-fruit-beside-the-plate-after-the-day-is-sized.md) (its rules
  are now scheduled, not only measured) and [`0079`](./0079-meals-fit-by-cuisine-and-accompaniments-by-cuisine.md)
  § Table 3 (a side is offered beside every main). Leaves [`0084`](./0084-hold-the-food-group-maximums-below-the-starch-caps-and-the-bands.md)
  and [`0085`](./0085-hold-prd-019s-minimums-with-a-calendar-and-a-repair-pass.md) in force, repriced.

## Context

`balanceOf` scores a plan against thirteen rules of PRD 019's table. **Nothing in
production ever read that score**: its only callers were the evaluator and its own specs.
The scheduler held some of the table — the minimums of fish, legumes and oily fish, the
maximums of fish, meat, red and processed meat and eggs — and priced them under the macro
bands. Four rules it never held at all: vegetables at every lunch and dinner, two fruit a
day, half the cereal whole, 25 g of fibre.

Measured on the real library, the rotation and the rescues production uses (the evaluator,
`--rotate 10 --flag accompaniments`, 14 profiles × 10 seeds = 140 plans), the four
unscheduled rules were the four worst: **vegetables held on 6% of plans, fruit on 34%,
whole grain on 32%**, against a mean of 65% across the thirteen. The owner asked for plans
that keep the whole table, for every purpose and every way of eating.

Four causes, each verified in the code before it was changed:

1. **A main under `ACCOMPANIED_FROM_KCAL` (700) was offered no side at all.** Vegetables
   and fruit arrive mostly beside the plate, so a person eating three or five times on an
   ordinary target — every one of their meals under 700 kcal — got none of either. The
   rule was written for search cost, and it fell hardest on the people it meant to spare.
2. **`setCost` ranked sides on the macros alone.** Of the sets a meal was offered nearly
   none carried a vegetable, so the day's search could not choose one however much it
   wanted to, and `meetSides` — the pass that exists to repair exactly this — had nothing
   to repair with. Instrumented on one profile: **86 of its 87 candidates were refused for
   the bands**, which is the second finding below.
3. **The day's own cost could not see a group.** Sets were chosen for macro fit and
   repaired afterwards by a single late pass, which `enforceDistinctDays` and
   `holdSideStarches` then ran after and could undo: no pass but `meetSides` knew
   `sideLack` existed.
4. **Table 3's cereal sides are 2 of 13 whole** (`pan-integral`, `tabule`). Offering a side
   at every main therefore *lowered* the whole-grain share — it added refined cereal to
   every plate — from 31% to 24% before this record's fourth mechanism put it back.

## Decision

The rules of `0087` are scheduled, by four mechanisms, with the macro bands untouched
above all of them.

- **A side is offered beside every lunch and dinner** (`ACCOMPANIED_FROM_KCAL` 700 → 0).
  What is left of the old rule is the slot: nothing goes beside a breakfast, a snack or a
  supper.
- **A rule that is a step is priced as a step.** `vegetablesLack` is 0 at 150 g and 1
  below it, not the distance to 150 g. Priced as a distance it was *worse than nothing*:
  tried with a half-portion ladder on every vegetable side, the search bought the half
  portion, paid less, and still broke the rule — on three seeds vegetables fell to 21%,
  below the 31% the same code reached with no ladder at all. The ladder was dropped and the
  step kept, and vegetables ended at **61% of 140 plans**, from 6%.
- **`balancedDay` carries both day-level rules in its cost**: a per-meal term for the
  vegetables of each main, and one day-level hinge for the two fruit, the plate's own fruit
  credited so a dish that brings it needs no dessert. Both are summed through `Term` and
  `DaySums` like every other term, and both are bounded in `lowestBelow` — the vegetables
  by the least any remaining meal can owe, the fruit by the most any remaining meal can
  bring, which is how `tenths` already bounds the energy floor. Both apply only with
  accompaniments on and only to a **banded** day: in the unbanded first build the term
  took a day out of its band on the thinnest pool there is (gluten-free, 157 ingredients
  excluded), and the bands are not for sale.
- **A refined cereal side is nudged towards its whole twin** (`REFINED_SIDE_WEIGHT`, a
  quarter of the vegetables' price). It decides between sides that are the same meal
  either way — a white roll and a wholemeal one differ by almost nothing on the macros —
  and it moved whole grain from 38% to **67%** on three seeds. Measured first, so the
  layer was right: the dish library is **48% whole on its own**, bimodally (of 248 mains
  carrying cereal, 117 are wholly whole and 131 wholly refined), so the sides were the
  half that needed moving.
- **Prompt 4.8.0**: every main is asked for its own 150 g of vegetables *and* told sides
  are added, where 4.7.1 told it one or the other depending on that same 700 kcal line;
  and breakfast and the snacks are asked for fruit whatever the mains take, where the old
  condition — neither main takes sides — is now never true.

## Alternatives considered

- **Hold the table's rules instead of pricing them.** Rejected: the bands are hard and
  every group rule competes for what they leave. A held rule that cannot be met returns no
  plan, and a plan is worth more than a rule.
- **Raise the price until the rules hold.** Measured, not argued, and the weights are at a
  frontier: what one rule gains another pays. The vegetables' weight at 2 instead of 0.5
  bought nine points of its rule **and took a day out of its band** (587 of 588).
- **Reprice the table's maximums and minimums** (80 and 60, from 30 and 20). Tried because
  the caps were being broken for free — at baseline **155 of 159** fish exceedances and
  **104 of 106** meat ones were ones a band-keeping swap could have removed — and
  **rejected on the measurement**: over 140 plans it bought eggs six points and cost
  starches seventeen, left the mean of the thirteen rules unchanged (77%), and was equal or
  worse than the old weights on 11 of the 14 profiles. The weights are unchanged. A cap
  broken "for free" by a swap the scheduler could make is not the same as one it can price
  its way out of, and this is the measurement that separates them.
- **A portion ladder on the vegetable sides** (half and whole). It is in this record
  because it looked obvious and measured worse — see the step above.
- **Accompaniments at the snack slots**, which is where fruit would most easily land on a
  two-meal day. Not taken: Table 2 of `0079` is a product shape, and this is the owner's
  decision, not an agent's.
- **Reading `balanceOf` in production and refusing a plan under some score.** Rejected for
  now: it would refuse plans that are the best available for that person and library.

## Consequences

- **`1960 of 1960` days inside 5% on all four macros**, 0 plates with a declared allergen,
  across 140 plans of 14 profiles. The condition of everything above — and one better than
  the 1959 `main` scored on the same seeds.
- The thirteen rules went from a mean of **65% to 78%**, and the mean of the fourteen
  profiles' median plan scores from **64% to 79%**: vegetables 6% → 58%, vegetables at four
  mains in five 54% → 86%, fruit 34% → 66%, whole grain 32% → 59%, eggs 51% → 66%,
  starches 64% → 84%, fish and shellfish 61% → 67%, meat 66% → 72%, processed 73% → 79%.
  Legumes 94% → 92% and red meat 88% → 89% moved by a plan or two, which is noise at ten
  seeds. **The vegetarian profile keeps the whole table**, on the median plan and on nine of
  its ten seeds.
- **Twelve profiles of the fourteen improved; two lost ground**, and they show the shape of
  every trade here. Gluten-free, 77% → 65%, is the thinnest pool measured (157 ingredients
  excluded): it gained whole grain (50% → 70%) and gained *nothing* on vegetables, which
  stay at 0% because its larder has almost no gluten-free side to bring them, while the room
  that bought the whole grain came out of its protein caps (meat 90% → 60%, processed 100% →
  60%). Three-meals-high-protein, 64% → 59%, traded the same way: vegetables 0% → 60% and
  whole grain 40% → 80% against its starch and processed caps. On a pool that thin every
  constraint added displaces another, and the lever for both is their larder, not the
  weights.
- Scheduling costs about three times as long with sides on (15 s → 105 s for 140 plans).
  Every main now prices sets it used to skip. Well inside the generation budget.
- **The table still does not hold everywhere, and the rest is data, not scheduling.** Two
  ceilings are measured: only **41% of the library's mains carry 150 g of vegetables a
  serving** (median 120 g), so a plan of 28 mains cannot draw them all from that subset and
  also satisfy the macros, the caps and the season; and on a low-energy day there is no
  room inside the bands for a side that would bring the rest (cause 2 above, 86 of 87).
  Prompt 4.8.0 asks the model to close the first; nobody has measured it yet, because the
  evaluator never calls a model.
- `eggs` is the one cap the bands genuinely need: at baseline 187 of its 363 exceeding
  meals were ones no band-keeping swap could remove. It is cheap protein and a tight day
  reaches for it.
- The protein caps that are left — fish and shellfish at 67%, meat at 72% — are a **supply**
  problem, and the evidence is in the pool the rotation hands over: in the plans that break
  the fish cap of 8, the rotation offered between 7 and 13 fish mains and the plan served
  nearly all of them. `POOL_RESERVE` is a floor on that supply and there is no ceiling,
  deliberately — `rotatePool` never filters, so that a thin library or a narrow taste costs
  variety and never a plan. So the lever is the *ask*: `poolAsks` should want more of what
  is scarce rather than less of what is plentiful. Which is a prompt change, and nothing
  here can measure a prompt change.
- Whole grain and the starch caps now trade against each other: whole-grain dishes are
  disproportionately rice and grain dishes, so preferring them pushes a base past its four
  a fortnight. Measured, in the plans that lost the starch rule, the extra base was always
  the **dish's**, never the side's.
- A future agent reading a group rule: the four weights are `SIDE_LACK_WEIGHT`,
  `REFINED_SIDE_WEIGHT`, `HELD_MAXIMUM_WEIGHT` and `HELD_MINIMUM_WEIGHT`, and none of them
  may outrank `BAND_MISS_WEIGHT`. The day's search is bit-exact and bounded; a new term
  goes in `Term`, `DaySums`, `addTerm`, `closingCost` **and** `lowestBelow`, or the bound
  stops being admissible and the search silently stops finding the cheapest day.
