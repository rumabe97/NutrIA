# 0101 — A day can hold two fixed meals, and the second is offered from what still fits

- **Date**: 2026-10-15
- **Status**: accepted
- **Amends**: [`0098`](./0098-a-meal-somebody-fixed-is-not-the-schedulers-to-change.md), which made one
  rule per day structural and cited [`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md)
  for why. `0045` was right; the conclusion drawn from it was too strong.
- **Builds on**: [`0099`](./0099-a-variety-cap-counts-the-meals-the-generator-chose.md) (free 1,
  premium 3) and [`0100`](./0100-a-person-may-name-a-dish-and-the-gate-is-on-what-comes-back.md)
  (the screen these rules are written on).

## Context

The owner fixed a meal, went back for a second on the same day, and the day was gone from the
picker. He asked why, was told it was deliberate and that nobody had measured the alternative,
and said: make it possible.

`0098` had declared one rule per day **structural** — a map keyed by day index cannot hold two
— and reasoned from `0045` that two meals already decided on a three-meal day leave the search
one dish and the portions, which is not enough to reach four macros. The reasoning was never
measured. This record is that measurement.

## What was measured

14 profiles × 10 seeds, 982 dishes, accompaniments on, the rule count held fixed so that the
only thing changing is **where the rules land**:

| arrangement | days inside 5% on all four macros | rules served |
| --- | --- | --- |
| two rules, different days (`0099`'s arrangement) | 1957 / 1960 | 560 / 560 |
| two rules, **same day**, dish chosen without regard for the other | **1855 / 1960** | 560 / 560 |
| two rules, same day, second chosen **from what still fits** | **1955 / 1960** | 560 / 560 |
| three rules, same day, each chosen from what still fits | 1949 / 1960 | 840 / 840 |

Unguarded, **204 of the 280 days carrying two rules missed a macro band** — 73%, against 0.5%
for the same two rules on different days. `0045` is real.

**But it is the pair that fails, not the idea.** Two things say so. The losses are not a
property of the shape: a five-meal profile lost every pinned day, eight four-meal profiles lost
none, and one three-meal profile lost none. And choosing the second dish from the ones that
leave the day solvable recovers almost all of it — 1955 against a 1957 baseline, every rule
still served. The misses spread across all four macros (fat 8, protein 10, carbs 4, energy 2 in
a two-seed sample), which is what "the remainder does not fit" looks like rather than one
constraint being tight.

## Decision

**A day may hold a rule for each meal, and a meal holds one.** The database says so
(`UNIQUE(user_id, weekday, slot)`, migration `0065` — the loosening `0063` had already written
down as the way to do it), and the scheduler's pins are keyed by day *and then* slot, so two
rules on one plate remain impossible by construction.

**The second rule of a day is offered only the dishes that leave that day inside its bands.**
`pinnable` takes what the day already holds; for each candidate that fits the plate, `dayHolds`
schedules that one day with both rules and reads the same `PLAN_TOLERANCE` bands validation
reports. The offer is what passes.

Three properties of that gate, each chosen rather than fallen into:

- **It reuses the band definition rather than restating it.** A second idea of what "inside the
  band" means is how two places come to disagree.
- **Its pool is cut to the dishes that can serve a slot the pins left free**, which is exact and
  not a sample: a dish the scheduler could not place in a free slot cannot help that day
  balance. Half the cost (197 candidates: 5.6 s → 2.7 s) and 197 of 197 verdicts unchanged.
- **It is optimistic, and that is stated.** One day built alone sees no variety pressure from
  the other thirteen and has the whole library to balance with. A pair it refuses can never
  work; a pair it accepts still cost 8 days in 1960. It is a filter for an offer, never a
  promise — `honouredPin` remains the backstop that keeps a day in band by dropping a pin it
  cannot honour.

**No per-day cap, because the filter is the cap.** Three rules on one day hold the bands
(1949/1960) and the offer collapses on its own: the third rule's list is 2 of 37 dishes on the
tightest profile, 8 of 230 on another. A number would be arbitrary where the measurement is
not; what a person can fix is **what still fits**, and when nothing does the screen says so.

**The cost is a slower list, once, on the rarer path.** A first rule's offer is unchanged (~25
ms). A second rule's costs ~14 ms per candidate — about 2.7 s on the largest library — and is
paid only when that day already holds a rule.

## Consequences

- **`clashes_with_fixed` is an eighth reason a dish is not offered** (`whyNotFixable`), and it
  is actionable. It is said apart from `too_big_or_small` because the way forward differs:
  another dish, or the other rule removed.
- **The screen tells two emptinesses apart**: a library with nothing for that meal, and a
  library with nothing that works beside the rule already there. On a three-meal day holding two
  rules the second is the ordinary answer, not an edge case — the copy is written for that.
- **The offer survives at 79% on average** (median 92%, floor 14% on the tightest shape), so the
  list is still a list. The floor is honest about that profile's day rather than hidden.
- **Rolling the deploy back is safe; re-tightening is what cannot be undone.** The previous API
  runs on this schema — it never names the constraint and never handles a unique violation for
  this table — and if two rules on one day already exist it keeps whichever the read returns
  last, refuses further rules on that day, and still deletes by id. What no deploy can do is put
  `UNIQUE(user_id, weekday)` back over data that no longer complies. **The migration that would
  do it**, written here so it is not worked out under pressure: delete every rule but one per
  `(user_id, weekday)` — the earliest `created_at`, so the rule somebody wrote first is the one
  that survives — and then add the narrow constraint back. That one *is* destructive, deletes
  something a person chose, and needs its own `-- reviewed-destructive:` line and a reviewer
  (`migration-reviewer`, 2026-10-15).
- **The gate is absolute, so a library that cannot close a day offers nothing.**
  `dayHolds` asks for a day inside all four bands — not for a day as good as that
  library gets — so wherever no day can be closed at all, the second rule is refused for
  every dish, under `clashes_with_fixed`. Production's library closes days, which is
  `0045`'s own measurement and the 1955/1960 above; the end-to-end fixture pool does not,
  because its ten ingredients carry almost no fat and every one of its fourteen days sits
  6% over the protein band. That is what turned CI red on 2026-10-15 with the suite green
  on a developer's machine, where a thousand real recipes stood in the way of noticing
  (`apps/api/test/README.md` § *The shared pool cannot reach the macro bands*). The
  alternative rule — offer what leaves the day **no worse than it would be without the
  pin** — would say something useful on a thin library, and costs a second schedule per
  candidate. It is not what was measured here, so it is written down rather than built
  (CI, 2026-10-15).
- **A season refusal wears the clash's label.** `dayHolds` schedules a day, and the scheduler's
  own search filters what is in season (`servableOn`) — so a dish refused only because it is out
  of season in that fortnight comes back `clashes_with_fixed`, which names the wrong cause. It is
  narrow (a searched, not-offered dish, on a day that already holds a rule, out of season) and
  telling the two apart means a second probe per reported dish, so it is written down rather than
  machined around. The first offer is unaffected: a pin outranks the season, so an out-of-season
  dish really can be fixed (`tests`, 2026-10-15).
- **What this does not do**: it does not tell somebody a standing rule stopped being honourable
  (`0098` left that open and `0100` left it open again), and the plan-level backstop can still
  drop the second pin of a day silently. The measurement bounds how often: 8 days in 1960.

(who decided: the owner, 2026-10-15, asking for two fixed meals on one day after being told it
was deliberate and unmeasured; the agent, that the measurement runs first and that what it
found — the pair, not the count — becomes the gate.)
