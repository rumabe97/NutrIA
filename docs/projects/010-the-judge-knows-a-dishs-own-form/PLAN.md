# Plan — Project 010: The judge knows a dish's own form

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes.
> **Written by**: an agent via `/plan-project`.

- **Status**: approved — by the owner, 2026-09-30
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md). Every acceptance criterion is mapped at the end of this file.
- **Routing profile**: `tiered`, with **every code phase at `quality-max` (opus @ high)**:
  the judge is validation of model output and allergy-adjacent, one of the two floors that
  never move (`docs/reference/agent-team.md`; `AGENTS.md` § Model routing). Its
  `invariant-reviewer` runs at the same level. Phase 6 writes no code.

## Design summary

The architect's report
[`0006`](../../reference/architecture/0006-afinar-el-juez-de-imagenes-2026-09-30.md)
is the design; read its §§ 4, 5, 7 and its annex before any phase. Decision
[`0073`](../../decisions/0073-a-dishs-own-form-is-not-an-extra-food.md) amends `0066` and
`0072`.

- **The rule gains one idea, in code.** A word that names a *form* (pancakes, bread,
  meatballs, milk, yogurt) brings no allergens when the dish has its own version of that
  form. "Has its own version" is decided from the recipe alone, by two keys:
  - an ingredient of the dish *is* that form — a closed table of catalogue slugs by family;
  - the dish's title names the form — a closed table of title words by family.
  The rest of the name is mapped as today, so a qualifier that carries an allergen still
  rejects ("wheat noodles", "cheese pancakes").
- **Families are narrow.** A family is a set of forms a picture cannot tell apart. Bread
  does not excuse pancakes. A breaded form is excused by the title only, never by the
  protein under it. A short name seen beside its fuller one stays a second food.
- **Nothing a model is asked changes.** The two calls, their prompts and the blind design
  stay as they are; the pilot's stored answers stay valid. No migration, no new cost.
- **The acceptance set comes first, as tests.** The pilot's answers (reduced), the
  production cases rebuilt, one case per class in both directions. Without it every word
  added to a table is a bet.
- **What the judge said is kept.** Each attempt's two answers go into
  `recipe_images.provenance`; a hand-accept keeps the rejections' notes. None of it reaches
  a screen or an answer.
- **Any published picture can be removed**, because the judge will accept more.
- **Then the holes.** Names that carry an allergen and map to none today are closed once
  the rule can tell a dish's own form from an extra.

## Phases

### Phase 1 — The acceptance set, before the rule changes

- [x] done — commit `aaee20e` ("The judge's refinement starts from its acceptance set, written as tests")
- **Dispatch**: opus @ high — `/execute-project 010 phase 1`. `quality-max`. Review:
  `invariant-reviewer`.
- **Goal**: what the rule must and must not do is written as tests while the rule is
  still today's.
- **Scope**:
  - `packages/core/src/domain/DishPicture/**` — tests and fixtures only; `judge.ts` is not
    touched in this phase;
  - *amended 2026-09-30:* `packages/core/src/test/dish-picture/**` — the helper the test
    files share (the seed catalogue's reader, the builder of a picture's case). A helper
    beside the rule would be compiled into the package; this folder is left out of the
    build and of coverage, and already holds the domain's test data;
  - `packages/core/AGENTS.md`, if the fixtures need a line on where they come from.
- **Steps**:
  1. **The pilot, reduced, as a fixture.** From the pilot's stored judge answers (the 57
     re-judged pictures, the 8 of the mini-pilot and the 3 wrong-recipe controls — they
     are in the private local context, as are the architect's replay scripts), write a
     committed fixture holding, per picture: the foods seen, the match, and the recipe's
     ingredients (slug, picture name, grams). **No dish name from the private library**:
     each recipe's title is replaced by a neutral one. Record in the fixture's header how
     it was produced and that the controls' match was rebuilt from their verdicts.
  2. **The catalogue the replay needs.** The tests read the repository's own seed
     catalogue (`packages/database/src/seed/`), with names and allergens as the seed
     writes them. If core cannot import it cleanly, generate a reduced committed fixture
     from it and say so.
  3. **The pilot as a test**: 65 accepted with the notes they have today (pin the notes),
     3 controls rejected.
  4. **The production cases, rebuilt** (report § 5.2), each both ways the match call could
     have answered: the corn-flour pancakes ("pancakes"), the rice cakes ("grain base"),
     the stew with the plant protein ("meatballs"). Written as the behaviour wanted —
     accepted — and marked as expected to fail today.
  5. **One case per class, in both directions** (report § 4 and § 5.5): for each family of
     the annex, the faithful picture accepted (expected to fail today where it does), and
     the ones that must stay rejected — the form with a qualifier that carries an allergen,
     a form of another family, a breaded form on a dish that only holds the plant protein,
     a form on a dish that neither has nor names it, and the second food beside its fuller
     name.
  6. **The reverse measure, as a test.** A committed set of example dishes (written for
     this, none from the private library) and the list of extra foods of the report's
     annex: the number of pairs accepted is pinned at today's value.
  7. **The holes, pinned**: the 19 names of report § 5.6 map to no allergen today; a test
     lists them, so they cannot silently become 20.
