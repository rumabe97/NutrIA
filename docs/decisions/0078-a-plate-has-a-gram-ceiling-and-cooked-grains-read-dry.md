# 0078 — A plate has a gram ceiling, and cooked grains are read and bought dry

- **Status**: accepted. Complements [`0076`](./0076-protein-on-a-reference-weight-and-a-hard-plate-limit.md): that bounds a plate's energy against its share, and this bounds its weight.
- **Date**: 2026-10-01
- **Deciders**: owner ("me parece muchísimo una comida de 1 kg"; "¿ponemos que es 200 g de cuscús en seco?"; the ceilings 750 g and 250 g); agent: the yields
- **Project**: docs/projects/014-a-plate-that-weighs-what-it-should

## Context

After `0076`, a person with two main meals still got lunches and dinners of 0.8–1.2 kg, measured read-only on the production library for the profile that found `0076`. Each meal carried about 1,000 kcal, much of it in watery food: cooked grains, vegetables, skyr.

The recipe and the shopping list showed cooked weights ("Cuscús cocido 600 g"), though a person buys and weighs about 230 g of dry couscous.

## Decision

1. **Gram ceiling.** No plate weighs more than `PLATE_GRAMS_MAX` for its slot:

   | Slot | Ceiling |
   |---|---|
   | breakfast, lunch, dinner | 750 g |
   | morning_snack, afternoon_snack, supper | 250 g |

   It is enforced exactly like `PLATE_LIMIT`. The energy floor is the only thing that may pass it.
2. **Yields.** The 15 cooked grains and pastas of the catalogue are shown and bought in dry weight. Dry weight = cooked weight ÷ yield. The yields are common cooking ratios: cooked weight per dry weight, for grains boiled until tender and drained or absorbed.

   | Cooked slug | Dry slug | Yield |
   |---|---|---|
   | `arroz-blanco-cocido` | `arroz-largo-crudo` | 3.0 |
   | `arroz-basmati-cocido` | `arroz-basmati-crudo` | 3.0 |
   | `arroz-integral-cocido` | `arroz-integral-crudo` | 2.5 |
   | `arroz-salvaje-cocido` | `arroz-salvaje-crudo` | 3.5 |
   | `cuscus-cocido` | `cuscus-crudo` | 2.5 |
   | `bulgur-cocido` | `bulgur-crudo` | 2.5 |
   | `quinoa-cocida` | `quinoa-cruda` | 2.75 |
   | `mijo-cocido` | `mijo` | 3.0 |
   | `trigo-sarraceno-cocido` | `trigo-sarraceno` | 2.5 |
   | `cebada-cocida` | `cebada-perlada` | 3.0 |
   | `espelta-cocida` | `espelta-en-grano` | 2.5 |
   | `polenta-cocida` | `polenta` | 4.0 |
   | `pasta-cocida` | none ("Pasta (en seco)") | 2.3 |
   | `pasta-integral-cocida` | `pasta-integral-seca` | 2.2 |
   | `fideos-de-arroz-cocidos` | `fideos-de-arroz-secos` | 2.5 |

   **Cooked legumes are not converted.** In Spain they are bought cooked, in jars.

## Alternatives considered

- **Only the person adding a meal.** It needs no code and helps most, but it is the person's choice and does not stop a 1.2 kg plate for whoever keeps two meals.
- **Asking the model for denser dishes.** Rejected for now: it only reaches new dishes, and the prompt would change for everyone.
- **Storing recipes in dry weight.** Rejected: the macros and the scheduler read cooked grams, and a data migration of every recipe is out of proportion to the confusion it solves.

## Consequences

- To fit the same energy into less weight, the scheduler picks denser dishes and smaller portions. That means fewer vegetables and more bread, pasta, legumes and oil. The evaluator guards the macro promise.
- Shopping lists stored before this change keep cooked weights until the plan is regenerated, a meal is swapped, or the plan is rebuilt.
- A new cooked grain added to the catalogue reads cooked until it is added to the table.
