# 0022 — A swap can be asked for something

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's decision — "continúa con el plan")

## Context

"Cambiar plato" (`0015`) replaced a meal with whatever fitted its calories and
protein: library first, the model only when the library had nothing. It could
not be told *why* the person wanted another dish. The roadmap named the axes
people actually have in mind — faster, cheaper, vegetarian, no cooking, more
protein — and the catalogue can answer three of them today.

## Decision

**A swap may carry one axis, and every candidate must answer it; the axes
offered are the ones the data can answer.**

- `quicker`: strictly less time in total, prep and cooking, than the dish
  being replaced. `no_cooking`: a cook time of zero. `more_protein`: at least
  a fifth more protein per calorie than the current dish, and the protein the
  fit is scored against rises by a quarter so a richer plate ranks as the
  better one. No axis is the default and stays a real choice.
- The axis is a filter on the library pick and on the model's answers alike
  (`axisFilter` in `core/domain/Scheduler`), judged against the dish being
  replaced. When the library has nothing that answers it, the model is told
  what was asked, in one line, and its dishes pass the same filter: the model
  is asked, never trusted.
- Not offered: *cheaper*, because no ingredient carries a price, and
  *vegetarian*, because food classes exist only in the seed and not in a
  column the picker can read. Either is a data change first; an axis the
  product cannot enforce would be a promise made by a prompt.
- The screen says when nothing answers the axis and suggests another one or
  none; the allowance is not spent by a swap that found nothing.

## Consequences

- `POST /meal-plans/meals/:id/swap` takes `{ axis? }`; prompt `2.7.0` carries
  the wish. `MealDetailView` is unchanged.
- The swap's anchor now reads the recipe's minutes, so "quicker" is judged
  against the real dish and not a guess.
- Adding *vegetarian* means persisting the seed's food classes on
  `ingredients` and filtering on them; *cheaper* means a price per ingredient.