- **Acceptance criteria**: PRD 1. With today's rule the suite is green, and the cases
  marked as expected to fail are exactly the production cases and the faithful case of
  each class the rule gets wrong.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core`.
  - `sh scripts/check-leaks.sh` — and a reading of the fixture for any dish name.
  - **Stop signal:** a case that cannot be written without inventing the judge's answer.

### Phase 2 — The dish's own form, and three words' worth of vocabulary

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 010 phase 2`. `quality-max`. Reviews:
  `invariant-reviewer` (opus, high), `legal`.
- **Goal**: a form the dish has or names stops rejecting its own picture, and nothing
  else does.
- **Scope**:
  - `packages/core/src/domain/DishPicture/**` (the rule, its tables in a file of their
    own, the tests);
  - `apps/api/AGENTS.md` (the picture notes), `docs/legal/**` (`legal`).
- **Steps**:
  1. **The tables**, closed and in one file: for each family of report § 7.3 and its
     annex — the judge's words, the catalogue slugs that *are* that form, and the title's
     words that name it. Title words in Spanish and in English. Start from the annex; each
     row is a line the reviewer reads and a test.
  2. **The rule.** When a seen food's name holds a form word and the dish has its own
     version of that family — by an ingredient or by its title — that word brings no
     allergens; every other word of the name is mapped as today. It applies whether the
     match call paired the name or left it as an extra.
  3. **What bounds it** (report § 7.3), each with its test from phase 1:
     - a short name seen beside a fuller name of the same form is a second food;
     - "nuggets" and "croquettes" are excused by the title only;
     - a title's "tortitas" does not excuse "pancakes" when the dish holds rice or corn
       cakes;
     - the meat family (meatballs, burger, patty, sausage) counts for a dish with a plant
       protein, firm tofu or minced meat.
  4. **Three vocabulary fixes** (report § 7.4): words that are not a food are not mapped
     in the word-by-word step; a plant qualifier before a dairy word maps the qualifier
     and not the dairy word; a sulphite a food only *may contain* never rejects a picture
     (*amended 2026-09-30, owner:* one a food contains — dried apricots, wine — still does).
  5. **The note.** A verdict that used the exemption carries `own_form:<name>`; it is
     stored with an accepted picture as the other notes are. *Amended 2026-09-30, from
     phase 1's review:* the note is written only when the exemption actually removed a
     foreign allergen — several pilot pictures show a dish's own form that today's rule
     already accepts, and their pinned notes must not change. The pilot's floor is
     one-sided: its 65 accepted pictures cannot show a looser rule; only the 3 controls
     and the forms file's rejects can.
  6. **The two tests that pin the wrong behaviour** (`judge.test.ts`, "noodles" left as an
     extra on a dish of rice noodles; "cake" on a dish of rice cakes) are rewritten on
     purpose, named in the log, with the reviewer's agreement. The three tests of project
     006's second food are not touched.
  7. **Measure on the private library**, locally, with the architect's scripts rebuilt
     against the real rule: the dishes exposed per class (report § 5.3) and the pairs that
     pass (§ 5.4). Record both tables in the log.
  8. **The record.** `apps/api/AGENTS.md`; the judge's header comment; `legal`'s new path
     in IMG-2 and its reading of the privacy policy's sentence about the checker.
