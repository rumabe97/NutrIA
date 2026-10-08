# 0084 — Hold PRD 019's maximums as kind rules, below the starch caps and the bands

- **Status**: accepted
- **Date**: 2026-10-08
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 3)
- **Extends**: `0081`, `0082`

## Context

PRD 019's table sets maximums a fortnight: fish and shellfish ≤ 8, meat ≤ 6, red meat ≤ 4 and processed meat ≤ 2 never on consecutive days, eggs ≤ 8 except for vegetarians, and pasta, rice and grains ≤ 4 each with a rice or grain side counting. The PRD says the maximums are held above fit and only the bands outrank them, as in `0081`. The scheduler already held pasta, rice and grains and a legume's three (`0081`, `0082`) as kind rules at `HELD_KIND_WEIGHT` (100).

## Decision

- Each maximum is a `KindCheck` over one kind named for its group (`heldMaximums`), so the cap is the group's and not a dish's. Main-meal caps scale to the plan's main meals; meat's is 12 when the person's pool holds no fish (`0010` § 3.3).
- Eggs are counted by the egg at every meal (`KindCheck.weight`): a three-egg omelette counts three. The egg cap is waived for a pool with neither meat nor fish, where the egg is the protein.
- A dish is read at the servings the first pick gives it, since the balance score counts a plate as served. A swap or a rebuild reads each kept meal's groups from its rows as served (`Placement.groups`).
- The maximums are held at `HELD_MAXIMUM_WEIGHT` (30): above any fit, below the starch and legume caps (100), and below the bands. A day outside its bands screens its swaps without their price. They are not filtered at the first pick.
- A rice or grain side counts towards `STARCH_RULES` (`holdSideStarches`). Last, a day whose side breaks the rule is sized again without it, kept only when the day stays as close to its bands and its energy.
- When a maximum gives, it gives to the bands: the exception is allowed and the evaluator counts it.

## Alternatives considered

- **The maximums at the starch caps' price (100).** A meat past its six traded for a rice past its four came out even, the fit decided, and the starch cap held on fewer plans.
- **Filtering the maximums at the first pick, like the starch caps.** Tried by phase 3's first executor behind a measurement switch and not kept; its figures were lost in a crash. Without it, the improvement passes hold the maximums and the first pick stays as wide as before.
- **Eggs counted by the dish.** A tortilla of three eggs and a garnish of one would weigh the same, against AESAN's count by the egg.

## Consequences

- On the reference library (`--rotate 10`), red meat is held on 105 and 108 of 130 plans (baseline 56 and 59) and processed meat on 86 and 89 (baseline 26 and 40), off and on. Every day stays in band and `schedulePlan` stays within +10%.
- Meat, eggs and fish with shellfish still give on about half the plans: a rotation of 19 dishes a slot often has nothing else that keeps a day inside its bands. Phase 4 (minimums, `meetFloors`) and phase 6 (protein per meal) change what the bands need. The evaluator must learn to tell an exception the bands needed from one they did not (PRD criterion 3).
- Any new held group is one more `KindCheck` in `heldMaximums`, at the same price.
