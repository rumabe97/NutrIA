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

### Notes for the next phase

- **Phases 1, 2, 3 and 5 are unaffected by anything measured here and carry the whole of the
  promise.** Phase 1's provisional bound of **60** is supported: use it.
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
