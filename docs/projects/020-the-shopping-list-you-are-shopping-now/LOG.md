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

## Phase 3 — Pick your days (2026-10-09)

- **Executor**: opus @ medium, run directly — the **Dispatch** line is this session's own
  model and effort. The review the phase names was spawned as an `accessibility` agent on
  opus. It edited nothing; every fix below is this executor's.
- **Result**: done.
- **Evidence**:
  - `sh .claude/skills/ship/scripts/gate.sh --full` — green from the top, after the probe's
    own fixes landed.
  - `pnpm --filter web test` 254 (240 before), `ts:check` and `lint` clean.
  - **`/local-probe` on `/compra` at 320, 390 and 1280 px, light and dark**: six of six
    200, **zero sideways overflow**, correct `h1`, no hints to judge. The probe needed a
    plan, which a throwaway account does not have — see the deviations.
  - **The filter was driven, not just photographed.** A screenshot says a page fits, not
    that it works, so the real control was clicked in the real production build and the
    screen read before and after:

    | Range | Rows | Avocado | Subtitle | Live region |
    | --- | --- | --- | --- | --- |
    | Fortnight | 132 | 568.2 g | "los catorce días" | `""` |
    | Week 1 | 91 | 352.5 g | "la primera semana" | "Lista para la primera semana: 91 cosas que comprar." |
    | Week 2 | 79 | 215.7 g | "la segunda semana" | "Lista para la segunda semana: 79 cosas que comprar." |

    **352.5 + 215.7 = 568.2**, exactly the fortnight's figure — PRD 2's identity holding on
    a real plan through the whole stack, not on a fixture. The live region is empty on load
    and fills only after a change, which is the `announce` flag doing its job. Unticking
    every day leaves 0 rows, the subtitle says "los días que has elegido", the region says
    "No has elegido ningún día." and the way back appears; it does not appear while rows
    exist.
  - PRD 1 and 5 are that table. PRD 8: the choice survives in `localStorage` and is dropped
    with the rest of this device's state on a session change (`forgetRange` beside
    `forgetPendingTicks`). PRD 9: gate green and the accessibility review passed, below.
  - **Offline (step 8), stated as the plan asks**: the filter never becomes an address. It
    is radios in a `fieldset`, not tabs and not links, and `/compra` keeps its exact path —
    no query string, no new segment — so the copy the service worker stored by path
    (`0053`) is still the copy it serves. Both allow-lists are untouched.
- **Review**: `accessibility` found two P1, three P2 and no P0. All fixed in this change:
  - **P1 — picking a range was never announced** (WCAG 4.1.3). A blind shopper heard
    "Semana 1, radio, seleccionado" and nothing about the nineteen rows that had just left;
    the sentence naming the range sits *above* the control, already behind them. Fixed with
    an always-mounted `aria-live="polite" aria-atomic="true"` region that starts empty,
    following `CareAccessLog`'s precedent. The reviewer's reasoning for why the `announce`
    flag is load-bearing was the part this executor would have missed: without it,
    hydration swapping the server's range for the device's would announce a range nobody
    chose.
  - **P1 — the "show the fortnight" button threw focus to `<body>`**, because it unmounts
    the instant it is pressed. Focus now lands on the fortnight segment, which announces
    itself.
  - **P2 — the `role="status"` sentence entered the DOM already holding its text**, which
    is the case where nothing is read, worst on VoiceOver/Safari — the owner's device. The
    visible sentence is plain text now; the region above is what speaks.
  - **P2 — the chosen segment had no visible boundary**: measured `--surface-card` on
    `--surface-sunken` at **1.06:1 light and 1.02:1 dark**, verified independently here.
    With the native radio at `opacity: 0` there was no native mark carrying the state
    either, unlike the day checkboxes. Fixed with a `--color-brand-09` border: **4.56:1
    light, 4.36:1 dark**, clearing 1.4.11's 3:1, with the weight and text colour changing
    too so the state never rests on colour alone.
  - **P2 — forced colours erased the control.** Both backgrounds become Canvas, both text
    colours CanvasText, and `opacity` is not forced, so what was left was four words in a
    row with one semibold. The chosen segment now takes a `Highlight` border and the track
    an `outline`. The verdict on the `opacity: 0` radio is narrower than feared and worth
    recording: it stays focusable, operable and correctly announced — forced colours does
    not touch the accessibility tree — so only the *seeing* broke.
  - **Judged and not done**: a visible `legend`. The cure needs the flex moved to an inner
    element so the UA does not fight a visible `<legend>`, and the control is already named
    for assistive tech, named again by the subtitle, and now announced after every change.
    It goes to the owner as a P3 with the reviewer's sharper point attached: on `/compra`
    with a scheduled plan, `PlanSwitch` sits 12px above wearing the same pill recipe, so
    there are two near-identical rows — one navigating, one filtering — and neither carries
    a visible label. That is a property of the pair, not of this component.
  - **Reported, not fixed**: `PlanSwitch` has the same 1.06:1 / 1.02:1 contrast defect, in
    code this phase did not touch. Per `apps/web/AGENTS.md` § Design review that is the
    owner's call unless it is a P0, and it is not: there the chosen pill also carries
    `aria-current`, the subtitle and the URL, and misreading it costs one tap — where
    misreading this filter means buying a week's food for a fortnight. If they are ever
    unified, the direction is to bring `PlanSwitch` up to this.
