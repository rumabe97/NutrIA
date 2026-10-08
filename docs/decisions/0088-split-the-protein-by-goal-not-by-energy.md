# 0088 — Split a muscle-gain day's protein over its meals by goal, not by energy

- **Status**: proposed
- **Date**: 2026-10-08
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 6)
- **Extends**: `0036`

## Context

`slotBudgets` divides all four macros of the day among the meals by the same weights, the energy's: a breakfast that carries a quarter of the energy carries a quarter of the protein, and a snack that carries 8% carries 8%. Somebody building muscle is best served by 0.3–0.4 g/kg of protein at each meal (ISSN 2017, Schoenfeld and Aragon 2018): on the reference library's muscle-gain profile (98 kg) the breakfast averaged 0.42 g/kg and the snacks 0.15–0.16, with the lowest breakfast at 0.22.

## Decision

- `proteinWeightsFor(goal, weights)` names, for `muscle_gain` only, each slot's share of the day's protein: its energy weight times 1.5 for breakfast and supper and 2 for the snacks. For every other goal it names nothing and the split is the energy's, bit for bit.
- `SchedulerInput.proteinWeights` is optional; `slotBudgets` divides the protein by it and the other three macros by the energy weights. The first pick, the day's swaps and the sizing all read those budgets, so no pass changed.
- Generation and an event rebuild pass it from the person's goal; the evaluator passes it for the same profiles. A meal swap sizes to the old plate and is untouched.

## Alternatives considered

- **Leans of 2 and 3.** Breakfast reached 0.50 g/kg but the muscle-gain score fell (77 to 73) and lunch and dinner fell to 0.52 and 0.49.
- **A protein floor per meal for every goal (the report's 0.25 g/kg).** The library's snacks do not carry it; it belongs with the generator's ask for protein snacks (phase 7).
- **Changing `briefFor` now.** The prompt's per-slot protein numbers are part of the prompt; changing them without the version bump phase 7 makes would change the generator's output under an unchanged version.

## Consequences

- On the reference library (`--rotate 10`, accompaniments on), muscle gain: breakfast 0.42 to 0.46 g/kg, morning snack 0.15 to 0.17, afternoon snack 0.16 to 0.21, lunch 0.60 to 0.55, dinner 0.56 to 0.51; score 69 to 77. The other four goals and every day in band are unchanged.
- The lowest breakfast of a plan stays near 0.2 g/kg: some days have no dish that carries it inside the bands. Protein snacks are phase 7's ask of the generator.
