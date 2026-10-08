# Plan — Project 019: Balanced plans by goal

> **Purpose**: the phased technical execution plan. `/execute-project` follows this literally.
> **Audience**: agents primarily. **Committed**: yes. **Written by**: the lead via `/plan-project`; approved with the PRD on 2026-10-03.

- **Status**: approved
- **Type**: standard
- **PRD**: ./PRD.md
- **Routing profile**: tiered

## Design summary

Report [`0010`](../../reference/architecture/0010-balanced-plans-by-goal-2026-10-03.md) is the design. Phases follow its order:
1. measure the way production does;
2. guarantee the groups in the pool;
3. then maximums;
4. then minimums;
5. then accompaniments;
6. then protein per goal;
7. then the prompt.

Every phase is measured on the reference library (`0080`) with `--rotate`, and must keep 196/196 days in band, off and on, with 0 allergens and schedulePlan within +10%.

## Phases

### Phase 1 — Measure the way production does

- [x] done (2026-10-03; see LOG)
- **Dispatch**: opus @ medium — `/execute-project 019 phase 1`.
- **Covers**: PRD 1.
- **Steps**:
  1. Add a `--rotate` mode to the evaluator: production's 19-a-slot rotation plus the wider_rotation retry, across N seeds.
  2. Add a per-profile, per-goal balance score against the PRD table.
  3. Record the baseline in the LOG.
  4. Add `harina-de-maiz` to the grains group if its dry weight qualifies.

### Phase 2 — The pool carries every group

- [x] done (2026-10-03; see LOG)
- **Dispatch**: opus @ high — `/execute-project 019 phase 2`. Deviation: the pool shapes every plan.
- **Covers**: PRD 2.
- **Steps**: the rotation reserves, per slot, enough dishes of each group the table needs (legume kinds, oily fish, whole grain), within the person's filtered library, and fills the rest as today. Measure.

### Phase 3 — Maximums held

- [x] done (2026-10-08; see LOG)
- **Dispatch**: opus @ medium.
- **Covers**: PRD 3.
- **Steps**:
  1. Fish + shellfish ≤ 8, meat ≤ 6, red ≤ 4 never on consecutive days, processed ≤ 2 at any meal never on consecutive days, eggs ≤ 8 except vegetarians. Same mechanism as `0081`.
  2. A rice or grain accompaniment counts towards `STARCH_RULES`.
  3. Record decision `0084` (or extend it).

### Phase 4 — Minimums

- [x] done (2026-10-08; see LOG)
- **Dispatch**: opus @ high. Deviation: new mechanism.
- **Covers**: PRD 4.
- **Steps**:
  1. Add a reservation calendar for the minimum groups (legumes ≥ 8, fish ≥ 6 with oily ≥ 2), each capped by what the pool can supply.
  2. Add a final `meetFloors` repair pass that never trades a day out of band.
  3. Record decision `0085` (`0084` is phase 3's).
  4. Count, in the evaluator, the exceptions to the table's maximums and minimums that the bands needed and the ones they did not (`--exceptions`).

### Phase 5a — The maximums repaired (`meetCaps`)

- [x] done (2026-10-08; see LOG)

### Phase 5b — Vegetables, fruit, fibre and whole grain through accompaniments

- [x] done (2026-10-08; see LOG)
- **Dispatch**: opus @ medium.
- **Covers**: PRD 5.

### Phase 6 — Protein per meal by goal

- [ ] pending
- **Dispatch**: opus @ medium.
- **Covers**: PRD 6.
- **Steps**: per-slot protein weights in `slotBudgets` and `briefFor` by goal.

### Phase 7 — Prompt 4.7.0

- [ ] pending
- **Dispatch**: opus @ high, plus `invariant-reviewer` (AI output).
- **Covers**: PRD 7.
- **Steps**:
  1. Group lines inside the existing requests, under the 55% budget.
  2. Ask for the thin cells: light Spanish legume dinners, more legume kinds, whole-grain dinners.
  3. Add a preferences-form hint that "pescado" doesn't include shellfish.

## Hand-off

- Measure only with `pnpm db:local` and `NUTRIA_LOCAL_PG=1`; never Neon.
- No production data change without a reviewed migration.
- No `fable` for agents.
- Run the e2e suites only with the harness's mail and push guard (#208).
