# LOG — Project 006: Realistic dish pictures, true to the recipe

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

## Phase 1 — Picture state and spend in the database (2026-09-27)

- **Executor**: `backend` agent (opus @ medium) in its own worktree. Review by
  `migration-reviewer` (opus @ high): verdict "ship", re-checked after the fixes.
- **Result**: done.
- **Evidence**:
  - `pnpm --filter database generate`: "No schema changes".
  - `node scripts/check-migrations.mjs`: 1 new migration, 43 in all, journal and snapshot
    in order.
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`: 11 of 11
    tasks. api 846 tests; `RecipeRepository.test.ts` 14 tests (new).
  - `gate.sh`: green.
- **Deviations from plan** (plan amended in this change):
  - The verification commands are `generate` and `scripts/check-migrations.mjs` at the
    repository root.
  - `model` and `prompt_version` are nullable too, because the claim inserts a row before
    anything is drawn.
  - The claim also takes over a `drawing` row older than 15 minutes (a drawing killed at
    `maxDuration`). The takeover adds one to `attempts`; only a claim after a failure's
    cool-off resets it to 0.
  - `completePicture` and `failPicture` take the claim's timestamp and match on it, so a
    drawer whose claim was taken over cannot end the newer drawing. They also carry
    `attempts`, `model` and `promptVersion`, and `failPicture` takes `now` to start the
    cool-off.
  - `recipe_image_calls.recipe_id` is nullable, `on delete set null` and indexed, instead
    of cascade: a cost ledger must not lose billed spend when a recipe goes (migration
    review, P2).
  - `hasImage` and the admin count read `status = 'ready' and bytes is not null` until
    phase 3. This keeps phase 1 a safe rollback target.
  - `saveImage` is a no-op until phase 3 deletes it.
- **Decisions**: none new (`0066`).
- **Notes for the next phase**:
  - The concurrency guarantee rests on Postgres semantics
    (`INSERT … ON CONFLICT DO UPDATE … WHERE`, READ COMMITTED, autocommit). The unit test
    pins the statement's shape against a mocked driver. Phase 3's end-to-end suite must
    prove "two concurrent reads start one drawing" on a real Postgres.
  - The rollback floor, the claim token and the attempts rule are in the plan's Hand-off.
  - Before this migration reaches production, the owner may run
    `select count(*), count(bytes) from recipe_images;` there (read-only). The delete is
    right either way. If the count is above 0, those were `0010` illustrations that were
    served, and each dish is drawn again on first view.

## Phase 2 — The image client, the prompt and the allergen judge (2026-09-27)

- **Executor**: `backend-high` agent (opus @ high, `quality-max`) in its own worktree.
  Review by `invariant-reviewer` (opus): no P0 or P1 after two rounds of fixes.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api`: 11 of 11
    tasks. api 889 tests; the DishPicture domain 88 tests, `judge.ts` 96.9% branches.
  - The health-boundary spec, with `NODE_OPTIONS=--experimental-vm-modules`: 28 of 28.
  - `gate.sh`: green.
  - Offline calibration, with no calls: the pilot's 57 recorded judge answers replayed
    against the real 930-entry seed catalogue.
    - 57 of 57 accepted.
    - The 3 wrong-recipe controls are rejected: prawns (crustaceans), octopus with feta
      (molluscs, milk), a bun (gluten).
  - The provenance check finds C2PA and IPTC on the 8 real Gemini files and on none of
    their re-encodes.
- **Deviations from plan** (amended in the plan's "As built" and in phase 3's steps):
  - **Name mapping.** The existing matcher alone is exact-only and caught 0 of 3
    controls. Mapping adds a synonym table and word-level steps.
  - **Reviewer's P1s.** The judge's `specific` flag no longer exempts a name the catalogue
    knows. Matched names are re-checked, so prawns matched to broccoli are rejected.
  - **Ambiguous foods.** They map conservatively as extras. A name that is the matched
    ingredient's own name cut short is not re-checked, so the pilot's rice-noodle dish
    still passes. `may_contain` is its own tier (oats).
  - **A bare name matched beside its fuller form is judged as its own food.** "Peanut
    butter" plus "butter", "soy milk" plus "milk", "vegan cheese" plus "cheese" are
    rejected on a milk-free dish (reviewer's P2 on the exemption).
  - **Two false rejects found by the replay and fixed.** "Spread" is now a generic word and
    "flake(s)" a descriptor.
  - **The image key** cannot be required at boot, because the switch is a database flag.
    Without the key, no client is available.
  - **Out-of-scope files.** `ai.module.ts` (the providers are registered but no route uses
    them), `redact.ts`, `turbo.json` (`globalEnv`) and the test fixtures.
  - **The health-boundary command** needs `NODE_OPTIONS=--experimental-vm-modules`.
- **Decisions**: none new (`0066`).
- **Notes for the next phase**: phase 3's steps now carry the reviewer's P3s:
  - the whole catalogue with `mayContain`;
  - a wiring test on the real catalogue;
  - a judge failure is never kept;
  - the key refusal and the cost floor;
  - the deployment rows.
