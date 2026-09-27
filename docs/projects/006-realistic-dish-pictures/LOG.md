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

## Phase 3 — Drawing on first view, storing in Blob, the monthly cap (2026-09-27)

- **Executors**: `backend-high` (opus @ high) for steps 1–6 and the unit specs; `tests` (opus)
  for the end-to-end suite. Review: `invariant-reviewer`, no P0 or P1, both P2s closed.
- **Result**: done. The end-to-end suite runs first on CI: the local e2e database
  (Nutria-E2E) had not had migration 0042 applied, which is the owner's step.
- **Evidence**:
  - `pnpm turbo lint ts:check test`: green.
  - `gate.sh --full`: green after formatting the suite.
  - The API build's preflight passes with `@vercel/blob`.
  - The `dish-pictures` e2e suite (`apps/api/test/dish-pictures.e2e-spec.ts`) covers:
    - with the flag off, nothing is claimed;
    - an accepted picture is stored untouched at its path and served;
    - a prawn the judge sees is rejected through the real catalogue (crustaceans) and not
      stored, with 3 image calls and 6 judge calls in the ledger;
    - a failing dish is left alone for 7 days;
    - 402 and 429 release the claim;
    - at the cap, nothing is claimed;
    - four simultaneous views make exactly one image call, and a second person sees the
      same URL;
    - `picture-status` is read-only; it answers 400, 404 and 409 where it should, 404 to
      another person and to a pending-review plan, and 200 on the caller's active plan;
    - the old routes answer 404;
    - `/admin/pictures` is for the owner only.
- **Deviations from plan**:
  - The core cannot schedule Nest work. `PlanController.openMeal` returns
    `{claim, meal}` and `MealPlansService` schedules the drawing.
  - `releasePicture` is new: the cap or a key refusal gives the claim back rather than
    failing the dish.
    - The row stays `failed` with `provenance.released` and keeps `attempts`; a refused
      attempt is not counted.
    - The next open claims it at once, with no cool-off.
    - `/admin/pictures` counts `released` apart from `failed`.
  - A file with no C2PA manifest fails at once. A Blob failure fails the dish.
  - Unknown-cost floors: 0.0337 $ for an image, 0.001 $ for a judge call. A 4xx is
    recorded at 0.
  - `picture-status` requires onboarding and a dish on the caller's own visible plans.
  - The flag's audience is `signed-in`, since "everyone" is not an audience.
  - `sharp` is removed from `apps/api`.
  - The stub picture clients are never used in production (`picturesStubbed`).
  - A failing picture request never turns the meal page into a 500.
- **Known and accepted (P3)**:
  - Judge calls and drawings running at the same time can go past the cap by about one
    attempt each. That is why the OpenRouter key's own limit is required at go-live
    (phase 6).
  - A drawing whose claim was taken over leaves an orphan blob.
- **Notes for the next phase**:
  - `MealDetailView.pictureStatus` (`none | drawing | ready`) is new and required.
  - `illustrationPath` is now the absolute Blob URL.
  - Polling goes through `GET /recipes/:id/picture-status` → `{status, url}`.
  - `/admin` needs a `dishPictures` toggle (the existing flag route) and the
    `GET /admin/pictures` line.
  - `docs/legal/analisis.md` still names the removed route, for `legal`.

## Phase 4 — The meal page waits for its picture; every picture says it is AI (2026-09-28)

- **Executor**: `frontend` (opus @ medium). Reviews: `accessibility`, two passes, no P0, P1
  or P2; `legal` confirmed the strings verbatim and their placement.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui`: 14 of 14 tasks.
  - `gate.sh --full`: green.
  - 10 new unit tests in `apps/web/src/lib/picture.test.ts`:
    - the URL passes through untouched, and `DishPicture` uses no `next/image`;
    - polling every 4 s, giving up at 60 s, pausing, stopping when the page is left.
  - Local probe at 320, 390, 1024 and 1280 px, light and dark, plus 200% text, through a
    probe-only harness (a temporary patch of the server fetch and Playwright interception
    of the poll), reverted, with the marker count at 0:
    - no sideways overflow;
    - no layout shift from drawing to ready;
    - no announcement.
  - The "IA" mark measured 17.5:1 (light) and 15.5:1 (dark) on its own ground.
- **Deviations from plan**:
  - **Owner's request, 2026-09-28.** At 60rem and wider, the meal page has two columns when
    a picture exists or is being drawn: the picture on the left; the actions, the specs and
    the macros on the right. The actions are grouped (`--swap-push`) at every wide width.
    With no picture, the page stays one column, with no empty track.
  - **Accessibility P3s applied.**
    - The bare `<figure>` is `aria-hidden` while there is no picture.
    - The mark is hidden from assistive technology on the meal page, where the alt already
      carries the notice; the card keeps its label.
    - The hero's width is also capped by the viewport height.
  - The "rendered as served" test lives in `apps/web`. `packages/ui` is untouched.
  - es-ES `admin.withoutImage` changed from "sin ilustrar" to "sin imagen".
- **Known P3, left**: the card link's accessible name begins with the AI label.
- **Notes for the next phase**:
  - Phase 5 merges `agent/dish-pictures-legal/legal`, which is updated with the C2PA
    measurement and MAI removed, and applies its § 3.3 and § 4 sentences to the
    `/privacidad` and `/condiciones` dictionaries.
  - Only one agent probes at a time, with its own cookie file: one agent's cleanup once
    deleted another's probe account.

## Phase 5 — Published texts (2026-09-28)

- **Executor**: `frontend` (opus @ medium, deviating from the plan's sonnet: it already held
  the phase 4 context), after the lead merged the `legal` branch (docs/legal only).
- **Result**: done. `owner-approves`: the owner approved the es-ES wording of the four
  changed paragraphs on 2026-09-28 ("Aprobados, publícalos").
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web`: 14 of 14 tasks, including
    `i18n/legal.test`.
  - `gate.sh --full`: green.
  - The private leak patterns match nothing in the added lines.
- **What changed** in es-ES and en-GB, verbatim from `docs/legal/imagenes-de-platos.md`
  § 3.3 and § 4.2 a–c:
  - `/privacidad`:
    - the Google sentence is scoped to designing the dishes;
    - a pictures paragraph (OpenRouter → Google Vertex AI, DeepInfra's check, no
      training, the "IA" mark and the machine-readable mark) replaces the illustration
      line;
    - the Vercel line covers the pictures.
  - `/condiciones`: pictures are illustrative, and the ingredient list governs.
  - Both pages are dated 28 September 2026.
  - No version constant is bumped and no prior email is needed, per legal.
- **Deviations from plan**: the executor (above).
- **Notes for the next phase**: the privacy text says Vercel hosts the pictures "in the
  European Union". That holds only if the Blob store is created in fra1, which is step 1
  of phase 6.
