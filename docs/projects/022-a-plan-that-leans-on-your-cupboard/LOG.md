# LOG — Project 022: A plan that leans on your cupboard

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — A plan that leans on your cupboard (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Phase 0 — Price it before building it (2026-10-23)

- **Executor**: **opus @ medium, directly** — not the `plan-evaluator` the plan's Dispatch
  line named. Two reasons, both facts about the tools rather than about the design, and
  `PLAN.md`'s Dispatch line is amended in this same change: `plan-evaluator` holds no `Write`
  or `Edit` and its brief says *"You edit nothing"*, while steps 1–4 of this phase **are**
  edits to `evaluate-plans.mjs`; and the role agents work in their own worktree, which has no
  `.env` and cannot reach `pnpm db:local`, so the one thing this phase exists to do — run the
  evaluator against the local Postgres — can only be done from the main checkout.
- **Result**: **done**, and stopped at its `owner-approves` gate. No product code was written:
  the whole phase is `apps/api/scripts/evaluate-plans.mjs`, plus this entry and the plan's
  amendments.
- **Scope held**: one file changed outside the project's own docs —
  `apps/api/scripts/evaluate-plans.mjs`. No schema, no migration, no route, no screen, and no
  change to `packages/core`.

### What the instrument gained

`--pantry <larder|slugs>`, `--pantry-mode rank|filter|bucket`, `--pantry-share N` and
`--pantry-yields first|last`, with four hand-written larders (`LARDERS`) at 15, 30 and 60
items plus one control, each carrying the sentence it assumes. Every slug was checked against
the real catalogue before the runs; the check happens inside the run's transaction, because a
slug validated against nothing comes back as *"the cupboard covered nothing"*, which is the one
failure that reads exactly like a result.

The figures a pantry run reports — the fortnight's shopping rows, the rows the cupboard already
holds, the plates and the whole meals it reached — are written on **every** run, pantry or not,
so the no-pantry baseline file carries them too and *"against the no-pantry run"* is a
comparison of two measurements rather than a recollection.

**The seasonings are named and reported separately** (`PANTRY_STAPLES`). `sal` is in 883 of the
1,638 local recipes and `aceite-de-oliva-virgen-extra` in 822, so any larder holding both makes
*"plates using a pantry item"* about 100% before the feature has done anything. A figure that
cannot go down is not a measurement, so every coverage figure is given twice: over all the
cupboard's items, and over the ones somebody actually shops for.

### Evidence

```
pnpm db:local status                 # running, 930 ingredients, 1,638 recipes
pnpm --filter core build             # clean, no zero-byte output in dist/
pnpm turbo lint ts:check --filter=api  # 8 tasks successful
node --check apps/api/scripts/evaluate-plans.mjs  # ok
```

`apps/api/scripts/evaluate-plans.mjs` is outside the api package's lint globs
(`'src/**/*.ts' 'test/**/*.ts'`) and outside its tsconfig's project service, so `eslint` refuses
it by design; the phase's stated verification passes and the file's style is held by review.

**The instrument is an identity on the paths it changed.** The per-seed pick stopped going
through `RecipeController.reusablePool(slots, context, rotation)` and now goes through the
run's own `rotate()`, which is `rotateFor` over the same `servable` library the function had
already read — one read per profile instead of one per seed, and the band-miss ladder became a
list of rungs instead of a list of appliance shares. Both were checked rather than argued: the
script at `HEAD` and the edited script were run on the same arguments and every figure `HEAD`
writes came back **byte-identical**, twice —

- `--rotate 2 --only objetivo-alto-5-comidas --flag accompaniments` (no band miss), and
- `--rotate 3 --flag accompaniments --prefer air_fryer` (the whole cohort, which walks the
  appliance ladder on 14 fortnights).

**The cohort and its baseline.** 14 profiles; `--rotate 3` is 42 fortnights, `--rotate 8` is
112. Read the rescue counts at the right scale: `0102`'s recorded **8–9** was over 42
fortnights, this run's own 3-seed baseline is **5** of 42, and its 8-seed baseline is **14** of
112. Every figure below is the 8-seed one unless it says otherwise, and the 8-seed baseline is
**1,568 / 1,568 days inside all four macros, 0 plates with a declared allergen**, which is
`0102`'s 588/588 cohort re-measured at the larger seed count.

#### 1. The hard filter is impossible, with this cohort's own numbers

`--pantry-mode filter`, 42 fortnights each. Exit 1 — *could not measure* — at all three sizes,
and **the snacks fail first**, exactly as [`architecture/0012`](../../reference/architecture/0012-a-plan-from-the-ingredients-somebody-already-has-2026-10-22.md)
said they would:

| cupboard | fortnights built | slots under 19 | the thinnest slots (unrestricted profile) |
| --- | --- | --- | --- |
| 15 items | 3 of 42 | 54 | morning_snack **0**, afternoon_snack **0**, lunch 9, dinner 15 |
| 30 items | 3 of 42 | 32 | morning_snack **0**, afternoon_snack **1**, lunch 11, dinner 19 |
| 60 items | 22 of 42 | 18 | morning_snack **6**, afternoon_snack **9**, lunch 28, dinner 26 |

Even the 60-item best case loses 20 of 42 fortnights outright and puts 36 of the 308 days it
did build outside a band. `--pantry-mode filter` stays what the plan says it is: a
confirmation, measured here and nowhere else, and never a product mode, option or "strict"
switch.

#### 2. The rejected composition is rejected on numbers, not on memory

`--pantry-mode bucket` — the cupboard's slugs through `preferIngredientSlugs`, the single
bucket all four leanings share. 42 fortnights, 30-item cupboard: **2,232 of 2,268 plates
(98.4%)** used something from the cupboard, and **whole meals went from 361 to 370**. The
bucket holds nearly everything and therefore steers nearly nothing — `0102`'s dilution,
reproduced on this cohort.

#### 3. The rank's rung is the whole of why the steering is viable (PRD criterion 4)

Measured twice at each share: once with no rung, so a band-missing plan drops straight to
`wider_rotation` where an uncapped rotation has no cap for a share to be scarce against; once
with the cupboard's own rung (half the share, then none) ahead of that rescue. 112 fortnights,
30-item cupboard.

| share | days in band, **no rung** | rescues, **no rung** | days in band, **with rung** | rescues, **with rung** |
| --- | --- | --- | --- | --- |
| 0 (cupboard declared, no quota) | 1568 / 1568 | 14 | — | — |
| 5 | 1566 / 1568 | 16 | **1568 / 1568** | **11** |
| 7 | 1567 / 1568 | 21 | **1568 / 1568** | **11** |
| 14 | 1567 / 1568 | 19 | **1568 / 1568** | **10** |
| 19 | 1564 / 1568 | 23 | **1568 / 1568** | **12** |

Without the rung the quota is the cliff `0102` already paid for once. With it, **no day leaves
a band at any share and rescues fall below the no-pantry baseline** — 14 → 10–12 — because a
band-missing plan now has a cheaper way out than giving up its whole rotation.

**Read that last column carefully: it is the rung paying for itself, not the steering being
free.** The baseline has no rung to walk, so a band-missing plan there goes straight to
`wider_rotation` and is counted as a rescue; the rung gives those plans a cheaper exit, and 10
of 112 is what is left after it. The comparison that prices the *steering* is rung against
no-rung at the same share — the two left-hand columns against the two right-hand ones — and not
baseline against rung. Nobody should read this table as *"declare a cupboard, get fewer
rescues"*.

Share 0 is
byte-identical to the no-pantry run (same 13,402 rows, same 14 rescues, same 1,568 days), which
is the control that says the instrument adds nothing of its own.

**So the stop signal does not fire.** No slot under 19 in `rank`, and rescues below baseline,
not above.

#### 4. The shop-shortening is phase 2's, and not phase 4's — the finding that matters most

Rows of a fortnight's list the cupboard already holds, real food only, 112 fortnights, 30-item
cupboard, with the rung:

| share | real-food rows | already bought | **left to buy** | against share 0 |
| --- | --- | --- | --- | --- |
| 0 | 11,793 | **2,086** | 9,707 | — |
| 5 | 11,518 | 2,093 | 9,425 | −2.9% |
| 7 | 11,461 | 2,111 | 9,350 | −3.7% |
| 14 | 10,616 | 2,077 | 8,539 | −12.0% |
| 19 | 9,804 | **2,041** | 7,763 | −20.0% |

**The "already bought" column is flat, and at the top it is lower than at the bottom.** The
steering does not find more of what somebody owns; what it does is draw the fortnight from
fewer distinct ingredients, which shortens the list by shortening the variety. The whole of the
promise *«la compra baja»* is delivered by declaring the cupboard — phases 1 and 2 — at
**2,086 of 11,793 real-food rows, 17.7%, 18.6 rows of a 105-row fortnight**.

What the steering does buy is meals cooked entirely from the house: **986 → 1,011 (s5, +2.5%)
→ 1,099 (s14, +11.5%) → 1,252 (s19, +27%)** of 6,048 meals.

#### 5. What it costs, which the balance score hides

The score moves 79% → 77–78% and looks mild. The food-group table does not (plans where the
rule applies and holds, 112 fortnights, with the rung):

| rule | s0 | s5 | s14 | s19 |
| --- | --- | --- | --- | --- |
| **eggs** (cap 8 a fortnight) | 66% | 60% | **39%** | **23%** |
| **starches** (capped) | 79% | 75% | **56%** | 60% |
| oily fish | 95% | 93% | 93% | 86% |
| meat | 80% | 81% | 88% | 92% |
| whole grain | 73% | 71% | 81% | 88% |
| legumes | 84% | 86% | 86% | 88% |
| vegetables | 57% | 61% | 63% | 63% |

A real cupboard's staples — eggs, rice, pasta, potato, bread — are precisely the foods the
table caps, so ranking by *"what I would not have to buy"* ranks the capped foods first. At
share 14 and above the egg maximum is broken in most fortnights. `0102`'s accepted trade was
fish 62% → 55% and meat 79% → 67%; **eggs 66% → 23% is far outside anything that precedent
paid for.**

**Which rules break is a property of `despensa-30`, not of the rank.** Eggs and the capped
starches collapse because that cupboard holds `huevo`, `arroz-bomba-crudo`,
`pasta-integral-seca`, `patata` and `pan-integral` — which is what a real Spanish cupboard
holds, so the finding is representative of the common case rather than a quirk. But a different
cupboard breaks different rules: a cupboard with no eggs cannot push the egg count anywhere, and
three of the fourteen profiles are plant-leaning to begin with. What generalises is the
mechanism — *the rank promotes whatever the cupboard holds, and a cupboard holds staples, and
the table caps staples* — and not the particular 23%.

#### 6. The kitchen does not regress at a small share (PRD criterion 3)

`--prefer air_fryer`, median air-fryer plates on the ten four-meal profiles, which is the shape
021's *«median 20 of 56»* was measured on (the cohort mixes two-to-five-meal days and cannot be
read against it):

