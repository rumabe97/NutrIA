# PRD — Project 010: The judge knows a dish's own form

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's request and decisions of 2026-09-30 and the architect's
> report [`0006`](../../reference/architecture/0006-afinar-el-juez-de-imagenes-2026-09-30.md) —
> approved by the owner before the plan is written.

- **Status**: approved — by the owner, 2026-09-30
- **Roadmap item**: [`docs/ROADMAP.md`](../../ROADMAP.md) — a follow-up to
  [`006-realistic-dish-pictures`](../006-realistic-dish-pictures/) and
  [`009-owner-reviews-rejected-pictures`](../009-owner-reviews-rejected-pictures/), asked
  for by the owner on 2026-09-30: "Refina el juez", and "tiene que afinar para todo tipo de
  platos, no solo el que he encontrado"

## Problem

The picture judge rejects pictures that show the dish as it is.

- **What happened.** On 2026-09-30, production held 18 dishes with a picture. Three of
  them had been rejected by the judge at least once, and all three rejections were false
  for the allergen they named:
  - corn-flour pancakes, rejected three times out of three for gluten — the owner
    accepted the picture by hand;
  - rice cakes with turkey, rejected once for gluten;
  - a lentil stew with a plant protein, rejected once for egg, gluten and milk.
- **Why.** The vision model names what it sees; the code maps each name to the catalogue
  and takes its allergens from there. When the name is a **form** — pancakes, meatballs,
  bread, milk, yogurt — the code gives it the allergens of that form's usual recipe. A
  picture shows the form, not what it is made of. When the dish has its own version of
  that form (pancakes of corn flour, gluten-free bread, soy yogurt, a plant protein), what
  is seen is the dish's own form, and its allergens are the dish's.
- **How much.** Measured offline on the 500 dishes of the seed library (report `0006`
  § 5.3): 128 dishes carry something whose most natural name makes the rule reject a
  faithful picture — one dish in four. For the three classes already seen in production,
  43 dishes.
- **What it costs.** These rejections are not random: the same dish is rejected every
  time. A blocked dish costs its three attempts (about 0.10 USD), seven days without a
  picture, and a review by hand. The owner's hand-accept of project 009 is for the rare
  case, not for one dish in four.
- **The other direction.** The rule also has holes. Of 166 names of foods that carry an
  allergen, 19 map to none today ("pizza", "omelet", "crepes", "tortilla", "paneer"…): a
  pizza drawn on a dish with no gluten passes (report § 5.6).
- **Nothing takes back a picture the judge accepted.** "Retirar" works only on a picture
  accepted by hand. A rule that accepts more needs a way out when it accepts wrongly.
- **What the judge said is not kept.** Only the rule's verdict is stored, never the two
  calls' answers, so production cannot be replayed through another rule; and accepting a
  picture by hand erases even the notes of its rejections. What the judge called the
  owner's pancakes on each attempt can no longer be known.

## Outcome

- **The judge stops reading a dish's own form as an extra food.** A word that names a form
  brings no allergens when the dish has its own version of that form: an ingredient that
  *is* that form, or a title that names it (owner's decision, 2026-09-30: the title is
  enough). The rest of the name still counts: "wheat noodles", "egg noodles", "cheese
  pancakes" and "feta cheese" are rejected as today.
- **It does not let through what the judge exists to stop.** The pilot's wrong-recipe
  controls stay rejected. A form of another family is still rejected (toast on a dish of
  pancakes). A short name seen beside its fuller one is still a second food ("milk" beside
  "soy milk").
- **What the new rule accepts can be found afterwards.** A verdict that used the exemption
  says so in its notes, which are kept with the accepted picture.
- **The holes are closed**, after the rule is in place: the names that carry an allergen
  and map to none today map to it (owner's decision: in this project, as a later phase).
- **Any published picture can be removed**, not only one accepted by hand (owner's
  decision, 2026-09-30; it changes the decision of project 009).
- **The acceptance set is a test.** The pilot's judge answers enter the repository,
  reduced: the foods seen, the match, and the ingredients with their grams — without the
  names of the private library's dishes (owner's decision, 2026-09-30).
