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

## Phase 2 — The dish's own form, and three words' worth of vocabulary (2026-10-01)

- **Executor**: `backend-high` on opus, three rounds; `invariant-reviewer` (opus, high)
  three times, the third iterating with the implementer directly; `legal` twice. Shipped
  **after** phase 4, on `legal`'s advice: a picture the new rule accepts wrongly can be
  taken back.
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web
    --concurrency=2 --force`: 17 of 17 tasks green — core 3090, api 1233, web 142.
    `pnpm --filter core test:coverage`: floors hold (DishPicture about 99 % of lines,
    96.7 % of branches). No `.fails`, `.skip` or `.only` anywhere in core.
  - The pilot's test and fixture untouched and green: 65 accepted, 3 controls rejected, no
    note moved. The holes test untouched: still 19.
  - Phase 1's 191 rows: 187 verbatim; 4 rewritten on purpose (below).
  - `invariant-reviewer`, third round: no P0, no P1.
- **Why three rounds.** The first two rounds wrote the exemption as a blacklist — excuse
  the form word, then guard what slips through — and each review found a new class of
  foreign allergen getting past the guard (round 1: a qualifier that carries an allergen
  only as part of the whole catalogue name, "goat cheese", "cow's milk", "spring roll";
  and title words anywhere, "semillas tostadas", "sin pan"; round 2: names made of the
  dish's own form words, "cream cheese", "milk roll"; descriptors, "whole milk"; negation
  gaps; nouns like "wraps de lechuga"). Round 3 changed the rule's shape:
  - **A whitelist.** Once a closed list of serving words is set aside (a glass of,
    grated, sliced…), the seen name must be *exactly one row* of a family the dish holds,
    by ingredient slug or title. Any other name is read exactly as before, notes included.
  - **Closed allergens per family**, written in `forms.ts` and never read from the
    catalogue (a brownie's walnuts had been excused beside a nut-free sponge): bread
    gluten; breading eggs+gluten; pancakes, cakes, biscuits, pastry and meat
    eggs+gluten+milk; crackers gluten; wraps gluten; pasta eggs+gluten; nuggets
    eggs+gluten+lactose+milk; milk, yogurt and cream lactose+milk; cheese milk.
  - **Titles**: a negation (sin, ni, no, without, en vez de, en lugar de, instead of,
    libre de) reaches to con/with/y/and, a comma or a closing parenthesis; "-free" and
    "-less" negate their own word; a title word beside bowl/bol/cuenco names nothing;
    ambiguous head words (tostada, tosta, rebanada, taco, empanada, pastel, wrap, sandwich,
    burrito, quesadilla, enchilada, fajita, montadito, toast) name their form only as the
    title's first word followed by its end or con/with/y/and; phrases where "pan" or
    "migas" mean something else name nothing.
  - **The exhaustive test** `judge.catalogue.test.ts`: every seed product whose name holds
    a row's word (175) beside 21 example dishes; an accepted pair carries nothing the dish
    lacks or is a listed second batch of the same form, checked against its family's set.
    A new catalogue product shows up there, not in a reviewer's probe.
- **Library measure** (the private library, offline, counts only):
  - Pairs that pass now and were rejected before phase 2: **195 of 26,394** (predicted
    229; round 1 211; round 2 205). By family: meat 82, milk 26, bread 19, wraps 16,
    pancakes 14, cream 10, pasta 10, crackers 3, cakes 1; plus 14 from the sulphite
    vocabulary fix. **Newly rejected against the rule before phase 2: 0.**
  - Dishes exposed to a false rejection (paired / left over), any class: 78/80 (before
    phase 2 144/145). The classes seen in production: 32/34. Still exposed on purpose:
    "nuggets" (title only), "cakes" and now "crackers" on rice and corn cakes (the
    crackers may contain sesame — the lead accepted the cost; production's own word,
    "grain base", passes), the three classes left out (lactose, tofu read as cheese,
    scrambles without egg).
  - Titles: 8 of 500 hold a negation token, none with a family word in its reach; a
    head-only noun outside first position in 13, first in 34 (26 before "de").
- **Deviations from plan** (plan amended):
  - Four phase-1 rows rewritten to expect **rejected**, with the reviewer's agreement:
    "brownie" on a bean brownie (the catalogue's only brownie holds walnuts), "crackers"
    on corn cakes (may contain sesame), "empanadas" on corn empanadillas (the only
    empanada is tuna), "plant milk" on an oat pudding (a generic plant word names no
    plant). Phase 5 maps the bare filled words to their unfilled form (step 5).
  - Rows beyond the annex: "pizza base", "breaded chicken", "battered fish" (its fish still
    weighed against the dish). Meat also holds poultry and lamb mince.
  - Accepted by the lead: "Pan de coliflor/nube/lechuga" and "Pizza(s) de coliflor/
    berenjena" name their form (the owner's "title alone"); "sin queso y pan" names bread.
  - Pinned as unchanged, not this rule: "whole/skimmed/fresh milk" paired by the match
    call with the soy milk passes through project 006's shortened-name rule.
  - Step 6: `judge.test.ts`'s "noodles left as an extra on a rice-noodle dish" rewritten
    on purpose; "cake" on rice cakes kept rejected (phase 1's decision); project 006's
    three second-food tests untouched.
  - **`/privacidad`**: the owner decided (2026-09-30, "Mete la cláusula de privacidad") to
    add `legal`'s clause (b) to the checker sentence; it ships with this phase, and
    `privacy.updated` carries the day it reaches production.
- **Decisions**: `0073`.
- **Notes for the next phase**: phase 5's step 5 (the filled forms) and the bare "pizza",
  "tortilla", "crust" found by the third review. The reviewers' probe scripts and the
  measuring harness are in the private local context of the session, not the repository.

## Phase 5 — The holes (2026-10-01)

- **Executor**: `backend-high` on opus; `invariant-reviewer` (opus, high) beside it from
  the start, iterating with the implementer directly (two rounds and a re-check).
- **Result**: done.
- **Evidence**:
  - `pnpm turbo lint ts:check test --filter=core --filter=api --filter=web
    --concurrency=2`: 17 of 17 green — core 3237. `pnpm --filter core test:coverage`:
    floors hold (DishPicture 100 % of lines, 97.46 % of branches). Format clean.
  - The pilot's test and fixture untouched and green. Replayed from the private record:
    57/57 and 8/8 accepted, the 3 controls rejected; only control 3's notes move (still
    rejected, now also for "hamburger patty", gluten).
  - `invariant-reviewer`: no P0, no P1. Its own sweep (1,139 names × 88 dishes, the rule
    after phase 2 against this one): everything that newly passes is a bare form word (or
    cookies/biscuits on the new crumble dish); 5,004 pairs newly rejected.
- **What changed** (by mechanism):
  - **Plurals.** Synonyms are looked up through a word's singular, and "-es" plurals after
    ch/sh/ss/us/x/z are understood: "croutons", "toasts", "pies", "yogurts",
    "sandwiches" now carry their allergen.
  - **The 19 holes are closed**, and 15 more the sweep found: pizza, crust, tart, crepe,
    cupcake, fritter, fusilli, burrito, crumble, crumb, paneer, latte, buttermilk,
    frittata, meringue, hollandaise, crayfish… each mapped to its usual recipe, never to a
    filled product. "hamburger" reads as "burger", "omelet" as "omelette". Where a new name
    is a form, it is a row of its family (crumble, burrito, pizza crust, latte), so the dish's
    own version still passes.
  - **Bare form words** (`BARE_FORMS`): "brownie", "cracker", "empanada", "sandwich" alone
    read as the unfilled form. Its own class, not phase 2's second batch: a bare form word
    carries what its form carries, and a filling or a may-contain the picture cannot show
    is not read into it. By design: a tuna empanada named only "empanada" beside chicken
    empanadillas is accepted (its fish is contained, not may-contain — the picture does not
    show it); bare "crackers" pass on any dish with gluten, bare "brownie" on any dish with
    eggs, gluten and milk. A named filling ("tuna empanadas", "walnut brownie", "sesame
    crackers") rejects everywhere. Each cost is a test titled as on purpose.
    `judge.catalogue.test.ts` reads each product's own entry (not the rule's table) and
    `BARE_DROPS` lists the two catalogue drops, checked to be may-contain only.
  - **"tortilla"** is read from the dish: the potato omelette only when the dish is one (the
    packaged omelette; a title naming tortilla de patata(s), tortilla española,
    omelette(s), frittata(s); or a title opening with "tortilla(s)" on a dish holding an
    egg); everywhere else a wheat wrap (gluten). Corn tacos are excused by their own wraps
    form. Known misses, pinned and in `apps/api/AGENTS.md`: a wheat wrap called "tortilla"
    on a gluten-free omelette passes; a potato omelette called "tortilla" on a wheat dish
    with no egg passes.
  - **Left open, with reasons pinned in `judge.holes.test.ts`**: "sausages" (three faithful
    pilot pictures call the dish's chorizo "sausage" — mapping it is the stop signal; only
    the vegetarian sausages contain an allergen) and "patty" (no allergen of its own).
- **Library measure** (private library, offline, counts only; before = the rule after
  phase 2):
  - Exposure (paired / left over): any class 78/80 → 69/80; without the classes left out
    34/36 → 25/36; the classes seen in production 32/34 → 22/34. The whole fall is
    "crackers" on rice and corn cakes. **Nothing rose.**
  - § 5.4 pairs (31,500): 111 newly accepted, all "crackers" (101 on dishes that already
    carry gluten, 10 on their own cakes); **0 newly rejected**.
  - The phase's 39 names × 500 dishes: 13,374 newly rejected; 287 newly accepted, all bare
    form words (sandwich 131, crackers 111, empanadas 36, brownie 9).
  - "tortilla": 0 of 13 egg dishes titled tortilla/frittata/omelette rejected, before and
    now; 0 of 8 tortilla dishes; 7 of 8 egg-and-potato dishes not titled as omelettes now
    reject a wheat "tortilla" (the 8th carries gluten) — the intended tightening.
  - Sandwich/bocadillo titles: 11 of 13 (paired) and 13 of 13 (left over) rejected for
    their own name before; 0 now.
- **Deviations from plan** (plan amended):
  - "sandwich" joins the bare words; the bare-word widening is recorded as its own class.
  - "tortilla" readings, the title-head key and "frittata" as a title word (the lead's
    decisions); the egg-and-potato key was dropped after measuring that every library
    omelette is reached by its title.
  - `judge.holes.test.ts` rewritten on purpose (what each hole carries, what is left open);
    the three phase-2 rows (brownie, crackers, empanadas) accepted again; "plant milk" stays
    rejected (a generic plant word names no plant). Two example dishes added to the test
    helper (`oatCrumble`, `potatoOmelette`).
  - Accepted cost: "Tortilla de patatas sin huevo" (vegan) is read as an omelette and
    rejected for eggs — a redraw, the same kind as the scrambles left out.
- **Decisions**: `0073`.
- **Notes for phase 6**: read production's `provenance.drawings` for "tortilla",
  "sandwich", "empanada" and the `own_form:` notes; "sausages" stays open until a
  vegetarian sausage turns up in a rejected picture.

## Phase 6 — Production, after it ships (2026-10-01) — waiting on its gate

- **Executor**: the lead (opus), reading production read-only.
- **Result**: not started — owner-gated. Phases 2 to 5 are live (the final rule since
  `09ed832`, 2026-10-01), but neither condition holds yet: about 60 dishes drawn with that
  rule, or two weeks gone (2026-10-15).
- **Evidence** (production `recipe_images`, read-only, 2026-10-01): 26 dishes have a
  picture, all `ready`, none `failed`; the most recent drawing ended 2026-10-01 07:30 UTC,
  before phase 5 reached production — so no dish has yet been drawn with the final rule.
- **For the owner**: run `/execute-project 010 phase 6` again when about 60 dishes have been
  drawn since 2026-10-01, or on 2026-10-15.

## Phase 6 — What the rule did in production (2026-10-09)

- **Executor**: Opus 5.5 (the lead). The owner authorised the read on 2026-10-09, twice, after the auto-mode classifier had refused it once; it ran from the main checkout inside `sql.begin('read only')`, which the engine enforces, over `recipe_images` and `recipe_image_calls` only. No user table was read, and no address, id or host was printed.
- **Result**: done. The gate was met and passed: **73 pictures drawn since the rule went live on 2026-10-01**, against the 60 the gate asked for.
- **The numbers, all read 2026-10-09 from production:**
  - **Pictures**: 93 rows — 91 `ready`, 2 `failed`.
  - **The judge blocks nothing.** Both failures carry `reason: model_refused`, and the recorded text is the provider answering 429 ("Provider returned error — provider: DeepInfra") on the judge call. Neither is a verdict about the picture. **No dish is held back by the judge today.**
  - **Judge calls since 2026-10-01**: 71 `seen` and 71 `matched` (0.0307 and 0.0179 USD), plus 2 `error`.
  - **Month's spend**: 2.4575 USD on 73 drawings and 0.0486 USD on 144 judge calls — 2.51 USD against the 10 USD cap (`0066`).
  - **The own-form exemption has never fired**: 0 rows carry an `own_form:` note, eight days after it shipped. The case it was built for has not occurred in production.
  - **Three pictures were accepted by hand**, two on 2026-09-30 (gluten) and one on 2026-10-04, after the rule shipped (peanuts).
  - **Eleven rejected attempts are stored with their notes**, and they tell one story that is not the one phase 2 fixed: the drawing adds a food the recipe does not contain, and that food carries an allergen. Peanut butter on a dish whose spread is jam, 3 times; a "creamy base" read as gluten, 2; seeded bread and black sesame (sesame, tree nuts); meatballs (eggs, gluten, milk); a "grain base" (gluten); cheese (milk). The hand-accepted picture of 2026-10-04 is the same case.
  - **`missing_main` appears twice**, never as the only reason: both times beside an added allergen (`missing_main:Kefir`, `missing_main:Egg white`).
  - **Lactose and "may contain" appear zero times**; so does the tofu scramble. PRD § out-of-scope had guessed at both; production has no instance of either.
- **The owner's four decisions, 2026-10-09**, from those numbers:
  1. **The invented garnish**: tell the drawing call not to put anything on the plate that the recipe does not contain. By this project's own hand-off rule ("the two calls are not touched… a change there is a different project") it does **not** ship inside 010; it is recorded in the workspace task lane and ships as its own change.
  2. **The own-form exemption stays** exactly as it is. That it never fires means the case is rarer than it looked, not that the rule is wrong; it is written, tested and costs nothing to keep.
  3. **Lactose and "may contain" stay as they are.** No production case asks for a change, and the allergen layer is the last place to change on a guess.
  4. **`missing_main` stops rejecting on its own**: it stays as a counted note so the console still shows it, but it no longer fails a picture by itself. It has never been the real reason, and a picture missing a visible main is ugly, not unsafe.
- **PRD criterion 12**: met. The rule's effect is measured, and what was left out of scope was decided against real numbers rather than guesses.
- **Evidence**: the read's output stayed in the session scratchpad; the counts above are what it returned. Nothing was written to production.

## Phase 6 follow-up — `missing_main` stops rejecting on its own (2026-10-09)

- **Executor**: `backend` (sonnet, medium), carrying out decision 4 of the "What the rule
  did in production (2026-10-09)" entry recorded on `docs/close-010` (PR #251), not yet on
  `main` when this entry was written. That entry's numbers: `missing_main` appeared twice
  in production, never as the only reason — both times beside an added allergen that
  rejected the picture anyway.
- **The owner's reasoning, repeated here**: a picture missing a visible main is ugly, not
  unsafe. It should never fail a picture by itself; it stays a counted note so the console
  still shows it.
- **Result**: done — and the contract did not move. Reading `judgePicture` in
  `packages/core/src/domain/DishPicture/judge.ts` shows `accepted` was always
  `rejecting.length === 0`, and `rejecting` was always built only from extras carrying a
  foreign allergen; `missing` (the `missing_main:` note) has never been part of it, back to
  this file's first version (`4b70ff76`, project 006 phase 2). `PictureReason.ts`'s own
  comment already said as much ("`judgePicture` rejects only for `extra_allergen:`"). So
  the owner's decision ratifies standing behaviour rather than changing it — the question
  was simply never decided until now (PRD § out of scope: "`missing_main` as a reason to
  reject, or as a count on the console").
- **What changed**: a comment at the `missing` computation in `judge.ts`, naming the
  2026-10-09 decision and the production counts (no dish name, no slug) so a future reader
  does not mistake the omission for an oversight; one pinning unit test in `judge.test.ts`
  for the combined case the task calls out — a picture missing its main *and* showing an
  added allergen is still rejected, for the allergen, not for the missing main.
- **Evidence**: `pnpm --filter core build` green. Targeted run —
  `judge.test.ts`, `judge.catalogue.test.ts`, `judge.holes.test.ts`, `judge.forms.test.ts`,
  `judge.reverse.test.ts`, `judge.pilot.test.ts` — 6 files, 796 tests, all green. The
  pilot's floor (PRD 2, repeated in the hand-off) holds unmoved: 65 faithful pictures
  accepted with their notes, 3 controls rejected — all three controls already combine a
  missing main with an added allergen, and are pinned as rejected for the allergen.
- **Deviations from plan**: none. No decision record was added under `docs/decisions/`:
  the judge's contract did not change in a way a future reader could not infer — the
  file's own top-of-file doc comment already says a picture "is rejected only when it
  clearly shows an extra food… Everything else is a note." One line was added to
  `docs/decisions/LOG.md` instead, per the task's own rule for a non-contract-changing
  decision.
- **Notes for the next reader**: this entry and PR #251's "Phase 6 — What the rule did in
  production" entry describe the same production read; PR #251 is the source of the
  numbers, this one is the change that carries out its decision 4. The two LOG entries are
  independent appends and should both survive a merge of either branch.