- **Acceptance criteria**: PRD 2, 3, 4, 5, 6, 7, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`; the domain's
    coverage floor holds (`pnpm --filter core test:coverage`).
  - Every case phase 1 marked as expected to fail now passes, and its mark is gone.
  - The pilot's test is untouched and green.
  - `invariant-reviewer` reports no P0 or P1.
  - **Stop signals:** a control changes; the pairs that pass exceed the predicted number
    and the difference is not explained family by family; `legal` finds that the privacy
    policy's sentence must change (then the owner decides).

### Phase 3 — What the judge said is kept

- [x] done — commit `8e9ca11` ("What the judge said about a dish's picture is kept, and never leaves")
- **Dispatch**: opus @ high — `/execute-project 010 phase 3`. `quality-max`: it touches
  the accept's write. Reviews: `invariant-reviewer`, `legal`. The `tests` agent moves the
  end-to-end cases.
- **Goal**: the next refinement can be measured on production.
- **Scope**:
  - `apps/api/src/modules/ai/services/DishPicture.service.ts`;
  - `packages/core/src/{entities,controllers,repositories}/{DishPicture,Recipe,Admin}/**`;
  - `apps/api/test/**`; `apps/api/AGENTS.md`; `docs/legal/**` (`legal`).
- **Steps**:
  1. **Each attempt's answers are stored.** For every attempt that reached the judge, the
     foods seen and the match are kept in `recipe_images.provenance` beside the notes —
     for a failed drawing and for an accepted one. Bounded: three attempts, a closed shape,
     a cap on how many foods and how long a name.
     *Amended 2026-09-30:* they also survive the dish's next drawing — a view's claim
     after the cool-off, or the owner's retry — within the same bound. A dish rejected
     three times and drawn again later is exactly the case a refinement needs to read, and
     today each drawing's end overwrites what the one before left.
  2. **A hand-accept keeps the evidence.** The accept's write keeps the rejections' notes
     and the attempts' answers beside `acceptedBy` and the overridden allergens. It still
     holds no path.
  3. **None of it leaves.** No view, no answer and no audit row carries a name a model
     wrote; `provenance` still never leaves as it is. A test pins it for the list, the
     one-recipe read, `/admin/pictures` and the trail.
  4. **The end-to-end cases**: the exact keys of `provenance` after a failed drawing, an
     accepted one and a hand-accept move with the change.
- **Acceptance criteria**: PRD 10, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The touched e2e suites, locally if the dev database answers, and in CI.
  - `legal` confirms that what is stored names nobody.

### Phase 4 — Any published picture can be removed

- [ ] in progress
- **Dispatch**: opus @ high — `/execute-project 010 phase 4`. `quality-max`: it changes who
  may take back what. Reviews: `invariant-reviewer`, `accessibility` with `/local-probe`,
  `legal`. — human-verify: the owner opens a dish whose picture the judge accepted and
  sees the picture and "Retirar"; removing one is his choice.
- **Goal**: a picture the judge accepted wrongly has a way out that is not a migration.
- **Scope**:
  - `packages/core/src/{entities,controllers,repositories}/{DishPicture,Recipe,Admin,Audit}/**`;
  - `apps/api/src/modules/{ai,admin}/**`;
  - `apps/web/src/app/(admin)/admin/catalogo/**`, `apps/web/src/components/PictureRemoveAction/**`,
    the dictionaries;
  - `apps/api/test/**`; `apps/api/AGENTS.md`; `docs/legal/**` (`legal`);
  - *amended 2026-09-30:* `apps/web/src/app/(admin)/admin/ajustes/registro/**` and
    `apps/web/AGENTS.md` — the audit log names who had accepted a removed picture, or it
    would show the new detail as a dash; `core/entities/{Error,AdminQuery}` and
    `apps/web/src/lib/pictureRefusal.ts` change comments only.
- **Steps**:
  1. **The route.** `POST …/picture/remove` works on any `ready` picture. The row goes to
     failed with `owner_removed`, the public file is deleted, and `picture.removed` is
     written in the same transaction — now saying, in a closed word, whether the picture
     had been accepted by the judge or by hand.
  2. **The console.** A dish with a published picture has its review page: the picture,
     the dish's ingredients and "Retirar", with the confirmation that says what it does.
     Recetas links to it from a `ready` row.
  3. **The record.** The code comments and `apps/api/AGENTS.md` that say only a
     hand-accepted picture can be removed; `legal` closes IMG-16.
  4. **Tests.** The unit and end-to-end cases that pin "remove refuses a judge-accepted
     picture" are rewritten on purpose; a failed dish and a dish with no picture are still
     refused; a removed dish is not claimed inside its cool-off.
- **Acceptance criteria**: PRD 9, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web`.
  - The touched e2e suites, and CI.
  - `/local-probe` on the page at 320, 390 and 1280 px, in light and dark.
  - `invariant-reviewer` reports no P0 or P1.

### Phase 5 — The holes

- [ ] pending
- **Dispatch**: opus @ high — `/execute-project 010 phase 5`. `quality-max`. Review:
  `invariant-reviewer`.
- **Goal**: a food that carries an allergen and that the rule does not see today is seen.
- **Scope**: `packages/core/src/domain/DishPicture/**`; `apps/api/AGENTS.md`.
- **Steps**:
  1. For each of the 19 names of report § 5.6, map it to the catalogue entries whose
     allergens it carries, or list it by name as left open, with the reason ("tortilla" is
     a wheat wrap and a potato omelette).
  2. Put each new name in its family where it is a form, so the dish's own version still
     passes: a dish of crepes is not rejected for the word "crepes".
  3. Look for more of the same kind: run the annex's list of foods through the rule and
     add what it finds to the pinned list of phase 1. Found by phase 1's review, outside
     the 19: "hamburger", "sausages", "buttermilk".
  4. Measure again on the private library; record the exposure and the pairs in the log.
- **Acceptance criteria**: PRD 8, 11.
- **Verification**:
  - `pnpm turbo lint ts:check test --filter=core`; the domain's coverage floor.
  - The pilot's test untouched and green; the library's exposure does not rise.
  - **Stop signal:** a synonym that rejects a faithful picture of the pilot.

### Phase 6 — Production, after it ships

- [ ] pending
- **Dispatch**: opus @ medium — `/execute-project 010 phase 6`. No code; reads production
  read-only. — owner-gated: phases 2 to 5 shipped, and either about 60 dishes drawn with
  the new rule or two weeks gone, whichever comes first.
- **Goal**: know what the rule did, and decide what was left out with data.
- **Scope**: `docs/projects/010-the-judge-knows-a-dishs-own-form/LOG.md`; a dated note
  under `docs/reference/` if the numbers deserve one.
- **Steps**:
  1. Read, from production: dishes that ended failed by the judge; attempts rejected;
     pictures accepted with `own_form`; pictures accepted by hand; the attempts' stored
     answers.
  2. The owner looks at the pictures accepted through the exemption.
  3. A dish the judge still blocks is retried by hand, by the owner.
  4. With those answers, say whether lactose, "may contain", the tofu scramble and
     `missing_main` deserve a change, and how often the judge uses each name.
- **Acceptance criteria**: PRD 12.
- **Verification**: the numbers, with where each was read, in the log.

## Hand-off

- **`0004` holds.** No safety decision moves to a prompt. What a person may eat is decided
  in code against the recipe; the judge was never that guarantee. The match call decides no
  more than today — phase 2 makes the outcome depend on it less.
- **The two calls are not touched**: not their prompts, not what they are told, not their
  models. A change there invalidates the stored answers and is a different project.
- **The private inputs are in the main checkout only.** The pilot's stored answers, the
  seed library and the architect's replay scripts live in the private local context, which
  is not in git: an agent in a worktree does not have them. The executor reads them from
  the main checkout, or the lead derives what a phase needs and hands it over. The pilot's
  controls were stored as verdicts, not as the match call's answers: their match is
  rebuilt, and the fixture says so as an assumption, not a fact.
- **The private library stays private.** Its dishes' names never enter the repository: not
  in a fixture, a test name, a comment or the log. Counts and a few generic examples only.
  Anything under the private local context is never quoted in a committed file.
- **A model's words reach no screen and no answer**: not the foods the judge named, not
  its notes. Only closed reasons, allergen keys and catalogue slugs do.
- **Every row of a table is a test.** A word added to a family, a slug, a title word or a
  synonym without its case in both directions does not merge.
- **The pilot's test is the floor.** 65 accepted with their notes, 3 controls rejected, in
  every phase.
- **Every admin mutation writes its audit row in the same transaction**
  (`apps/api/AGENTS.md` § Admin).
- **The e2e exact key lists** move in the same change as any new field.
- **The dev database** was over its quota on 2026-09-30 and resets on 2026-10-01. Agents
  try one query; if it is refused they do not loop, and let CI run the suites. Never the
  whole e2e suite locally, and never two runs at once. Worktrees have no `.env`.
- **Production is read-only.** No migration in this project.

## Out of scope

- Lactose and "may contain" as not foreign; a tofu scramble read as egg; tofu read as
  cheese; `missing_main` as a rejection or a count.
- Any change to what the two model calls are asked.
- A tool that replays production through a rule.

## PRD acceptance criteria → phases

| PRD | Phase |
| --- | --- |
| 1 The acceptance set exists before the rule changes | 1 |
| 2 The pilot does not move | 1 (pinned), 2, 5 |
| 3 The three production cases are accepted | 2 |
| 4 Each class, in both directions | 1 (written), 2 |
| 5 The second food is kept | 2 |
| 6 What the rule lets through is known in advance | 1 (the test), 2 (the library) |
| 7 The exemption is written down | 2 |
| 8 The holes do not grow, and then close | 1 (pinned), 5 |
| 9 Remove, for any published picture | 4 |
| 10 The judge's answers are kept | 3 |
| 11 Across the project: floor, `0004`, legal, privacy of the library, gate | all |
| 12 After it ships | 6 |
