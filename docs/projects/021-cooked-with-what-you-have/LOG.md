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

## Phase 2 — Every dish says what it needs (2026-10-16)

- **Executor**: opus, in-session, as in phase 1 — the dispatch line names `opus @ medium`
  and `/execute-project 021 phase 2`, which is what the owner typed, so the effort is the
  session's rather than a `backend` variant's. One agent: the reviewer below.
- **Result**: done. Every one of the 1128 dishes in the development library declares its
  equipment, inferred from the prose of its own steps, and the inference is written out in
  the migration's header so it can be argued with.
- **Evidence**:
  - `NUTRIA_LOCAL_PG=1 pnpm --filter database migrate` on the 1128-dish library (dumped to
    the scratchpad first): applied. Afterwards **1128 rows, 0 empty, 0 null**, and
    **no key outside the ten-appliance catalogue** — the count-by-appliance check phase 1's
    reviewer asked for, which is what catches a typo in a pattern that `text[]` would
    otherwise swallow.
  - **Counts by appliance** (the second reading, after the review below changed three
    patterns): stovetop 1085, oven 58, blender 20, microwave 3, and **zero** for the air
    fryer, the pressure cooker, the grill, the steamer, the slow cooker and the rice cooker.
    1091 dishes declare one appliance; 37 declare two.
  - **Dish-slot pairs** for the oven: 8 breakfast / 34 lunch / 42 dinner / 7 other, against
    the PRD's independent reading of production (7 / 35 / 44 / 8). Two readings of two
    different libraries landing within one dish of each other is the best evidence the oven
    patterns are right.
  - **Idempotent**: the same `UPDATE` run again reports `UPDATE 0`. It is not a property of
    the regexes but of the `WHERE equipment = '{}'` guard, which also means a dish that
    declares its own equipment — every dish the model writes from phase 3 on — is never
    overwritten by it.
  - `node scripts/check-migrations.mjs --drift` — *"1 new, 68 in all, journal and snapshot
    in order, schema and migrations agree"*; the destructive guard accepts the file's
    `-- reviewed-destructive:` line. Database lint, types and 53 tests green; `pnpm format`,
    `pnpm -w run deadcode` and `pnpm check:leaks` clean.
  - **The export script carries the column now**, and was run to prove it rather than read:
    `node scripts/export-reference-library.mjs --from-local --source ai` wrote 628 recipes
    whose `INSERT INTO recipes (...)` names `equipment` between `difficulty` and
    `instructions`, with real `ARRAY[...]::text[]` values. (The test file was written inside
    the repository because the script resolves `--out` against the repository root, not the
    working directory; it was removed.)
  - **And on a copy, as the plan asks**: the library was dumped at `0066`, restored into a
    scratch database, and migrated there. The classification's fingerprint —
    `md5` over every id and its appliances, in id order — is **identical on both**
    (`fa50fc0a70fcacd80e0b06e11ec0b907`), with 0 empty rows. The scratch database was
    dropped. (`nutria_ci`, which is also on this machine, was left alone: it is not mine.)
  - **Production, read-only, with the final patterns** — the review's own condition, and
    the one piece of evidence the development library cannot give (standing approval for
    production reads, 2026-10-15): of **962 dishes, 0 would come out empty**; 917 stovetop,
    **65 oven**, 3 microwave, 20 blender, **1 pressure cooker**, and **zero** air fryer,
    grill, steamer, slow cooker and rice cooker. 873 declare the hob and nothing else. The
    single pressure-cooker claim was read rather than counted, and **it is correct**:
    *"Cocer las alubias blancas secas en una olla a presión con agua y la sal durante 20
    minutos"* — dried beans in 20 minutes are not possible any other way, and no alternative
    is offered. So the one dish production will hide from a kitchen without a pressure
    cooker is a dish that kitchen genuinely cannot cook. The oven's 65 against this library's
    58 is the ~91 dishes production has generated since the 2026-10-02 export.
  - `migration-reviewer` (opus @ high) on `0067`: **cleared on one condition** — see
    **Review** below.
