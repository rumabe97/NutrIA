# 0014 — A verdict on a dish shapes the next plan

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's request)

## Context

The owner wants each person's plans to become *theirs*: "something simple for
the user to say whether they liked the recipe, and the AI to take it into
account in future plans". The roadmap had it as part of "a user can live inside
the plan" — complete / skip / favourite / dislike — and the tables
(`favorite_recipes`, `disliked_recipes`) have existed since the kickoff, unused.

Two things had to be true of the design. It had to be **one press**, at the
moment the plate is in front of the person, or nobody would do it. And it had to
reach **both halves of generation**: reuse, which is code and picks from the
library deterministically ([`0009`](./0009-rotate-reuse-per-user.md)), and the
model, which writes the fresh third ([`0013`](./0013-a-third-of-every-plan-is-fresh.md)).
A signal that only reached the prompt would be lost on the two thirds of the plan
the model never sees.

## Decision

**One verdict per person per recipe — liked, disliked, or none — recorded on the
recipe, not the meal, because the dish can return in another plan and that is
what the verdict is about.**

- `PUT /recipes/:id/verdict`. The user is the session's; the body is one of three
  words; an unknown recipe is a 404. The two tables are cleared for the pair and
  at most one row written, in a transaction, so a "liked" never sits beside a
  "disliked". Pressing the active button withdraws the verdict.
- **Reuse, in code.** A disliked dish joins `avoidSlugs`, next to last fortnight's,
  for good. A liked dish goes into `preferSlugs`: `rotatePool` puts favourites at
  the front of the pick, so a favourite is in the pool whenever the library may
  offer it — still never straight after it was served, which `avoidSlugs` decides.
- **Generation, in the prompt.** Liked dishes are named as *their taste* — design
  new dishes in the same spirit, not copies. Disliked dishes are named as never to
  recreate, including their defining ingredient in the same role. Prompt version
  2.5.0.
- The meal screen shows the two buttons under the dish name with one line saying
  what pressing them does, and the current standing.

## Consequences

- A dislike is a preference, not a safety rule: it is enforced deterministically
  on reuse and by instruction on generation, which is the right strength for
  "I did not enjoy this". Allergies stay where they were.
- Favourites return, but not every fortnight: `avoidSlugs` still holds back last
  fortnight's dishes. A person who wants the same dish every week can say so in
  their profile; the verdict is for "again, sometime".
- The library grows in the direction of each person's verdicts, since fresh
  dishes are designed towards what they loved — the plans start to differ *per
  person*, not just per fortnight.
- Nothing yet expires a verdict; a dish disliked once is out until the person
  withdraws it. That is the honest reading of "no me gusta".
