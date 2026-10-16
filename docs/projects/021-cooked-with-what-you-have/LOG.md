# LOG — Project 021: Cooked with what you have

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
- **Review** — `migration-reviewer`, opus @ high, 2026-10-16: **cleared for production, no
  P0 and no P1.** Its verdict: `0066` cannot destroy or lose data, cannot fail on the rows
  production already holds, holds `ACCESS EXCLUSIVE` on `recipes` only for two `CREATE
  TYPE`s, a `CREATE TABLE`, a catalog-only `ADD COLUMN` and an FK and an index on an empty
  table, and the API build still serving requests is blind to all of it — *"it is a Friday
  migration"*. It confirmed by reading the code, not by taking the header's word, that
  `findReusable`'s bare `db.select()` lists only the columns its own build declares
  (`RecipeRepository.ts:550`), that no raw SQL under `apps/api/src` names `recipes`, that
  both hand-loaded dumps insert column-listed, and that `apps/web` touches no database. It
  also checked the snapshot chain, the cascade account deletion depends on, and that the
  repository's conflict target is the constraint the table declares
  (`KitchenRepository.ts:134`). It states explicitly why none of the three rules applies: no
  `-- reviewed-destructive:` line is needed (none of the nine patterns fires, and the
  constant default means Postgres 11+ rewrites no row), the two-release column rule governs
  *dropping* and this file only adds — with `migrate` as the **last** step of `vercel-build`,
  so the new build never meets the old schema — and the enum-rebuild rule is about *removing*
  a value, of which there is none.

  Its three P3s, all applied:
  1. **The lock paragraph told half the story.** "Milliseconds" is true of *holding* the
     lock, not of acquiring it: the ALTER queues behind whatever reader of `recipes` is in
     flight, every later read queues behind it, and `drizzle-kit migrate` sets no
     `lock_timeout`. It measured the bound rather than guessing — no `transaction(` anywhere
     in `apps/api/src/modules/{meal-plans,fixed-meals,ai}` or
     `packages/core/src/controllers/Plan`, so the wait is single statements — and the header
     now says so, including the sentence that matters later: this is wording only until a
     file also carries a data step, which is why phase 2 is a separate deploy.
  2. **One rollback case the header did not name.** An instant rollback runs no build and so
     no `migrate`, and a revert-and-redeploy applies nothing either, because this file is
     already the last entry the migrator saw — so **re-landing it needs a fresh `when`** or
     the migrator skips it in silence and a build declaring `recipes.equipment` serves
     against a schema without it. In the header now, with the same precaution for a
     migration from another branch deploying ahead of this one.
  3. **Two findings carried to later phases rather than fixed here**, both now written into
     `PLAN.md` where the phase that owns them will read them:
     `scripts/export-reference-library.mjs` names every recipe column except `equipment`
     (lossless only while every row is `'{}'`; it would export phase 2's backfilled library
     as unclassified, and at **phase 8** would land the air-fryer batch declaring nothing),
     and phase 2's verification must be **a count by appliance that sums to the row count**,
     because `text[]` lets a mis-spelled appliance through and `appliancesOf` drops it in
     silence. A note for phase 8 about `ALTER TYPE … ADD VALUE` — a value added and used in
     one transaction fails, and a deploy is one transaction — went in too.

  What it did not do, in its own words: it did not re-run the two applications reported above
  ("no statement in the file can behave differently on rows than on none"), and it did not
  read production, so *962 recipes* and *production is at 0065* remain this session's numbers
  and nothing in the verdict depends on them.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 1 — The kitchen as data, and inert (2026-10-16)

- **Executor**: opus, in-session. The phase's dispatch line names `opus @ medium` and
  `/execute-project 021 phase 1` as the route, and that is what the owner typed, so the work
  was done directly rather than handed to a `backend` subagent — which means the **effort was
  the session's**, not the `medium` a `backend` agent's definition would have carried. The one
  agent this phase required is the reviewer below.
