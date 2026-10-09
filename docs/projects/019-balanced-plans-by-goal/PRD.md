# PRD — Project 019: Balanced plans by goal

> **Purpose**: what this project delivers and why — the product half of the contract.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: the lead via
> `/plan-project`, from the owner's request and architect report `0010`; approved by the owner on 2026-10-03.

- **Status**: done — delivered and closed 2026-10-09 (owner's delegation of 2026-10-03; closing entry in LOG.md)
- **Roadmap item**: follow-up to projects 016–018

## Problem

The owner: "Tienen que ser planes súper equilibrados, y que de verdad cumpla el objetivo del usuario, como perder grasa, ganar músculo, comer sano… esto es lo más importante."

His production plan v17 had legumes at 2 of 28 mains, fish at 13 of 28, and pasta and rice 5 times each. Architect report [`0010`](../../reference/architecture/0010-balanced-plans-by-goal-2026-10-03.md) measured 280 production-like plans. Of those plans:
- 74% meet legumes ≥ 8 a fortnight;
- 54% meet fish ≤ 8;
- 25% meet meat ≤ 6;
- 28% meet processed meat ≤ 2;
- 19% meet vegetables at every main;
- 0% meet fruit ≥ 2 a day;
- 7% meet whole grain ≥ 50%.

The library is rich enough. The cause is the pool: a random 19 dishes per meal that ignores food groups. On top of that, the scheduler has no minimums at all.

## Outcome

Every plan follows a fortnightly food-group table based on AESAN 2022, EFSA and the WHO, and every goal gets what it needs, while keeping every day within ±5% on all four macros.

## The table (per fortnight, scaled to the plan's main meals)

| Group | Rule |
|---|---|
| Legumes | ≥ 8 (≥ 25 g dry-equivalent); one kind ≤ 3 and never on consecutive days (`0082`) |
| Fish | ≥ 6, of which oily ≥ 2; fish + shellfish ≤ 8 |
| Meat | ≤ 6, held; red ≤ 4, never on consecutive days |
| Processed meat | ≤ 2 at any meal, never on consecutive days |
| Eggs | ≤ 8, except for vegetarians |
| Pasta, rice, other grains | ≤ 4 each, never on consecutive days (`0081`, `0082`); a rice or grain *side* counts too |
| Vegetables | 150 g at every main, side included |
| Fruit | ≥ 2 portions a day |
| Whole grain | ≥ 50% of cereal |
| Fibre | ≥ 25 g a day |

- **Minimums never exceed what the person's filtered pool can supply.** A dislike, an allergy or a dietary pattern that removes a group sets its minimum to 0. For example, someone who dislikes fish gets no fish minimum.
- **Maximums are held above fit.** Only the bands outrank them, as in `0081`.

## Per goal

- **Gain muscle:** protein spread over every meal, with breakfast and snacks raised (per-slot protein weights).
- **Lose fat:** fibre ≥ 25 g, which today is short only on the low-kcal profile.
- **All goals:** sugar, frying and sauces are handled through the generator's prompt, because the catalogue has no sugar column.

## Acceptance criteria

1. The evaluator builds pools the way production does (`--rotate`) and reports a balance score per profile and goal. A baseline is recorded.
2. The pool guarantees each group a fortnight needs.
3. Every maximum in the table holds on every measured plan, or a band needed the exception and it is counted.
4. Every minimum holds wherever the person's pool can supply it.
5. Vegetables, fruit, fibre and whole grain are met through accompaniments.
6. Per-slot protein by goal. The muscle-gain profiles reach ≥ 0.3 g/kg at breakfast.
7. The prompt moves to 4.7.0. Its group lines go inside the existing requests, with no extra paid call, and the prompt stays within PRD 005's length budget.
8. Throughout: 196/196 days in band, off and on; 0 allergens; schedulePlan within +10% of today.

## Decisions (owner, 2026-10-03)

- Processed meat ≤ 2 a fortnight (WHO).
- Meat ≤ 6, held (AESAN ≤ 3 a week).
- Eggs ≤ 8 except for vegetarians (AESAN ≤ 4 a week).
- "Si es necesario, pedimos [los platos] al agente de IA": dishes are generated only to fill the gaps, inside the calls already made.

## Open questions

None. Report `0010` § findings also noted that disliking "pescado" leaves shellfish in, and proposes a hint on the preferences form. That is folded into phase 7.
