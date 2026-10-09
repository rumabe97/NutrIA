# 0090 — A dinner is asked only for the forms it keeps

- **Status**: accepted
- **Date**: 2026-10-09
- **Project**: docs/projects/019-balanced-plans-by-goal (phase 7)
- **Extends**: `0088`; reads `0079`'s Table 2

## Context

Prompt 4.7.0 (`0088`'s line, 2026-10-08) asks a lunch or dinner short of `POOL_RESERVE` for a
legume, a whole grain or an oily fish, worded the same at both meals except for legumes
("light, never stewed" at dinner). The paid sample of 2026-10-09 (5 plans, 65 requests,
0.0654 USD) showed the model writes every asked group — 13 of 13 plan-and-group pairs, and
all 13 of the dinner-and-group pairs among them — but `PoolBuilder` kept nothing in 6 of 24
meal cells, every one of them a dinner: `fitSlots` (Table 2 of `0079`) refuses rice, pasta,
quinoa and the other grains, and stewed pulses, at a Spanish dinner, and the 4.7.0 wording
invites exactly those dishes ("salmón con arroz integral", "ensalada templada de lentejas",
"tostas de hummus de garbanzos"). The ask and the rule that judges the dish disagreed, so the
generator spent requests and a dinner slot on a dish `PoolBuilder` would then discard as
`wrong_meal`.

## Decision

- `poolAsks` asks a dinner for a legume or a whole grain only when the request's shown
  catalogue holds a row `fitSlots` keeps there (`rowFitsMeal`, read off Table 2): a legume as
  edamame, tofu or tempeh, a whole grain as wholemeal bread, toast or a wrap. A catalogue with
  none of those rows is asked at lunch instead, where `POOL_RESERVE` already reserves them;
  nothing is asked twice. The oily-fish ask is unchanged — fish already survives a dinner —
  but its wording adds "with no rice, pasta or other grain beside it", since the grain a plate
  carries beside the fish is what `fitSlots` was refusing, not the fish itself.
- A dinner's ask of a vegan or vegetarian keeps 4.7.0's stewed, light wording for legumes
  (`PLANT_BASED_PATTERNS`): a pulse fits every meal for somebody plant-based, and `rowFitsMeal`
  already lets it through at dinner for them. Their whole-grain ask still loses rice and
  quinoa — Table 2 does not ask who eats the dish.
- `PROMPT_VERSION` moves to `4.7.1`. `Balance.dinner.seed.test.ts` runs every named form
  (`DINNER_FORMS`) through the real `fitSlots` on the real seed and its meal lists, so the
  wording and the rule are checked against the same source and cannot drift apart silently —
  a form Table 2 or a meal list starts refusing fails there, not as `wrong_meal` in a plan.

## Alternatives considered

- **Stop asking an omnivore's dinner for legumes or whole grain at all, and let lunch carry
  both** (`POOL_RESERVE` already gives dinner 2 legumes, 1 oily fish and 3 whole grain, and
  every lunch cell the sample asked kept at least one dish). Rejected for now: it gives up
  the case `poolAsks` exists for — a thin pool with nothing of a group at either meal — rather
  than asking dinner in the one form it can keep.
- **Teach `fitSlots` to keep rice, pasta and stewed pulses at dinner instead.** Rejected:
  `0079`'s Table 2 is the owner's answer for what a Spanish dinner is, measured and
  deliberately stricter than lunch; loosening it to fit a prompt's wording reopens that
  decision for a reason that is really the prompt's, not the rule's.

## Consequences

- The paid sample's dinner cells (`docs/projects/019-balanced-plans-by-goal/LOG.md`, "Phase 7
  — prompt 4.7.1") are the number this record rests on; a second, dinner-only paid sample
  against 4.7.1 belongs in the same entry once somebody with a working provider key runs it.
- The standard dinner prompt (no asks) is untouched; a dinner with asks is longer than 4.7.0's
  since it now names forms, and `PoolPrompt.spec.ts` holds the two longest combinations
  (legumes and a whole grain; an oily fish and a whole grain) to PRD 005's 55% of 3.4.0.
- `rowFitsMeal` and `PLANT_BASED_PATTERNS` are exported from `core/domain/MealFit` for
  `poolAsks` and the prompt to share one answer to "does this row survive this meal"; a third
  caller needing the same answer should read it from there rather than re-deriving it.