- **Result**: done. The kitchen and a dish's requirement exist in the database and in the
  domain, and **nothing behaves differently**: no prompt, gate, filter, offer or screen
  reads either of them for a decision yet.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=database` — 7 tasks green. Core:
    4,060 tests in 140 files, of which **40 are new** (15 on the catalogue and the fold, 13
    on the repository, 12 on the controller). Database: 53 in 5.
  - `node scripts/check-migrations.mjs --drift` — *"0 new, 67 in all, journal and snapshot
    in order, schema and migrations agree"*. **"0 new" is not a verdict on `0066`**: the
    script diffs `origin/main...HEAD` and the file is still untracked, so the gate has not
    looked at it yet and will on the pull request. What it does prove here is the half that
    matters most before then — the drift check runs `generate` and the tree does not change
    ("No schema changes"), and the journal and snapshot chain are in order. The nine
    destructive patterns were run against the comment-stripped SQL by the reviewer below;
    none fires.
  - `NUTRIA_LOCAL_PG=1 pnpm --filter database migrate` **on the 1,128-dish local library**
    (not a reset — the library was dumped to the scratchpad first, outside the repository):
    applied; all 1,128 rows read `equipment = '{}'`; `kitchen_equipment` carries
    `kitchen_equipment_one_per_appliance UNIQUE (user_id, appliance)`,
    `kitchen_equipment_user_id_idx` and the `ON DELETE CASCADE` foreign key to `user`.
  - **From empty**: a scratch local database migrated `0000`→`0066` from nothing, through
    `DIRECT_DATABASE_URL` and without `NUTRIA_LOCAL_PG` (the recipe in the CI-shaped-database
    note). `recipes.equipment` is `'{}'::text[] NOT NULL`, and `enum_range` on both new types
    returns exactly the catalogue, in order. The scratch database was dropped afterwards.
  - **Dependents**: `pnpm turbo ts:check --filter=api --filter=web` — 7 tasks green, so the
    field added to `MealDetailView` and `ReusableRecipe` breaks no app. (Turbo's
    `--filter=core` does not check them, which is why this was run separately.)
  - `pnpm -w run deadcode` (knip, `--production`) and `pnpm format` — both clean.
  - `docs/local/nutria-seed-500.sql`, the file the owner reloads by hand, inserts with
    `INSERT INTO recipes (cook_minutes, ..., steps_version)` — column-listed, not
    positional — so the new column does not break his reload or `pnpm db:local reset`.
  - **A live round trip against the local database**, which a mocked repository cannot
    stand in for — a throwaway script outside the repository, one throwaway account, deleted
    at the end. Silence read as the default kitchen (`stovetop`, `oven`, `microwave` → `has`,
    the other seven → `missing`) with `described=false`; writing a stance made it
    `described=true`; **oven written twice and air fryer once left two rows**, which is
    Postgres itself accepting `ON CONFLICT (user_id, appliance)` rather than the SQL text a
    unit test asserts; a fourth `prefers` came back as
    `InputParseError {"appliance":["At most 3 appliances may be preferred"]}`; clearing the
    oven put it back to `has` and clearing an appliance nobody had spoken about changed
    nothing and threw nothing; and **deleting the account left zero kitchen rows** — the
    cascade account deletion depends on (`docs/ARCHITECTURE.md` § Privacy).
  - `migration-reviewer` (opus @ high) on `0066`: **no P0, no P1** — see **Review** below.
- **Deviations from plan**:
  1. **The phase's Scope line was amended in the same change.** Step 4 ("the recipe
     repository and `PlanController` carry `equipment` out with a dish") names files the
     Scope line did not: `packages/core/src/repositories/Recipe/**`,
     `packages/core/src/controllers/Plan/**` and `src/test/fixtures.ts`. The line now says
     so, with the date.
  2. **The three-preference bound is enforced in this phase, in `KitchenController`**, and
     not in phase 4 where the plan puts it. Phase 4's scope holds no `controllers/Kitchen`,
     and the alternative — a Nest service counting preferences and then writing — is exactly
     the read-then-compare `AGENTS.md` forbids and that a security scan found in
     `EventController.add` on 2026-09-22. It is checked **inside** the repository's advisory
     lock, against rows read in the transaction that writes, with the appliance being written
     left out of the count so re-stating a preference is never a fourth. Phase 4 therefore
     has nothing to add: it lets `InputParseError` through, and `AllExceptions.filter`
     already answers 422 with `fieldErrors`, which is PRD criterion 1's "the field named".
  3. **`MealView` deliberately does not carry equipment; only `MealDetailView` does.** The
     fortnight payload is 56 meals and phase 5 says a chip on every dish is noise, so
     nothing on a card would read it. The dish detail — PRD criterion 5 — is the screen that
     does.
  4. **`clearStance` is idempotent** rather than answering `NotFoundError` for an appliance
     nobody ever spoke about, which is how `FixedMealController.remove` answers. The
     difference is what is being named: a rule's id is somebody's and a 404 is what stops an
     id confirming another account's row exists (`0019`), while `oven` is a catalogue key
     every account shares. A "back to normal" tap that could 404 would be worse for no gain.
  5. **Part of phase 9's documentation landed here**: `packages/database/AGENTS.md` gained
     *A dish's equipment* — the column holds what a dish **cannot** be cooked without and
     never what it may use, an empty array is a dish that needs nothing, and the Postgres
     enums duplicate core's catalogue with a test that catches the drift. Phase 9 keeps the
     preference half, which does not exist until phase 3. The reason for not waiting:
     `/ship` § 2 asks for a rule in the same change as the code it governs, and phases 2 and
     8 write to this column long before phase 9 reads it. The plan's phase 9 step 2 says so.
- **Decisions**: no new record.
  [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)
  already carries every structural choice this phase implemented; the numbers it is still
  missing are phase 6's.
- **Notes for the next phase**:
  - **The default kitchen already excludes seven appliances, and phase 3 is where that
    bites.** `DEFAULT_KITCHEN` is `has` for stovetop, oven and microwave and `missing` for
    the other seven (`0102`). The moment phase 3 enforces `missing`, an account that never
    opened the screen loses every dish declaring a blender, a steamer, a grill, an air
    fryer, a pressure cooker, a slow cooker or a rice cooker. By the PRD's own reading of
    the prose that is 20 blender dishes of 1,128 here, and 45 steam plus 20 blender of 962
    in production — paid by **everybody**, not only by the people who said something. So
    **phase 6 must price the default kitchen and not only the hardest one**, and if the
    price is wrong the lever is one constant read everywhere (`DEFAULT_KITCHEN`), which
    makes it a change to `0102` rather than to a call site.
  - `appliancesOf` is the only reader of the raw `text[]` and silently drops anything
    outside the catalogue. Phase 2's migration may therefore write **only** catalogue keys:
    a typo in its pattern list is not a loud failure, it is a dish that needs nothing.
  - `kitchenOf(stances)` is the one place silence becomes a kitchen. Phase 3's
    `resolvePreferences` should take the folded `Kitchen`, never the rows, so that no call
    site can invent its own normal kitchen (`0052`'s rule).
  - Still phase 3's, untouched here: `equipment` on `CandidateDish` and
    `generatedDishSchema`, `withinEquipment` beside `withinTime`, and `insertRecipes` /
    `DishRequestRepository` writing the model's declaration — today both take the column's
    default, so a dish the model writes is unclassified until phase 3.
  - Phase 4's write path is `KitchenController.setStance(userId, { appliance, stance })` and
    `KitchenController.clearStance(userId, appliance)`; both answer the whole `KitchenView`
    (`appliances`, `described`, `maxPreferred`), so one call feeds a screen. `described` is
    false for an account that never spoke — that is phase 5's empty state, and
    `maxPreferred` is the bound a screen must say **before** it is hit.
  - **A machine that loses power mid-build leaves a `dist` both caches believe is done.**
    This phase hit it: six of the new `dist/**/*.js` files were **zero bytes** after the
    laptop died during a build, and rebuilding did not fix them. The verified cause is
    `tsconfig.build.tsbuildinfo`: it still said the `.js` were current, so `tsc` emitted only
    the `.d.ts` — **even after `dist` had been deleted**, and running the package's own build
    directly rather than through turbo made no difference. The symptom is a controller that
    imports as `undefined` from `dist`, which reads like a broken export. The repair is to
    delete `*.tsbuildinfo` **and** `dist`, then build; `find packages/*/dist -name '*.js'
    -size 0` is how to see it at all. Worth knowing in phase 6, where the evaluator reads
    `dist` and a stale one measures the previous answer (`build-core-before-measuring`).
  - **`pnpm --filter database build` before running core's tests** after any schema change:
    core's vitest aliases only core's own self-references, so `database/schema` resolves to
    `dist` and an unbuilt edit is invisible to the tests that assert against it (this is how
    the enum-drift test can pass against a stale build).
