# LOG — Project 020: The shopping list you are shopping now

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

## Phase 1 — The domain knows which day each gram is for (2026-10-09)

- **Executor**: opus @ medium, run directly — the phase's **Dispatch** line is this
  session's own model and effort, so no agent was spawned and no worktree was used.
- **Result**: done.
- **Evidence**:
  - `pnpm --filter core test` — 134 files, 3,911 tests, all passing.
    `src/domain/ShoppingList/ShoppingList.test.ts` alone: 37 tests (20 before), all passing.
  - `pnpm --filter core ts:check`, `pnpm --filter core lint` — clean.
  - `pnpm --filter api ts:check` — clean, which is the plan's "every current caller compiles
    unchanged": `PlanGeneration`, `MealSwap` and `PlanLoadRebuild` were not touched.
  - Coverage of the changed file: statements 98.36%, branches 97.77%, **functions 100%** —
    above the `src/domain/**` floor (90/100/95/95). The one uncovered line is the
    pre-existing `continue` for a slug the catalogue cannot resolve, uncovered before this
    change too.
  - `sh .claude/skills/ship/scripts/gate.sh --full` — migrations, checks, web-build and
    static ok; `format` failed on the new file, fixed with `prettier --write` (a chained
    call collapsed onto one line, whitespace only), then `pnpm format`, `pnpm deadcode` and
    `pnpm check:leaks` re-run green, and core's lint and suite re-run green after it. Run
    once, nothing else running (the machine dies with two gates at once).
  - PRD 2, on the numbers: `rangeQuantity(row, every day of the row)` equals the row's
    stored `displayQuantity`, `displayUnit` and `totalGrams` for every row of two fixtures
    covering all the kinds — grams, countable, slice, ml, over a kilogram, a merged
    cooked+dry grain, and a cooked pasta with no dry counterpart.
  - PRD 4, on the numbers: a 14-day fixture with 100 g on days 1–5 and 8–14 reads 500 g for
    week 1, 700 g for week 2 and 1,200 g for the fortnight, from the one stored row.
  - The round-up is after the sum, proved by a case where it matters: 50 g of cooked pasta a
    day for three days is 70 g dry, not the 75 g that rounding each day to 25 g first would
    buy.
- **Deviations from plan**: three, all recorded here, with the plan amended in this same
  change where a later phase is affected.
  1. **A built row carries two fields the plan did not name: `dryRounded` and
     `gramsPerUnit`.** Neither can be recovered from the rest of the row, and
     `rangeQuantity` needs both. A plan with cooked *and* dry couscous merges into one row
     named and slugged after the **dry** food, so nothing left in that row says its weight
     came off a cooked grain and must be rounded up to 5 g — and inferring it from the slug
     would start rounding a row of plain dry couscous that today is bought to the gram.
     `gramsPerUnit` is the same problem for countables: 3 eggs for 150 g does not say that
     an egg is 58 g, so the range's own `ceil(grams / 58)` is uncomputable without it.
     Phase 2's step 5 is amended to persist and serve both.
  2. **`rangeQuantity` defines two edges the plan left open**, because the server and the
     screen both call it and must not disagree: **no day chosen is nothing to buy**, for
     every row; and **a row with no breakdown shows its stored quantity under every range**.
     The second is what keeps a hand-added row (it belongs to no day — PRD 7) and a row
     stored before the migration visible to somebody walking a supermarket. The opposite
     default would empty the list for every existing plan until it was regenerated.
  3. **A source day's `date` is optional**, and a day without one is filed under a
     `day-<n>` placeholder. Phase 1's scope is `packages/core/src/domain/ShoppingList/`
     alone and every current caller must compile unchanged, so the three callers cannot be
     given dates until phase 2. An undated day is still counted into the row's total — the
     list is never short — and no range can select it. Phase 2's step 2 is amended to say
     that every writer must supply real dates.

  One implementation note that is not a deviation but matters: **`totalGrams` is now the
  breakdown summed by the very function a range uses.** `buildShoppingList` no longer keeps
  a separate running total. Floating-point addition is not associative, so a total summed
  item-by-item and a range summed day-by-day could have differed in their last bits and, on
  an unlucky value, by a whole 5 g step after the round-up. Summing once, in one order,
  makes PRD 2's identity true by construction rather than by luck.
