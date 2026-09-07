# Condition → exclusion map — the evidence behind decision 0008

> **Decided on 2026-09-07.** This document is the evidence that was assembled for the
> `owner-approves:` gate in phase 4; the decision it produced is recorded in
> [`0008`](../../decisions/0008-condition-exclusions.md), which is the authority. Kept
> because the reasoning — especially the list of things deliberately *not* mapped — is
> worth more than the conclusion.
>
> **Outcome**: `coeliac → gluten` applied automatically. `lactose_intolerance → lactose`
> offered as a suggestion the user confirms, per the recommendation below. Pregnancy left
> unmapped. Everything else produces no dietary inference.
>
> **Audience**: the owner. **Committed**: yes, so the reasoning survives the decision.

## What is being decided

Whether a recorded health condition may cause NutrIA to exclude an allergen from every
plan automatically — and if so, which conditions and which allergens.

Everything not on the approved list behaves as it does today: the condition is stored,
shown back, and raises the supervision notice. It changes no food.

## The admission rule I applied

A mapping is proposed **only** where avoiding the substance *is* the definition of
managing the condition — not one therapeutic strategy among several, and not a matter of
degree. That rule excludes far more than it admits, deliberately:

| Condition | Common dietary advice | Why it is **not** proposed |
| --- | --- | --- |
| Diabetes (1 & 2) | Carbohydrate management | A prescription, individualised to medication and glycaemic control. Not an exclusion. |
| Hypertension | Sodium reduction | Established, but a *quantity* target, and the catalogue holds no sodium figures. We cannot enforce what we cannot measure. |
| Chronic kidney disease | Protein, potassium, phosphorus limits | Highly individualised by stage and by whether the person is on dialysis. Getting this wrong is dangerous in both directions. |
| Gout | Purine reduction | Effect size is contested and it is a reduction, not an exclusion. |
| High cholesterol | Saturated fat reduction | A quantity target again, and one the existing macro targets already touch. |
| IBS | Low-FODMAP | A structured, time-limited elimination protocol run with a dietitian. Not a standing exclusion, and doing a fraction of it badly is worse than not doing it. |
| Hypothyroidism, PCOS, GERD, breastfeeding | Various | No single, universally agreed exclusion. |

## Proposed, and approved

### 1. `coeliac` → allergen `gluten`

**Confidence: high.** The treatment for coeliac disease *is* a strict, lifelong gluten-free
diet; there is no version of managing it that includes gluten. This is definitional rather
than therapeutic, which is exactly the bar above.

- NICE guideline NG20, *Coeliac disease: recognition, assessment and management* — advises
  a strict gluten-free diet for life.
- Codex Alimentarius CODEX STAN 118-1979 defines the gluten-free threshold used across the
  EU (20 mg/kg).
- The allergen row already exists (`gluten`, EU-mandatory), so this reuses the enforcement
  path allergies already take. No new mechanism.

**Note:** a user with coeliac disease would normally also tick "Cereales con gluten" in the
allergy step. The mapping matters for the ones who do not — who tell us the diagnosis and
reasonably expect the product to have understood it.

### 2. `lactose_intolerance` → allergen `lactose`

**Confidence: high, with one caveat you should weigh.** Lactose intolerance is managed by
restricting lactose; the allergen catalogue already carries a non-EU `lactose` row for
exactly this.

- NIH/NIDDK, *Lactose Intolerance* — management is limiting lactose-containing foods.

**The caveat:** most people with lactose intolerance tolerate *some* lactose, and a hard
exclusion is stricter than most clinicians would advise. It is over-restrictive rather than
unsafe, and the user can remove it — but it will silently narrow their plans, and
"NutrIA decided this for me" is a worse experience than being asked. **My recommendation:
approve it, but as a suggestion the user confirms rather than an automatic exclusion.**
That needs a small UI addition and is not built.

## Put forward for a decision rather than approval

### 3. `pregnancy` → a food-safety exclusion list

Pregnancy is the one case where an established, non-individualised list of foods to avoid
exists, and it is food *safety* rather than therapy: raw or undercooked fish and meat,
unpasteurised dairy, liver, and high-mercury fish.

- AESAN (Agencia Española de Seguridad Alimentaria y Nutrición) recommendations for
  pregnancy.
- NHS, *Foods to avoid in pregnancy*.

**Why I have not proposed it as a mapping:** it does not fit the mechanism. Those are
ingredient-level and preparation-level exclusions, not allergens, and "undercooked" is a
property of a recipe rather than of an ingredient. Implementing it properly is its own
piece of work — probably its own project — and implementing it partially would produce
precisely the half-guarantee this project exists to eliminate.

**What I would do instead, if you want pregnancy handled now:** leave it unmapped, and let
the supervision notice carry it. The notice already says the plan should be reviewed by a
professional, which for pregnancy is the correct advice regardless of what we filter.

## The decision

All three recommendations were accepted on 2026-09-07 and are in effect:

1. **`coeliac` → `gluten`, applied automatically**, at `contains` level. Trace sensitivity
   remains the user's own choice in the allergy step.
2. **`lactose_intolerance` → `lactose`, offered not applied.** It appears on the profile as
   "podemos excluir lactosa… pero no lo hacemos por nuestra cuenta", pointing at the
   allergy step where accepting it becomes an ordinary intolerance the user can later
   remove. A suggestion already acted on stops being shown.
3. **Pregnancy stays unmapped.** The supervision notice carries it.

Both maps are pinned by a test in `packages/core/src/domain/Health/Health.test.ts`, so a
future addition made without updating [`0008`](../../decisions/0008-condition-exclusions.md)
fails rather than passing quietly.

## Standing constraint

Whatever is approved here, the boundary in
[`0004`](../../decisions/0004-deterministic-safety-layer.md) does not move: no dosing, no
interaction checking, no condition-specific medical advice, and medications map to nothing,
ever.
