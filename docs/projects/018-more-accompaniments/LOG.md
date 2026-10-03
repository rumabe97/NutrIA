# LOG — Project 018: More accompaniments

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The batch, drafted (2026-10-03)

- **Executor**: opus @ high (`architect-018b`); the first architect was lost to a reboot.
- **Result**: done. Report [`0009`](../../reference/architecture/0009-more-accompaniments-2026-10-03.md).
  - 42 entries: Spanish 22, Asian 4, Latin 4, Arab 5, all families 7.
  - By role: 10 starch, 24 vegetable, 8 dessert.
  - No missing slugs.
- **Review (lead, owner's delegation of 2026-10-03).** Every listed entry is accepted except:
  - **picos-de-pan:** out. It is a BEDCA row, so it waits for the queued USDA re-sourcing task.
  - **caldo-de-pollo and caldo-de-verduras:** out of the batch until their allergen links exist (below).
  - **tostada-con-aceite and avellanas (breakfast only):** out. Sides are never served at breakfast (`MAIN_SLOTS`), so they would be dead entries. The existing breakfast-only rows stay as they are.
  - **espinacas-a-la-catalana (5 g pine nuts at lunch and dinner):** accepted, against the letter of `0079` answer 7. It is the nut case the phase 3 specs need, and the larder excludes it for nut allergies.
- **Safety finding, acted on in phase 2.**
  - `caldo-de-pollo` and `caldo-de-verduras` carry no allergen link. Spanish carton broths usually list celery, and the sibling rows (`pastilla-de-caldo-de-verduras`, `sopa-de-verduras-envasada`) carry it as traces.
  - Dishes in production that use them are not excluded for a celery allergy today.
  - Decision: add celery as `contains` to both rows, in the seed and through a reviewed data migration for production. The cautious reading wins on allergens.
- **Code finding, acted on in phase 2.** `itemGroups` (Accompaniment.ts) counts a food group with no gram threshold, unlike `dishGroups`: 10 g of fideos would make a side "pasta". Give it the same `FOOD_GROUP_GRAMS` threshold.
- **Phase 3 conditions:**
  - **Time first.** Paste the batch, measure schedulePlan, and stop above +10%. Prune each role before building the sets if needed.
  - **Variety.** If distinct sides per profile do not rise, add a small repetition cost for the same side within a fortnight, priced like the kind rules and measured.
  - **traditional_spanish spec.** It goes through `setsBeside` with a foreign dish.
