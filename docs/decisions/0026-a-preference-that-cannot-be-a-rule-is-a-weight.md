# 0026 — A preference that cannot be a rule is a weight

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

`0025`'s audit left a group of answers that reached the model as a line of the
prompt and were checked by nobody: cuisines, liked foods, budget, breakfast
style, plate size, cooking frequency. That is the shape of the bug that started
all of this — a user wrote "pescado" in their dislikes and was served salmon,
because asking was all the product did.

Two of that group can do better, and they are the two people actually notice:
the kitchens they chose, and the foods they said they like.

Neither can become a rule the way a dislike did. "Prefiero mediterránea" is not
"only mediterranean" — a fortnight of one cuisine is not what the words ask
for, and a library short of that cuisine would fail to build a plan at all. And
a like cannot be enforced by anything: you can serve someone salmon, you cannot
make them enjoy it.

## Decision

**What cannot be a rule becomes a weight on the pick, never a filter.**

- `isPreferredDish` in `core/domain/Variety` answers one question — should the
  library offer this dish before the others — for three reasons: they asked for
  the dish by name (a liked dish, `0014`), it comes from a kitchen they chose,
  or it uses a food they said they like.
- `rotatePool` partitions on it: what they lean towards first, in its shuffled
  order, then everything else in its own. The tail is still there, so a thin
  library or a narrow taste costs variety and never a plan. `pickReplacement`
  ranks a swap the same way, so the two agree.
- Liked labels resolve against the catalogue exactly as dislikes do — the same
  reading of a word, one function, so "salmón" reaches smoked and frozen salmon
  on both sides and "pescado" reaches every fish.
- Cuisines are compared normalised, because the model writes `mediterranea`
  where the person chose `Mediterránea`.

## Consequences

- A cuisine or a liked food now changes which dishes are *offered*, not only
  what the prompt says. Nothing is excluded, so no answer here can leave a slot
  unfillable — the difference from `0023`, and the reason the two are separate
  mechanisms.
- Still only asked, and honestly so: budget, breakfast style, plate size,
  cooking frequency and the shape of their day. Budget cannot become either a
  rule or a weight until an ingredient carries a price.
- The profile says of a *dislike* whether it is kept out or only asked for
  (`0025`). A like has no such line, because "we will lean towards it" is what
  the word already means.
