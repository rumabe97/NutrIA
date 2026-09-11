# 0048 — Protein is held both ways, and the fortnight is repaired as a whole

**Status**: accepted · **Date**: 2026-09-11 · **Deciders**: owner, agent

## Context

After [`0047`](./0047-dishes-are-designed-to-the-whole-split.md) a real
regeneration of a high-carbohydrate profile landed energy, carbohydrate and fat
inside 5% on all fourteen days, event days included — and protein 7–17% over on
nine of them. Nothing reported it: since [`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md)
protein had a floor 5% under target and, above it, only the safety ceiling of
3 g/kg. The owner's bar is 5% on every macro, both ways: "fixea también la
proteína".

Three causes, measured on a copy of production:

- **Supply.** The library holds one or two dishes per meal at or under that
  profile's 17% protein share; the median sits at 26–38%. 3.0.0's new dishes
  came back at 17–20% — on the target or over it, never under.
- **Build order.** Days are built in order and each dish may appear twice a
  plan, so the dishes that fit best are spent in the first week. The day's own
  swaps cannot move a surplus to another day.
- **A linear cost.** One point of error costs the same at 2% as at 12%, so a day
  with three macros to the gram and protein 17% over was as good as it got.

## Decision

**Protein gets a band above the target, the fortnight is repaired as a whole
after it is built, and the prompt asks for dishes on both sides of every
number.**

- **Validation**: `PLAN_TOLERANCE.proteinOver = 0.05` and a `protein_above_target`
  advisory. The ceiling still blocks, is asked first, and still measures body
  mass. The new kind counts towards `0046`'s band miss, so a plan over on protein
  is scheduled again from the wider rotation.
- **Scheduler — the spread pass.** Once every day is built, days outside a band
  are first re-sized to the bands; then, repeatedly, the day furthest outside
  trades a meal with the same meal of another day, both re-sized to the bands,
  whenever the two end up with fewer macros outside — or as many, less far
  outside. Every move is checked with `canPlace`, including against the days a
  mid-plan rebuild leaves alone. Bounded (60 rounds, 24 exchanges priced
  properly per round), deterministic.
- **Prompt 3.1.0**: protein is a figure to land on, not a minimum; each meal's
  dishes straddle every figure, and protein is given as a range per meal —
  half the set at 90–100% of the figure, half at 100–110%.

## Alternatives considered

Measured on a copy of production, on the profile's real
generation pools reconstructed from the plans (the reconstruction reproduces
the live plans exactly: 10 of 14 protein days and a worst day of +18.6%):

| Scheduler | 3.0.0 pool, first / wider | 3.1.0 pool, first / wider |
|---|---|---|
| `main` | protein 5 / 11 of 14 | protein 8 / 10 of 14, carbs 11 / 14 |
| A band penalty inside each day's build | worse on every pool — the best dishes went faster | — |
| Spread pass, days counted | protein 8 / 13 | protein 11 / 12 |
| Spread pass, macros counted, band-sized (chosen) | **all four 14 / 14** | protein 13 / 13, the rest 14 / 14 |

Across every profile with a plan on the copy, from the library alone: protein
inside on 54 days of 70 against 43, fat 70 against 63, carbohydrate 69 against
66, energy 70 in both. A real regeneration with everything above landed
**all four macros inside 5% on all fourteen days**, events included, with a
worst protein day of +4.9% — while one of its four model requests failed on a
network timeout and was covered from the library.

- **A penalty for leaving the band inside the day's own build.** Tried first,
  at weights 1, 3 and 10: each day took the dishes that fit best more greedily
  and the last days had less to choose from. Worse on every pool.
- **Replacing a meal from the pool inside the spread pass**, as well as
  exchanging between days. Measured worse: a locally best replacement led the
  search to a worse end.
- **Choosing library dishes by composition** instead of a seeded dozen. Helped
  carbohydrate and fat on the first pool, not protein — the dishes are not
  there — and trades away `0009`'s per-person rotation. Not done.
- **Per-ingredient trimming** — serving less chicken and more rice than a
  recipe says. The strongest lever, and a change to what a recipe means; still
  the owner's decision, not needed at this measurement.

## Consequences

- A profile whose split the library cannot reach — a 15% protein day, say —
  still misses until the model has written dishes for it; the prompt now asks
  for them on both sides. The miss is reported, never hidden.
- The spread pass costs well under a second on a fortnight; the whole schedule
  stays at two to seven seconds.
- `Scheduler.test.ts` pins the mechanism on a toy pool whose last three days
  ran 8–14% over on protein without it.