| run | median of 56 | cohort total | rescues |
| --- | --- | --- | --- |
| air fryer preferred, no cupboard | 36 | 2,860 | 19 |
| + cupboard, share 5 | **36.5** | 2,911 | 16 |
| + cupboard, share 14 | **29** | 2,285 | 18 |
| + cupboard, share 19 | **20** | 1,686 | 16 |

021's floor of 20 holds everywhere, free at share 5 and with margin at 14. At share 19 it sits
**exactly on** the floor and the cohort total is nearly halved — share 19 is the knob's ceiling,
not a candidate: it is the pantry reserve filling the whole cap before `applianceShare` runs.

**Which preference gives way first is priced but not settled.** At share 14 the two orders give
the same median, 29 of 56; `--pantry-yields first` (the cupboard yields first) keeps more
air-fryer plates in total (2,285 vs 2,120) and `last` keeps more of the cupboard (1,132 vs
1,094 whole meals) and fewer rescues (12 vs 18). Every criterion-3 figure above was taken under
`first`. The choice belongs to phase 4 and `PLAN.md` now says so.

#### 7. The bound, and a correction the PRD is owed (PRD criterion 11)

Cupboard declared, no steering (`--pantry-share 0`), 112 fortnights. All four runs produced the
**same plan** — 1,568/1,568 days, 14 rescues, 13,402 rows — which is the point: a declared
cupboard changes what the list *says you already have*, never what the fortnight is.