- **Decisions**: none created.
  [`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md)
  is the record this phase implements; [`0078`](../../decisions/0078-a-plate-has-a-gram-ceiling-and-cooked-grains-read-dry.md)
  and [`0053`](../../decisions/0053-the-shopping-list-survives-the-supermarket.md) are
  unchanged.
- **Notes for the next phase**:
  - **What phase 2 must persist and serve**, beyond `boughtGrams`: `perDay` (date →
    unrounded grams, already dry where `0078` applies), `dryRounded` and `gramsPerUnit`. The
    last two may live inside the `perDay` jsonb payload rather than as their own columns —
    phase 2's "justify the shape" clause covers either.
  - **Every writer must give its days their dates.** `MealCompositionView` already carries
    `date`, so `groupByDay` in `MealSwap.service.ts` and `PlanLoadRebuild.service.ts` can
    pass it straight through. `PlanAssignment`'s `PlanDayAssignment` has only `dayIndex`, so
    `PlanGeneration.service.ts` must map `dayIndex` → `date` from the plan's start date.
    Without that, the breakdown is placeholder-keyed and the fortnight reads short.
  - **Rows stored before the migration ride the empty-breakdown fallback** and read as the
    whole plan's need under every range. Nothing has to be backfilled for the screen to be
    correct, only for it to be filterable.
  - **Phase 3's fortnight preset can read the row's stored `displayQuantity` and
    `totalGrams` directly**, which is exactly equal to today's list by construction — the
    cheapest way to satisfy PRD 2's "an unfiltered list equals today's list".
  - **`rangeList` keeps the order it is given and must not re-sort.** A freshly built list
    is in `CATEGORY_ORDER`; a stored list comes back ordered by the database's
    `ingredient_category` enum, whose order differs (`pantry` and `bakery` are swapped).
    That mismatch predates this project and is left alone; re-sorting inside `rangeList`
    would silently change one of the two screens.
  - The exported surface phases 2–4 build on, all from `core/domain/ShoppingList`:
    `rangeQuantity(row, days)`, `rangeList({ items }, days)`, and the types
    `ShoppingRangeRow`, `RangeQuantity`, `RangeRow`, `ShoppingPerDay`, `ShoppingRow`,
    `ShoppingList`, `ShoppingSourceDay`.

## Phase 2 — An amount bought, and the days on the wire (2026-10-09)

- **Executor**: opus @ medium, run directly — the **Dispatch** line is this session's own
  model and effort. Both reviews the phase names were spawned as agents on opus:
  `migration-reviewer` (its definition pins high effort, the floor for a migration) and
  `invariant-reviewer`. Neither edited anything; every fix below is this executor's.
- **Result**: done.
- **Evidence**:
  - `sh .claude/skills/ship/scripts/gate.sh --full` — **green from the top** on `main` with
    phase 1 merged: migrations (`--drift`), lint, types, tests with coverage, the web build,
    every public page still static, format, dead code, leaks.
  - `pnpm --filter core test` 3,927 · `pnpm --filter api test` 1,642 · `pnpm --filter
    database test` 53 · `ts:check` clean in core, api, web and database.
  - `node scripts/check-migrations.mjs --drift` — "journal and snapshot in order, schema and
    migrations agree". The migration applied to the local Postgres, and
    `\d shopping_list_items` shows the four columns with the intended nullability and
    defaults.
  - **The write path proved against real Postgres**, which no unit test can do because the
    bound is SQL: a throwaway table with the production column types, the write's own
    expression, eight cases, all as specified — 500 of 1,200 → 500 unticked; 999,999 →
    1,200 ticked (the cap); −50 → 0 (the floor); an old client's tick → the whole need,
    ticked; its untick → 0; exactly the need → ticked; **99.999 of 100 → 100.00 ticked**
    (the reviewers' P1, after the fix); and a row that needs nothing → 0, **unticked**.
  - PRD 3 (bought is an amount, never below zero nor above the need): the eight cases above,
    plus unit specs on the two decisions extracted for the purpose, `boughtAsk` and
    `carriedBought`.
  - PRD 7 (a swap, rebuild or regeneration keeps the amount, capped at the new need):
    `carriedBought` specs — carried unchanged when the row keeps its size, capped when a
    swap shrinks it, zero for an ingredient new to the plan, never negative.
  - PRD 10 (ownership unchanged): `invariant-reviewer` verified the walk in the SQL Drizzle
    actually emits, built offline with `.toSQL()` — `… where "shopping_list_items"."id" = $4
    and "meal_plans"."user_id" = $5 and "meal_plans"."status" <> 'pending_review'`. Another
    account's item and a plan under review both update nothing, which the controller turns
    into a 404, never a 403. The amount reaches SQL as a bound parameter, so a hostile
    string stays a parameter. Controller specs cover the 404 and the pass-through.
- **Reviews**: no P0 from either. `migration-reviewer`: 0061 destroys nothing, is
  reversible, and the previous API keeps working against the new schema in both directions.
  `invariant-reviewer`: ownership, the 404 shape and `0060` invisibility intact; nothing new
  reaches a prompt, a log, an error body or a professional route; `perDay` is not
  client-writable. What they found, and what was done:
  - **P1 (fixed) — the derived `checked` could disagree with the stored amount.**
    `bought_grams` is `numeric(9,2)`, so Postgres rounds on assignment, while `checked` was
    derived from the *unrounded* expression: 99.999 g asked of a 100 g row stored 100.00 and
    derived `checked = false` — a fully bought row saying it is not, the one state `0091`
    says cannot exist. Fixed by rounding first, `ROUND(LEAST(GREATEST(…), …), 2)`, one
    expression for both columns, so the comparison reads the number the row will hold. Both
    reviewers derived it independently; the backfill cannot produce the state (same type and
    scale on both sides), so the write path was the only way in.
  - **P3 (fixed) — a correctness hole in the event rebuild.** A remade day whose date could
    not be found was filed under a `day-<n>` placeholder. The damage was not obvious: the
    row's breakdown would be *partly* dated, so it would miss `rangeQuantity`'s
    empty-breakdown fallback and read **short under every date range while its total stayed
    right**. A list that quietly under-buys is the one failure this project cannot have, so
    an undated day now joins the service's other refusals: nothing is written and the log
    says why.
  - **P3 (fixed) — a stale rationale that would have outlived the column.** Both the schema
    comment and `0091` said `checked` is kept partly because "the admin console reads it".
    Both reviewers grepped: these two tables have exactly one reader and writer,
    `PlanRepository`, and the only screen that reads the flag is the web shopping list. The
    deploy window alone justifies the column; the sentence is corrected in both places, and
    `0091` carries an `Amended 2026-10-09` note saying so — left standing, that is how a
    column survives the release that should drop it.
  - **P3 (fixed) — a row that needs nothing read as bought.** `0091` says both "done when
    `bought >= needed`" and "untouched at zero", and at a zero need both apply. Resolved in
    favour of untouched — nobody bought it — with `AND total_grams > 0` in the write and the
    matching guard in `carriedBought`, and `0091` amended to say which sentence wins. Note
    that `ROUND` does **not** cover this edge, contrary to one line of the P1 report: at a
    zero need the rounding is a no-op and the guard is what settles it. Both are in.
  - **P1 for growth (recorded, nothing to change)** — drizzle wraps every pending migration
    file in **one** transaction, so the `ACCESS EXCLUSIVE` from the `ADD COLUMN`s is held
    across the backfill: milliseconds at a few thousand rows, a second or two near 100k
    ticked rows, tens of seconds of a closed table near a million, which the shared pooler
    would spread to unrelated endpoints. At this beta's scale it is a non-event. The
    non-obvious part is written into the migration's own comment so the next person does not
    try to fix it the wrong way: **splitting the file does not shorten the lock** — only two
    deploys do.
  - **P2 (accepted, deliberately not fixed) — the deploy window.** Between the backfill
    committing and the new API being `Ready`, the build still live writes `checked` without
    `bought_grams`, so a tick made in that window is lost and an untick is sticky. The
    sticky direction (`checked = false` with the amount at the need) is indistinguishable
    from a legitimate partial shop, so no read-side rule can repair it. The alternative is
    two coupled special cases, at the view mapping and at the carried map, both to be
    removed again next release, to protect one checkbox for a minute on a friends beta.
    Recorded as chosen, not as a bug.
- **Deviations from plan**: six, each with the plan amended in this same change.
  1. **The phase's scope did not list the three writers.** A list is built in
     `PlanGeneration`, `MealSwap` and `PlanLoadRebuild` — the last under
     `apps/api/src/modules/events/`, which the scope omitted. Without them a swap or an
     event rebuild would write a list with no breakdown at all, which phase 3 could not
     filter. Scope amended.
  2. **`pnpm db:check`, the phase's second verification command, does not exist** in this
     repo. `node scripts/check-migrations.mjs --drift` is what does that job (and is what
     the gate runs as its `migrations` step); used instead, green.
  3. **Three columns, not one jsonb envelope.** Step 2 invited a justification for any shape
     but `perDay jsonb`, and the row needs two more things `rangeQuantity` cannot recover —
     the dry flag and the grams per unit. They are their own columns rather than fields
     folded into the `perDay` payload, so that `per_day` stays *exactly* phase 1's
     `ShoppingPerDay` and is stored and read with no conversion, and so that both are typed
     and queryable rather than buried in JSON. All four additions are nullable or defaulted.
  4. **The cap and the floor are not proved over HTTP in this phase.** They are SQL, and
     `packages/core`'s repository tests are mock-based by design
     (`packages/core/AGENTS.md`), where asserting a clamp would assert the mock. So the
     decisions around the clamp were extracted as two pure exported functions — the file's
     own established pattern, beside `saveShape` and `refusesProfessionalSave` — and unit
     tested, and the clamp itself was proved by the Postgres rehearsal above. The four HTTP
     cases `invariant-reviewer` found missing are routed into phase 5's steps, which owns
     `apps/api/test`. Two comments that claimed "covered end to end" for an amount were
     corrected to say what is and is not covered: today's suites only ever send a tick.
  5. **`setItemChecked` → `setItemBought`, `setShoppingItemChecked` →
     `setShoppingItemBought`**, and the API service and route with them. The write no longer
     only ticks, and a name that says it does would mislead every later reader.
  6. **Phase 4's scope gained a rule**, from `migration-reviewer`: that phase must send
     `{ boughtGrams, checked }` — both — for one release. A new web build sending the amount
     alone reaches the API still live during its own deploy, whose body schema predates this
     phase and answers with a 400, and by `0055` a 4xx **drops the entry from the offline
     queue** — the mark would vanish with no trace. `boughtAsk` already prefers the amount
     when both arrive, so sending both is correct against either API.
- **Decisions**: no new record.
  [`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md)
  amended on two points of fact (the admin-console claim, and which sentence wins at a zero
  need), with the amendment noted in the record itself.
