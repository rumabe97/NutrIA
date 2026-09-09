# 0004 — The AI never decides anything that can hurt someone

- **Status**: accepted
- **Date**: 2026-09-06
- **Project**: docs/projects/001-workspace-kickoff

## Context

The product's central promise is a personalised plan, and personalisation is exactly where
a language model earns its place: choosing dishes someone will actually cook and eat.

It is also a product where a wrong answer has physical consequences. A peanut in a meal for
someone with a peanut allergy, or a 900 kcal target for an adult, is not a bad
recommendation — it is harm. A model instructed not to do those things will mostly comply,
and "mostly" is the wrong reliability class for this.

## Decision

The boundary is drawn by **consequence, not by capability**:

| Decided by code | Decided by the model |
| --- | --- |
| Allergy and intolerance exclusion | Which dishes to propose |
| Calorie and macro targets, and the daily floor | How to vary them across a fortnight |
| Shopping-list aggregation | Recipe wording and instructions |
| Progress and adherence calculation | How to phrase a substitution |
| Authorisation and ownership | — |

The deterministic half lives in `packages/core/domain/`, which has no NestJS dependency and
no I/O, so it is fast to test and impossible to bypass by wiring. `findSafetyViolations`
compares allergen **ids** against a structured catalogue, never names, so nothing depends
on spelling or on a prompt being followed. `nutritionTargets` derives kcal from
Mifflin-St Jeor and clamps to `MINIMUM_DAILY_KCAL`, reporting the clamp so the user is told
rather than silently overridden.

Model output is structured and validated before it is stored. Anything that produces or
displays food re-validates — before storing **and** before returning.

## Alternatives considered

- **Prompt the model with the user's allergies and trust it.** Rejected: unfalsifiable in
  production. There is no test that proves a prompt is always obeyed.
- **Validate only at generation time.** Rejected: replacements, the assistant's
  suggestions, and shopping lists are all separate paths to a plate. Collections re-check
  at read time for the same reason the reference workspace re-derives access on read.
- **Ask the model to check its own output.** Rejected: correlated failure. The checker
  shares the generator's blind spots.

## Consequences

- The ingredient catalogue is load-bearing infrastructure, not seed data. An empty
  `allergens` table means the safety layer has nothing to enforce, so
  `packages/database/src/seed/` is part of deployment rather than a development convenience.
- Adding a food path means adding a `getSafetyProfile` call. The method is named so the
  call site is greppable: a path that never calls it is a path with no allergy check.
- `SafetyViolationError` returns 422 and is logged at error level regardless — unsafe
  content reaching that point means an upstream check let it through, which is a bug to
  investigate, not a user error to display.
- The domain layer carries the highest coverage floor in the workspace.

## Amendment — 2026-09-09

A free-text allergy that resolves to a catalogue row now also excludes every
row *made of* it: the anchor's slug, as whole hyphen-separated tokens, found as
a run inside another slug (`tomate` → `tomate-frito`, `zumo-de-tomate`; `pan` →
`pan-rallado`, not `panceta`). The matching rule is unchanged — still exact,
still no stemming — this applies only downstream of a match. The gap showed
when the end-to-end suite first ran against the thousand-row catalogue: a
tomato allergy excluded one row and offered nine tomato products to the model.
`madeOf` in `core/domain/Safety`.