- **What the judge said is kept** (owner's decision, 2026-09-30): the two calls' answers
  are stored with each attempt, and accepting a picture by hand keeps the notes of its
  rejections. The next refinement is measured on production, not on assumptions.

## Scope

**In**

- The rule in `packages/core/src/domain/DishPicture/` — code only:
  - a closed table of families of forms: the judge's words for each, the catalogue
    ingredients that *are* that form, and the title's words that name it;
  - three vocabulary fixes: words that are not a food ("base", "glass", "bowl"…) are not
    mapped one by one; a plant qualifier before a dairy word ("soy yogurt", "coconut
    milk") maps the qualifier and not the dairy word; sulphites never reject a picture;
  - the note a verdict carries when the exemption was used.
- The acceptance set as tests, written **before** the rule changes: the pilot's answers
  and its three controls, the production cases rebuilt, one case per class in both
  directions, and the count of what the new rule lets through.
- The holes of report § 5.6, as a phase after the rule.
- "Retirar" for any published picture, with its audit row, and the console's copy for it.
- The judge's answers stored with each attempt, in `recipe_images.provenance` (jsonb, no
  migration), and the rejections' notes kept by a hand-accept. They reach no screen: what
  a model wrote stays out of every answer, as today.
- The record: a decision amending `0066` (and `0072` for the removal), `apps/api/AGENTS.md`,
  the comments of the judge, and `legal`'s notes on `docs/legal/imagenes-de-platos.md`.
- What the two model calls are asked does not change. No migration. No new cost.

**Out**

- Lactose, and "may contain" allergens: left as they are. Treating them as not foreign
  lets through far more than it fixes (report § 5.4). Decided later with production data.
- A tofu scramble read as egg: a faithful picture of that dish does look like egg. That is
  what the hand-accept is for.
- Tofu read as cheese: never observed.
- Telling the vision model the dish's name, or changing either prompt: it breaks the blind
  design and the calibration.
- `missing_main` as a reason to reject, or as a count on the console.
- Replaying production through a rule, as a tool: this project stores what such a replay
  needs; the replay itself is for the next refinement.

## Acceptance criteria

1. **The acceptance set exists before the rule changes.** With today's rule, exactly the
   cases that should fail do fail: the production cases rebuilt, and the faithful case of
   each class.
2. **The pilot does not move.** All 65 faithful pictures are accepted with the same notes
   as today, and the 3 wrong-recipe controls are rejected.
3. **The three production cases are accepted**, in every way the match call could have
   answered (6 of 6 rebuilt cases).
4. **Each class, in both directions.** For each family of forms: a faithful picture of a
   dish with its own version is accepted, and these are still rejected — the same form
   with a qualifier that carries an allergen ("wheat", "egg", "cheese"), a form of another
   family, a breaded form on a dish that only holds the plant protein, and a form on a
   dish that neither has nor names it.
5. **The second food is kept.** "milk" seen beside "soy milk", "cheese" beside "vegan
   cheese" and "butter" beside "peanut butter" are rejected, as the tests of project 006
   pin it, untouched.
6. **What the rule lets through is known in advance.** Measured on the private library,
   locally, and recorded in the log: the count of extra foods that pass and were rejected
   before is the one predicted (229 of 26,394 pairs with the prototype's tables), every one
   of them a food of the same family as a form the dish already has. A higher number is
   explained family by family or the change does not merge. The same measure over a
   committed set of example dishes is a test, so the number cannot move unnoticed later.
7. **The exemption is written down.** A verdict that used it carries a note naming the
   food, and the note is stored with the accepted picture.
8. **The holes do not grow, and then close.** The 19 names that map to no allergen today
   are not 20 after the rule; after the holes' phase, each maps to its allergen or is
   listed by name as left open, with the reason. The pilot does not move and the library's
   exposure does not rise.
9. **Remove, for any published picture.** A picture the judge accepted can be removed by
   the owner: the dish goes back to having none, the public file is deleted and the
   removal is in the audit log in the same transaction. The console says what it does
   before it does it.
10. **The judge's answers are kept.** Each attempt's two answers (the foods seen, the
    match) are stored with the dish's picture row; a hand-accept keeps the rejections'
    notes and those answers. No answer of the API carries any of it, and a test says so.
11. **Across the project.**
    - Built by `backend-high` and reviewed by `invariant-reviewer`, both opus at `high`:
      it is validation of model output and allergy-adjacent. No P0 or P1.
    - `0004` holds: no safety decision moves to a prompt, and what a person may eat is
      still decided in code against the recipe. The match call decides no more than today.
    - `legal` has updated its notes; the privacy policy's sentence about the checker stays
      true, and `legal` confirms it.
    - No dish's name from the private library is in the repository.
    - The workspace gate is green at every phase boundary. No new cost, no migration.
12. **After it ships.** A dish production has blocked is retried by hand and accepted;
    the pictures accepted through the exemption are looked at during the first week.

## Open questions

- None for the owner before the plan. His decisions of 2026-09-30:
  - **The principle:** a form the dish has or names is not an extra food; the title alone
    is enough.
  - **Remove:** for any published picture, in this project.
  - **The pilot's answers:** in the repository, reduced.
  - **The holes:** in this project, as a later phase.
  - **The judge's answers:** stored with each attempt, and the notes kept on a hand-accept.
- Taken from the architect's recommendation, for the owner to change at approval if he
  wishes: the family of meat forms (meatballs, burgers, sausages) counts for a dish with a
  plant protein, firm tofu or minced meat (report § 14, question 3); lactose, "may
  contain" and `missing_main` wait for production data.
- For `legal`, inside the plan: whether the privacy policy's sentence needs any change
  (the architect's reading is that it becomes truer), and the new line of IMG-2.
- Unknown until production shows it: how often the judge uses each name, and so the real
  effect on the rejection rate. With 18 dishes drawn, a change in the rate proves nothing
  before about 60.
