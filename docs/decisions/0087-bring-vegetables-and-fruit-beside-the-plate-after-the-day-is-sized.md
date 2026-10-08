# 0087 — Bring vegetables and fruit beside the plate after the day is sized

- **Status**: proposed
- **Date**: 2026-10-08
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 5b)
- **Extends**: `0079`, `0085`, `0086`

## Context

PRD 019 asks for 150 g of vegetables at every main (plate and side together) and two portions of fruit a day, met through the accompaniments. The day's own search chooses each meal's set (bread, vegetable, fruit; one of each role at most) for the macros alone, from the six sets that best close the meal's gap. On the reference library with accompaniments on, that left 31 of 140 plans with 150 g at 80% of their mains and 28 with two fruits a day. The catalogue is not the limit: a Spanish larder has about 24 vegetable sides, most over 150 g, and twenty fresh fruits.

## Decision

- `meetSides` runs after `meetCaps` and before the distinct-days and side-starch passes, and only with accompaniments on. A day short of vegetables or fruit (`sideLack`: each main's share of 150 g missing, plus the share of two fruit portions the day lacks) is offered, for each lunch and dinner, the sets that carry them (`sideSets`: the sets of the larder's best portions per role, ranked by what they close of that lack, then by fit).
- A set is taken when the day, sized again with it (`balancedDay`, banded), is nearer the table, is as inside its bands as it was, keeps its floor, the order of its meals and its energy. Two rounds a day, three candidates sized a round.
- The day's own search is untouched. Pricing the lack inside it would have meant new terms in its branch-and-bound bounds.

## Alternatives considered

- **Vegetable and fruit terms in the day's cost.** Exact, but `balancedDay`'s search prunes by lower bounds on each term; each new term needs a proven bound and touches the hottest loop of the scheduler.
- **Ranking the six offered sets by the lack.** The day's search still picks by macros among them and bread wins ties.

## Consequences

- On the reference library (`--rotate 10`, accompaniments on, phase 5a → 5b): 150 g at 80% of mains 31 → 74 of 140 plans; fruit two a day 28 → 73; whole grain 28 → 39; starches 86 → 90; 150 g at every main 0 → 4. Goals (weight loss, muscle gain, maintenance, healthy eating, performance) 61/62/63/57/62 → 62/69/67/69/65. Every day stays in band, `schedulePlan` +6.5% over 5a.
- Profiles whose meals take no accompaniments (a small budget per meal, `ACCOMPANIED_FROM_KCAL`) are unchanged: patron-kosher, patron-sin-gluten.
- A swap (`pickReplacement`) still composes its set by fit, so a swapped meal can lose its vegetable.
- Whole grain moved only through the bread a day happened to take; a bias towards whole-grain bread is a later, separate decision.
