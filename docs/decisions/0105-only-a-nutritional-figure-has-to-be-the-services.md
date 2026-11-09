# 0105 — Only a nutritional figure has to be the service's

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted — supersedes the **scope** of
  [`0104`](./0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md)
  clause 4; the rest of `0104` stands
- **Date**: 2026-11-09
- **Project**: docs/projects/023-an-assistant-that-answers-from-your-plan

## Context

`0104` clause 4 said that **every number** in an assistant's answer is extracted and checked
for membership in the set of figures the service supplied, and that an answer carrying one the
service did not supply is withheld.

The same evening, the owner asked for the assistant to write a recipe when somebody asks for one
— *«o platos si pide una receta en específico»* — and the PRD was amended to say it may write one
"with its ingredients and quantities". The two were never reconciled, and they cannot both hold:
**every recipe has `200 g de arroz` in it, and no service could have supplied that number.** Read
together, the contract withheld every recipe it had just promised. It surfaced while building the
check (project 023 phase 2), which is the right place to find it and the wrong place to leave it.

## Decision

**What has to be the service's is a nutritional figure** — an amount of energy, an amount of a
macronutrient, or a percentage of either — and nothing else.

- `450 kcal`, `45 g de proteína`, `proteína: 45 g`, `el 33 % de tus calorías`, and the label form
  of a recipe's nutrition block (`Calorías: 652`) are figures, and are checked.
- `200 g de arroz`, `2 huevos`, `nata al 18 %`, `30 g de proteína en polvo`, `30 minutos a 180
  grados` and `el 14 de noviembre` are quantities, dates and temperatures, and are not.
- A nutritional unit preceded by a number **word** (`unas dos mil calorías`) is withheld outright:
  it cannot be checked, and a figure that dodges the check by being spelt out is the one to
  distrust.
- A stated figure is a supplied one **of the same kind** — energy against energy, protein against
  protein, a share against a share — when it is within the product's own ±5 % of it, or equal to it
  rounded to the stated figure's precision. Both are ways of *saying* a figure. Sugar and saturated
  fat are kinds the service never supplies, so a figure of either is always withheld.
- The question adds **its nutritional figures, by kind** — «quiero llegar a 120 g de proteína» may be
  repeated back — and not every number in it: «tengo 30 años» does not make «30 g de hidratos» a
  supplied figure.

The **structural constants** the plan had put in the set — fourteen days, meals a day — are
**dropped**. They were there for a check that read every number. This one never reads a bare
number, so they were no longer needed, and they had become harmful: a `5` or a `100` in the set
would have let `5 g de proteína` and `100 g de grasa` through.

## Alternatives considered

- **Keep checking every number, and add a recipe's quantities to the set.** Rejected: there is
  no service that knows a recipe the model has not written yet.
- **Keep checking every number, and forbid recipes.** Rejected: it reverses the owner's
  instruction to rescue a check, which is the order of priorities upside down.
- **Check nothing in a recipe.** Rejected: a recipe that ends «por ración, unas 450 kcal y 45 g de
  hidratos» is stating exactly the figure the 2026-09-12 probe caught a model inventing for a
  diabetic. What a recipe *is made of* is free; what it *claims to supply* is checked.

## Consequences

**The safety intent is unchanged.** The dangerous number was always a nutritional one — the
per-meal carbohydrate split, the protein a day — and every one of those is still checked against
what the service computed.

**What is weaker, said plainly.** A quantity is not a figure, so an answer that says «toma 300 g
de arroz en cada comida» is not withheld by this check even though it implies a carbohydrate
amount. What stands against that is the rest of the design: the label, the prompt's rule against
stating amounts it was not given, and the fact that the assistant can change nothing — the plan
a person eats from is still the scheduler's.

**Why by kind, found in review before it shipped.** The first build kept one flat list of every
number in the context. With a fortnight in it — some 350 figures between 0 and 2,500, each with a
±5 % band — almost any amount of grams falls within 5 % of *something*: lunch's `33 %` share made
«33 g de grasa» a supplied figure, and the carbohydrate target made «240 g de proteína» one. A
check that cannot tell a share from a mass is not checking.

**Density is still a thing to measure, not a thing already solved.** Even kind by kind, fourteen
days of per-meal protein at ±5 % cover a good part of the plausible range. Project 023 phase 6
seeds an invented figure into real answers over a real fortnight and counts how many this check
lets through; that number decides whether ±5 % is the right band, or whether per-meal figures
should leave the set in favour of day-level ones.

**The check now has a vocabulary to keep**: the energy and macronutrient words, in both
languages, and the gap allowed between a nutrient and its amount (`GAP` in
`core/domain/Assistant/FigureSet.ts`). A comma is deliberately not allowed in that gap — «para
subir la proteína, añade 150 g de pechuga» is a recipe, not a protein figure — and the tests name
that case so a future widening cannot quietly undo it.
