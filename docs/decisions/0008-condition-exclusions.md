# 0008 — What a recorded health condition may change about a plan

- **Status**: accepted
- **Date**: 2026-09-07
- **Project**: docs/projects/003-trust-depth-and-polish

## Context

Phase 4 of project 003 began collecting health conditions, medications and supplements.
Collecting a condition raises an immediate question the code cannot answer on its own:
may it change the food?

[`0004`](./0004-deterministic-safety-layer.md) already fixed the outer boundary — no
dosing, no interaction checking, no condition-specific medical advice. It does not settle
the inner one. "Coeliac disease implies no gluten" is not medical advice in any meaningful
sense; it is what the words mean. "Type 2 diabetes implies fewer carbohydrates" sounds
similar and is a different kind of statement entirely: a quantity target, set with a
clinician, individualised by medication and glycaemic control.

The evidence was assembled and put to the owner in
[`condition-exclusions.md`](../projects/003-trust-depth-and-polish/condition-exclusions.md)
before anything was wired.

## Decision

**A condition may produce an automatic dietary exclusion only where avoiding the substance
*is* the definition of managing the condition — never where it is one therapeutic strategy
among several.**

Two lists, and the difference between them is the clinical one:

**Applied automatically** (`CONDITION_EXCLUSIONS`):

| Condition | Excludes | Why it qualifies |
| --- | --- | --- |
| Coeliac disease | Gluten | The treatment *is* a strict, lifelong gluten-free diet. There is no version of managing it that includes gluten. NICE NG20; Codex STAN 118-1979. |

Applied at `contains` level only. Coeliac disease does warrant avoiding cross-contamination,
but *how strictly* varies by individual sensitivity, and deciding that for someone is the
grading this layer refuses to do. The user turns trace sensitivity on in the allergy step,
where every other trace decision already lives.

**Offered, not applied** (`CONDITION_SUGGESTIONS`):

| Condition | Could exclude | Why it is only offered |
| --- | --- | --- |
| Lactose intolerance | Lactose | Most people with it tolerate *some* lactose. A hard automatic exclusion is stricter than most clinicians advise and would silently narrow every plan. NIH/NIDDK. |

Accepting a suggestion means adding an ordinary intolerance, so it lands in the list the
user already manages and can be removed the same way. Nothing becomes a restriction they
cannot see or undo. A suggestion they have already acted on stops being shown.

**Everything else produces nothing.** Diabetes, hypertension, chronic kidney disease, gout,
high cholesterol, IBS, hypothyroidism, PCOS, GERD, breastfeeding — all have well-known
dietary advice, and all of it is a quantity target or a supervised protocol. Free-text
conditions produce nothing under any circumstances: reading an unrecognised word and
deciding what it implies about someone's food is precisely the reasoning this product must
not do.

**Pregnancy stays unmapped.** The established advice is real and non-individualised, but it
is ingredient- and preparation-level food safety — raw fish, unpasteurised dairy, liver,
high-mercury fish, "undercooked" — which the allergen mechanism cannot express. Doing a
fraction of it would produce exactly the half-guarantee project 003 exists to remove. The
supervision notice carries it, which for pregnancy is the correct advice regardless of what
we filter. Handling it properly is its own scope.

## Consequences

- An approved mapping enters through the **existing allergen machinery**:
  `SafetyController.getSafetyProfile` resolves the allergen keys to ids and merges them into
  the same set a declared allergy uses. `findSafetyViolations` and `dishSafety` gain
  nothing, so there is no second path to keep in step.
- `SafetyController.getSafetyProfile` is now the **only** place a `SafetyProfile` is
  assembled. `RecipeController.generationContext` used to build its own, which meant "what
  may this user eat" had two implementations that happened to agree — until free-text
  allergies arrived and only one of them knew.
- Every automatic exclusion is **shown with its cause** on the profile: "Por tu celiaquía
  excluimos cereales con gluten de todos tus planes." A restriction the user did not ask
  for and cannot see the reason for is one they cannot argue with.
- The two maps are **pinned by test**. An addition made without a sign-off recorded here
  fails `Health.test.ts` rather than passing a review.
- Adding a condition to either list in future requires updating this record. That is the
  point of the friction.

## Alternatives considered

**A larger map, with confidence levels.** Rejected. A "low confidence" exclusion is still an
exclusion once it reaches the plate, and grading our own certainty invites treating the
grade as the safeguard.

**No map at all — every condition is supervision-only.** Tempting, and it was the shipped
state until this decision. Rejected because it is unhelpful in the one case where the
inference is not an inference: a user who tells us they have coeliac disease and is then
served bread has been failed by a product that understood them perfectly and did nothing.

**Sodium, potassium and phosphorus targets for hypertension and kidney disease.** Rejected
twice over: the catalogue holds no figures for them, and even with figures the thresholds
are individualised prescriptions.