| cupboard | items | real-food rows held | of 11,793 | per fortnight | whole meals |
| --- | --- | --- | --- | --- | --- |
| despensa-15 | 15 | 929 | 7.9% | 8.3 | 34 |
| despensa-15-sin-condimentos | 15 | 1,356 | 11.5% | 12.1 | 45 |
| despensa-30 | 30 | 2,086 | 17.7% | 18.6 | 986 |
| despensa-60 | 60 | 4,112 | 34.9% | 36.7 | 1,116 |

Coverage rises monotonically with size, with no cliff and no cost to the plan, so **nothing
measured here argues for a bound below the provisional 60**. `marketing`'s proposed 20 would
roughly halve the coverage of the one half of this feature that is certainly worth having, for
no benefit this run can see.

**The control larder earns its place.** Dropping the four seasonings from the 15-item cupboard
and putting four real foods in *raised* real-food coverage from 929 to 1,356 and whole meals
from 34 to 45. The effect is food, not salt and oil — but the seasonings do inflate the
*"plates using something from the cupboard"* headline (3,826 → 4,120 plates), which is why that
figure is never reported alone.

**The correction.** The PRD's § *Problem* promises *"about one row in four at thirty items, one
in two at sixty"*. Measured on hand-written cupboards instead of a best-case pantry: 18.6 rows
a fortnight at thirty, which against the PRD's own 73–88 denominator is **21–25%** and against
this run's 105-row denominator is **17.7%** — at or below the bottom of *"one in four"*; and
36.7 rows at sixty, **42–50%** of the PRD's denominator, so the sixty figure roughly holds.
This is the difference the plan's step 4 was written to catch, and phase 3's honest sentence
must use the measured number and not the PRD's.

### Deviations from plan

1. **Dispatch** — `plan-evaluator` → opus @ medium directly. Reasons under **Executor**;
   `PLAN.md` amended.
2. **Step 3's threading** — a pantry has no field on `Rotation` to be threaded into, and giving
   it one is phase 4's work, which this phase's scope forbids. The rank is therefore measured as
   the cupboard's reserve **appended to `reserveGroups`**, which is the one lever on the pick
   that `packages/core` already exports (`rotatePool`'s `reserve`, the same parameter
   `RecipeController.rotateFor` passes the food groups through). Everything else on the path is
   the real code's, and the mirroring is proven by the byte-identical `HEAD` comparison above.
   `PLAN.md` amended.