- **Deviations from plan**: five, with the plan amended in this same change where it matters.
  1. **A new file the scope did not name**, `apps/web/src/lib/shoppingRange.ts`: the range's
     own pure logic and its per-device memory, which belongs beside `pendingTicks.ts`
     rather than inside any of the three lib files the scope listed. Scope amended.
  2. **`ShoppingList` became a client component** rather than gaining a client child. It is
     the smallest shape that works: the range decides the rows, the quantities, the
     progress, the share text and the subtitle, so a server parent would have had almost
     nothing left to render. Next still server-renders it, so the cached copy is unchanged.
  3. **The probe needed a plan, which the skill gates behind the owner's word.** A
     throwaway account has none, and `/compra` without one renders the page's existing
     empty state — exercising nothing of this phase. The owner chose, on 2026-10-09, to
     have one generated for the throwaway account through the API's own route on the local
     Postgres (`AI_PROVIDER=stub`, the local library of 871 recipes, nothing written by
     hand, account deleted afterwards). It worked: 132 rows, and the first row came back
     carrying `perDay` with 8 dated days and `boughtGrams: 0` — incidentally the first live
     confirmation that phase 2's writers date their days correctly.
  4. **Two states the plan left open**, decided here and worth naming: picking "days"
     starts from the days already on screen, so the list never blinks empty on the way to a
     narrower range; and the day checkboxes appear only once "days" is chosen, because
     fourteen checkboxes nobody asked for would be the loudest thing on a screen whose job
     is a list.
  5. **Unticking the last day is a state, not an error.** The first implementation treated
     an empty day list like stale dates and snapped back to the fortnight — which would
     have hidden the very checkboxes the reader was using. It now falls back only when the
     stored dates belong to *another* plan. Found reviewing this executor's own work before
     the agent saw it, along with a live region wrapping a button, an empty state offered
     to a reader already seeing the whole plan, and a duplicated CSS rule.
- **What the probe found that no check could**: at 390 px the four preset labels broke
  mid-phrase ("Semana / 1", "Elegir / días"). About 202 px of room for about 245 px of
  Spanish labels, with the unbreakable "Quincena" holding its width while the rest gave
  way. The wrap breakpoint moved from 23rem to **27rem**, so a 390 px phone (24.4 rem) gets
  the two-by-two layout at ~169 px a segment and every label keeps its line.

  It was found here by looking at the screenshot — the `accessibility` agent had named this
  finding three times without delivering it, and sent it only after the fix had shipped. Its
  version, when it arrived, prescribed the same 27rem and added the part worth keeping:
  **ragged is the smaller half.** The chosen segment is semibold and therefore wider, so
  *which* labels wrap changes as you pick — the control's height moves under the reader's
  thumb and shifts the list below. And nothing scrolls sideways, because a flex item's
  `min-width: auto` is the floor, so the probe's own line stays green: this is a class of
  defect only a screenshot can catch.
- **What this review is and is not**, in its own words at hand-back: it ran no build, no
  probe and no gate, so every figure in it was read off the tokens and the markup rather
  than measured in a browser. The one part confirmed against a real render is the 390 px
  arithmetic, which the probe's screenshot settled. Its contrast numbers were separately
  recomputed here from the token values before any of them were acted on.
- **One finding left for phase 4, not dropped**: `ShoppingItem.tsx:57-61`, where the
  quantity `<span>` sits outside the `<label>`, so the checkbox is named "Aguacate" and
  nothing more. It was true before this phase, and this phase makes it matter more — the
  omitted quantity now changes with the range, so one row announces the same name for a
  week's amount and a fortnight's. Phase 4's step 4 already owned it and now says so
  explicitly; it is the phase that makes the amount the thing being announced, so fixing it
  earlier would mean writing that name twice.
- **Still only the owner's iPhone can answer** (`accessibility`, and it is right): whether
  the new live region is actually spoken by VoiceOver on iOS when a range is picked. An
  iOS/Safari live region is the one that most often stays silent, which is exactly why this
  one is mounted from the start and filled afterwards rather than inserted with its text —
  but a desktop Chrome cannot prove that, and this project's reader is on a phone.
- **Decisions**: none created.
  [`0091`](../../decisions/0091-the-shopping-list-is-read-by-range-and-bought-by-amount.md)
  is the record this phase implements.
- **Notes for the next phase**:
  - **Phase 4 must send `{ boughtGrams, checked }` — both — for one release**, already
    written into its steps: a build sending the amount alone reaches the API still live
    during its own deploy, gets a 400, and `0055` drops the queued mark with no trace.
  - **A privacy note carried from phase 2's review**: `perDay` puts *which day you eat
    what* into the payload the service-worker cache already holds. The v2 queue must stay
    ids-and-amounts and must still clear on a session change.
  - **Driving the control in a test clicks the label, not the input.** `.presetLabel` sits
    above the stretched radio, so an automated click on the input is intercepted — by the
    label, which is inside it, so a real pointer or finger works exactly as expected.
  - `/compra` has one address and takes its language from the account, so there is no
    `/en/compra`; the English copy needs an account whose locale is `en-GB` and the locale
    cookie the switcher writes, not a prefixed URL.