- **One note on the review itself**, because it cost a round trip and the next lead will hit
  it: `invariant-reviewer` re-read this file after the rounding fix had landed and reported
  the P1 as still open, anchored on the pre-fix line numbers — the comment added above the
  clamp had moved it eight lines down. The fix was verified in the tree by grep before the
  second report was acted on, and the reviewer confirmed it once shown the line. A reviewer
  reading a tree that is still being edited is worth checking against the file rather than
  fixing twice.
- **Notes for the next phase**:
  - **The migration's merge order.** `scripts/check-migrations.mjs` never reads a journal
    entry's `when`, and the migrator skips a file stamped at or before the last one applied
    — silently, with no error CI or a fresh database would surface. 0061 is stamped
    2026-10-09 14:35 UTC. At the time of writing it is the **only** migration in flight
    (#257 carried none, and no stale branch has one), and production's last applied is 0060,
    so nothing needs re-stamping. If another migration reaches production before this one
    does, re-stamp 0061's `when` at merge time — and then the local Postgres needs
    `pnpm db:local reset`, since it has already applied 0061 under the old timestamp.
  - **What phase 3 reads.** `ShoppingListItemView` now carries `boughtGrams`, `perDay`,
    `dryRounded` and `gramsPerUnit`, all as numbers, with `perDay` normalised from `null` to
    `{}` at the presenter so every reader has one shape. The fortnight preset can still read
    the stored `displayQuantity`/`totalGrams` directly for an exact match with today's list.
  - **A privacy note for phase 3**, from `invariant-reviewer`: `perDay` adds *which day you
    eat what* to the payload the service-worker cache already holds. The v2 offline queue
    must stay ids-and-amounts only and must still clear on a session change (`0055`).
  - **Rows written before this phase** have `per_day = NULL` and ride phase 1's
    empty-breakdown fallback: they read as the whole plan's need under every range, so every
    list in production today stays correct and simply is not filterable until its plan is
    regenerated, swapped or rebuilt. Nothing needs backfilling for the screen to be right.
