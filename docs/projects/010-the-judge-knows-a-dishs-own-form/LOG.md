# LOG — Project 010: The judge knows a dish's own form

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

## Phase 1 — The acceptance set, before the rule changes (2026-09-30)

- **Executor**: `backend-high` on opus (the plan's `opus @ high`), in three rounds; review by
  `invariant-reviewer` (opus, high), twice. The lead brought the files over, reworded one
  old test's dish name, and ran the verification.
- **Result**: done. `judge.ts` is untouched.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core` (forced): 7 of 7 tasks green — core
    1773 tests passed and **136 marked as expected to fail**, 103 files. Format clean.
  - Private data: the leak patterns find nothing in the new files; every test title is at
    least 3 words from any title of the private library or the pilot (checked by the
    implementer by word distance, and by the lead for the one title he changed).
  - `invariant-reviewer`: first pass 4 P1 (below), all closed; second pass no P0, no P1.
  - One run of the gate under load reported one failed test that a forced rerun and a
    direct run did not reproduce; nothing in these files was found to depend on timing.
- **What the suite holds**:
  - **The pilot** (`judge.pilot.fixture.json`, `judge.pilot.test.ts`): 68 pictures — 65
    faithful accepted with their notes pinned per picture, the 3 wrong-recipe controls
    rejected, each pinned by the food and allergen that reject it (not by their full notes,
    so closing a hole in phase 5 does not force an edit here). Recipes titled "Plato del
    piloto NN"; kept per picture: the foods seen, the match, the ingredients (slug, name,
    grams), and the picture's numeric marks and a count of non-food objects, which the
    pinned notes depend on. Nothing else: no title, no id, no file name, no provider text.
  - **The production cases** (`judge.forms.test.ts`): the three rebuilt, each every way the
    match call could have answered — 6, all marked. One more test pins today's mechanism
    (the rice cakes' note), to be deleted by phase 2 with the behaviour.
  - **The classes**: 15 families, the three vocabulary fixes and the bounds of report § 7.3
    — 160 faithful cases (130 marked), 93 that must stay rejected, 18 second-food cases.
  - **The reverse measure** (`judge.reverse.test.ts`): 20 example dishes written for the
    test × the report's 63 extra foods = 1,260 pairs; 83 accepted today, pinned per dish.
    It measures an extra food *beside* the dish's own foods, so it will not reconcile with
    the report's 229 (measured on the library); phase 2 reads it family by family.
  - **The holes** (`judge.holes.test.ts`): 166 names; the 19 that map to no allergen today
    pinned one by one, and a guard that fails if a 20th appears.
  - **The helper** `packages/core/src/test/dish-picture/acceptance.ts` reads the seed
    catalogue straight from `packages/database/src/seed` (as `SlugRepair.seed.test.ts`
    does) in the shape production's catalogue read gives; excluded from build and coverage.
- **Deviations from plan** (in the plan as amendments):
  - The shared helper lives under `packages/core/src/test/dish-picture/`, outside the
    phase's listed folder: a helper beside the rule would be compiled into the package.
  - **From the review, decisions of the lead** (the P1s): rice and corn cakes are crackers
    only, not cakes ("carrot cake" on a rice-cake dish stays rejected, and
    `judge.test.ts`'s "cake" on rice cakes is *not* rewritten by phase 2); a bare "burger"
    on a plant-protein or tofu dish stays rejected for its bun ("burger patty" and "patty"
    are excused); the breading family is keyed by the title only, as `0073` says.
  - **Decision of the owner** (the fourth P1): a sulphite a food only *may contain* never
    rejects a picture; one it *contains* still does — dried apricots, wine. PRD and plan
    amended.
  - Lettuce tacos, a crustless quiche and sweet-potato toast (a title naming the form and a
    material that is not it) are not pinned either way: phase 2 decides.
  - Two production titles are reworded — the same titles exist in the private library. The
    pancakes case opens with production's own prefix, "Tortitas caseras de maíz", already
    public, so it is no easier than production was.
  - An old test of `judge.test.ts` (since #128) named its tofu bowl exactly as a pilot dish;
    reworded. Lentil pasta joins the pasta family, beyond the report's annex.
- **Notes for phase 2**:
  - Unmark each `it.fails` as the rule makes it pass; a marked case that passes fails the
    suite, so the marks stay exact. Delete the mechanism test of the production cases.
  - **The architect's prototype is not the target.** Against this suite it accepts 122 of
    the 136 marked cases and **breaks 10 rejects**: a bare "burger", breading excused by an
    ingredient, cakes on rice cakes, dried apricots and wine. It also no longer accepts the
    production pancakes with their real prefix ("tortitas … de maíz" must not read as corn
    cakes when the dish holds corn flour and no `tortitas-de-maiz`). 14 marked cases need
    English title words (bread, battered, pancakes, cake, cookies, croquettes, meatballs).
  - Write `own_form:` only when the exemption removed a foreign allergen, or the pilot's
    pinned notes move (plan, phase 2 step 5).
  - Holes found outside the 19, for phase 5: "hamburger", "sausages", "buttermilk".
  - The fixture's generator and the architect's harness are in the private local context,
    in the main checkout only.

## Phase 3 — What the judge said is kept (2026-09-30)

- **Executor**: `backend-high` on opus (the plan's `opus @ high`) for core and the service;
  `tests-high` on opus for the end-to-end suites; review by `invariant-reviewer` (opus, high)
  and `legal`. Run beside phase 1, in their own worktrees; the lead brought both in after
  phase 1 merged (#176) and ran the verification on top of it.
- **Result**: done. The judge's rule is untouched; nothing a person sees changes.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web` (forced), with
    phase 1's suite in place: 17 of 17 tasks green — core 1807 passed and 136 expected to
    fail, api 1232, web 135, ui 487, database 43.
  - End-to-end: the dev database is over its monthly quota until 2026-10-01, so the touched
    suites (`picture-judgements`, new; `picture-acceptance`, `picture-candidates`) run in CI
    only; lint and types are green locally.
  - `invariant-reviewer`: no P0, no P1; one P2 (a change of shape would have dropped the
    history a row held) and three P3s, all fixed — the drawings are versioned and an older
    or newer shape is carried as it is.
  - `legal`: what is stored is a picture of a dish and a model's words on it; it names
    nobody. IMG-2, the DPIA and the record of processing say what is kept.
- **What was built**:
  - `PictureJudgement` (`core/entities/DishPicture`): the closed, bounded, versioned shape of
    `provenance.drawings` — the last 3 drawings, 3 attempts each, the recipe as it was judged
    once per drawing; caps on foods, names and notes; control characters and lone surrogates
    removed from every string a drawing's end writes (`jsonbSafe`); what is cut is marked
    `reduced`. Storing never throws and never changes how a drawing ends.
  - Every writer keeps the drawings: the three ends of a drawing read the row under its lock
    and write it back in one transaction; the retry, the removal and the hand-accept keep
    them; the hand-accept also keeps the rejections' `notes`, and still holds no path.
  - None of it leaves: the console's reads select `provenance - 'drawings'`; no view, answer,
    audit row or log line carries a name a model wrote — pinned by unit tests and by the new
    end-to-end suite with a sentinel name.
  - No migration: `provenance` is `jsonb` already.
- **Deviations from plan**: step 1 widened — the drawings survive the dish's next drawing
  (plan amended the same day, before the work). The end-to-end cases that read
  `provenance`'s exact keys moved with it.
- **Decisions**: none new; `0073`.
- **Notes for the next phase**:
  - Phase 6 reads `provenance.drawings` in production (read-only) to replay each attempt
    through a changed rule; the e2e suite shows that a stored attempt replays to the verdict
    it stored.
  - Any change to the shape raises `PICTURE_DRAWING_VERSION`.


## Phase 4 — Any published picture can be removed (2026-09-30)

- **Executor**: three opus agents at high in parallel, on one contract — `backend-high`
  (core and api), `frontend-high` (the console), `tests-high` (the end-to-end cases).
  Reviews: `invariant-reviewer` (opus, high), `accessibility-high` (code only), `legal`.
  Built beside phase 2 and ahead of it: `legal` advised that phase 2 not ship before a
  picture the judge accepted can be taken back.
- **Result**: built and verified; **waiting for the owner's check** (human-verify) and for
  the local probe, which needs the dev database (over its monthly quota until 2026-10-01).
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web` (forced,
    `--concurrency=2`): 17 of 17 tasks green — core 1815 passed and 136 expected to fail
    (phase 1's marks, for phase 2), api 1233, web 142, ui 487, database 43.
  - End-to-end: `picture-acceptance` rewritten; it first runs in CI (dev database over
    quota). Lint and types green.
  - `invariant-reviewer`: no P0, no P1. One P2 fixed — a row whose address pointed into
    another dish's folder would have had that dish's public file deleted; `unpublish` now
    refuses such an address before the store is asked (the removal still commits, answering
    `fileDeleted: false`). Two P3s: one closed as already asserted in e2e; `0072` still reads
    "a picture the judge accepted cannot" without pointing at `0073` — left, as most
    decisions carry no "amended by" line.
  - `accessibility` (code): no P0, no P1. One P2 fixed — after a removal, focus passed back
    over the closing dialog's confirm button before reaching "Volver a Recetas". P3s left:
    a ready row's "Revisar la imagen" sounds like a rejected one's; "generada por IA" heard
    twice (alt and caption); the dialog's `85vh` on iOS Safari at large text.
  - `legal`: IMG-16 closed; IMG-2 and IMG-14 updated; `/privacidad` and `/condiciones` do
    not change. One P3: `fileDeleted: false` for a refused address shows the console's "delete
    it by hand" text, which is wrong for that case; no code writes such a row today.
- **What was built**:
  - `POST /admin/catalogue/recipes/:id/picture/remove` works on any `ready` picture: the
    guard is `status = 'ready'` alone. In one transaction under the row's lock: the row goes
    `failed` with `owner_removed` (keeping `drawings`), and `picture.removed` records
    `{ acceptedBy: 'judge' | 'owner' }`, read from the locked row. Then the public file is
    deleted. Refusals unchanged: 409 for a dish with no published picture, 404 for anyone but
    the owner.
  - The console: every published picture has its review page — the picture, the dish's
    ingredients and "Retirar", whose dialog names the dish and says the picture cannot be
    recovered. Recetas links to it from every `ready` row. The audit log says who had accepted
    a removed picture.
- **Deviations from plan**: the audit log page and `apps/web/AGENTS.md` joined the scope
  (plan amended); comments only in `core/entities/{Error,AdminQuery}` and
  `apps/web/src/lib/pictureRefusal.ts`.
- **Decisions**: none new; `0073`.
- **For the owner (human-verify)**: open a dish whose picture the judge accepted, in
  `/admin/catalogo`, and see the picture and "Retirar". Removing one is your choice.