3. **Two measurements added that the plan did not ask for**, each because the question could not
   be answered honestly without it: the rung measured against its own absence (§ 3 — without it
   the stop signal fires, with it the stop signal does not, so a phase-0 run that measured only
   one of the two would have returned the wrong verdict), and `--pantry-yields` (§ 6 — the
   kitchen's figures mean different things under the two orders).
4. **A latent reporting bug fixed in passing**: `printRotations` read `result.slots` to print
   *"plates served of N"*, and `measureRotations` never returned `slots`, so that denominator
   had always printed `n/a`. It is returned now.

### Decisions

A line in [`docs/decisions/LOG.md`](../../decisions/LOG.md), 2026-10-23, for the four things
this run closes and a later agent would otherwise redo: the hard filter confirmed impossible
rather than argued impossible, the single-bucket composition dead, **the rung load-bearing** —
a pantry share that can reach `wider_rotation` without first giving way by degrees may not be
built — and the shop-shortening belonging to the declaring and not to the steering. No ADR:
what is still open is not a constraint but a choice, and it is the owner's at this gate.

**What that line does not decide**: whether the steering half is built at all, and at which
share. The composition and the bound are his here, and the record of what he chooses belongs
with the phase that implements it.

**One edit at this gate is the owner's to accept or revert**: § 7's correction was written into
[`PRD.md`](./PRD.md) § *Problem* as a *superseded in part* block rather than left in this file
alone, because phase 3's honest sentence is read off that paragraph and a phase-3 executor who
read only the PRD would promise *"one row in four"*. The PRD is his approved contract, so the
block names what it supersedes, points here, and changes no other sentence — but it is an
amendment to an approved document made by an executor, and it is flagged rather than assumed.

**The gate was answered the same day.** 2026-10-23, in the owner's own session, on these figures:
the steering half is **not** built — phase 4 struck, deferred and not cancelled, with its reopen
condition written into its status line — and **the bound is 60**. He also accepted § 7's correction
to the PRD as written, so the *superseded in part* block stands. A second line in
[`docs/decisions/LOG.md`](../../decisions/LOG.md) records all of it, and it narrows the entry of
2026-10-22 on purpose: *«a steer and not a filter»* is the shape the steering would have taken, not
something this product does, and until phase 4 exists a pantry changes no pick. Phases 1, 2, 3 and
5 may not be written as if it did.

### Notes for the next phase

- **Phases 1, 2, 3 and 5 are unaffected by anything measured here and carry the whole of the
  promise.** Phase 1's bound of **60** is supported by the measurement and was settled by the
  owner on 2026-10-23: use it, and not as a provisional number.
- **Phase 2 must store the measured figures**, and phase 3's sentence must read them. The
  honest numbers for a 30-item cupboard are *≈19 of ≈105 real-food rows already bought* and
  *≈9 of 54 meals using only what you had* — not the PRD's *"one row in four"*.
- **Phase 4's stop signal did not fire**, and phase 4 is also not obviously worth building: see
  the recommendation handed to the owner at this gate. If he takes it, the composition to
  implement is **the rank with its own rung at a small share (5), `--pantry-yields` chosen by
  phase 4**, and the first thing phase 4 should try is the obvious repair to § 5 — **never let
  the cupboard's reserve take a dish that would break a per-fortnight cap**, so the ranking
  stops promoting eggs, rice, pasta and bread past the table. That variant is cheap to measure
  with the instrument as it now stands and was not measured here because it is a design choice,
  not a parameter.
- **Reproducing any of it**: `pnpm db:local start`, `pnpm --filter core build`, then
  `NUTRIA_LOCAL_PG=1 node apps/api/scripts/evaluate-plans.mjs --rotate 8 --flag accompaniments
  --pantry despensa-30 --pantry-share 5 --json <file>`. One run is ~35 s at 3 seeds and ~2 min
  at 8; they are heavy and this machine takes one at a time.

## Phase 1 — The pantry a person types exists, and resolves (2026-10-23, finished 2026-10-26)

- **Executor**: three agents and this checkout. The product code by **`backend` (opus @ medium)**
  in its own worktree, which is the dispatch the plan names. The e2e suite by **`tests` (opus)**,
  because `ownership.json` excludes `apps/api/test/` from `backend` and `tests` is the only agent
  that may write or run those suites. The migration by **`migration-reviewer` (opus @ high)**, the
  floor a migration gets here. The integration, the four fixes the review found, the e2e suite's
  one broken guard and every verification that needs a database: **directly, opus @ medium, from
  the main checkout**.
- **Result**: **done.**
- **Scope held**: the plan's scope plus `packages/core/src/entities/Pantry/**` and
  `apps/api/test/`, both amended into it. Nothing outside the pantry's own files except five
  barrels, `profiles.module.ts`, `schemas/index.ts`, `schema.test.ts`, `fixtures.ts`, the
  migration journal and `apps/api/test/README.md`. No screen, no generation change, no prompt
  change.

### What was built

`pantry_items` as `userOwned` — so `user_id` cascades, and deleting the account deletes the
cupboard, which is the whole of what criterion 6 asks of the deletion half: `auth.config.ts`
enables `deleteUser` precisely because *"the cascade from `user.id` is what actually removes a
person's health data"*, and there is no table list anywhere to add this one to. Its uniqueness is
**two partial unique indexes** (`0068_a_cupboard_a_person_types.sql`), because Postgres counts
NULLs as distinct and one plain `unique(user_id, ingredient_id)` lets every *unresolved* label in
twice over.

The resolver reuses `core/domain/Safety`'s index, normaliser and curated synonyms whole and adds
one thing: a curated map of eleven coarse words, so *«tengo arroz»* lands on the dry food a
fortnight's list is written against (`0078`). `queso` is deliberately absent — thirty-eight
cheeses and no ordinary answer — so it stays unresolved and reaches `/admin` as a gap worth a word
(phase 5).

The bound is sixty, the same on both tiers, refused as a 422 naming `label`, and checked **inside**
the repository's transaction-scoped advisory lock against rows read in the same transaction that
writes — the read-then-compare a security scan found in `EventController.add` on 2026-09-22. The
two partial indexes are not that defence: they stop the same thing being named twice and say
nothing about sixty entries racing past a count.

### Evidence

Every command from the main checkout, against the local Postgres (69 migrations, 930 ingredients,
1,638 recipes):

| command | result |
|---|---|
| `node scripts/check-migrations.mjs --drift` | `0 new, 69 in all, journal and snapshot in order, schema and migrations agree` |
| `pnpm --filter core build` | clean |
| `pnpm turbo lint ts:check test --filter=core --filter=database --filter=api` | **11 tasks successful** — core 145 files / 4,169 tests, database 5 / 56, api green |
| `NUTRIA_LOCAL_PG=1 pnpm --filter api test:e2e test/pantry.e2e-spec.ts` | **11 passed, 11 total**, 14.5 s |
| `pnpm format` / `pnpm deadcode` / `pnpm check:leaks` | 7 tasks Prettier-clean / no findings / clean |

The pantry's own unit tests are **65 in `core` across five files and 8 in `api`**. Each exit code
above is the command's own: a first pass of this sweep piped every step through `tail` and reported
`exit=0` for all of them, which is `tail`'s status and not the command's — the same trap memory
records for `gate.sh`, fallen into three times in this session before the script was rewritten
without pipes.

**Criterion 7, checked rather than asserted.** `health-boundary.spec.ts` is unchanged and passing.
There is no log line in any file this phase added — `grep` over all of them for `Logger`, `logger`
and `console.` returns nothing — and the repository deliberately keeps Zod's message out of its own
`DatabaseOperationError`, because a `ZodError` over these rows would quote a label. The only
reference to the pantry anywhere outside its own module is `profiles.module.ts`, the wiring: phase
2 is what will read it.

**The e2e suite needed the local-Postgres flag, and the failure looked like the code's.** Without
`NUTRIA_LOCAL_PG=1` all eleven tests fail in ten seconds at sign-up with a 500 whose cause is
`better-auth` unable to query `rate_limit` — the connection goes to Neon, whose dev quota is spent
until 2026-11-01. Nothing to do with the pantry.

### Deviations from plan

1. **A fifth column, `normalised_label`.** Step 2's second index is on the normalised word and
   Postgres cannot reproduce `normaliseForMatching` — NFD, diacritics stripped, punctuation
   flattened — in an immutable index expression; a SQL normaliser that nearly agreed with the
   resolver's would be a second normaliser, which is the one thing this feature may not have.
   Written by the repository, read by the index alone. Plan amended.
2. **`packages/core/src/entities/Pantry/**` added to the scope**, because the repository parses its
   rows with a Zod schema and `packages/core/AGENTS.md` keeps Zod schemas in `entities/`. Plan
   amended.
3. **The e2e suite is not `backend`'s to write** — `ownership.json` excludes `apps/api/test/` from
   that role — so the phase is two dispatches. Plan amended, and this is a **plan error** rather
   than an execution one: any phase whose scope names a suite in `apps/api/test/` has the same
   shape, and the planner should split the dispatch when writing it.
4. **The coarse word is a curated map of eleven, not a family.** The catalogue holds no bare
   `arroz` row and the column holds one id, so the real question is which single row a coarse word
   means — and a word with no ordinary answer is better left unresolved than answered wrongly.
5. **The routes are `/pantry`, not under `/profile`.** The kitchen, the sibling the plan pointed
   at, has no module of its own — it rides `PATCH /profile/preferences` — so there was no
   controller to extend. `/pantry` is where `fixed-meals`, `events` and `vacations` sit, and the
   files are in the profiles module as the scope says.
6. **The Nest class is also called `PantryController`**, beside `core`'s, mirroring
   `ProfilesController` / `ProfileController`.

### The migration's review, and the four defects it found

`migration-reviewer` at opus and high effort: **`0068` is safe to ship as written, no P0, no P1,
nothing in the SQL to change.** Both FK statements take `SHARE ROW EXCLUSIVE` on the *referenced*
tables (`user`, `ingredients`), which blocks writes there and not reads, for milliseconds on an
empty table with indexed primary keys — but it leaves a warning for later: a future deploy that
ships a long backfill in the same pending batch as a key to `user` would hold that lock for the
whole backfill. The two predicates **partition** the table, so every row is covered by exactly one
index. And a partial unique index is **not** usable as an `ON CONFLICT` arbiter unless the
statement repeats its predicate — there is no upsert here, but a refactor to `onConflictDoUpdate`
must carry it or fail with 42P10.

Its four findings were checked against the files before any of them was fixed, and all four were
real:

- **P2 — a 500 where a 422 belonged.** `grams: 0.004` passed the body schema, was written as
  `0.00` into `numeric(9,2)`, and failed `.positive()` on the read back. The floor is now `0.01`,
  which is the column's floor and not a taste.
- **P3 — a label of punctuation alone replaced the previous one.** `normaliseForMatching('🍅')` is
  the empty string, which is the key the unresolved index holds *and* the key the repository
  matches on, so a second such entry silently updated the first. Refused now as a 422 naming
  `label`, which is what `resolveCustomAllergens` does by dropping an empty key.
- **P3 — the same word once resolved and once not**, reachable when the catalogue learns a word
  between two writes. **Fixed differently from the review's suggestion**: letting the resolved
  branch also match on the label would, with an unresolved row *and* a resolved row for another
  ingredient standing, write two rows for one ingredient and break
  `pantry_items_one_per_ingredient`. The twin is absorbed inside the lock instead — where the
  resolved row exists it stays and the twin is deleted, and where it does not the twin becomes the
  resolved row in place, keeping the order it was typed in. Two tests, one per branch.
- **P3 — two comments asserted what nothing enforced.** `unit` with no amount is now refused
  (422 naming `unit`), and the cascade carries its reason: `SET NULL` would let a catalogue
  deletion *fail* against the unresolved index with a 23505 naming nobody, during the API's build
  against production. `food_preferences.ingredientId` — the same shape, a typed label beside a
  nullable id — cascades for the same reason; `custom_allergens` is the one that uses `SET NULL`,
  because there the failure direction is a claim of enforcement outliving the thing enforced.

**One fix to the e2e suite, which was the suite's own guard and not the product's.** It read the
tier back from `GET /billing` before asserting the bound — a good instinct, so that a `setTier`
that did nothing could not leave the test measuring the free account twice. But with no Stripe
configured, which is every environment but production, that route answers its `available: false`
arm: the two tiers' allowances and no `tier` at all. The guard read `undefined` and failed a test
about the cupboard. It now reads the account's own row through `UserController.getUser`.

### Notes for the next phase

- **Phase 2 spends the draft through `PantryController`**, from the meal-plans side, and
  `PantryController.clear` is what it calls once the draft is spent — idempotent on purpose, so a
  generation that finds an empty cupboard is not a failure.
- **`PantryEntryView.slug` is the only part of an entry that may leave the product.** The label is
  the person's; it goes back to them and nowhere else.
- **The honest numbers for the sentence phase 3 will write** are in phase 0's § 1 and the notes
  above it: *≈19 of ≈105 real-food rows already bought* at thirty items, not *"one row in four"*.
- **`pantry_items` has no reader outside its own module yet**, which is what makes phase 2's diff
  readable: whatever starts reading it is phase 2's work and nothing else.
- **Running the e2e suite here needs `NUTRIA_LOCAL_PG=1`** and `pnpm db:local start`. Without it
  every test fails at sign-up with a 500 that has nothing to do with the code under test.

## Phase 2 — The fortnight's list comes back with what you already have (2026-10-26)

- **Executor**: the product code by **`backend` (opus @ medium)** in its own worktree, the
  dispatch the plan names; the integration, the three amendments decided before it started and
  every verification that needs a database **directly, opus @ medium, from the main checkout**.
  The e2e suite by **`tests`**, because `ownership.json` excludes `apps/api/test/` from
  `backend` — the plan's Dispatch line says so now, which phase 1 learned the hard way.
- **Result**: **done.**
- **Scope held**: `PlanGeneration.service.ts` and its spec, `PlanRepository.ts` and its spec,
  `domain/ShoppingList` and its spec, `entities/Plan/Plan.ts` and `controllers/Pantry` (both
  amended into the scope below), and the e2e suite. No screen, no prompt change, no new
  provider call, and nothing that orders, filters or reserves anything by what is in a cupboard.

### What it does, and where the shape carries the rule

The cupboard is read **after `buildShoppingList`** — after scheduling, after validation, after
the safety gate, after everything that chooses a dish has finished choosing. That is what makes
*"a pantry changes no pick"* a property of the shape of this code rather than a promise about it,
and it is why criterion 8 needs no test to be true: nothing the read returns can reach the pool,
the rotation, the scheduler or `promptPreferences` from that far down the function.

The list is seeded at its **first insert** and nowhere else, so every later rebuild carries the
seed for free through the `carriedBought` that `replaceGeneratedItems` already applies. The
cut plan's list (project 015) is deliberately left unseeded: that shop is already somebody's own.

The draft is cleared **after the plan is saved**, skipped when the job's deadline has passed, and
a failure to clear can never fail the generation — the plan is committed by then, and a throw
would hand somebody `GENERATION_FAILED` for a fortnight they already have. The warning carries
the error's message and never a label.

`generationMetadata.pantry` is `null` for a generation nobody told anything to — not a row of
zeroes — because *"nobody said anything"* and *"somebody said something that covered nothing"*
are different facts and phase 3's sentence may only be said about the second.

### The two figures, as implemented

- **`wholeMeals` of `meals`** — a meal counts when it has ingredients and **every** one of them,
  its accompaniment included, is in the resolved cupboard. Presence, never amount. Mirrors
  `pantryPlateMetrics.whole` in phase 0's instrument, so the sentence the screen will say is the
  number the project was priced on. An empty cupboard gives 0 and not all of them, which is the
  `every`-over-an-empty-list trap closed on purpose.
- **`coveredRows` of `rows`** — rows whose seed covers their **whole** need, which is a row
  nobody has to visit. Not every row the cupboard merely named: an amount below the row's need
  leaves a remainder on the list. Phase 0's `covered` counted `pantry.has(row.slug)`, which
  coincided with this only because phase 0 had no amounts at all.

Also stored: `asked` as `{ slug, grams }` pairs — slugs, the one part of an entry that may leave
the product — and `unresolved` as a **count**, so the plan records that three words went
unanswered and never which.

### Evidence

From the main checkout, against the local Postgres, each exit code the command's own:

| command | result |
|---|---|
| `pnpm --filter core build` | clean |
| `pnpm turbo lint ts:check test --filter=core --filter=api` | **11 tasks successful** |
| `NUTRIA_LOCAL_PG=1 pnpm --filter api test:e2e test/generation.e2e-spec.ts test/pantry.e2e-spec.ts` | **2 suites, 33 tests passed, 49.6 s** — eleven of them new |
| `pnpm deadcode` / `pnpm check:leaks` | no findings / clean |

`generation.e2e-spec.ts` passing is the load-bearing line: it generates real fortnights against
the real library, so the seed, the record and the clearing are exercised by the path a person
takes and not by a stand-in. Phase 1's `pantry.e2e-spec.ts` still passes beside it.

**The eleven cases live in `generation.e2e-spec.ts`** under *the cupboard the fortnight was asked
with (022 phase 2)*, sharing one generated fortnight rather than generating per case — the whole
file is 22 cases in 33 s because of it. They prove: a no-amount entry pre-buys its whole row and
leaves nothing on it; a part-filled row keeps `needed(range) − bought` **under the fortnight, one
week and one chosen day** (`0091`); an amount above the need is capped at the need; an unresolved
word seeds no row and is counted without being named; the seed survives a swap, capped at the new
need; a failed generation leaves the cupboard untouched and a successful one empties it; one
account's cupboard reaches no row of another's list; the plan row carries slugs and counts and
**no typed word anywhere in `to_jsonb(meal_plans.*)::text`**; and a fortnight nobody told anything
to stores `pantry: null` with every row untouched.

**The cupboard those cases type is chosen, not written down**, and that is the test's own finding:
the first version hard-coded *«pechuga de pollo»*, which this library has no row for, so three
cases passed while covering nothing. It now derives its entries from a fortnight the same run
generated — most-cooked-with first, each ingredient's own catalogue name as the label — and checks
what the product resolved them to. `wholeMeals` recomputed from `recipe_ingredients` and
`meal_accompaniments` came out **non-vacuous at 10 of 42**, which is the undercount above seen from
the other side: it reads low, not zero.

### Deviations from plan

1. **Seeded at the first insert (`PlanRepository.ts:361-383`), not inside
   `replaceGeneratedItems`.** The plan's step 1 named the rebuild path; a plan's **first** list is
   inserted by a plain `insert(shoppingListItems)` that never mentioned `boughtGrams`, so the
   column took its `'0'` default. Seeding there is also the smaller change, because the rebuild
   then carries it for free. **One seeding path, so a swap can never reseed from a draft that has
   been spent.** Decided before execution; plan amended.
2. **An entry with no amount seeds the whole row, ticked** — the plan's sentence said the
   opposite and cannot be implemented: `0091` gives a tick exactly two meanings, so there is no
   *"some"* state in this data model, and inventing one is a schema change this scope forbids.
   What settles it is that **phase 0 priced this feature with no amounts at all**. Decided before
   execution; plan amended; the owner was told, and it is reversible while phase 3 is unbuilt.
3. **`ShoppingItemDraft` gains optional `boughtGrams` and `checked`**, derived from one
   `carriedBought` call so the two can never disagree. Scope amended for
   `entities/Plan/Plan.ts`.
4. **`carriedBought` moved from `PlanRepository` to `domain/ShoppingList`.** Not cosmetic:
   importing it where it was would have created **the first `domain` → `#repositories` edge in
   `packages/core`**, and computing the seed in `apps/api` would have made that app import a
   repository `Plan.ts:172` calls private to `core`. One clamp, two callers, neither owning it.
   `0091`'s own text stays correct — it names `PlanRepository` only as the sole reader and writer
   of the two tables, which is unchanged — and no `AGENTS.md` mentions the function. **One stale
   pointer is left on purpose**: the architect's report
   `docs/reference/architecture/0012-…-2026-10-22.md` names `PlanRepository.ts:1417` at `:138`,
   `:421` and `:461`. It is a dated analysis and dated analyses are not rewritten.
5. **`PantryController.forGeneration` added** rather than reading `PantryRepository` from outside
   the pantry's module: nothing outside it should have to know that `ingredientId` is a column,
   and the one place that already holds the catalogue read is where both the id and the slug can
   come from. The label comes back in no form at all.

### A debt, written down rather than hidden

`spendPantry` runs in `generate()` after `persist`, not in `PlanJobRunner` after
`markSucceeded`. The plan's step 3 says *"when the job succeeds"*, and this is a moment earlier:
**if `markSucceeded` failed, a plan would exist, its job would read failed, and the cupboard would
be empty.** The runner is outside this phase's scope, and this position covers every caller of
`generate`. The cost of the rare case is bounded — the person regenerates, and that second plan
does not lean on the cupboard — and the alternative inside scope, clearing before `persist`, is
worse: a failed save would lose what somebody typed. Worth moving the day `PlanJobRunner` is
open for another reason.

### The finding phase 2 leaves open, deliberately

**`wholeMeals` undercounts, and so did phase 0's own figure.** `tests` found it while writing the
suite and the implementer left the behaviour alone, which was the right call: the contract was to
mirror phase 0's definitions so the screen's number is a number the project measured.

The asymmetry is the dry/cooked line (`0078`). The cupboard and the shopping **list** agree on the
dry row — *«tengo arroz»* resolves to `arroz-largo-crudo`, and `ShoppingList.ts:106` buys a cooked
grain dry (`dry?.drySlug && catalogue.has(dry.drySlug) ? dry.drySlug : item.slug`) — so
`seedFromPantry` *does* pre-buy the rice row and **`coveredRows` is right**. But a **plate** carries
the cooked slug (`arroz-blanco-cocido`, which `domain/Yield` maps to `arroz-largo-crudo`), and no
cupboard holds a cooked slug, so `pantryPlates` never counts a rice, pasta or dry-pulse meal as one
cooked from the house. Verified in all three places: `Yield.ts:21`, `ShoppingList.ts:106`, and
`evaluate-plans.mjs:640`, whose `whole` compares raw plate slugs with no mapping at all.

So **phase 0's *≈9 of 54 whole meals* is itself an undercount** — its larders were dry slugs
(`arroz-bomba-crudo`, `pasta-integral-seca`, `pan-integral`) — and the instrument that priced this
project has the same gap as the code that now ships. The figure is conservative in both, which is
the safe direction for a sentence a product says about itself, and the half of criterion 4 that
sells the feature (*«la compra baja de 38 a 27 cosas»*) is **unaffected**.

**It is phase 3's first step, not a patch here**, because closing it in `pantryPlates` alone would
store a figure larger than anything this project has measured, and the sentence would quote an
unmeasured number. The fix is `toDry(slug, 0)?.drySlug ?? slug` in `pantryPlates`, in the
instrument and in the e2e case together — `drySlug` is nullable — followed by a re-run of phase 0's
cohort so the number the screen says is measured again.

### Notes for the next phase

- **Close the `wholeMeals` undercount before the sentence is written** — the section above, and the
  doc comment on `pantryPlates`, which states it where the next reader will be.
- **Phase 3 reads `generationMetadata.pantry` and must parse it.** That column is
  `Record<string, unknown>` (`entities/Plan/Plan.ts:274`) — `kitchenShare`'s own precedent, which
  the plan told this phase to follow — so the shape is pinned by a unit test and by nothing in the
  type system. The shape to parse is `PantryRecord` in `PlanGeneration.service.ts`:
  `{ asked, coveredRows, meals, rows, unresolved, wholeMeals }`, or `null`.
- **The sentence is read, never recomputed.** The cupboard is cleared immediately after the plan
  is saved, so by the time a screen asks there is nothing left to recompute from. `null` means
  nobody was told anything and the sentence may not be said at all.
- **The honest numbers** are `coveredRows` of `rows` and `wholeMeals` of `meals`, both as defined
  above. Phase 0's figures for a thirty-item cupboard were *≈19 of ≈105 real-food rows* and
  *≈9 of 54 meals*; do not promise *"one row in four"*, which the PRD's own § *Problem* has
  marked superseded.
- **Nothing reads the pantry before the plan is picked, and phase 3 must not change that.** The
  screen says what the generation already did; it does not ask the cupboard anything new.