- **Review** — `migration-reviewer`, opus @ high, 2026-10-16: **safe on production's rows
  and cannot lose data, cleared on one condition** — that it does not merge in the same pull
  request as `0066`. It verified in Postgres, rather than by reading, that `array_remove`
  plus `nullif` plus `coalesce` cannot produce NULL, an empty array or an off-catalogue
  value; that `\y` is a real word boundary here, so `cebolla` is not read as a pot and
  `cazoleta` not as a pan; that `jsonb_object_keys` over the whole library returns only
  `cue`, `minutes` and `text`, none of which any pattern can match; that `EXPLAIN` filters
  on `equipment = '{}'` before running a single regex; and that the counts reproduce exactly.
  It also established something I had asserted loosely: the development library is **871 of
  production's 962 rows by slug** — the 500 seeded dishes plus all 371 of the 2026-10-02
  export, each slug checked — so 90.5% of production's prose had already been read by these
  patterns, and ~91 rows had not.

  Two P1s and four P2s are applied; the P1 that remains is an instruction, not a change:

  1. **P1 — "it is its own deploy" was not true of the tree, and no file can make it true.**
     Only the merge order can. The header now says that plainly, and the owner's instruction
     is below.
  2. **P1 — `pnpm db:local reset` would have produced an unclassified library, silently.**
     `scripts/local-pg.mjs` replays the data-only migration `0056` after each library load,
     because a data migration that runs before the library exists has nothing to work on;
     this is the second of those and was not in the list. Left alone, every reset from today
     would have given a library in which **no dish needs anything** — and phases 3 and 6
     measure the evaluator on that library. Fixed by making the constant a list, and
     **proved by running `pnpm db:local reset --reference` end to end**: it reloaded both
     dumps, replayed `0056` and `0067` over each, and left 871 dishes with **0
     unclassified**. (The reset cost the 257 dishes the local library held beyond the two
     dumps; the 1128-dish library was restored from the dump taken before the migration and
     re-migrated, back to the same fingerprint.)
  3. **P1 — the ~91 unread production rows.** Answered by the read-only production query
     above. One row would claim an appliance the default kitchen lacks, and reading it showed
     the claim is right.
  4. **P2 — the exclusions covered only each appliance's first synonym.** `cuece las lentejas
     en olla rápida o en una cazuela normal` would have claimed a pressure cooker, and `en
     freidora sin aceite o en el horno` an air fryer — both `missing` by default, so both
     dishes would have vanished for every account. Every synonym is covered now.
  5. **P2 — one microwave claim contradicted its own prose**: *"deja atemperar los frutos
     rojos congelados a temperatura ambiente **o** dales un golpe muy breve de microondas"*.
     The alternative pattern grew a 45-character window inside one JSON string, which also
     stops an alternative in a *different* step being read as this one's. That dish now
     declares only the hob, and the three genuine microwave dishes are untouched.
  6. **P2 — the `asar` paragraph was not true of the library it cited.** The participles are
     ingredients, as I wrote; but 22 dishes use **verb** forms, and three of those name a
     tray or a temperature and no vessel — *"ásalos en bandeja a 210 grados 18 minutos"* is
     unambiguously an oven and was classified as a hob. The oven branch now reads a verb form
     within 120 characters of `bandeja` or of 150-299 degrees (the range matters: a bare
     `grados` would have caught the 21 dishes whose cue is *"75 °C en la parte más gruesa"*,
     which is a thermometer in a piece of meat). It adds exactly that one dish, verified.
  7. **P2 — the fallback's cost, as a number**: with the hob as the fallback, a kitchen that
     marks the hob `missing` keeps **43 of 1128** dishes — dinner 21, lunch 15, afternoon
     snack 12, breakfast 11, morning snack 8, supper 3 — against the 19 a slot the rotation
     needs, so no plan can be built. If the 240 no-cook dishes declared nothing instead, the
     same kitchen would keep 47 breakfasts, 28 lunches, 37 dinners, 106 morning snacks, 181
     afternoon snacks and 45 suppers: above the need everywhere. Measured here and written
     into the header, because it is the figure phase 9 needs to answer the fallback question
     and phase 4 needs to decide whether `stovetop: missing` may be offered at all.
  8. **P3s, all applied**: the header's "13 of 70 oven mentions" reproduced under no reading
     and is now the measured 59 named / 2 dropped by the alternative (the acceptance criterion
     is that the header's counts match a fresh query, and they did not); "cookable with a pan"
     was the wrong reason for the two dishes that offer *either* of two appliances — the real
     reason is that a `text[]` is a conjunction and cannot say "either", which phase 3
     inherits the moment the model is asked for the same field; the pattern list in the header
     now matches the statement word for word (`grill de carb`, `cuécel`, `cuécal`, `frita`,
     and an unaccented `frie` in the statement); and `packages/database/AGENTS.md` no longer
     says an empty array is also the answer for an unclassified dish — after this migration
     there is no unclassified row, which is a different thing from a dish that needs nothing.
  9. **Carried to phase 3, not a finding against the file**: the 20 blender dishes are all
     genuine (`vaso de la batidora`, `tritura en la batidora`) and `blender` is `missing` in
     the default kitchen, so the moment phase 3 enforces, every account that never opened the
     screen stops being offered them — including the owner's. The pools stay far above 19, so
     nothing breaks; it is a product decision (a hand blender is in most Spanish kitchens)
     that is cheaper to take now than to discover.
- **What the measurement actually found**, which is the part worth reading twice:
  **this library almost never requires an appliance.** Of 1128 dishes, 58 need an oven, 20 a
  blender and 3 a microwave — and of production's 962, 65 an oven, 20 a blender, 3 a
  microwave and 1 a pressure cooker. Nothing else needs anything — not one dish requires an air
  fryer, a pressure cooker, a grill, a steamer, a slow cooker or a rice cooker. The reason
  is not a shy pattern list; it is that **the prose offers alternatives**, and `0102` says
  the column holds what a dish *cannot be cooked without*:
  - the library's single air-fryer mention is *"Precalienta el horno **o** la freidora de
    aire"*, and its single pressure-cooker mention is *"cuece en agua con sal durante 20
    minutos **(en olla rápida)**"* — both cookable with what everybody has. Production holds
    one real pressure-cooker dish, dried beans in 20 minutes, which genuinely needs one;
  - 17 of the 20 microwave mentions are *"al vapor **o** en el microondas"* or *"en el
    microondas **o** en un cazo"*;
  - every one of the five dishes naming a grill means the **oven's** grill function
    (*"calienta el horno al máximo con la función grill"*) or an alternative to a pan
    (*"una parrilla **o** plancha estriada"*);
  - *"cuece el brócoli al vapor **o** en agua hirviendo"* and *"cuécelas al vapor **en otra
    cazuela**"* are a pot, not a steamer: one dish in 1128 names a `vaporera`, and nothing in
    production does.
  Two consequences the next phases must carry, both already in the plan:
  1. **Phase 1's warning is answered, and the answer is good**: the default kitchen marks
     seven appliances missing, and on today's library that costs **nothing at all**. The
     only two constraints with anything behind them are the oven and the blender.
  2. **Phase 8's sizing table counted words.** Its steamer (21 lunches, 23 dinners, "none
     needed — already past the cap") and its grill (18, 36, "~6 lunches") do not exist as
     requirements. Six of the ten appliances in the catalogue cannot serve one dish, which
     is `0102`'s own supply rule pointed at the catalogue: grow the supply or shrink the
     catalogue, the owner's call at phase 8. The plan now says phase 8 re-reads that table
     from `recipes.equipment` rather than from words.
- **Deviations from plan**:
  0. **Two files outside the plan's scope line, both named in it now**:
     `scripts/export-reference-library.mjs` (phase 1's reviewer finding) and
     `scripts/local-pg.mjs` (this phase's). Neither is optional — the first turns a
     classified library into an unclassified one on export, the second on reset — and both
     are in the plan's step list with the reason.
  1. **The pattern list grew a second half the plan did not ask for: an "offered as a
     choice" exclusion per appliance.** Step 1 asked for the words that name each appliance;
     applied alone they would have declared an air fryer on a dish that says *"the oven or
     the air fryer"* and taken it away from everybody without one. The exclusion is what
     makes the list say what `0102` means rather than what the words say, and it is written
     out in the header beside each pattern.
  2. **Three narrowings against the plan's own word list**, each one a dish nobody loses, each
     argued in the header from the text that prompted it: `asar`/`asado` are not oven words
     here (nearly always *pimientos asados de conserva* — an ingredient that arrives
     roasted); `plancha` is a stovetop word and not a grill (as the PRD's own reading
     counted it); and steaming without a named device is a pot.
  3. **`stovetop` is detected, not only used as the fallback.** The plan's list named eight
     appliances and made stovetop the residue. A dish that sautés *and* bakes would then
     have declared only an oven, and phase 5 shows that declaration to a person — so the
     detail screen would have been wrong about 37 dishes. Detecting it costs nothing: it is
     `has` in the default kitchen.
  4. **The fallback was left exactly as the plan says**, against the evidence, on purpose.
     The 239 dishes that match nothing are **no-cook** dishes — bagels, avocado with goat's
     cheese, carrot sticks with hummus — not the pan dishes `0102` assumed when it wrote
     *"treated as a pan, which is what 824 of 1128 are"*; the pan dishes match pan words by
     themselves, 845 of them. Declaring a hob on a bagel is harmless today (`stovetop` is
     `has` by default, and phase 5 shows nothing for a dish whose only appliance is a hob),
     and changing it is a change to `0102`. **The question for phase 9 and the owner**:
     should a dish that needs no cooking declare nothing instead?
- **Decisions**: no new record. `0102`'s rule is what the inference applies; the two
  questions it raises — the fallback on a no-cook dish, and six catalogue entries with no
  supply — belong to phase 9 and phase 8, where the plan now asks them.
- **For the owner, before this is merged**: **`0067` must not reach production in the same
  deploy as `0066`, and PR #282 is green and waiting on your merge.** Drizzle wraps every pending migration file in one transaction, so if
  both are pending at once the data `UPDATE` runs inside `0066`'s `ACCESS EXCLUSIVE` on
  `recipes` — the one lock in this pair that blocks every reader — which is the whole reason
  the backfill is a separate file. The repository's own rule covers it
  (`packages/database/AGENTS.md` § Migrations: "Release N+1 is merged only once release N's
  production deployment is `Ready`"): merge PR #282, wait for both production deployments,
  then merge this. If they do land together nothing is lost or corrupted — the UPDATE sees
  the column, since DDL is transactional in Postgres — it is readers waiting that is being
  avoided.
- **Notes for the next phase**:
  - **Phase 3 inherits a library with only two real constraints.** `withinEquipment` will
    remove an oven dish from a kitchen without an oven (57 dishes) and a blender dish from
    one without a blender (20). Nothing else it does can remove anything, so a test that
    asserts the gate works must use the oven or the blender — an air-fryer fixture would
    pass against a filter that does nothing.
  - **The model's own declaration replaces this inference, dish by dish.** The guard is
    `WHERE equipment = '{}'`, so nothing here will overwrite a dish the model classified.
    Phase 3 must make `generatedDishSchema` write only catalogue keys: an unknown string is
    dropped by `appliancesOf` in silence, which reads as "needs nothing".
  - **`0102`'s `DISHES_NEEDED_PER_SLOT` promise is the one at risk**, not the enforcement.
    Phase 6 should report the two numbers that matter — what the oven and the blender cost —
    and phase 8 should start by re-reading the real table from the column on production.

## Phase 3 — A dish nobody can cook is never served (2026-10-16)

- **Executor**: `backend-high` (opus, high effort), in its own worktree — the first phase of
  this project not done in-session. The plan deviates this phase upward to high on purpose
  ("since this changes the gate on what a model returns"), and the agent type is the only
  thing that guarantees the effort: the Agent tool takes a model but no effort, and a
  definition's own `effort:` wins. The worktree's 24 files were brought over by patch, proved
  identical to the worktree's own diff before it was removed, and the worktree and its branch
  are gone — one copy of the work, not several. The lead added the two dictionary files and
  ran the reviews.
- **Result**: done. A missing appliance is a constraint in the three places the cooking time
  is one, and a preference reaches the model and the order of the library read and **nothing
  else**.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api` — **11 tasks green**. Core:
    140 files, **4,073 tests** (13 new). Api: 123 suites, **1,656 tests**. Database: 53.
    Lint is `--max-warnings 0` on all three; Prettier clean.
  - `pnpm turbo ts:check --filter=web` — green **after** the four dictionary keys; three
    `TS7053` errors without them (see the deviation below).
  - **The preference provably removes nothing**, which is the one claim this phase had to
    prove rather than assert: a test over a 20-dish pool where 5 declare an oven asserts the
    preferred run's *set* equals the plain run's, that it still holds all 20, that the five
    oven dishes come first, and that the order differs — same seed both times, so the
    preference is the only variable. It works because `rotatePool` shuffles by seed before it
    partitions, so ordering can only happen inside `isPreferredDish`.
  - `withinEquipment` reads **`!== 'missing'`** and nothing else, so a `prefers` stance
    cannot remove a dish by construction. Its five cases use the **oven and the blender**,
    the only two appliances this library actually requires — an air-fryer fixture would have
    passed against a filter that does nothing (phase 2's note, applied).
  - **The cost of shipping this, measured on production** (962 rows, read-only): with the
    default kitchen — which is every account's, since no screen exists until phase 5 — **28
    dish-slot pairs of about 1,364 stop being offered**: 10 breakfasts, 9 afternoon snacks, 7
    morning snacks, 1 lunch, 1 supper, 0 dinners. What is kept per slot is 369 lunches, 369
    dinners, 222 afternoon snacks, 186 breakfasts, 159 morning snacks and 59 suppers, against
    the 19 a slot the rotation needs — **no pool comes near its floor, so nothing can fail to
    build**. 20 of those dishes need a blender and 1 a pressure cooker.
  - **CI cannot prove the filter works, and it is worth knowing why**: `AI_PROVIDER=stub`
    resolves to *no provider at all* (`ai.config.ts`: `case 'stub': return null`), so a suite
    builds its plans from the library alone and the dishes it holds declare `'{}'` — which
    the filter never removes. A green end-to-end run says the change broke nothing; it says
    nothing about the constraint. That is phase 7's job, on real rows.
  - `invariant-reviewer` (opus) on the whole diff: **no P0** — see **Review** below.
  - **The owner's decision on the blender, taken on the evidence** (2026-10-16): it is now in
    `DEFAULT_KITCHEN`. With it, the default kitchen refuses **one dish of 962** in production
    — the pressure-cooker beans — instead of twenty-one. Recorded in `0102` with the
    reasoning, which is that record's own asymmetry pointed at the default rather than at an
    unclassified dish: the error that costs everybody is worse than the error that costs the
    minority who can then say so, and a hand blender is in most Spanish kitchens. Every place
    that enumerated the normal kitchen was brought into step — the entity and its test, two
    domain tests, the controller's comment, `packages/database/AGENTS.md`, the schema's
    comment, the PRD, `0102` and `docs/decisions/LOG.md`. **Migration `0066`'s header was
    left alone**: it is merged and production has run it, so it is never edited, and it was
    true when it was written.
  - **Two traps, and the first attribution of them in this entry was wrong** — corrected
    here because a reader would otherwise learn the wrong lesson. (i) Putting the blender in
    the default kitchen broke **two specs that asserted the old missing list**:
    `PoolPrompt.spec.ts`, which was updated with it, and `apps/api`'s
    `health-boundary.spec.ts`, which was **missed** and was the single api failure in the
    run after the change — the implementer found and fixed it, not a rebuild. The lesson is
    that `DEFAULT_KITCHEN` is asserted in more places than the file that defines it:
    `grep -rl DEFAULT_KITCHEN` before changing it. (ii) Separately, `PoolPrompt.spec.ts`
    *also* failed once after being correctly updated, and that one **was** the stale `dist`
    `build-core-before-measuring` describes — `apps/api` reads `packages/core` from `dist`,
    so the spec was right and the build was old. Final state, re-run after both: **17 tasks,
    api 123 suites / 1,657 tests, core 4,073, web 295, ui 490, database 53, all green**, and
    the full gate green including coverage, the web build and the leak check.
- **Review** — `invariant-reviewer`, opus, 2026-10-16: **no P0.** Nothing here exposes a
  person's data, no health data and no free text reaches the model, and no preference removes
  a dish from the library. What it established by reading rather than by trusting: `prefers`
  reaches exactly one predicate (`isPreferredDish`), used by a stable partition and as a sort
  key, never as a filter; the only stance comparisons in non-test code are `!== 'missing'`,
  `=== 'missing'` for the log line, and the `prefers` bound in the controller, so nothing
  reads "not `has`"; the kitchen is read once, folded once and resolved once, and
  `BuildPoolInput` now *omits* `kitchen` so a caller cannot hand the prompt a different
  kitchen from the gate's, which is the right shape for `0052`; `withinEquipment` is an `&&`
  term **after** `dishSafety` in both chains and after the allergen branch in
  `whyNotFixable`, so it can neither let through what safety refuses nor reorder anything
  ahead of it; the two prompt lines interpolate `APPLIANCES` keys and nothing else; and a
  professional still reaches a client's kitchen only inside `CareController.withClient`, with
  the audit row that writes.

  It also answered the question I most wanted answered — **can a generation fail rather than
  degrade?** No: every rescue path widens through `reusablePool`, `PoolBuilder` floors the
  fresh ask, and the event rebuild has no model and already degrades. A thinner library means
  more model dishes, not a refusal.

  Its findings, and what became of each:
  1. **P1 — the prompt gave the model a reason to under-declare. Fixed.** The constraint line
     said *"never list one in `equipment`"*, and the gate reads that self-report: a dish that
     hides its oven is not rejected, it is **stored in the shared `recipes` table** with a
     declaration migration `0067` can never correct, and then served to every other account
     whose kitchen lacks an oven. The clause is gone, the reason is written where the line is
     built, and a new spec asserts the prompt never asks for an appliance to be left out.
     An honest declaration costs one rejection; a silent one costs every account that dish.
  2. **P1 — a standing fixed meal whose dish needs a missing appliance stops being honoured
     silently. Carried to phase 4, measured first.** The generation restores pins from the
     *filtered* pool while `standing()` keeps listing the rule. Production the same day: **1
     standing rule in all of production, and 0 that the default kitchen drops** — so it is a
     mechanism, not an incident, and phase 4 is where it becomes possible, because until
     there is a route nobody can say "no oven". The plan now asks phase 4 for the reviewer's
     recommended answer: keep the drop and say why in `standing()`, per `0011` § 2.
  3. **P2 — the refusal's wording claimed the person had said something. Fixed.** Nobody can
     have said anything until phase 5, and after the blender decision the default refuses one
     dish. Both dictionaries now read *"Necesita un electrodoméstico que no hay en tu
     cocina"* / *"It needs an appliance your kitchen does not have"*, which is true before
     and after the screen exists.
  4. **P2 — the plan's phase 6 said the default kitchen costs nothing. Fixed, and it was the
     most useful finding after the P1s**: the blender was one of the seven and 20 production
     dishes need it. Phase 6's step now carries the measured numbers and a warning the
     reviewer found on its own — the evaluator already prices the default without being told
     to, because `nobodysContext` reads a random id and so gets `DEFAULT_KITCHEN`, which means
     **its numbers move with this merge** and an earlier baseline is not comparable.
  5. **P2 — the preference's claim was wider than the code, and P3's two stale counts:
     already correct in the tree.** The reviewer read an earlier snapshot of the worktree;
     verified rather than trusted, `Rotation.ts` already says the preference takes nothing out
     of the library *and* that the per-slot cap moves which dishes are taken, and its test
     already covers a cap below the library size. Nothing to change.
  6. **P2 — a dish request for a blended dish would always have failed. Answered by the
     blender decision**, which is what makes it cookable for everybody again.
  7. **P3 — `wayForward` owes the new reason a route. Carried to phase 5**, where the kitchen
     section that the route points at will exist; the plan says so.

  **The reviewer then withdrew half of its own P1, and the reason is worth keeping**: it had
  offered, as one way to stop a pin being dropped silently, restoring pins from the
  *unfiltered* library. That would force an allergen dish onto a plate — `libraryAndPool`'s
  unfiltered half applies no safety filter, and a pin is a forced candidate, not a ranked
  one. The implementer had already refused it for exactly that reason. **Never restore a pin
  from the unfiltered library**, and the comment at `PlanGeneration.service.ts` now says so
  where somebody would try it.

  What the tree does instead, and the reviewer judged it better than what it asked for: the
  generation and the event rebuild each **log** every pin they could not honour, covering all
  the ways a rule becomes unhonourable — the season, a dish dropped from the catalogue, a
  cooking time lowered under it, and now a kitchen — rather than a kitchen-only mechanism.
  Telling the *person* is one sentence on phase 5's screen for all of them, which is why it is
  carried there rather than special-cased here.

  **A process note, because it changes how a worktree should be brought back.** Those two
  warn blocks are in `PlanGeneration.service.ts` and
  `apps/api/src/modules/events/services/PlanLoadRebuild.service.ts`, and they are in **none**
  of the three patches taken from the worktree: the implementer wrote them straight into the
  main checkout after its worktree had been removed and before it was stopped. So "bring the
  changes over, then remove the worktree" is not enough to know what a phase contains —
  `git diff --name-only` against the patch's own file list is, and it is what found this.
  Both files were read in full before this was called done; they are coherent, cite `0102`
  and `0097`, and the gate ran with them in the tree.
- **Deviations from plan**:
  1. **Five scope lines the plan did not name, all amended in the same change**, each
     unavoidable: `entities/Plan` (the pool and `whyNotFixable` need the declaration;
     `AiCall`'s union is the only place a rejection reason can be recorded), `domain/Variety`
     (where the preference can order without removing), and the two inserts
     (`PlanRepository`, `DishRequestRepository`) so a dish the model writes is classified from
     the start. The plan was incomplete here, not wrong.
  2. **Four `apps/web` dictionary keys, which the plan gives to phase 5.** Widening
     `NotFixable` and `DishRejection` breaks `pnpm --filter web ts:check` in three places that
     index by the reason, so the words had to land in the same change or the repository would
     be red between phases. `reasons.missing_equipment`, `reasonFix.missing_equipment` and
     `rejection.missing_equipment` in both dictionaries — *"Necesita un electrodoméstico que
     dijiste que no tienes."*, *"Revisar tu cocina"*, *"sin electrodoméstico"*. **Phase 5 still
     owns the screens, the design review and the final wording.**
  3. **`Kitchen | null` rather than an all-`has` constant**, mirroring `withinTime(dish,
     limit: number | null)`. It keeps two silences apart: a *person's* silence is
     `kitchenOf([])`, folded once in the controller, while a *caller's* omission — a spec, a
     script — is "no constraint". So there is no second kitchen constant anyone could mistake
     for a real one.
  4. **The prompt's unconditional line was cut from ~225 to ~131 characters** because PRD
     005's budget test read **0.5502** against a 0.55 ceiling with the long wording; it now
     reads ~0.5465. That is about forty characters of headroom for the next sentence anyone
     adds to the prompt — a number phase 8's prompt work needs.
  5. **`missing_equipment` is deliberately not in `AdminController.PERSONAL_REJECTIONS`**, on
     the `over_time` precedent: how somebody cooks is not the health or religious fact
     `allergen` and `unwanted` are. `AdminController` is unedited, and that is the decision
     rather than an omission.
- **Decisions**: no new record. `0102` is what this enforces; `PROMPT_VERSION` moved 4.8.0 →
  **4.9.0** with its history paragraph, and `STEPS_VERSION` stayed at 2.8.0 because nothing
  about how steps are written changed — a library-wide rewrite is not being asked for.
- **The product decision this phase raised, and the owner's answer**: until phase 5 ships a
  screen every account has the default kitchen, so whatever that kitchen lacks is lacked by
  everybody. With the blender missing from it, 20 dishes — smoothies, creams and purées,
  mostly breakfasts and snacks — would have stopped being offered to every account including
  the owner's, with no way for anybody to say otherwise. **He put the blender in**
  (2026-10-16), on this record's own asymmetry: the error that costs everybody is worse than
  the error that costs the minority who can then correct it. So what the constraint actually
  refuses in production today is **one dish of 962**, the pressure-cooker beans — which is
  the honest size of this feature until phase 8 grows the supply, and is written into `0102`
  as such.
- **Notes for the next phase**:
  - **Phase 4 inherits a decision it should make in the same breath**: whether
    `stovetop: missing` may be offered on the screen at all. Phase 2 measured that a hob-less
    kitchen keeps 43 dishes of 1128 and cannot build a plan, so a person who ticks it gets a
    generation that fails rather than a plan that is odd.
  - **The route owes a way forward for the new reason**: it is `actionable`, so the screen
    must offer one, and the dictionary already says *"Revisar tu cocina"* — which only means
    something once phase 5's kitchen section exists to link to.
  - **Phase 7's end-to-end suites are what prove the constraint**, and the trap is the one
    above: a suite whose dishes declare `'{}'` passes against a filter that does nothing. A
    suite must write a dish that declares an oven or a blender and then assert it is refused
    with `missing_equipment` — and that it is offered to an account that has the appliance.
    The two existing assertions on `notOffered` are in `apps/api/test/fixed-meals.e2e-spec.ts`
    and `apps/api/test/dish-request.e2e-spec.ts`.
  - **Phase 6's evaluator flag** now has `withinEquipment` and `resolvePreferences`' `kitchen`
    to read, so it needs no second idea of the rule — and phase 2's measurement says the only
    two numbers it can report are the oven's and the blender's.

## Phase 4 — The API asks, stores and answers (2026-10-16)

- **Executor**: `backend` on **sonnet**, in its own worktree — the plan's routing for this
  phase ("mechanical from a complete contract"), and the first phase of this project not run
  on opus. The lead made one design move afterwards, brought the work over by patch, and
  verified the file set against the patch's own list before removing the worktree.
- **Result**: done. A person can describe their kitchen through the profile and through an
  onboarding step, and **neither is required**: an account that never opens it finishes
  onboarding, generates a plan, and reads as the default kitchen.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api` — **11 tasks green**. Core:
    **4,084 tests** (11 new). Api: 123 suites, **1,666 tests** (10 new). Database 53.
  - The skipped step is covered where it is cheapest to assert: with the seven required
    steps completed and no kitchen, `missingSteps` is empty and `resumeStep` points at
    `review`.
  - The route's refusals are covered end of to end of the DTO: an appliance outside the
    catalogue, an unknown stance and a repeated appliance are 422 with the field named; a
    fourth `prefers` reaches the route as the controller's own 422 (`fieldErrors.appliance`)
    **with the other preferences unwritten**, because the kitchen is applied first.
- **What the agent found that the plan had not**, and both are worth reading:
  1. **A batch needs an order.** Somebody swapping their preference from the oven to the air
     fryer sends both changes in one body; written in the order they arrive, the new one
     meets the old one still standing and is refused as the fourth. Everything that is not
     `prefers` is written first, then the `prefers`.
  2. **`resumeStep` was computed in a way that only held while `review` followed the
     required steps directly** (`REQUIRED_ONBOARDING_STEPS.length + 1`). With an optional
     step in between it would have sent a returning person **to the kitchen instead of the
     review**. It now reads `review`'s own position. That is a defect this phase would have
     introduced and the agent repaired in passing.
- **The move the lead made, and why**: the agent put `applyKitchenChanges` in
  `controllers/Onboarding/` — "where a list of changes first arrived" — and `ProfilesService`
  then imported it from there, so the profile route depended on the onboarding module for
  something that is not onboarding. It is now `KitchenController.applyChanges`, and
  `kitchenChangesSchema` moved to `entities/Kitchen` beside the bound it has to respect. The
  argument is that **the order a batch must be written in is a fact about the bound on
  `prefers`**, so it belongs where the next caller sending a batch will look for it. The
  agent was asked before the move rather than after, agreed, and listed what it touched; it
  had flagged the placement itself.
- **Deviations from plan**: the three scope lines above, amended in the same change. Nothing
  else: the bound was **not** re-implemented at the route (phase 1 already enforces it inside
  the repository's lock, and a count at the edge would have been the read-then-compare the
  repository's rules forbid), `DEFAULT_KITCHEN` was not touched, and `apps/web` was left
  alone.
- **Decisions**:
  - **The refused field is `appliance`, not `kitchen`.** It is the name the controller gives
    the thing it refused, and a screen needs to know which appliance — the DTO's field name
    would say less.
  - **A refused change leaves the earlier ones written.** There is no transaction spanning
    the batch, and the state it leaves is the one somebody reaches by pressing the appliances
    one at a time.
  - **`totalSteps` goes from 9 to 10 and `review` moves from position 8 to 9.** Safe for
    people mid-onboarding, which was checked rather than assumed: `completedSteps` stores
    step **names**, `missingSteps` is recomputed from them, the new step is optional so it
    never appears there, and the stored `currentStep` only ever grows and is clamped to the
    list's length. Nobody is sent back to a step they finished.
- **Notes for the next phase**:
  - **Phase 5 inherits a contract change**: the onboarding flow reads the step list and
    `totalSteps` from the server, so the screen count shifts by one and a kitchen screen
    belongs between `cooking` and `review`.
  - **`/privacidad` has to name the kitchen**, and the plan now says so in this phase's
    successor rather than here: its *"Qué datos recogemos y para qué"* list is enumerative
    and the kitchen is in none of its entries. It is phase 5's because that is when a person
    can actually give it to us — until a screen asks, nothing is collected. The same read
    found that **`cookingTimeMinutes` has never been named there either**, which is older
    than this project and worth the `legal` agent's eye in the same pass.
  - **For `tests` (phase 7)**, the cases the agent would write, none of which it ran: the
    skip path end to end (seven steps, no kitchen, `complete` succeeds, a plan generates,
    the profile reads the default with `described: false`); the step saved and re-saved
    idempotently; `null` taking a stance back; the bound (a fourth refused with the earlier
    stances kept, re-stating an existing preference never being the fourth, a swap in one
    body succeeding, and **two concurrent PATCHes each adding a different `prefers` at two
    leaving at most three** — the lock test); the shape refusals writing nothing, including a
    bad kitchen beside a valid `cookingTimeMinutes` leaving the time unchanged; and ownership
    — account B's stances never in account A's profile, a `userId` in a body ignored.

## Phase 5 — The screen somebody describes a kitchen on (2026-10-16)

- **Executor**: `frontend` (opus) for the screens, in its own worktree; `legal` (opus) for
  the wording `/privacidad` owes; `accessibility` (opus) for the review the plan's
  verification line names. The lead brought the work over, applied the legal text, ran the
  probe, applied every P1 and P2, and split two findings into phases of their own.
- **Result**: done, **pending the owner's verification on an iPhone**, which is this phase's
  `human-verify` gate and the one thing none of the four of us can stand in for.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=web --filter=ui` — 14 tasks green. Web: 35 files,
    **298 tests** (3 new). Ui 490, core 4,084, database 53.
  - **`/local-probe`**, both languages, 320 / 390 / 1280, light and dark, signed in:
    `/onboarding/8` and `/perfil` **200 everywhere, zero sideways overflow**. The two
    `under 44px` hints on `/perfil` are the fixed-meal day and slot `select`s and pre-date
    this change. At 320 the three chips wrap to two lines per appliance (a 4,550 px page);
    at 390 they fit on one.
  - **What the screenshots showed that the lines could not**: an unanswered row carries
    *"(por defecto, sí/no)"* beside the appliance **with no chip chosen**, so a silent
    kitchen does not read as ten answers somebody gave; the hob's *"No tengo"* is dashed and
    dimmed with its reason underneath (*"Todos los planes dan por hecho un fuego: sin él no
    podríamos construirte ningún plan"*); and with the bound spent the line reads *"Ya
    prefieres 3. Quita una para poder elegir otra."* with **every other `Prefiero` dashed**.
  - **The language is a cookie, not the URL** — `/en/perfil` is a genuine 404, the `/en`
    tree is public pages only. Seen by setting `nutria_locale=en-GB` on the probe's session,
    which is worth knowing for every future probe of a signed-in screen.
  - **Not seen, and it matters**: `/plan/comida/[id]`, the dish detail with the appliance
    icons. A probe account has no meal plan and the stub provider writes nothing worth
    looking at, so **the icons have never been rendered in a browser**. They are reviewed as
    code and they are the first thing to look at on the owner's device.
- **The three reviews**:
  - **`apple-web-design`: PASS**, no P0 or P1 left. It found and fixed a real P1 in passing —
    a chosen `ChipGroup` chip's only surviving cue under `forced-colors: active` was its font
    weight, so the chosen chip vanished with the palette. That fix reaches the cuisines, the
    intolerances and the dietary patterns too.
  - **`accessibility`: ships after one P1 and two P2s**, all applied. The P1 is the one that
    matters on the owner's own device: **thirty radios whose accessible name was only
    "Tengo" / "No tengo" / "Prefiero"**, the appliance living solely in the `fieldset`'s
    legend. Read linearly that is fine; swiping control to control, or using the
    form-controls rotor — which is how a form is filled on a phone — it is ten
    indistinguishable triplets. Fixed with an `ariaLabel` on the chip, `"Horno: Tengo"`, the
    visible label unchanged so Label-in-Name still holds. It also measured what this phase
    was most likely to get wrong and found it right: ten distinct named groups, nothing
    announced as an answer nobody gave, the hob focusable with its reason as its
    description, the live region firing only on a change, 44 px targets, contrast 4.90–17.9:1
    on text and 3.15–3.65:1 on borders in both schemes, reduced motion honoured.
  - **`legal`: the kitchen must be named, in its own bullet**, and *"Tu forma de comer"* must
    not be stretched to cover it — that entry is quoted by the special-category section and
    by the art. 9.2.a consent paragraph, so folding the appliances in would tell a reader
    they sit under the health consent, which the code does not do. Basis 6.1.b, no art. 9, no
    art. 22, **no consent version bumped and no notice mail** (a bump would send every
    account back through a blocking health-consent screen for a datum that is not health).
    The wording, its sources and the publish conditions are in `docs/legal/`.
- **A live gap this phase closes, and it was mine**: phase 4 added the step server-side, so
  `resumeStep` answered **9** while the shipped web pinned `TOTAL_STEPS` at **8** and
  `[paso]/page.tsx` 404s above it. Two places redirect by `resumeStep`, so **a new account
  that finished the seven data steps and came back landed on a 404**. Production had 8
  accounts in onboarding and 0 unfinished, so nobody was in that state — but it was
  reachable from the moment #285 deployed. `frontend` found it, and its `steps.test.ts` pins
  `FLOW` against `ONBOARDING_STEPS` **by index**: the two lists being in the same order was
  never checked by anything.
- **A second live gap, found by reading rather than by running**: `/privacidad`'s *"Lo que
  recibe el modelo"* paragraph has been short since #284, because prompt 4.9.0 sends the two
  kitchen lines for **every** account. Not false and nothing in its "nunca" list is broken —
  incomplete, about data reaching a processor abroad. It ships with this phase.
- **Deviations from plan**:
  1. **Step 4 (a standing rule that is no longer honoured) was taken out of this phase** into
     **phase 5b**, before the work started, because `FixedMealController.standing` is three
     cheap parallel reads on a screen people open often and answering honourability needs a
     generation context per call. That is a latency decision, not a sentence.
  2. **`MealShapePicker`'s missing `forced-colors` block was fixed here**, on a screen this
     phase does not touch: its chosen state was expressed only in colours, which that mode
     erases, and unlike `ChipGroup` it had no weight change either — so **the meal size
     somebody picked was invisible in high contrast**, live. Four lines, and the same defect
     had just been fixed next door.
  3. **The onboarding card clips at the browser's 32px font size** — measured, and declined
     by both agents as not this phase's: steps 2, 5, 6, 7 and 8 all reach x=403 in a 390px
     viewport with the document's overflow at 0, step 4 reaches 497, `/onboarding/9` and
     `/perfil` are clean. It is the card's floor, it is older than this project, and fixing
     it is a change to seven screens. **Phase 5c**, with the numbers, so it cannot die in a
     message. This phase put `min-inline-size: 0` on the kitchen's own rows so they can never
     be what sets that floor.
- **Decisions**:
  - **`stovetop: missing` is offered and explained, not hidden**: the chip is rendered,
    `aria-disabled`, focusable, with the reason beside it. Phase 2 measured that a hob-less
    kitchen keeps 43 dishes of 1,128 and cannot build a plan, and phase 4 left the question
    open.
  - **The profile does not edit the kitchen in place.** It is a read-only section with one
    edit link to the step. The bound, the hob rule, the default-as-default rendering and the
    only-send-what-changed diff are four rules; a second editor would be a second copy of all
    four, and `ProfileSection`'s own doc states that rule for every other block on that
    screen. **So the web never sends `kitchen` on `PATCH /profile/preferences`** — phase 7
    should assert that route as *the preferences route's* path, not the screen's.
  - **Only what changed is sent**, never ten rows: rewriting them would freeze a default that
    has to stay free to change, as the blender changed the day before this screen existed.
  - **`role="status"` alone, not paired with `aria-live`** — settled by counting rather than
    by taste: 33 places in `apps/web` use `role="status"` and exactly 2 pair it, both in
    `FixedMealPlanner`. The pairing is the outlier.
  - **The policy's words follow the screen's**: `legal` had written *"fuegos"*, the dictionary
    says `Fuego`, so the published text says *"fuego"* and the legal source carries a note
    saying why.
- **Notes for the next phase**:
  - **Phase 5b has no dictionary key to say its sentence with**, which `frontend` spotted:
    `fixedMeals.reasons.missing_equipment` is the refusal for a dish being chosen now, not a
    statement about a standing rule quietly not honoured. It needs its own words, for all
    four causes.
  - **Phase 7 owes a case no screen will ever generate**, which is exactly why a suite should:
    a `kitchen` and a `cookingTimeMinutes` in one body, where a refused fourth `prefers` must
    leave the cooking time unchanged.
  - **The probe cannot reach a dish detail.** Any phase that needs to see one needs the
    owner's dev account and his word, or a seeded plan in the local database.

## Phase 5b — A rule that is not being honoured says so (2026-10-16)

- **Executors**: `backend` (opus) as `standing-honour` for `packages/core` and `apps/api`;
  `frontend` (opus) as `standing-sentence` for `apps/web`; `accessibility` (opus) as
  `honour-a11y` for the review the phase's verification line requires. The two implementers
  never spoke: the lead carried the wire shape between them, which is why it is written out
  in full below.
- **Result**: done. A standing fixed meal the generation can no longer honour now says so,
  on the row it belongs to, with the reason and a way forward.

### The finding that outranks the feature: the record was wrong, and had been for two phases

**The season does not break a standing rule.** `FixedMealsService`'s own header has said
since project 020 that *"a rule written in June with a summer dish stops being honourable in
December without anybody being told"*, the plan repeated it as one of four causes, and it is
**false**. Measured by `backend` with a test that first pins `outOfSeasonFruit` on
`nectarina` for a January fortnight so the fixture cannot quietly stop being out of season,
and then verified independently by the lead in the scheduler:

- `honouredPin` is consulted at the top of the slot loop (`Scheduler.ts:1014`) and the
  comment beneath it says nothing below runs — not the variety gate, not the kind caps, not
  the floors.
- The season predicate lives in `seasonFor` (`Scheduler.ts:1813`), in the day search below.
- Neither `servable` nor `pinnable` filters by month; the other `outOfSeasonFruit` call
  (`Scheduler.ts:1259`) is in `pickReplacement`, the swap path.

**So a June dish fixed to a December Monday is still served.** The season reaches a rule
only when another rule shares the day, through `dayHolds`, and the sentence said then is
`clashes_with_fixed` — a mislabel, left recorded rather than machined around because naming
it costs a second mechanism. The header is corrected, the plan's goal and acceptance
criterion are amended, and **five causes produce a sentence** where the plan assumed four:
`too_slow`, `missing_equipment`, `unknown_dish` (new), `wrong_slot`, `clashes_with_fixed`.

### The latency decision, and the plan's preferred reading was wrong

The plan named three shapes and refused to pick. The numbers picked, on the local library
(1,148 recipes, 851-dish pool, medians of nine runs, core built first):

| | median |
| --- | --- |
| `standing()` as it was, and still is | **2 ms** |
| the assembly alone, no rules | 53 ms |
| honourability, one rule | **76 ms** |
| three rules on three days | 82 ms |
| two rules sharing a day | 109 ms |
| a rule pointing at a deleted dish | 58 ms |

So folding it into the profile read would have been **forty times slower on a screen people
open to look at their rules**, for an answer that is empty for almost every account — one
standing rule in all of production. **Chosen: a separate route**, `GET
/fixed-meals/honourability`, with `FixedMealsView` untouched so the profile page compiles
unchanged. Storing it at generation time was refused on **correctness** rather than cost:
every cause can change after a generation, so a stored answer is right about the last plan
and wrong about the person.

**One number changed the design.** `pinnable` with a non-empty `held` is **2.7 s** on this
pool — its own comment says "about 14 ms each" per candidate, which is true and ruinous over
851 of them. Rather than add a third caller, `dayHoldsPin` went into the scheduler: the same
last filter asked of **one** dish, **6 ms**, with a test asserting it agrees with
`pinnable`'s whole-pool answer dish by dish. That is why two rules on one day cost 109 ms
and not 5.4 s.

### The wire

```ts
type UnhonouredRule = { readonly id: string; readonly actionable: boolean; readonly why: NotFixable };
type FixedMealHonourability = { readonly judged: boolean; readonly unhonoured: readonly UnhonouredRule[] };
```

`judged: false` means **the answer could not be computed**, not that every rule is fine —
so the screen renders nothing at all rather than reassurance nobody earned.

### What the screen says, and why the words are new

Phase 5 left this phase a specific problem and it was the heart of it: `reasons.*` answers
*"why was this dish not offered when you went looking"*, and this says *"a rule you set some
time ago is quietly not being honoured, and here is what changed"*. Same cause, different
tense, different thing to do next. So `unhonouredReasons` is its own block of ten, beside
the picker's nine, which are untouched. The mark is the **word** «No se está cumpliendo»,
with the amber border third — the lesson phase 5 learned the hard way on `MealShapePicker`,
whose chosen state was colour only and invisible in forced colours.

### Verification

- `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web` green; web 14/14,
  298 tests. `apps/api/src/modules/fixed-meals/services/FixedMeals.spec.ts` is new: nine
  cases driving the real `honourability` over a stubbed context, one per cause plus the
  ordering and `judged: false`.
- **A red build was left red, deliberately and reported.** Widening `NotFixable` with
  `unknown_dish` made `t.reasons[why]` a TS7053 in `FixedMealPlanner.tsx`, in a file the API
  agent may not edit. It said so instead of reaching across, and the web agent's keys closed
  it. The lead ruled the picker's key **stays** rather than being narrowed away: `why` is
  typed `NotFixable` on the wire, so a client can receive the value whatever today's producer
  does, and a total map defends the contract while a narrowing branch defends an assumption.
- The second request is behind an `IntersectionObserver` on the rules list that fires once
  and disconnects, so the profile's first paint is untouched — the profile is a Server
  Component and `rules`/`standing` still arrive as props. A failed answer is swallowed, as
  `explain` does it, leaving the screen this phase started from.
- `apple-web-design`: **PASS**, two P1s found and fixed by the implementer, one P2, no P0.
- **`accessibility` found two more P1s and four P2s, in a browser, and one of them was the
  implementer's own fix.** All six fixed and then **re-measured on the shipped build**, which
  is the only reason the numbers below are quotable:
  - **A removal whose re-judgement failed wiped every mark**, which is the exact failure this
    phase exists to prevent: three marked rows and «Hay 3 comidas fijas que ya no podemos
    cumplir» became zero marks and only «Quitada», with two rules still unhonourable — a
    screen that had said "three are broken" saying nothing, right after an action. The marks
    are now **derived** from the rules on screen rather than replaced, so nothing can unmark
    a row but an answer saying the rule is honourable. Verified both ways with the second
    call denied.
  - **`overflow-wrap: anywhere` cost the row 2.7× its height** — 5440 px at 320 px with a
    32 px root, the text column down to **21 px**, stacking a sentence one letter per line.
  - The answer landing under the thumb (`rootMargin: '400px'`), no `forced-colors` block at
    all, the amber border at **1.80:1 in light** (9.65:1 in dark — the colour channel existed
    only in the dark scheme), and the `role="status"` sentence sitting *below* the rows while
    saying «marcadas arriba».
  - **On the shipped build**: marked row **882 px** at 320/32 (text column 164 px) and
    **692 px** at 390/32, document overflow 0; forced colours marks the border `Highlight`
    against an unmarked `rgb(0,0,0)`; the border is 5.07:1 light and 8.16:1 dark at 1 px, so
    marked and unmarked rows stay the same height; the marks land while the list is still
    360–676 px below the fold.
- **The lesson of this phase, and it happened twice in one evening**: a reasoned CSS fix was
  worse than what it replaced, both times, and both times only a number caught it. The
  implementer added `overflow-wrap: anywhere` to stop a marked row overflowing and tripled
  its height; the reviewer then told it to remove the property and, on measuring, **corrected
  its own recommendation** — without it the row is 425 px wide on a 320 px screen with the
  document's overflow still at 0, phase 5c's exact signature. What ships is the pair:
  `anywhere` **and** a row that wraps under `@media (width < 17rem)`, in `rem` so the query
  tracks the reader's font size rather than their device, inert at ordinary sizes. The three
  measurements are in the stylesheet beside the rules, so nobody re-tries either half from
  memory.
- **`/en/perfil` 404s, and that is by design, not a defect** — checked when the review
  reported it: `apps/web/src/app/en/` holds only the public tree, the signed-in app has no
  locale segment, and its dictionary comes from the `nutria_locale` cookie through
  `activeLocale()`. The English strings are reached by setting that cookie, which the
  re-probe then did.

### Deviations from plan

1. **Scope crossed twice, both amended in the plan rather than left quiet**:
   `packages/core/src/domain/FixableReason/**` for the new `unknown_dish` reason, because a
   deleted dish has no sentence without it and a second mechanism is what this phase
   forbids; and `packages/core/src/domain/Scheduler/**` for `dayHoldsPin`.
2. **Both agents worked in the main checkout**, not worktrees: a worktree has no
   `apps/api/.env`, and they were in disjoint directories.
3. **The visual pass was unspent by the implementer** and had to be unlocked by the lead:
   both agents believed a marked row was unreachable without a real account. It is reachable
   through real routes with no SQL — fix a meal (**no plan is needed**, only a non-empty
   offer) on a dish declaring an oven, then `PATCH /profile/preferences` with `oven:
   missing`. That recipe is worth keeping: it is how any "a rule stopped working" state is
   staged from now on.

### Left standing, with the owner told

- **`POST /fixed-meals/not-offered` and `POST /fixed-meals/request` still take ~2.7 s** when
  that weekday already holds a rule. Pre-existing, **unchanged** by this phase, and the
  owner confirmed he feels it. `dayHoldsPin` is the right instrument for the handful of
  dishes a search asks about and the **wrong** one for the whole offer, so the fix needs its
  own per-route measurement. Queued in `docs/ROADMAP.md` § *Next*.
- **The owner asked for a product change on 2026-10-16**: a dish the day's macros cannot
  hold should warn and be choosable rather than be refused. It revisits `0101`'s gate, it
  will need a decision record, and the wording of `clashes_with_fixed` and
  `too_big_or_small` changes with it — deliberately left untouched here. Also queued in the
  roadmap, with the consequence stated: a day built around an accepted rule comes out of
  band, which `0011` allows and the evaluator counts.

### Notes for the next phase

- **No e2e suite covers honourability.** `apps/api/test/**` is the `tests` agent's and this
  phase did not enter it. What it owes: a rule, a cause applied, the reason named, another
  account's rule absent, and `judged: false` not a 500.

## Phase 5c — The onboarding card at 200% (2026-10-16)

- **Executor**: opus, in-session. A CSS change measured in a browser rather than reasoned
  about, so it stayed where the probe runs.
- **Result**: done. **Every onboarding step is clean at 390 px with the browser's font size
  at 32 px** — "nothing past the edge" on steps 1, 4, 8 and 9, where before, every element
  of the card ran 13 px past the viewport with the document's own overflow at 0.
- **The measurement in the plan was partial, and the real one is bigger.** Sweeping every
  step at both widths found a cause the first reading had missed: **the header's "Cerrar
  sesión" button reached 606 px in a 390 px viewport on *every* signed-in screen**, including
  the ones recorded as clean. The card's own 403/497 were real but second.
- **Four causes, each measured before and after**:
  1. **The header could not wrap.** `.inner` is a flex row holding a brand, a language
     switch and a two-word button that may not break in half, with no `flex-wrap` — so
     nothing could give. Its own comment already said the row should "grow instead of
     clipping" at 200%; it only did so vertically. **606 → fits.**
  2. **A grid item never shrinks below its min-content**, and `overflow-wrap: break-word`
     does **not** reduce min-content (only `anywhere` does) — so a paragraph sat 379 px wide
     inside a 341 px form. `grid-template-columns: minmax(0, 1fr)` on `.fields` and `.row`.
     **403 → fits.** This is the finding worth carrying: the repository uses
     `overflow-wrap: break-word` widely, and it does nothing for a grid or flex item's floor.
  3. **Two buttons that cannot break sharing one row**: "Atrás" and "Continuar" are 207 px
     each at that size, in a 341 px row. `.actions` wraps now, which costs nothing at
     ordinary sizes where they have always fitted on one line.
  4. **Four meal-size pills in a four-column grid**: `repeat(4, 1fr)` → `repeat(4, minmax(0,
     1fr))`, and `min-inline-size: 0` on the `fieldset` the UA gives `min-content`. **497 →
     fits.** The pills now clip their own labels instead of the card clipping them, which is
     the lesser loss — the chosen one is still legible by position.
- **Evidence**: a sweep script in the scratchpad walks steps 1, 4, 8, 9 and `/perfil` at 320
  and 390 with the root font at 32 px and reports what reaches past the edge and whether the
  document can be scrolled to it. BEFORE / AFTER-HEADER / AFTER-FIELDSET / AFTER-GRID /
  AFTER-ALL / FINAL are in this session's record. `pnpm turbo lint ts:check test
  --filter=web --filter=ui` — 14 tasks green, web 298 tests. `/local-probe` at ordinary font
  size on steps 4 and 8 and `/perfil`, three widths, both schemes: **200 everywhere, zero
  overflow**, so nothing regressed for everybody else.
- **One change made and then reverted, deliberately**: wrapping `ProfileSection`'s head read
  like the same fix, and **measured no gain at either width** — the profile's remaining
  overflow is its card grid, not that row. A change to a shared component with no number
  behind it is not worth shipping, so it went back.
- **What is left, measured, and why it is not here**:
  - **`/perfil` at both widths**: the section head, its badge and the card root reach 415
    (320 px) and 425 (390 px). Same family, a different screen, and it wants its own look —
    the profile is one long page of cards, not a seven-step flow.
  - **The bottom navigation at 320 px only**: `343` for the link and `326` for its icon, on
    every signed-in screen. Five labels do not fit 320 px at 32 px type, and the fix is a
    design question — wrapping a fixed bottom bar, scrolling it, or dropping to icons — not
    a mechanical one. **At 390 px it is already clean.**
  - **The header is now three lines at 200%, and sticky.** Looked at rather than measured,
    which the probe's own rule insists on: at 390 px with 32 px type the wrapped row —
    brand, language switch, "Cerrar sesión" — occupies about **40% of a 910 px viewport**
    and stays there, because `.header` is `position: sticky`. Nothing is cut off, which is
    what this phase owed and what WCAG asks; whether a header should hold forty per cent of
    the screen at that size is a design question, and the honest answer is that it trades a
    clipped header for a tall one. It belongs with the follow-up below, not with a hurried
    guess here.
- **Notes**: the three above belong together in one follow-up about the app shell at large
  type: the profile's card grid, the bottom bar at 320 px, and whether the header should
  stop being sticky once its row has wrapped. Nothing in this phase touched `packages/ui`: `Button`'s `white-space: nowrap` is the
  reason the actions row had to wrap, and changing it would have altered every button in the
  product to fix one row.

## Phase 6 — What it costs, measured (2026-10-16)

- **Executor**: `plan-evaluator` (opus), as `kitchen-cost`, for the measuring. The plan
  priced this phase `opus @ high` and **`plan-evaluator` has no `-high` variant**, so it ran
  at its definition's own effort — the `/execute-project` rule for a role with no variant,
  recorded here rather than silently. The flag itself was written in-session, because
  `plan-evaluator` has no `Write` tool and the plan gives it steps 1–2: deviation 1 below.
- **Result**: steps 1, 2 and 4 done. **Step 3 is owner-gated and open** — it needs one real
  generation against the production provider, which no agent may run.
- **The answer, in one line**: a missing oven, a missing blender or a kitchen with only a
  hob costs a profile **0.2% to 10.4% of the dishes it may reuse and nobody a single day**
  — 14/14 days inside 5% on all four macros for all fourteen profiles in all four runs.
  Every number is in [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)
  § *What it costs, measured*, which is where a reader should go; the shape of it is below.
- **What was run**: four runs of `evaluate-plans.mjs` over the fourteen fixed profiles, on
  the local library (1,084 es-ES dishes), read-only, `AI_PROVIDER=stub`, no model called —
  the default kitchen, then *no oven*, *no blender*, and *no oven, no microwave, no
  blender*. **56 profile-runs, 784 days.** Not one reported a day out of band, a fall back
  to the whole library, a blocking shortfall, an allergen on a plate, a variety violation,
  a plate over its slot ceiling or a share outside its limit, and the energy floor was
  never reached.
- **The two numbers the plan asked for by name**: saying *no oven* costs 4.4%–8.1% of a
  profile's pool; saying *no blender* costs 0.2%–3.3%. And **the default kitchen costs
  nothing**, which is now measured rather than argued: a run with no kitchen at all and a
  run with the default produce identical pools, per-slot pools and days for all fourteen
  profiles, so none of 1,084 local dishes is refused by a hob, an oven, a microwave and a
  blender (production: one dish of 962, the pressure-cooker beans).
- **The one number to watch, and it is a slot**: `patron-sin-gluten`'s breakfast pool,
  **37 → 29** in the hardest kitchen, against the 19 the rotation needs per slot. The
  thinnest slot anywhere in the four runs, a 21.6% cut to a slot that was already the
  narrowest in the set, and still above the line — today. It is phase 8's argument with a
  name on it.
- **Findings**:
  1. **The flag was a silent no-op for six of the fourteen profiles**, found by
     `plan-evaluator` reading its own zeroes rather than reporting them. `contextFor`'s
     `dietaryPattern` branch rebuilds `preferences` from scratch instead of spreading
     `shared.preferences`, so `kitchen` arrived `null` — and `withinEquipment` reads null
     as "nobody asked", which is true of **every** dish. Those six would have reported a
     cost of zero that nothing had been charged. One key, with the comment that says why:
     proved with `patron-vegetariano` **549 → 543** under `--without oven`, and the eight
     unaffected profiles reproduce value for value across the fix, so the baseline did not
     move.
  2. **A kept run could not say which kitchen it measured.** `flags: []` and nothing else
     in the JSON header, while the plan keeps these files for `--compare` — so a later
     comparison against the hardest kitchen's file would have read its smaller pool as a
     regression with nothing in the file to explain it. The header now carries
     `without: [...]`, and the run prints `Kitchen: the default, without oven`.
  3. **The declared library and the prose library disagree, and the record now says so.**
     `0102`'s Context counted the appliances a dish's *steps name* (oven 68 locally); what
     the product obeys is the `equipment` column after `0067`'s backfill (oven 58), which
     only classifies a dish whose steps name an appliance **and** do not offer it as one
     choice among several. Unlabelled, a reader concludes the library lost ten dishes.
  4. **The microwave is worth about nothing** — 3 dishes, all breakfasts — so "the hardest
     kitchen" is really the oven plus the blender, which is worth knowing before phase 8
     decides what to grow.
  5. **Six of the ten catalogue appliances have no dish to reuse, the air fryer among
     them.** Read on both libraries: the declared `equipment` column names exactly four
     appliances — locally stovetop 1,041, oven 58, blender 20, microwave 3; in production
     (962 es-ES dishes, **none undeclared**) stovetop 917, oven 65, blender 20, microwave
     3, pressure cooker 1, so 89 dishes beyond the hob and no dish needing two of them.
     **Zero air fryer in either.** The plan's "1 in 1128" was the prose count; the backfill
     did not classify that dish, because its steps offer the air fryer as one choice among
     several. Step 3 is therefore a **sharper** test than the plan expected, not a muddier
     one: nothing can be reused, so every air-fryer dish in that fortnight is one the model
     wrote because it was asked to, and no filter can produce a false positive.
- **Deviations from plan**:
  1. **The script was written by this session, not by the agent the plan names.**
     `plan-evaluator` reports numbers and has no `Write` tool, and the plan hands it steps
     1–2. The division actually used: this session wrote `--without`, the agent measured
     with it, found the bug above, and the fix came back here. Nothing outside
     `apps/api/scripts/evaluate-plans.mjs` changed.
  2. **Step 1 asked for "a stance list for the harder cases" and only `--without` was
     built**, because there is no second number for it to produce: `prefers` may never
     remove a dish (`0102`), and this evaluator calls no model, so a stance of *prefers*
     changes nothing it can observe. The preference half is step 3 by construction. Step 1
     is amended in the same change to say so.
- **Evidence**: eight runs plus a header check, in this session's scratchpad under
  `.../scratchpad/kitchen/` —
  `/tmp/claude-1000/-home-ruben-Escritorio-githubProyects-NutrIA/8e5a2d68-a50c-466c-805f-46a1bfae0ff2/scratchpad/kitchen`.
  The four that count are `fixed-default`, `fixed-oven`, `fixed-blender` and `fixed-three`,
  each a `.json` and a `.log`; the four pre-fix runs (`default`, `without-*`) are kept for
  the comparison in finding 1, and `header-check.json` for finding 2. Core was built before
  measuring (`pnpm turbo build --filter=core`), which is not optional: the evaluator loads
  `packages/core` from `dist`, so an unbuilt edit measures nothing and returns identical
  numbers.
- **Notes for the next phase**:
  - **Phase 8 now has its target**: not "more dishes" but **gluten-free breakfasts that
    need no oven and no blender**, and then the six catalogue appliances with no dishes at
    all. The constraint half is nearly free on today's library; the supply half is the
    whole of what is left.
  - **Phase 7 can assert a kitchen without a model.** Every number above came from
    `resolvePreferences` and `reusablePool`, the same two the API calls.
- **The gate, step 3, and exactly what it takes.** Nothing below is an agent's to run: it
  calls a paid provider, and the environment is a choice only the owner can make.
  - **Not on his own production account.** `PlanRepository` completes the active plan in
    the same transaction that inserts the new one (`completesActive`), or cuts it short
    when the new one waits for its day — so generating there **ends the fortnight he is
    eating**, Sunday's *Bacalao al horno* included. The test is not worth a plan.
  - **Recommended: locally, against the real provider**, from the main checkout (a
    worktree has no `.env`). It exercises the same `PoolPrompt` 4.9.0 and the same
    OpenRouter route the deployed API uses, on a probe account, and nothing in production
    is written or read. The local library has no air-fryer dish either, so the denominator
    is the same zero. `/local-probe`'s `account.mjs create` makes the account and walks
    onboarding; the kitchen stance is set on the screen.
  - **The alternative, if the deployed build itself must be the thing tested**: a second
    account in production, never his own.
  1. Set **Freidora de aire** to **Prefiero** — onboarding's kitchen step, or `/perfil` →
     *Tu cocina* → the edit link on an account that has finished onboarding.
  2. Generate a fortnight.
  3. One read-only query counts the answer. Syntax-checked inside `begin read only`
     against the local database before it was written down:

     ```sql
     with latest as (
       select p.id from meal_plans p join "user" u on u.id = p.user_id
       where u.email = '<the account used>' order by p.created_at desc limit 1
     )
     select
       count(*)                                                as plates,
       count(*) filter (where 'air_fryer' = any(r.equipment))  as declares_air_fryer,
       -- Declared and named are different claims: prompt 4.9.0 no longer pays the
       -- model to under-declare, so both are counted. A fortnight that names an air
       -- fryer in six steps and declares it in two is a prompt that half worked.
       count(*) filter (where lower(r.instructions::text)
                              ~ 'freidora de aire|freidora sin aceite|air ?fry')
                                                               as names_air_fryer,
       count(*) filter (where r.equipment <> array['stovetop']::text[]
                          and r.equipment <> '{}'::text[])     as needs_something_else
     from meals m
     join plan_days pd on pd.id = m.plan_day_id
     join latest    l  on l.id  = pd.plan_id
     join recipes   r  on r.id  = m.recipe_id;
     ```

     The longer version — the denominator, the stances the account actually holds, and
     every plate with the appliances it declares — is in this session's scratchpad as
     `paso3-airfryer.sql`, four statements of the same shape, all four run.
  4. The number goes into `0102` § *What it costs, measured* under *Still owed*, and the
     phase closes. **Whatever it says**: zero air-fryer dishes is a result — it would mean
     `PREFERRED APPLIANCES:` is a line the model ignores, and that is worth knowing before
     phase 8 grows a catalogue on the strength of it.

## Phase 6 step 3 — The preference half, and the answer is zero (2026-10-16)

- **Run by the owner**, on production, from his own account — which this phase had
  recommended against, because `PlanRepository` completes the active plan in the
  transaction that inserts the new one. He chose to, and the gate is met.
- **The answer: zero.** With the air fryer marked *prefers*, prompt **4.9.0** sent
  `APPLIANCES THEY WOULD RATHER COOK WITH — use these where the dish is as good for it:
  air_fryer` to `google/gemma-4-31b-it` (CoreWeave, twelve calls, 84,996 input tokens,
  about $0.013). 21 dishes written, 9 distinct used, **none declaring an air fryer and none
  naming one in its steps**; 0 of 56 plates either way. The numbers are in
  [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)
  § *What it costs, measured*.
- **The prompt was verified before the model was blamed.** `kitchenLines()` in
  `PoolPrompt.ts` emits both lines, the metadata records `promptVersion: "4.9.0"`, and the
  rejection tally holds no `missing_equipment` — so the line went out and nothing of what
  came back was refused for an appliance. The failure is downstream of the prompt, not in
  it.
- **One thing was checked rather than assumed.** A fresh dish named *Bacalao con cuscús y
  berenjena **asada*** declares only `stovetop`, which read like under-declaration. Its
  steps say *"saltearlos … en la sartén"* throughout: **the declaration is correct and the
  dish's name is loose.** Two other fresh dishes declare nothing at all, and that is right
  too — they are no-cook dishes.
- **What the same generation proves about the other half**, which is why this is not a
  failed phase: 14 of 14 days inside 5% on all four macros, zero advisories, no allergen,
  the owner's pinned tortilla honoured on both of its weekdays — while `blender: missing`
  on that account silently kept production's 20 blender dishes out of his pool. *Does not
  have* is enforced and demonstrated in production on a real person's plan.
- **Limits of the measurement, stated rather than buried**: a dish is stored only if the
  plan used it, so 12 of the 21 written dishes are gone unexamined; the instruction is soft
  by design (*"where the dish is as good for it"*), so a model judging that nothing
  qualified is not disobeying; and it is one generation on one model.
- **What follows**: nothing to fix in the prompt yet. The library has **zero** air-fryer
  dishes to prefer, so the line is being asked to invent what the catalogue cannot show it.
  Phase 8 grows the catalogue and the line is re-measured against a library that has
  something to prefer — which is the order `0102` § *Adding an appliance to the catalogue is
  adding a promise* already argued for.

## Phase 7 — End to end (2026-10-16)

- **Executor**: `tests` (opus), as `kitchen-e2e` — the plan priced the phase `opus @ medium`
  and `tests` is the medium variant, so the routing matched exactly.
- **Result**: done. **`apps/api/test/kitchen.e2e-spec.ts`, 14 tests, green on both
  databases**: the local 1,128-dish library (24 s) and a CI-shaped one built from migrations
  plus `seed` with **zero recipes in it** (39 s). The acceptance criterion was the second
  run, and it is the one that found the design problem below.
- **No product defect.** Four phases of kitchen work hold up on real rows.
- **The finding, and it belongs to phase 8 as much as to this phase: a scripted dish cannot
  be relied on to reach the library.** `PlanGeneration.service.ts` stores a model's dish
  only if the plan **used** it (`newRecipes`, filtered by `used`), so against the
  development library two runs stored **0 and 2 fresh rows out of eighty-four plates** — the
  shared pool's days sit about 6% over protein, so a real dish wins nearly every slot. On
  the CI-shaped database 6 of 42 plates were fresh and **none of the six was one of the nine
  oven fixtures**. A suite that assumed its scripted dish would be in the library would
  therefore be green on one database and red on the other, for reasons having nothing to do
  with the kitchen.
  - **So the two halves are tested through different doors.** The nine scripted oven dishes
    test the **gate** — they are what `missing_equipment` fires on, handed to the same
    `cook` client for both accounts, so the only difference between the two generations is
    the kitchen. The **filter** is read on a **copy of a dish the account is already
    offered**, with the oven declared on it and nothing else changed (`copyDishDeclaring`,
    new in `harness.ts`): same slots, minutes, ingredients and macros, one field different,
    on either database.
- **What the suite asserts**, against the phase's four steps:
  1. **No oven dish at all** in the fortnight of an account that says it has none — asserted
     as both halves at once, because either alone passes for the wrong reason: zero oven
     plates is true of many fortnights whatever the kitchen, and a rejection tally says the
     gate fired without saying the plan came out clean. Plus, said separately so a red run
     names which half broke, that there were oven dishes in the library to be served.
  2. **The offer, both ways**: `missing_equipment`, actionable, to the account with no oven
     and 422 `fieldErrors.dishSlug` at add time, while **the same dish without the oven on
     it** stays offered to both — which is what tells the reason from every other refusal.
     The second account fixes it, and its pinned oven dinner is served on both of that
     weekday's days with the appliance on the meal detail.
  3. **`0019` again**: another account's id in the body changes nothing.
  4. **The suite brings its own dishes**, for the reason above, and asks the *table* which
     slugs declare an appliance rather than its own fixture — so it asserts something about
     the 58 oven dishes the development library already holds, and still has something to
     assert where there are none. Nine dishes, three per slot, copies of `POOL`'s shapes
     with `equipment: ['oven']`. **`POOL` itself is left alone on purpose**, and that is the
     rule to keep: every suite shares it, so an appliance declared there would narrow every
     other suite's pool.
  - **And it needs no fat source, which is worth saying because the README's trap is about
     exactly that.** `fixed-meals.e2e-spec.ts` had to bring oil-bearing dishes because
     `0101`'s second-rule offer is gated on a day the scheduler can build inside all four
     bands, and no day built from `POOL` is. Every offer this suite reads is a **first** rule
     on a weekday that holds nothing, so no in-band day is required and `PAIRABLE` is not
     needed. A suite that needs an in-band day must bring a fat source; this one does not
     need one.
- **The three things earlier phases left it, all covered**: the body no screen will ever
  send (a `kitchen` and a `cookingTimeMinutes` together, where the refused fourth `prefers`
  is 422 `fieldErrors.appliance` **and the cooking time of the same body is unchanged** —
  `ProfilesService` applies the kitchen first, so a change to that order would be a 422 that
  quietly moved somebody's cooking time); the preferences route asserted **by its own path**,
  which no screen sends a kitchen on; and no model needed for any of it.
- **And the bound's edges, which are where it would have broken**: a preference restated is
  the fourth write and never the fourth preference, a swap in one body, `null` putting an
  appliance back to the default and clearing one nobody ever set answering the same, and
  three shapes the DTO refuses while writing nothing. The three `prefers` written include
  the **oven** — the one appliance this library has dishes for — so the offered library
  coming back slug-for-slug identical is a real statement that a preference removes nothing.
- **Verification**: `pnpm --filter api test:e2e -- --runTestsByPath test/kitchen.e2e-spec.ts`
  on both databases, and re-run independently by the lead on the local library. The four
  suites nearest what was touched (`fixed-meals`, `preferences`, `generation`,
  `dish-request`) are green, 44 tests, and nothing but this suite imports any of the five
  functions added to `harness.ts`. Zero accounts and zero `kitchen_equipment` rows left on
  either database; the scratch database `nutria_ci_repro` on port 54329 is disposable.
- **Deviations from plan**:
  1. **The agent worked in the main checkout, not its own worktree.** A worktree has no
     `apps/api/.env`, and both the e2e run and the dev-database scripts need the API's
     environment. Nobody else was editing the tree.
  2. **The full 54-suite local run was stopped deliberately** and is not part of this
     phase's evidence: ~25 minutes for 2.5 suites against the 1,128-dish library, heading
     for hours on a machine that has died under load. See the blocker note below for what
     it had reported before it was stopped.
- **One thing left on the record, not this phase's and not a regression**: the stopped full
  run had reported `admin`, `owner-alerts` and `swaps` failing, and **all three pass when
  run on their own on the same database** (91 tests, 96 s) — so they are order- or
  state-dependent on a developer's rich library. CI is green on `main` for #288, which is
  the database shape those suites actually have to pass on. `admin.e2e-spec.ts`'s is worth
  naming because it is **the same root cause as this phase's design change**: its premise is
  that its own generation asked the model, so the catalogue holds model-made dishes with a
  maker — and on a rich library a generation may store no fresh recipe at all. A latent
  flake in a file the `tests` agent owns, cheap to fix, and deliberately left for the owner
  to schedule rather than folded into a phase it does not belong to.
- **Notes for the next phase**:
  - **Phase 8 must read this phase's finding before it drafts anything.** A dish is stored
    only if a plan uses it, and on a rich library a generation stores almost nothing — so
    growing the library through the pool builder cannot be verified by generating and
    looking. The five hundred seeded dishes were loaded, not generated, and that is the
    shape the growth has to take.
  - **The preference half still owes a real generation** (phase 6 step 3) and no suite can
    stand in for it: with zero dishes declaring an air fryer, a grill, a steamer, a slow
    cooker or a rice cooker in either library, there is nothing for a filter to find and the
    only question left is what the model does with the prompt line.

## Phase 8 — A library that cooks with more than a pan (2026-10-17)

- **Executor**: `backend` (opus), as this session's phase-8 agent. The plan prices the phase
  `opus @ medium`; it ran at that. The lead took every decision the phase raised and
  reversed itself once, on the record below.
- **Result**: done, and **the file is the deliverable rather than a load**:
  `docs/local/021-equipment-batch-final.sql`, **169 dishes**, `locale es-ES`,
  `source 'seed'`, `steps_version '4.9.0'`, `created_by NULL`, gitignored, with its JSON
  sidecar beside it. **The owner runs the load** — `develop` first, production after — as he
  ran the five hundred. Nothing was written to any database but the local one, and the local
  library was put back to its pre-phase 1,130 dishes when the measuring was done.
- **The answer, in one line**: eight of the ten appliances grew, one needed nothing, and
  **one cannot be expressed in this product at all** — the slow cooker, refused by a schema
  bound before its declaration is ever read. And the phase produced a number nobody had:
  asked as hard as a prompt can ask, the model declares the appliance it was steered
  towards on about **a third** of the dishes it writes.

### What was drafted, and what it cost

- **24 cells** (appliance × slot), **246 dishes wanted**, **343 model calls**,
  **0.3168 USD**. Spend read from the gateway's own `costUsd` on every call, 0 calls with
  no cost reported, and confirmed independently by the OpenRouter key's own counter moving
  **0.2622 → 0.5788 USD**. Against `AI_TEXT_MONTHLY_CAP_USD` of 5 that is **0.579 of 5**,
  4.42 remaining; the key's own wall (`0064`) is 10 USD monthly. `google/gemma-4-31b-it` via
  CoreWeave throughout, no fallback to DeepSeek needed, `--max-usd 2` never approached.
  **One disclosure for the owner**: this is `apps/api/.env`'s key, so if production shares
  it, these 0.32 USD sit on production's wall as well as on the gauge's month.
- **177 dishes were accepted and declared their appliance → 175 distinct → 169 shipped**,
  after six were struck on review (below). **341 more were accepted by every gate a
  generation runs and declared something else**, and that number is the finding.
- Per appliance, kept of wanted, with the off-target count and the declare rate:

  | appliance | cells | kept / wanted | off target | declare rate | calls |
  | --- | --- | --- | --- | --- | --- |
  | air_fryer | 3 | 30 / 36 | 40 | 43% | 42 |
  | blender | 5 | 33 / 34 | 36 | 48% | 41 |
  | microwave | 3 | 28 / 33 | 50 | 36% | 42 |
  | grill | 2 | 23 / 24 | 23 | 50% | 24 |
  | steamer | 2 | 23 / 24 | 25 | 48% | 24 |
  | rice_cooker | 2 | 19 / 24 | 32 | 37% | 36 |
  | pressure_cooker | 2 | 17 / 23 | 39 | 30% | 40 |
  | oven | 3 | 4 / 24 | 58 | 6% | 34 |
  | slow_cooker | 2 | **0 / 24** | 38 | **0%** | 60 |
  | **total** | 24 | **177 / 246** | **341** | **34%** | 343 |

- **The shortfall is stated rather than chased** (the lead, 2026-10-17): 69 of 246 not
  drafted, with ten passes exhausted on eight cells. 246 was a description of the gap and
  never a target, and another hundred calls at this prompt would not have closed it.

### The findings, which are the phase

- **`prefers` steers about a third, and phase 6 measured it at zero.** Phase 6 step 3 found
  that a *preferred* air fryer produced **no** air-fryer dish in a whole fortnight. This
  phase asked as hard as the machinery allows — the appliance marked `prefers`, every other
  non-default appliance `missing`, **and** a wish whose rendered line ends *"Every dish
  proposed must satisfy that"* — and got **34%**. So the wish moves the number off zero and
  no further: three dishes in five still come back cooked some other way. That is the honest
  size of the preference half, and it argues for supply over steering — a kitchen preference
  is worth what the library holds for it, not what the prompt asks for.
- **A slow cooker cannot be expressed in this schema, and it is not a supply problem.**
  `generatedDishSchema` bounds `cookMinutes` at 180 (`apps/api/src/modules/ai/prompts/pool.schema.ts:38`)
  and a step's `minutes` at 240 (`:94`), and `PoolBuilder.validate` parses that schema
  **first** (`apps/api/src/modules/ai/services/PoolBuilder.service.ts:541`) — before the
  catalogue, before the allergy gate, before anything reads `equipment`. An honest braise
  declares four to eight hours and is refused as `schema`; the drafts that fit inside 180
  minutes are hob stews declaring `stovetop`. **60 of the run's 79 `schema` rejections are
  that one bound** (of 211 rejections of every kind), every one a slow cooker, verbatim:

  ```
  WARN [PoolBuilder] Dish "Estofado de Tempeh y Alubias al Slow Cooker" rejected:
    cookMinutes Too big: expected number to be <=180; steps.5.minutes Too big: expected number to be <=240
  ```

  **No cooking-time preference was involved** — the script passes `maxMinutesPerDish: null`
  and `cookingTimeMinutes: null`, and there is no `over_time` drop anywhere in either log.
  The way out is not a raised constant: lifting the bound hands the dish straight to
  `withinTime`, which refuses 480 minutes for everybody who set a limit, so it needs the
  idea that an unattended cook is not time at the stove — the time-and-elaboration project
  this one left out of scope, now arriving with evidence. **The owner's choice at this phase
  is binary**: keep the catalogue entry with a zero and this reason, which
  [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md)
  § *Adding an appliance to the catalogue is adding a promise* explicitly permits, or take
  the appliance out. The plan's own row said *"~24, if it stays in the catalogue"*.
- **An oven snack is a bad snack, and the model said so 53 times out of 54.** The lead
  amended the plan mid-phase to add the oven's three cells (breakfast +4, morning_snack +11,
  afternoon_snack +9) over this agent's recommendation to skip them. Breakfast came back
  **4 of 4**; morning_snack **0 of 11** and afternoon_snack **0 of 9**, and the
  `offTargetDeclared` field says why: **53 of the 54 off-target snacks declared `none` — no
  appliance at all.** Asked for an oven snack the model writes yogurt, fruit, nuts and
  toast, because that is what a mid-morning snack is. The oven's figure in phase 6's ratio
  is therefore **not a shortfall to be drafted away**; it is a fact about what an oven is
  for, and the model's refusal was better product judgement than the amendment it was
  answering.
- **A count the run believed was larger than the file could ever load.** Run 1 reported 173
  kept and the distinct total was **171**: `crema-energetica-de-mango-y-chia` and
  `pollo-y-vegetales-al-vapor-en-arrocera` were each drafted into two cells. It cost
  nothing — `ON CONFLICT (slug) DO NOTHING` would have skipped the second insert — but the
  arithmetic was wrong and silently so. **Concurrency hid it**: cells draft three at a time
  and `PoolBuilder`'s own `excludeSlugs` only knows one build's accepted dishes, so no layer
  was in a position to see a collision between two cells. Fixed with a run-wide slug set
  (`apps/api/scripts/draft-equipment-batch.mjs:514`), and worth remembering as the shape of
  the bug rather than the bug: a per-unit dedupe inside a concurrent fan-out is not a dedupe.
- **`cleanSteps` has no notion of appliance words, and this is not a batch artefact.** The
  batch surfaced *"tostar en la air_fryer"* (a field name on somebody's plate) and
  *"en el blender"* (an English noun where Spanish has *batidora*). `StepCleanup` screens
  minutes, English **stopwords** and leaked ingredient names; an appliance is a noun, so
  both walk through — and `PoolBuilder` runs `cleanSteps` on **every production generation**,
  not only here. The lead verified it and recorded it in `docs/ROADMAP.md` with this batch's
  slugs as the evidence; it is **application code and out of this phase's scope**, so it was
  not fixed. See that entry rather than a second copy of it here.

### How the macro spread was made to happen

Not by asking the model for variety. Each pass carries **one** brief and asks for three
dishes — `DISHES_PER_REQUEST`, so one request — and the brief advances every pass, offset
per cell. The first version of the script asked for a cell's whole twelve at once, which
would have drafted every cell inside a single brief; that was the trap the plan's step 2
names and it was caught before any spend.

Seven briefs, and the result is nearly flat: `proteina-alta-3000` 31, `omnivoro-2400` 27,
`sin-gluten-2400` 26, `vegano-2000` 23, `omnivoro-1600` 21, `vegetariano-2000` 21,
`sin-lactosa-2400` 20. **A vegan brief is what actually stops thirty chicken breasts** —
the catalogue that request is shown holds no meat, so the model cannot write one.
`gluten_free` and `lactose_free` were chosen because `patron-sin-gluten` (444) and
`alergia-lacteos` (470) are the smallest pools in phase 6's table.

Per serving across the 169: kcal 162–952 (median 589), protein 5–60 g (36), carbs 6–130 g
(59), fat 4–53 g (23). **One honest weakness**: starch bases run rice 54, potato 31, pulses
27, grains 2, pasta 1 — rice and potato are over-represented, a consequence of which
appliances needed filling (rice cooker, air fryer and pressure cooker all pull that way)
rather than of the briefs.

### The validator, and the review the owner asked for

- **`--check` over the whole file: 0 problems, all 169.** Every dish passes the gates a
  generation runs, in the order it runs them: the strict schema, catalogue slugs (near
  misses repaired), the **allergy gate**, the way of eating and the dish rules, the time
  limit, `withinEquipment`, the method read back (`methodMentions`), a meal its ingredients
  allow (`fitSlots`), and last the serving ceiling (`0070`). Nothing re-implements a gate,
  so nothing can disagree with one. `0102`'s rule still holds: **no dish needs two
  appliances beyond the hob** — every pair is appliance + `stovetop`.
- **The gates do not read a name; this review did, and it found an invented word, a
  duplicate name and twelve spelling or casing defects in 171 dishes.** `--check` passed all
  171 and said nothing about any of it, because every gate in `PoolBuilder.judge` reads
  ingredients, slots, minutes, equipment and steps — never the one field a person reads most.
  The lead read all 171 names and struck *"bacalao con **huertingueras** a presión"*, which
  is not a Spanish word and which no rule can repair, and one of
  *"**Bol** de Yogur Griego con Caqui y Nueces"* / *"**Bowl** de Yogur Griego con Caqui y
  Nueces"* — the same name twice over genuinely different methods, which a person reading two
  identical names cannot know. **That is the most useful thing a future batch can learn from
  this one**: budget a human pass over the names, because nothing in the pipeline will.
- **The "tuner" the plan asks for does not exist.** No script, no history under
  `apps/api/scripts` or `scripts`; the word came into the plan from the seed project's prose.
  The four checks it stood for — catalogue slugs, the `0070` ceiling, two documented steps
  (`hasUsableMethod`), allergens resolved — are all gates in `PoolBuilder.judge`, which
  every draft went through. The lead is correcting the plan's wording.
- **Six dishes struck on review, not one of which broke a gate.** `bol-de-kiwi-y-yogur-griego-con-nueces`
  declared `microwave` and cooked nothing — the mirror of the slow cooker's problem, an
  over-declaration that withholds a cold yogurt bowl from everybody who said they have no
  microwave. `crema-fria-de-bacalao-y-patata` and `crema-untuosa-de-bacalao-y-coliflor-con-croutons-integrales`
  blend **raw desalted cod**, the first serving it chilled with nothing cooking the fish at
  any point: the lead's reasoning is that *esqueixada* is real but a cured-raw dish is
  something a person **chooses**, and this library's dishes are **assigned** by a scheduler
  on a Tuesday. `crema-espesa-de-…` was the second of two near-twins separated by an
  adjective. Then two more, from the lead's read of the **names**:
  `bacalao-con-huertingueras-a-presion`, whose name holds an **invented Spanish word** no
  rule can repair and whose method is muddled besides — step 5 closes the pressure cooker
  for one minute, step 6 programmes it, step 7 turns off the hob — and
  `bol-de-yogur-griego-con-caqui-y-nueces`, the *Bol* of a *Bol*/*Bowl* pair carrying the
  same name over two genuinely different methods. The *Bowl* was kept because it warms the
  **caqui**, which is what a microwave does well, where the *Bol* warms the Greek yogurt,
  which can split. All six return with one `--merge --exclude` edit if the owner wants them;
  the cod is his call and not an agent's.
- **Three rules applied on the way out, all deterministic and all printed in full** (88
  changes in the merge log), because a rule the machinery applies is the machinery doing
  its job and a hand-edited recipe is not:
  - **54 appliance-word substitutions** — `APPLIANCES` enum keys in any spelling plus the
    English noun `blender`, each to its Spanish name, **and nothing else**: not `oven`,
    `microwave` or `steamer`, and emphatically not `grill`, which is a real Spanish word
    (*el grill del horno*) where a blanket table would introduce errors in the place it was
    meant to remove them. **The part worth keeping is the gender agreement**: *"en el
    blender"* becomes *"en la batidora"* and not *"en el batidora"*, and *"la cesta del air
    fryer"* becomes *"la cesta de la freidora de aire"*. Verified after: **0 dishes have an
    English or keyed appliance word left in step text.**
  - **One equipment addition.** A pot or a pan named in a step is a hob the dish cannot be
    cooked without, so `buda-bowl-de-tofu-y-edamame-en-arrocera` went from `rice_cooker` to
    `rice_cooker+stovetop` — its step 2 is *"saltearlos en una sartén"*. **Under-declaring
    is the dangerous direction**: over-declaring withholds a dish, under-declaring hands
    somebody a dish their kitchen cannot cook. The rule fires on a **vessel** (*sartén*,
    *cazo*, *cacerola*, *olla*, with the pressure and slow cookers excluded so they cannot
    read as a plain pot) and deliberately **not** on *fuego*. Across 171 it fired **once**,
    which is the right number — `WISH_TAIL` had already got it right everywhere else.
  - **33 name normalisations**, after the lead's read, each one a normalisation and not a
    rewrite — and **a renamed dish's slug is regenerated** through `PoolBuilder.slugify`'s own
    formula and re-checked for uniqueness against the library and the batch, which is only
    possible because nothing has been loaded yet. A trailing *"al Aire"* on a dish declaring
    `air_fryer` became *"en Freidora de Aire"* (5 dishes): the same clipping as *"la
    air_fryer"* in the steps, where *"Tostas Crujientes de Pavo y Pera al Aire"* means nothing
    in Spanish. Then spelling — *Sesamo* → *Sésamo*, *Curcuma* → *Cúrcuma*, *Sandwich* →
    *Sándwich*, *Témpeh* → *Tempeh*; agreement — *"alubias blanca"* → *"alubias blancas"*,
    and *"al Cúrcuma"* → *"a la Cúrcuma"*, which was found only because adding the accent made
    the wrong article visible; and Spanish title case over 22 sentence-case names, keeping *y*,
    *de*, *del*, *con*, *al*, *a la* and *en* lower. ***Bowl*, *Smoothie Bowl*, *Buda Bowl* and
    *al Air Fryer* were left alone** — ordinary usage in Spain, and "correcting" them would be
    the naming-convention mistake this batch already made once.
- **The detector's own noise is on the record.** Five of the seven `hobWithoutStovetop`
  advisories were **false positives**: a grill dish's *"a fuego medio-alto"* is the grill's
  own heat, and `grill` alone is correct on all five. The patterns over-report by design and
  the five were labelled as noise in the owner's sample rather than handed to him as
  defects — seven lines reading as seven defects, when one is a defect and one is arguable,
  spends his attention on nothing and teaches him to distrust the next sample.
  `arroz-integral-con-pollo-y-verduras-ahumadas` was left alone on purpose: its step 1 is
  *"Calienta el aceite en la arrocera en modo saltear"*, real rice cookers have a sauté mode,
  the dish is cooked entirely in the machine, and the lone `rice_cooker` is honest.

### What was measured, before and after

Five runs of `evaluate-plans.mjs` over the fourteen fixed profiles, local library,
read-only, no model called. **The before pair was taken first, on 1,130 dishes** — not
phase 6's 1,084, which is why it had to be retaken — and core was not rebuilt between, so
the pairs are comparable.

| profile | default 1130 | no oven 1130 | default 1305 | no oven 1305 |
| --- | --- | --- | --- | --- |
| objetivo-bajo-3-comidas | 718 | 676 (−5.8%) | 743 | 700 (−5.8%) |
| objetivo-alto-5-comidas | 901 | 859 (−4.7%) | 950 | 907 (−4.5%) |
| alergia-lacteos | 470 | 438 (−6.8%) | 488 | 456 (−6.6%) |
| patron-vegetariano | 595 | 589 (−1.0%) | 628 | 620 (−1.3%) |
| quincena-con-evento | 877 | 835 (−4.8%) | 914 | 871 (−4.7%) |
| alergia-personalizada | 730 | 695 (−4.8%) | 767 | 731 (−4.7%) |
| alergia-personalizada-no-resuelta | 813 | 775 (−4.7%) | 850 | 811 (−4.6%) |
| patron-halal | 840 | 800 (−4.8%) | 888 | 846 (−4.7%) |
| patron-kosher | 766 | 734 (−4.2%) | 814 | 780 (−4.2%) |
| patron-sin-gluten | 444 | 408 (−8.1%) | 473 | 435 (−8.0%) |
| patron-sin-lactosa | 494 | 461 (−6.7%) | 516 | 482 (−6.6%) |
| imc-alto-2-comidas | 502 | 462 (−8.0%) | 537 | 497 (−7.4%) |
| patron-tradicional-espanola | 612 | 580 (−5.2%) | 633 | 601 (−5.1%) |
| tres-comidas-proteina-alta | 384 | 363 (−5.5%) | 407 | 386 (−5.2%) |

- **Every pool grew**, by 18 to 48 dishes, and **the oven's cost did not move** — flat or
  marginally better in all fourteen, because the 169 are almost all non-oven and so enter
  both pools. Four oven dishes is too few to show the effect the amendment reasoned about;
  the measurement is in place for a larger oven batch. A fifth run at +171 tells the same
  story: the oven's four add 0 or 1 dish to a pool.
- **One thing moved outside its band, and it is small and non-blocking.**
  `objetivo-bajo-3-comidas`, in the **no-oven run at 1,305 only**, goes 14/14 → **13/14**:
  day 10's fat is 38.9 g against a 37 g target, a deviation of **5.14%** — 0.14 points past
  the band, reported as the advisory `fat_out_of_band`. No fallback to the whole library, no
  blocking shortfall, no allergen on a plate, no variety violation, no plate over its slot
  ceiling. Read it as a draw rather than a break: over the same change that profile's **mean
  absolute fat deviation improved**, 3.44% → 2.66%, and carbs 2.85% → 2.47%. The library got
  better on average and one day of fourteen landed a tenth of a point over the line. **The
  other three runs are 14/14 on all fourteen profiles**, and all five exit 0 with no plate
  carrying a declared allergen.
- **The numbers are +175 and the file is 169.** The six struck dishes were removed after
  the measuring; they are three creams, two snacks and a pressure-cooker dish, and none bears
  on a band result — but the figures above should not be read as describing the file exactly.
- **The local library was put back** to its pre-phase 1,130 (`stovetop 1041, oven 58,
  blender 20, microwave 3`), so no other phase measures on a changed library.

### Evidence

Everything is under `docs/local/` (gitignored):

- `021-equipment-batch-final.sql` — the file to load, 169 dishes — and `…-final.json`, its
  sidecar with every dish, the per-cell record, the spend and the spread.
- `021-equipment-batch.log` and `021-equipment-batch-oven.log` — both runs' full output,
  de-coloured. The rejection tallies above are `grep -oE "dropped: [^)]*"` summed over these,
  and the `cookMinutes` quote is in the first.
- `021-equipment-batch.json` and `021-equipment-batch-oven.json` — the two runs' own
  sidecars, which `--merge` composes; keeping them separable is what let the oven's
  contribution be read on its own.
- `021-p8-before.json`, `021-p8-before-no-oven.json`, `021-p8-after-171.json`,
  `021-p8-after.json`, `021-p8-after-no-oven.json` — the five evaluator runs.

The script is `apps/api/scripts/draft-equipment-batch.mjs`: `--plan` prints the cells and
calls nothing, `--yes` drafts, `--merge` composes and re-emits, `--exclude` records a
review's verdict as a list rather than a hand-edit, and `--check` runs every gate again over
a finished file.

### Deviations from plan

1. **`swapWish` is repurposed to steer the batch**, because `prefers` alone steers nothing
   (phase 6 step 3: zero). It is the field a meal *swap* names its wish in; the four strings
   it normally holds are ones this code writes, so **nothing a person typed is involved** —
   that is `dishRequest`, a different field for exactly this reason (`0100`,
   `health-boundary.spec.ts`'s allowed-key list). Chosen over appending to the string
   `buildPoolPrompt` returns, which would have diverged silently from the prompt's own
   versioning. Said plainly in the script so nobody reading a gateway log mistakes a batch's
   instruction for a user's request.
2. **The plan's step 6 (`ALTER TYPE … ADD VALUE`) does not apply and no migration was
   written.** `recipes.equipment` is `text[]`, all ten appliances already exist in
   `APPLIANCES`, and the owner's decision was to grow all ten rather than change the
   catalogue.
3. **The oven's three cells were added mid-phase** by the lead, over this agent's
   recommendation, amending the plan's *"oven: none — already past the cap"* to cover lunch
   and dinner only. The reasoning is in the plan; the result is above and vindicates neither
   side cleanly — breakfast was a real hole and the snacks were not.
4. **One dish was struck and then brought back, and the lead reversed itself.** The rule was
   *"an enum key in a name or a slug stays struck"*, and
   `wrap-integral-de-tempeh-crujiente-y-brocoli-al-air-fryer` was removed under it. **It
   should not have been, and the one-line lesson is that *"al Air Fryer"* is not an enum
   key**: 19 other kept dishes carry `air-fryer` in the slug and read *"al Air Fryer"* in the
   name, which is ordinary Spanish in Spain, and **no name anywhere contains an underscore**
   — the key never reached a name at all. What was actually wrong with that dish was
   `air_fryer` and `stovetop` **in its step text**, which rule 1 now fixes everywhere.
   Applied as a rule the strike would have cost twenty dishes to a naming convention. The
   count went to 171, and then to **169** when the lead's read of the names struck two more.
5. **Production could not be read.** `mcp__neon__run_sql` was refused by the permission
   classifier ("Production Reads"), and so was a local `psql` — the second a false positive
   on the local database. So the phase's table was read from the **local** library (1,130
   es-ES dishes) rather than production's 962, and the month's spend from the OpenRouter
   key's own counter rather than from production's `ai_call` rows. Neither substitution
   changes a conclusion; the local figures and the lead's production figures agreed cell for
   cell where they overlap. A `mcp__neon__run_sql` permission rule would remove the gap.
6. **The advisor was consulted once**, before any code was written, under the two-call
   budget in `docs/reference/agent-team.md`. It caught three things that would each have cost
   real work: that `validate`/`judge` are `private` and the machinery to use is
   `PoolBuilder.build()`; that `build()` stops at twelve **accepted** dishes rather than
   twelve declaring ones, which is the loop the whole measurement rests on; and that
   `nutria-seed-500.sql` **predates the `equipment` column**, so copying its column list
   would have loaded 169 dishes declaring nothing — the exact failure this phase exists to
   prevent.

### Decisions this phase touches

- [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md) —
  § *Adding an appliance to the catalogue is adding a promise* is the section this phase
  answers, and the slow cooker is the one appliance it cannot answer for. § *What it costs,
  measured* has the phase 6 numbers these are the after of.
- **Migration `0067`**, phase 2's backfill — not a decision record, and the distinction
  matters because this entry's first draft cited it as one. Its rule, read **forwards**
  rather than backwards, is what this phase drafted against: a dish that offers a choice
  declares neither, so a dish whose method is built around one appliance offering no
  alternative declares it. That reading is what lets a rice cooker or a steamer carry a dish
  at all, and it is the standard production's 65 oven dishes already meet. The rule itself is
  stated in `0102` and in `packages/database/AGENTS.md` § *A dish's equipment*.
- [`0070`](../../decisions/0070-a-serving-has-a-ceiling.md) — the serving ceiling refused 5
  drafts.
- [`0045`](../../decisions/0045-a-day-is-built-to-all-four-of-its-numbers.md) — the reason
  the batch was drafted across seven briefs rather than counted.
- [`0064`](../../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)
  — the OpenRouter key's own monthly limit is the wall the spend was read against.

### Notes for the next phase

- **Phase 9 has two things to record that this phase produced** and one it must not: the
  **34% declare rate** belongs in `0102` beside phase 6's zero, because together they are
  the measured size of the preference half; and the **slow cooker's schema bound** belongs
  in `0102`'s supply section as the one appliance whose shortfall is not a supply problem.
  What it must **not** do is write a number nobody measured — the production counts are owed
  after the owner's load, not before.
- **The owner's load is the gate.** Expect **169** rows; the file prints the slugs production
  already held before it writes anything, and a short count is a collision rather than a
  failure. The appliance × slot query to run after it is in the hand-back and in the file's
  own trailer.
- **Two open questions for the owner, neither an agent's**: whether the two raw-salt-cod
  creams come back, and the slow cooker's stance in `0102` — keep the entry with a zero and
  the reason, or take the appliance out.
- **The time project now has its evidence.** A slow-cooker dish that passes the schema is
  refused by `withinTime` for everybody who set a limit, and **129 of the 169 fit a 30-minute
  limit** while 40 do not. That is the second half of the same finding and the strongest case
  yet for the cooking-time work `0102` flagged for its own measurement.
- **A second batch is cheap and is not needed yet.** 343 calls cost 0.32 USD, so nineteen a
  slot — the plan's *second* batch — is affordable whenever a fortnight is measured repeating
  itself. Nothing measured here says it is.

## Phase 9 — The record and the rule (2026-10-17)

- **Executor**: the lead directly, at this session's effort. The plan prices the phase
  *"general-purpose, inheriting the session's effort"*, which **is** the lead's own routing,
  and the phase's substance is prose about measurements the lead took itself an hour earlier
  — a fresh agent would have had to re-derive every number from the LOG. No subagent, no
  worktree.
- **Result**: done. `0102` carries both halves' numbers and nothing it cannot source;
  `packages/core/AGENTS.md` carries the preference rule; the roadmap carries the project 021
  deliberately left alone; and the PRD is read against its own criteria rather than declared
  met.

### What changed

1. **`0102`'s status moved off a false claim.** It said the preference half's numbers were
   *"still owed"* and named phase 6 step 3 as the thing that would settle them. Step 3 ran on
   2026-10-16 and its section was already in the record below the status line, so the record
   contradicted itself at the top. The status now names **both** measurements and says what is
   actually outstanding, which is not a number but a **library**: 169 dishes drafted and
   unloaded.
2. **A new section, `## Asking as hard as the machinery allows (2026-10-17)`.** Phase 6 left a
   real question open — is `PREFERRED APPLIANCES:` weak, or was it asked weakly? Phase 8
   answered it and the answer belongs in the record beside the zero, not only in a project log:
   **34%**, with the per-appliance table, 343 calls and 0.3168 USD. The two rows that are not
   supply problems are separated out and named as such (the slow cooker's schema bound, the
   oven's snacks), because a reader who takes 0% and 6% for shortfalls will try to fix them
   with more calls.
3. **`§ Adding an appliance to the catalogue is adding a promise` stopped promising a tuner.**
   It said the batch would be *"validated and tuned as the five hundred were"*. There is no
   tuner in the tree — phase 8 looked — so the sentence described machinery that does not
   exist, in the section a future agent would read before drafting the next batch. It now names
   `PoolBuilder.judge`'s gates, and states the load as **owed** rather than done.
4. **`packages/core/AGENTS.md` § *A preference may never remove a dish*.** The plan's step 2
   asked for the preference half here, the first half having landed in phase 1
   (`packages/database/AGENTS.md`, extended in phase 8 with `recipe_source`). Core's own doc
   comments already say it well — `withinEquipment` compares `missing` and nothing else — but
   `AGENTS.md` said **nothing about a kitchen at all**, so an agent working in core met the
   rule only if it happened to open `Kitchen.ts`. The section carries the one-line rule, the
   two boundary answers (`null` kitchen, unknown appliance), the bound, and the measured reason
   **not to answer a thin appliance by strengthening the prompt**.
5. **`docs/ROADMAP.md` § *Next* 6, the time and elaboration project** — the plan's step 4,
   and it had more to say than when the plan was written: the slow cooker's schema bound is a
   concrete first question, and `129 of 169` dishes fitting a 30-minute limit is a measured
   spread to design against. Also corrected, in the same section: the 021 entry claimed
   production held *"1 air-fryer dish and 2 pressure-cooker dishes of 962"*, a prose count that
   the `equipment` column contradicts. Measured 2026-10-17: **0 declaring an air fryer** of 972.
6. **The PRD is read against its criteria, not closed.** Criterion 10 is met. **7 and 8 cannot
   close before the load**, and 8 — *"one generation yields at least as many air-fryer dishes as
   the plan has days"* — stands **measured at zero**.

### The checks that produced no change, which is the result

- **Nothing shipped quietly gated the kitchen** (step 3). `Allowance.ts` holds six rows —
  `dishRequestsPerMonth`, `eventsPerPlan`, `fixedMeals`, `mealSwapsPerPlan`,
  `midPlanEventsPerPlan`, `planRedosPerFortnight` — and **no kitchen or equipment row**, on
  either tier or in the ceilings table. `marketing`'s verdict from 2026-10-15 holds as shipped.
- **The three-preference bound reads as a product bound everywhere it is written.**
  `MAX_PREFERRED_APPLIANCES = 3` (`entities/Kitchen/Kitchen.ts`), enforced inside the
  repository's lock (`KitchenController.applyChanges` → `setStance`, which throws
  `InputParseError` naming the field), travelling to the screen as `maxPreferred` in the
  profile payload, and said **before** it is hit (`KitchenPicker`, `OnboardingFlow`'s
  `kitchen.preferredFull`). `FixedMeal.ts` already cites it as the precedent for a bound that
  is *"the same on both tiers"*. Nothing to change.
- **The first half still says what the code does** (step 2's second clause).
  `packages/database/AGENTS.md` § *A dish's equipment* matches `appliancesOf`,
  `withinEquipment` and migration `0067` as they stand today.

### Evidence

- **Production, read 2026-10-17** (read-only, standing approval): 972 es-ES dishes, `equipment`
  column — stovetop-only aside, **air_fryer 0, grill 0, steamer 0, rice_cooker 0, slow_cooker 0,
  pressure_cooker 1, oven 65, blender 20, microwave 3**; `source 'seed'` exactly 500 and **0
  dishes at `steps_version '4.9.0'`**, which is what proves the batch is not loaded.
- **The owner's own fortnight, generated 2026-10-17 12:08** (plan v26, active, 14 days, 56
  plates, prompt 4.9.0, `google/gemma-4-31b-it` via DeepInfra, 12 calls, 0.018 USD). Kitchen:
  `air_fryer: prefers`, `blender: missing`. **0 plates declare an air fryer**, 53 are
  hob-only, 1 oven, 1 nothing, **0 blender** — the constraint half working unremarked while
  the preference half had nothing to work with. 51 distinct dishes of 56, no dish more than
  twice.
- **The load rehearsal, local Postgres, 2026-10-17**: `1,130 → 1,299` es-ES dishes, exactly
  +169, **0 collisions**, 30 air-fryer dishes where there were none, no recipe left without its
  ingredients, `EXIT=0`. The file's own pre-flight (127 ingredient slugs) passed.
- **Production load: refused to an agent, and deliberately not worked around.** The owner gave
  permission in the session ("te doy permiso", not at his computer). The `psql` call was denied
  by the permission classifier — *Production Deploy* — and the repository's own hook restated
  the rule it exists to serve: *"production data changes are run by the owner"*. The same
  write was available through `mcp__neon__run_sql_transaction`; **it was not attempted**,
  because routing a denied production write through a second tool is the one thing that would
  make the guard stop protecting him. Reported with the exact command instead. **The load
  remains the gate.**
- `develop` **could not be rehearsed on**: the `Nutria-E2E` Neon project is over quota
  (HTTP 402) and does not reset until 2026-11-01, which is why the rehearsal went to local
  Postgres — the same schema, 68 migrations, and the library the batch was drafted against.

### Deviations from plan

1. **No subagent.** The dispatch line names `general-purpose` inheriting the session's effort,
   which matches the lead's own routing, so step 4's *"if it matches your own, do the work
   directly"* applies. Recorded here because the plan names an agent type.
2. **The plan's step 1 was half wrong about its own subject.** It asked that `0102` *"carry the
   measured numbers from phase 6"* and that its status *"move off structural choices only"* —
   but phase 6's numbers were already in the record (phase 6 put them there) and the status had
   not said "structural choices only" for a day. What was actually wrong was the opposite: the
   status claimed numbers were missing that were present. Done as the plan intended rather than
   as it was worded.
3. **No file outside the phase's scope carries this phase's work**, and the two exceptions are
   worth naming because a reader counting six changed files against the plan's list will look
   for the rest. `PLAN.md` is not on that list and is touched by the execute-project loop
   itself, as in every phase: phase 8's commit backfilled, this phase's status line, this
   phase's checkbox. `packages/database/AGENTS.md` is not on it either and was not touched
   here — its `recipe_source` section went in with phase 8's commit, where `/ship` § 2 asks
   for a rule to travel with the code it governs. Of the two files on the list that did not
   change, `apps/api/AGENTS.md` already carries this project's line — the evaluator's
   `--without`, phase 7, citing `0102` — and `apps/web/AGENTS.md` says nothing about a kitchen
   and needed nothing: the screen's rules live in `0102` and the ones an agent must not break
   are in core's, which is where step 2 put them.
4. **The project is not closed.** Phase 9 is the last phase in the plan, but criteria 7 and 8
   are open and phase 5b is in progress, so the plan's own completion is not this phase's to
   declare. Said in the PRD rather than left for a reader to notice.

### Decisions this phase touches

- [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md) — the
  record this phase exists to finish. Two sections added or corrected; no number in it is now
  one nobody measured, which is the phase's acceptance criterion.
- [`0070`](../../decisions/0070-a-serving-has-a-ceiling.md),
  [`0045`](../../decisions/0045-a-day-is-built-to-all-four-of-its-numbers.md) — cited by the
  new section as the gates the batch passed and the band the measurement is read against.
- **No new decision record.** Phase 9 took no decision: the two that are open — the slow
  cooker's catalogue entry and the two raw-salt-cod creams — are the owner's, and both are
  stated where he will meet them.

### Notes for the next phase

- **The load is the only thing between this project and its last two criteria.** After it, two
  numbers close 7 and 8: the per-appliance count against `DISHES_NEEDED_PER_SLOT` (19), and one
  generation with the air fryer preferred. Neither is owed before.
- **The one measurement worth taking twice** is the declare rate *after* the load. 34% is how
  often the model writes the appliance when the library has nothing; with 30 air-fryer dishes
  to reuse, the plan's air-fryer plates should come from the library rather than the model, and
  the two paths are worth separating in the figure.
- **The guard that refused the load is working, and that is worth not fixing in a hurry.** If
  the owner wants an agent to be able to run a reviewed load, the narrow change is a permission
  rule for exactly that command, not a looser classifier.

## Phase 10 — A preference nobody can see (2026-10-18)

- **Executor**: the lead directly, at this session's effort. The owner ran the load, saw the
  fortnight that followed it, and authorised the fix overnight — *"haz todo lo posible para
  solucionar esto, genera todos los planes necesarios con todo tipo de usuario, haz push y
  merge de lo que sea necesario, te doy permiso"* (2026-10-18). No subagent: the work is one
  diagnosis on production's own rows, and a fresh agent would have had to re-derive every
  number in it.
- **Result**: done. A preferred appliance holds a third of every slot's cap. On the owner's
  own fortnight, re-scheduled from his real context with the seed his plan used, the plates
  go from **0 to 8 of 56** at the same 12 of 14 days in band; over the evaluator's fourteen
  profiles × three seeds the median is **18 of 56** with **587 of 588 days in band**.

### What happened

The load landed at 02:53 UTC — 169 dishes, no collisions, production at 1,141 es-ES dishes
with **30 declaring an air fryer** where it had held none. Five minutes later the owner
generated a fortnight with the air fryer still `prefers`, and it came back with **0
air-fryer plates of 56** and not one of the 169 dishes on any plate.

### Ruled out, on the rows rather than by reasoning

- **The timing**: the batch's rows are stamped 02:53:07, the generation job 02:57:54, the
  plan 02:58:55. The plan ran after the load.
- **The stored method**: an array of steps with `cue`, `text` and `minutes`, 2–8 of them
  (the five hundred average 4.97), so `hasUsableMethod` passes on all 169.
- **`fitSlots`**: keeps 165 of the 169 and takes a dinner from exactly 4 — stewed pulses at
  a Spanish dinner (`0079`), which is the table working.
- **The season**: `seasonFor` judges fresh fruit alone; these dishes carry none.
- **The person's own filters**: the free-from substitutes, the country scope, the time limit
  (his is 60 minutes, so `withinTime` allows 80) and his `blender: missing` exclude **none**
  of the 24 air-fryer dishes servable to him.
- **A cache**: there is none in `RecipeRepository`; every generation reads the library.
- **`servable` drops 117 of the 169, and that is the constraint half working**: a rice
  cooker, a steamer and a pressure cooker are `missing` for him under the default kitchen,
  so their dishes are correctly invisible. 120 of the batch keep a lunch or a dinner.

### The cause

`isPreferredDish` is **one bucket for four leanings** — a liked dish, a liked cuisine, a
liked ingredient or a preferred appliance — and `rotatePool` fills each slot's cap from the
front of that bucket with no rank inside it. He had named four cuisines (Mediterránea,
Española, Italiana, Mexicana), so the bucket held **548 of his 672 servable dishes** and an
air-fryer dish was **one in 22.8** of what the cap took.

Reproduced with the real code, his real context and his plan's own seed: **3 air-fryer
dishes in the pool, 0 on plates** — and the proof that the reproduction is his generation
and not a model of it is that its pool is 68 dishes, the `reused: 68` his plan recorded. The
same code with the kitchen as the only leaning: **24 in the pool, 22 on plates**.

### The fix, and why this size

`APPLIANCE_DISHES_PER_SLOT` keeps a third of each slot's cap for the appliances they would
rather use — **after** `reserveGroups` and never from it, because a legume minimum is what
validation refuses a fortnight for and a preference is not, and **nothing at all** when no
appliance is preferred, which `Rotation.test.ts` asserts rather than assumes.

A third because it is measured, on his own fortnight with accompaniments and the energy
floor as the generation passes them: 0 plates at a share of zero, 6 at three, 7 at five, 7
at seven — and seven is where every one of the fourteen days is back inside the band, while
nine and twelve buy no further plate (his air fryer holds 12 lunch dishes and 12 dinner
dishes, so the share runs out before the cap does).

### Evidence

- **His own fortnight, re-scheduled read-only against production** with everything the
  generation passes: pool 69 dishes of which **14 declare an air fryer** (was 3), **8 plates
  of 56** (was 0), 41 distinct dishes, nothing served more than twice, and the product's own
  `validatePlan` + `planQuality` say **12 of 14 days in band** — the same 12 of 14 the plan
  he was served scored, missing on the same two fat days (71.4 g against 68) that his two
  fixed meals already cost him before any of this.
- **Fourteen profiles × three seeds over the local library, which holds the same batch**
  (`--rotate 3 --prefer air_fryer --flag accompaniments`): **median 18 preferred plates of
  56**, max 27, and **587 of 588 days in band (99.8%)**.
- **The seven fortnights that still showed none are exactly the seven rescued from the whole
  library** (`wider_rotation`, 7 of the 8 rescues; the eighth showed one plate). The 34 that
  did not need a rescue have a median of 18. The bands outrank the preference by design
  (`0045` before `0102`) and the rescue is what that order looks like on a plate — recorded,
  not fixed, because weakening a rescue to show an appliance would trade the owner's own bar
  for a preference.
- **Without `--flag accompaniments` every profile is rescued and the median is 0.** The sides
  are what let a capped pool reach the bands, so a preference measured without them says
  nothing. Said in `apps/api/AGENTS.md` beside the flag.

### Deviations from plan

1. **A phase the plan did not have.** Phase 9 was the last; this is phase 10, added with the
   owner's authorisation after the load exposed something no phase had asked about. The plan
   carries it with its own dispatch, scope and verification.
2. **An instrument was changed, not only read.** `evaluate-plans.mjs` builds its rotation
   "as `PlanGeneration` builds it" by its own header and did not carry `preferAppliances`, so
   it could not see a preference at all. `--prefer` and a per-profile line are part of this
   phase because the measurement it is accepted on cannot be taken without them.
3. **The `0102` section corrects what phase 9 shipped four hours earlier.** `packages/core/AGENTS.md`
   said a `prefers` stance moves the order "exactly as a chosen cuisine and a liked food
   have since `0026`" — which is true and is the defect. Amended in the same change.

### Decisions this phase touches

- [`0102`](../../decisions/0102-a-kitchen-is-what-it-has-and-what-it-would-rather-use.md) —
  § *A preference nobody can see is not a preference*: the dilution, the share, the curve, and
  what the rescue costs it. The owner authorised the fix; the share's size is the planner's,
  on the curve, and his to revisit.
- [`0045`](../../decisions/0045-a-day-is-built-to-all-four-of-its-numbers.md) — cited as the
  rule that outranks this one, which is what the rescue's zeros are.
- **No new record.** The share is `0102`'s own preference half finally working; a second
  decision would split one rule across two files.

### Notes for the next phase

- **Criterion 8 is still open, and the share cannot close it.** Eight plates on his fortnight
  and a median of 18 across the profiles are not "at least as many as the plan has days" on
  *his* library: the air fryer holds 12 lunch and 12 dinner dishes against the 19 a slot the
  rotation asks for. The lever is supply, and a second batch costs 0.32 USD.
- **The other three leanings keep their one bucket.** Whether a chosen cuisine deserves a
  share of its own is a product question nobody has measured; nothing here says the cuisine
  leaning is hurting anybody, and it should not be changed on the strength of this.
- **A preference that disappears in a rescue is worth a figure.** `generation_metadata`
  already records `fallback`; counting preferred plates beside it would say how often the
  bands cost somebody the appliance they asked for, without storing anything about a person.
