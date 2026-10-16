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
