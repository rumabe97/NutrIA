# 0025 — Every answer changes something

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision)

## Context

After `0023` made dislikes and ways of eating real, the owner asked the obvious
next question: *is everything in the onboarding actually used?* Ten steps, about
twenty-five answers, and no one had ever traced them end to end.

The audit found three groups.

**Decided in code.** Birth date, sex, height, weight and activity level drive
the target equations and the safety floor; meals per day and snacks decide the
slots; the goal and its pace decide the calories; allergies, intolerances and
free-text allergies drive the gate; the way of eating and dislikes now exclude
food (`0023`).

**Asked of the model, and checked by nobody.** Cuisines, budget, breakfast
style, plate size, cooking frequency, week notes, liked foods.

**Read by no one at all.** The whole lifestyle step but its free-text note —
bedtime, wake time, training days, training time — and the country.

That last group is the failure this decision exists to prevent: five questions
a person answers carefully, stored, shown back, and touching nothing.

## Decision

**An onboarding question must change something, or it is not asked.**

Applied to what the audit found:

- **Their day** — bedtime, wake time, training days and time — becomes one line
  of the prompt: *wakes at 06:30; sleeps at 23:00; trains 4 days a week at
  19:00*. What time someone rises decides whether breakfast can be cooked or
  has to travel, and when they train decides where the heavier plate goes. That
  is a design judgement, which is the model's half of `0004`, so it is asked and
  not enforced.
- **Cooking time** stops being a request and becomes a rule. A dish over the
  limit is rejected whether the model wrote it or the library held it, exactly
  as an excluded ingredient is. Someone who says thirty minutes and is handed a
  fifty-minute stew has been ignored, and a prompt is not where that is
  guaranteed.
- **Country** is no longer asked. Nothing reads it, the catalogue is one
  country's, and the honest options were to use it or to stop taking it. The
  column and the values already stored stay, for the day the catalogue knows
  more than one country.

## Consequences

- Every remaining question now reaches either a rule or the prompt, and which
  of the two is recorded here rather than assumed.
- The "asked, not enforced" group is a standing risk of exactly the bug `0023`
  fixed: a model that ignores a line produces a plan the product then serves.
  Cuisines and liked foods are the strongest candidates to become rules — both
  could bias the library pick the way a liked dish already does. Budget cannot,
  until an ingredient carries a price.
- A tight cooking-time limit can now leave a slot unfillable, and generation
  fails naming it. That is the same trade `0023` took: better to say so than to
  serve what they said they cannot do.
