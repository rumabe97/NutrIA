# 0100 — A person may name a dish, and the gate is on what comes back

- **Date**: 2026-10-13
- **Status**: accepted
- **Builds on**: [`0098`](./0098-a-meal-somebody-fixed-is-not-the-schedulers-to-change.md) and
  [`0099`](./0099-a-variety-cap-counts-the-meals-the-generator-chose.md), which made a meal
  fixable and made it cost nothing; the architect's report
  [`0011`](../reference/architecture/0011-a-dish-the-library-does-not-have-2026-10-13.md),
  which named the seven reasons and this way out; `marketing`'s
  [dish-requests](../reference/marketing/dish-requests.md) for the number, and
  [`docs/legal/analysis.md`](../legal/analysis.md) ("P0-3's status at 2026-10-13") for the
  five conditions this is allowed under.

## Context

The owner fixed a meal, searched his library for *patatas a la riojana* — a dish it has, three
times over — and the screen showed him a shorter list and said nothing. His first reading was
that the library did not have it, and the obvious answer was to let people ask for the dish
they wanted.

Measured, the library was not the reason. Three dishes of that name were in his library and
all three were refused for **cooking time**: 50 minutes against a profile that said 30.
Raising that one preference unlocked 102 dishes for him. Across the seven reasons a dish can
be absent from the picker (`whyNotFixable`), the missing dish is the **rarest**, and four of
the other six are two taps from being fixed by the person themselves.

So the feature splits in two, and the order matters: **say why first, and offer to write the
dish only where the library genuinely has nothing.**

## Decision

### The silence is the defect, and it is answered before anything is sold

`GET /fixed-meals/not-offered` answers a search that found nothing with the dishes of that
name the library **does** have and the one thing standing between each and this meal.
`actionable` travels on the wire rather than being inferred by the screen: whether a reason
has a way forward is a judgement the domain already made, and two places deciding it is how
they come to disagree. An allergen is never softened into advice, and a recipe with no method
is this product's fault, not the reader's.

It is one request, half a second after typing stops, and only when the offered list answered
nothing — the answer costs a whole generation context, so it is never one per letter.

### The typed name is transient; the gate is on what the model writes back

A dish request is **the only field in this product whose content a person writes and a model
reads.** Everything else that reaches a model is a number, a catalogue name or a closed enum,
and `health-boundary.spec.ts` holds that line with an allowed-keys list — `dishRequest` was
added to it on purpose, with a sentinel test that it never reaches the picture prompt or the
judge.

What the typed string is: prompt input. It is never stored, never logged, never put in an
error, never recorded on an `ai_call`, and it has its own `AiFeature` (`dish_request`) so that
every log and filter can tell apart the one call carrying words a person wrote.

**The exposure is not the model call. It is the two places the answer comes back out**, and
this is the part that inverts the obvious design:

- `recipes` is **shared**. A stored dish is in front of every other account, for ever,
  outliving the account that asked for it (`created_by` is provenance, `ON DELETE SET NULL`).
- `buildPicturePrompt` carries the dish's **name, verbatim**, to Google (Vertex) when its
  picture is drawn — a recipient `/privacidad` promises the dish path never touches.

So gating the input would be cosmetic: the words come back through the name. `storableName`
gates the **model's** name before anything is stored, and it is **a vocabulary, not a
classifier** — it never asks what a word means, only whether this product has ever used it to
name food: the catalogue's ingredient names, the names the library already uses, and a closed
list of cooking words. Personal content is made of words none of those have ever needed. This
account's own name and its health words (conditions, medications, supplements) are checked
exactly, whatever the vocabulary says, because the library *could* hold a word that is also
somebody's surname.

It errs towards dropping, and the cost is stated rather than hidden: a real dish refused for
one unfamiliar word. That is the right direction — a refused dish is a sentence, a stored one
is in front of everybody for ever and on its way to Google — and it gets rarer as the library
grows, because the library **is** the vocabulary.

### A requested dish earns its place through the same gate as any other

The candidate is handed to `pinnable` on a pool of exactly itself, rather than to a second
idea of what fits. A requested dish passes the gates a library dish passes or it does not get
in, and `PoolBuilder` has already filtered it for allergens, excluded ingredients, unresolved
allergy labels, cooking time and an oversized serving before that.

### The allowance is spent on the dish, never on the request

Three a month with premium, none free (`marketing`, and `0097`'s *financial* kind). The count
is read **from the rows** — `source: 'user'`, which no other path writes — with
`recipes.created_at` added for it (migration `0064`, deliberately split so the 988 recipes
written before it stay honestly undated rather than all stamped with the deploy).

That is what makes the promise sayable: **nothing records what anybody typed**, because
nothing needs to. A request the output gate refuses leaves no row and costs nobody anything,
and the sentence on the screen says so — the digit never appears without *"solo cuenta cuando
llega un plato"*.

It is read twice: once before the model call, so nobody pays for a request that cannot be
honoured, and again inside the advisory lock that stores the dish, which is where it binds. A
request that loses that race is a call paid for and refused — honest and cheap, and far better
than holding a lock across a model call.

A dish whose slug the library already holds is **handed back**, not stored twice and not
charged for: two accounts can want the same dish in the same month, and `insertRecipes` has
treated that race as "a race to win harmlessly" since `0006`.

## Consequences

- **`PROFILE_CONSENT_VERSION` is 1.1.0.** The consent paragraph changed — one field now goes
  to the model as somebody wrote it — so every existing account is asked again. No mail is
  sent; the interstitial does it on the next visit.
- **A second free-text field is not a small change.** Anything that adds one inherits all of
  this: the boundary test's allowed list, an output gate before storage, and the legal
  analysis's five conditions. The rule is in `apps/api/AGENTS.md`.
- **The vocabulary refuses real dishes today.** Shakshuka is not in the catalogue or the
  library, so a request for it is refused with *"no nos ha salido ningún plato"*. Accepted,
  and self-healing as the library grows.
- **What this does not do**: it does not tell somebody a standing rule has stopped being
  honourable (`0098` left that open), and it does not let a professional ask on a client's
  behalf.

(who decided: the owner, 2026-10-13, asking for the best and most professional way to solve
a dish the library does not have, and taking the dish request at premium 3 / free 0; the
agent, the split between saying why and asking, and the output gate — after the `legal` agent
found that the picture prompt carries the name to Google and that the library is shared,
which is what moved the gate from the input to the output.)
