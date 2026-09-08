# 0011 — Nutrition targets are advisory; structure and safety bounds block

- **Status**: accepted
- **Date**: 2026-09-08
- **Project**: none (task, at the owner's report)

## Context

A generation failed on the owner's phone with `protein_out_of_band (2 días, p. ej.
141 frente a 185)`. Fourteen days of food were built, scheduled, checked for
allergens — and then discarded because two of those days came in 24 % under the
protein target. The owner was left with no plan at all.

The owner's instruction was plain: *the nutrition figures are guidance, generation
must never fail on them.*

He is right, and the product already said so. `TargetsPanel` calls the targets "an
estimate, not a prescription", derived from equations that "are right on average,
not for every person". A pipeline that then destroys a plan for missing one of
those estimates by a few per cent is contradicting its own screen — and the person
it protects ends up worse fed, because no plan is worse than a plan that drifts.

Three unlike things were being treated as one failure, and only one of them
justified the outcome:

- **Structural** — a missing day, an empty day, a missing meal. The plan is not a plan.
- **Safety bounds** — a day under the minimum energy a body needs; protein above
  `PROTEIN_CEILING_G_PER_KG`. These are not targets, they are limits.
- **Guidance** — outside the calorie band, under the protein target, a variety slip.

## Decision

**`validatePlan` reports; `isBlocking` decides.**

Structural and safety violations discard the plan, as before. Guidance violations
are **advisory**: the plan is delivered, and every advisory is recorded on it in
`generation_metadata.advisories` — which day, which rule, how far — so an operator
can still answer "why did this fortnight drift" without the user having lost it.

`protein_out_of_band` is split, because it was two rules wearing one name: under
the target is a goal missed (advisory), over the ceiling is a bound broken
(blocking). Conflating them is why a safety limit and a nutrition preference
shared a failure path in the first place.

The error copy is corrected in both languages. It said the plan "did not meet your
nutrition targets" — which is now the one thing that cannot cause it.

## Alternatives considered

- **Retry generation until a plan validates.** Spends the provider quota — bounded,
  and shared with every other user — on an outcome the tolerance defines as
  unnecessary. It also converts a fast failure into a slow one.
- **Widen the tolerances instead.** Moves the cliff rather than removing it, and
  the tolerances are honest: 10 % on energy is a real band, and a day outside it is
  worth *recording*. The problem was never the number, it was the consequence.
- **Deliver silently.** Cheaper, and gives up the ability to see drift at all. The
  advisories cost one array on a row already being written.
- **Show the drift on the plan screen.** Rejected for now: the per-day totals are
  already on screen beside the targets, so the information is not hidden, and a
  banner on a plan that is fine would read as a fault. Reconsider if users ask why
  a day looks light.

## Consequences

- Generation stops failing for the reason the owner hit. What still fails is a plan
  that is not a plan, or one that would underfeed someone or serve implausible
  protein — and those must keep failing.
- The scheduler is under more pressure than it was: tighter variety rules
  ([`0009`](./0009-rotate-reuse-per-user.md)) and a rotated pool give it less
  freedom to hit every target, which is why this surfaced now. Advisories make that
  pressure visible per plan instead of only as a failure rate.
- A plan can now be delivered that misses a target. The targets panel already
  frames them as estimates; if drift becomes common, the advisories are the
  evidence for widening the pool rather than the tolerance.
