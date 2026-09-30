# 0073 — A dish's own form is not an extra food

- **Status**: accepted
- **Date**: 2026-09-30
- **Project**: [docs/projects/010-the-judge-knows-a-dishs-own-form](../projects/010-the-judge-knows-a-dishs-own-form/)
- Amends [`0066`](./0066-photograph-like-dish-pictures-drawn-on-first-view.md) (what the
  judge counts as an extra food) and
  [`0072`](./0072-a-rejected-picture-waits-for-the-owner.md) (which pictures can be removed,
  and what a hand-accept keeps).

## Context

`0066` keeps a dish's picture only if the vision judge accepts it. The judge names the
foods it sees; the code maps each name to the catalogue, takes its allergens from there, and
rejects a picture that clearly shows a food carrying an allergen the dish lacks.

- On 2026-09-30, of 18 dishes drawn in production, three had been rejected at least once,
  and all three rejections were false for the allergen they named: corn-flour pancakes
  (gluten), rice cakes (gluten), a stew with a plant protein (egg, gluten, milk).
- The cause is one idea the rule lacks. When the judge names a *form* — pancakes,
  meatballs, bread, milk, yogurt — the code gives it the allergens of that form's usual
  recipe. A picture shows the form, not what it is made of.
- The architect's report
  [`0006`](../reference/architecture/0006-afinar-el-juez-de-imagenes-2026-09-30.md)
  measured it offline: 128 of the 500 dishes of the seed library carry something whose
  most natural name makes the rule reject a faithful picture. These rejections repeat on
  every attempt of the same dish.
- The rule also has holes the other way: 19 of 166 names of foods that carry an allergen
  map to none.
- Only the rule's verdict is stored, not the judge's two answers, and a hand-accept erases
  the rejections' notes: production cannot be replayed through another rule.
- A picture the judge accepted cannot be removed (`0072`: hand-accepted pictures only).

The owner asked for the judge to be refined "para todo tipo de platos", and decided on
2026-09-30.

## Decision

- **A word that names a form brings no allergens when the dish has its own version of
  that form.** The rest of the name is mapped as before: "wheat noodles" and "cheese
  pancakes" still reject.
- **"Has its own version" is read from the recipe, in code**, by either of two keys: an
  ingredient of the dish *is* that form (a closed table of catalogue slugs), or the dish's
  title names it (a closed table of words). The title alone is enough.
- **Families are narrow**: forms a picture cannot tell apart. Bread does not excuse
  pancakes. A breaded form is excused by the title only. A short name seen beside its
  fuller one is still a second food, as project 006 decided.
- **The sentence of `0066` stands word for word**: a picture is rejected only for an extra
  food, clearly visible and named, that carries an allergen the dish lacks. What changes is
  what "extra" means.
- **What the two model calls are asked does not change.** The judge stays blind to the
  dish. `0004` does not move: no safety decision goes to a prompt, and what a person may
  eat is decided in code against the recipe.
- **A verdict that used the exemption says so** in its notes, stored with the picture.
- **The judge's two answers are stored with each attempt**, and a hand-accept keeps the
  notes of the rejections. None of it reaches a screen or an answer.
- **Any published picture can be removed by the owner**, not only one accepted by hand.
  The removal stays an audited admin action.
- **The holes are closed after the rule is in place**, not before: today every synonym
  added would reject more faithful pictures.
- **Left as they are**: lactose and "may contain" as foreign allergens, a tofu scramble
  read as egg, tofu read as cheese. Decided later, with what production shows.

## Alternatives considered

- **Lean on the match call** (a form it paired with the ingredient it is made of passes).
  It fixes only when the call pairs, and the same picture passes or fails on that call's
  answer: between 47 and 117 dishes stay exposed. It also makes a model's pairing a
  condition to accept.
- **Tell the vision model the dish's name, or ask it differently.** The model is right to
  say "pancakes"; the reading is what is wrong. It breaks the blind design the wrong-recipe
  controls depend on, invalidates the stored answers, and cannot be measured without paying.
- **Leave the rule and accept by hand.** The hand-accept is a recorded override for the
  rare case; the surface is one dish in four.
- **A form never rejects.** A burger bun on a bowl of skyr would pass.
- **Decide by catalogue category, or by the ingredient's weight.** The category is too
  coarse; a weight threshold is a number with no owner and does not tell pancakes from a
  batter.
- **The title only with an ingredient the form can be made of.** The prudent variant: it
  leaves two or three more dishes unfixed and adds a table. The owner chose the title alone.
- **Treat lactose, or "may contain", as not foreign.** They let through 386 and 2,002 of
  the pairs rejected today, against 229 for the rule chosen.

## Consequences

- The rule accepts what it could not tell apart anyway: an extra food of the same family
  as a form the dish already has — a wheat roll beside gluten-free bread, a glass of milk
  beside a soy drink. Measured on the library, 229 of 26,394 pairs rejected today. The dish
  stays safe; a person with that allergy may distrust it. The note and "Retirar" are how
  it is found and undone.
- Two tests that pinned the old behaviour are rewritten on purpose, with the reviewer.
- A dish's title, which a model wrote, becomes an input of the rule. A title that names a
  form the dish does not have would excuse that form; the picture then matches what the
  person reads in the title.
- The tables are closed lists that someone must keep: every row needs its case in both
  directions, and a new catalogue ingredient that is a form has to be added to its family.
- `recipe_images.provenance` grows by the judge's answers, three attempts at most. They are
  a model's words about a picture of a dish: they name nobody, and they stay in the row.
- The effect on production's rejection rate is unknown until enough dishes are drawn with
  the new rule; with 18, the starting point runs from 6 % to 39 %.
