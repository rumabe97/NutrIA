# 0081 — Hold pasta, rice and grains to four a fortnight unless a day's bands need more

- **Status**: accepted
- **Date**: 2026-10-03
- **Project**: docs/projects/017-every-day-in-band

## Context

Project 016 phase 7 capped pasta and rice at four a fortnight. Project 017 phase 2 extended the cap to couscous and the other grains, and kept it from running on consecutive days. All of it was priced like the protein rule (0.15 a meal past the cap), so the scheduler could buy a better fit with a fifth plate.

On the reference library (decision `0080`), that soft cap was passed on 7 of 14 profiles, with rice six or seven times a fortnight, even with every day inside its bands.

The owner's rule for this project: **the macros win**. A hard cap is wanted wherever it costs no day.

## Decision

- **The cap is held above any fit.** A meal past four pasta, rice or grains a fortnight costs more than any fit a swap can buy (`STARCH_CAP_WEIGHT`). The schedule, `improveDay` and `repairOutOfBand` keep the cap whenever another dish keeps the day as close to its bands.
- **Only the bands outrank it.** Days are judged on their band miss first and on prices after, so a day that needs a fifth plate to land inside its macros gets it. That is one rule for every profile, with no per-profile switches.

## Measured (reference library, 14 profiles)

| | Before (phase 3) | After |
|---|---|---|
| Days in band, off / on | 196 / 196 | 196 / 196 |
| Profiles past four pasta, rice or grains | 7 | 0 |
| Allergens | 0 | 0 |

- schedulePlan time is +2.2% off and +0.8% on against phase 3 (best of two runs, back to back), still within +10% of #198.
- The fallback (a fifth plate for the bands) was never needed on this library.

## Alternatives considered

- **A strictly hard cap** (never past four). Rejected: the owner's "macros win" forbids a cap that could cost a day, and the fallback costs nothing when it isn't used.
- **The soft cap of phase 2.** Rejected: it passed the cap on half the profiles while every day was already in band.

## Consequences

- Pasta, rice and grains stay at four or fewer a fortnight on every measured profile.
- A future library or profile where a fifth plate is needed will show it in the evaluator's starch counts, not as a lost day.
