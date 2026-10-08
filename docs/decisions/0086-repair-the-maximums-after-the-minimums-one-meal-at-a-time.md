# 0086 — Repair the maximums after the minimums, one meal at a time, never trading a day or another rule

- **Status**: proposed
- **Date**: 2026-10-08
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 5a)
- **Extends**: `0084`, `0085`

## Context

`0084` holds PRD 019's maximums by pricing them in the improvement passes, and phase 4's evaluator count showed that most breaks were not needed by the bands: of the meals past a cap, fish and shellfish 213 with 20 needed, meat 141 with 4, eggs 308 with 72 (accompaniments off). Pricing leaves a maximum broken whenever a swap that fixes it costs a little fit in a day already inside its bands.

## Decision

- `meetCaps` runs right after `meetFloors`, before the distinct-days and side-starch passes. Both are one generic pass (`repairToRule`): a plan breaking a maximum swaps a lunch or dinner of a broken group for another dish of the pool, one meal at a time, starting from the days that serve the most of a broken group.
- A swap is made only if the plan's total excess of the maximums falls; no other rule gets worse (the minimums' shortfall, the held rules and the priced ones included); and the day stays as inside its bands as it was, keeping its floor, the order of its meals and its energy. A day a round found nothing for is not asked again in that call.
- A maximum the bands needed stays broken, as `0084` says, and `bandNeededExceptions` counts it.

## Alternatives considered

- **Pricing the maximums higher.** `0084` tried a higher tier for the starch caps and the fit decided; the repair pass keeps the pricing as it is and corrects the result without moving a day.
- **A bigger shortlist or a sizing budget.** Neither bought a measurable amount; the budget cost the gains, the shortlist the time.

## Consequences

- On the reference library (`--rotate 10`, accompaniments off / on), fish and shellfish hold on 99 and 83 of 140 plans (phase 4: 73 and 69), meat on 96 and 86 of 130 (71 and 69), red meat on 121 and 107 (113 and 99), eggs on 62 and 83 (45 and 75). Every day stays in band; `schedulePlan` +7% off and +6% on.
- Many breaks remain that a single swap could have fixed: it would break another rule (a fish swapped for a pasta past its four), which the pass refuses. A smarter pass would trade two meals at once.
