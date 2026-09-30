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

