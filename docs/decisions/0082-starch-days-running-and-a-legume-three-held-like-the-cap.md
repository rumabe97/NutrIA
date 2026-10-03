# 0082 — Hold the starches' days running and a legume's three like the starch cap

- **Status**: accepted
- **Date**: 2026-10-03
- **Project**: docs/projects/017-every-day-in-band (shipped with project 011 phase 5)
- **Extends**: `0081`

## Context

`0081` held pasta, rice and grains to four a fortnight above any fit. It left the other kind rules priced at 0.15 a meal, the same as the protein rule, so a few points of fit could buy a break. In the owner's production plan of 2026-10-03, rice was served on days 1 and 2, and white beans four times in a fortnight. Pasta, rice and grains are never meant to fall on days running, and one legume is capped at three (`LEGUME_RULES`).

On the reference library (`0080`) the same thing showed up: grains on days running on one profile, and 13 meals past a legume's three over 7 profiles with accompaniments off (5 meals with them on). Every day was inside its bands.

## Decision

- **Same mechanism as `0081`, no new one.** The scheduler keeps a list of held rules (`KindRules.held`), priced at `HELD_KIND_WEIGHT`. That is `0081`'s `STARCH_CAP_WEIGHT`, renamed because it now covers more than the starch cap. Two rules are held:
  - `STARCH_RULES` whole: pasta, rice and grains at most four a fortnight, never on two days running, never twice on one day;
  - `LEGUME_RULES`' three a fortnight for each legume (`legumeCapCheck`).
- **The same four places hold them.** The first pick serves no dish that breaks a held rule while another dish can be served. `improveDay` and `repairOutOfBand` judge a day's band miss first and the held price after. `pickReplacement` sorts such a dish last.
- **Only the bands outrank them**, as in `0081`. If a day can only land inside its macros by breaking one of these rules, it breaks it. If no other dish can fill the meal, the rule gives.
- **A legume's days running stay priced.** The owner asked for the cap, and the reference library shows the same two runs before and after.

## Measured (reference library, 14 profiles, before = bcc0777a)

| | Off, before | Off, after | On, before | On, after |
|---|---|---|---|---|
| Days in band | 196 / 196 | 196 / 196 | 196 / 196 | 196 / 196 |
| Pasta, rice or grains on days running or twice a day | 1 | 0 | 0 | 0 |
| Meals past a legume's three | 13 (7 profiles) | 0 | 5 (1 profile) | 0 |
| Meals past the starch cap | 0 | 0 | 0 | 0 |
| A legume on days running (still priced) | 2 | 2 | 0 | 0 |
| Allergens; snack or breakfast dish at a main meal | 0; 0 | 0; 0 | 0; 0 | 0; 0 |

- `schedulePlan` time, best of two, before and after taking turns: off 3,042 → 3,138 ms (+3.2%), on 6,684 → 6,072 ms (−9.2%).
- The fallback (breaking a held rule for the bands) was never needed on this library.

## Alternatives considered

- **Holding a legume's days running too.** Not asked for. It would add the most constraint for vegetarian pools, which already lean on legumes. That rule is still priced, and the evaluator reports its runs.
- **A second weight for the new rules.** Rejected: one weight, one order of judgement, one place to read it.

## Consequences

- Pasta, rice and grains are not served on two days running, and no legume is served more than three times a fortnight, unless a day's bands need it. The evaluator's starch and legume lines would show any such case.
- `kindPastCap`, `kindAtCap` and `starchPastCap` stay exported and tested, but the scheduler no longer calls them.
