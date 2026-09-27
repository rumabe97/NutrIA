# 0067 — Onboarding asks only what a plan reads

- **Status**: accepted
- **Date**: 2026-09-28

## Context

`0025` set the rule: a question whose answer changes nothing is not asked. Onboarding had
drifted from it. Traced field by field on 2026-09-28:

- **Read by nobody**: breakfast style, portion preference, working-hours notes, the
  free-text custom goal. Stored and never read again; since prompt 4.0.0 no typed text
  reaches the model, and no screen shows them back.
- **One soft line in the prompt, nothing deterministic**: wake and sleep times, training
  days and time (the whole `lifestyle` step, read only by `dayShapeOf` as "Their day: …"),
  cooking budget and cooking frequency (`BUDGET:` and `- Cooks:`). None of them filters,
  sizes or schedules anything; the scheduler, portion sizing and validation never saw them.
- **Read in code**: name, country (catalogue), birth date, sex, height, weight, activity
  (targets), goal type, target weight and pace (targets, progress), meal shape (scheduler
  weights, `0036`), maximum cooking time (library filter and prompt), cuisines, likes and
  dislikes, allergies, intolerances and way of eating.

The country question was also broken: asked on the first screen and never sent.

## Decision

The owner chose the strict cut. Onboarding keeps only the third list: the `lifestyle`
step is removed (nine screens → eight), how-you-eat keeps only the meal shape, cooking
keeps only the maximum time, and the goal loses its free text. The fields leave the
domain (schemas, views, prompt) at once; prompt 4.3.0 → 4.4.0 drops the three soft lines.
The about-you step now sends the country.

Step keys are not renamed or added: `RequiresOnboarding` checks every user's completed
steps, and a new key would lock out everyone who finished. Rows that still hold
`lifestyle` (every finished account) are read with unknown steps dropped and the current
step clamped.

The database columns stay for this release, so the old API running during the deploy
still finds them; a follow-up migration drops them through `migration-reviewer`.

## Alternatives considered

- **Keep sleep, training, budget and frequency as hints to the model** — they shaped at
  most the wording of the fresh dishes, and the prompt changes either way; asking eight
  more questions for that fails `0025`.
- **Remove only the four dead fields** — leaves a whole screen whose answers nothing
  decides.
- **Drop the columns in the same change** — a migration runs during the API build while
  the old API still serves; stopping reads first is the safe order.

## Consequences

- Shorter onboarding (about 30 inputs → about 18), less personal data held and sent to the
  model (RGPD art. 5.1.c); the legal texts in `docs/legal/` are updated with it.
- Anyone who later wants a plan to follow training or waking hours has to build a rule that
  reads them, and ask the question again in that same change.
- Follow-up owed: the migration dropping the nine preference columns and `custom_goal`.
