# 0005 — Ask the model for a pool of dishes; schedule the fortnight in code

- **Status**: accepted
- **Date**: 2026-09-07
- **Project**: docs/projects/002-plan-generation

## Context

A 14-day plan is roughly 60–70 meals. The obvious shape — ask the model for the plan — runs
into three problems at once.

**Volume.** Sixty-odd dishes with ingredients and quantities does not fit comfortably in one
structured response, and the quality of the tail degrades well before the token limit does.

**Cross-day constraints.** Generating day by day is cheap to retry but blind: day 9 has no
idea that day 4 already served lentils twice. Feeding every previous day back as context to
keep it honest grows the prompt linearly and pays for the same tokens fourteen times.

**Arithmetic.** Hitting a daily calorie and macro target is not a language problem. Asking a
model to make four dishes sum to 1,750 kcal produces plausible-looking totals that are
wrong, and [`0004`](./0004-deterministic-safety-layer.md) already establishes that nutrition
figures come from composition tables rather than from generated text.

## Decision

Generation is two stages, split along the line [`0004`](./0004-deterministic-safety-layer.md)
draws — the model chooses **what food**, code decides **when and how much**.

**Stage A — pool.** Two or three calls produce a pool of candidate dishes (roughly 24–30),
composed only of ingredient slugs from the catalogue with gram quantities. Each is validated
independently: the schema, the slug allowlist, and the allergy gate. A dish that fails is
discarded and the shortfall re-requested for that slot alone.

**Stage B — schedule.** Pure code assigns pool dishes to 14 days × slots. It enforces the
variety rules, scales `servings` to bring each day's totals into band, and computes every
macro from `recipe_ingredients` against the catalogue. Deterministic, fast, and exhaustively
testable without a model in the loop.

## Alternatives considered

- **One call for the whole plan.** Rejected: quality degrades across a response that long,
  and a single validation failure discards sixty dishes.
- **One call per day (14 calls).** Rejected: no cross-day awareness without re-sending
  accumulated context, and it pays for the constraint list fourteen times over.
- **One call per day with previous days as context.** Rejected: prompt grows linearly,
  cost roughly quadratic, and variety is still only *requested* rather than enforced.
- **Model returns the plan, code repairs it.** Rejected: repair that reassigns days and
  rescales portions is the scheduler, arrived at by a longer road and with a worse contract.

## Consequences

- **Acceptance criteria 5 and 6 (nutrition in band, variety) become code-enforced rather
  than model-hoped** — they are unit-testable properties of the scheduler, not statistical
  outcomes of a prompt.
- Two to three model calls per plan instead of fourteen. Regeneration is cheap enough that
  retrying is a normal path rather than a failure mode.
- The scheduler needs a pool with enough slot coverage; a pool that is short after retries
  fails the generation honestly rather than serving a thin fortnight. This is the main new
  failure mode, and it is the one the catalogue's breadth exists to prevent.
- Pool dishes persist as `recipes` with `source: 'ai'`, so a later plan can reuse a dish the
  user liked without regenerating it — which is what makes the feedback loop in
  [`ROADMAP.md`](../ROADMAP.md) implementable.
- Portion scaling is the scheduler's lever for hitting targets, so `meals.servings` carries
  real meaning and the meal detail view must show scaled quantities, not the recipe's base.
