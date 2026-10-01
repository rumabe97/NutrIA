# PRD — Project 014: A plate that weighs what it should

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's brief of 2026-10-01; approved by the owner.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: approved
- **Roadmap item**: none — a follow-up to project 012, at the owner's request

## Problem

Project 012 keeps every plate within 0.5–1.5× its share of the day's energy. A person who eats two main meals still gets plates of 0.8–1.2 kg, because each carries about 1,000 kcal. On the real profile that found 012, measured read-only on the production library:

- lunches and dinners average about 800 g, with a maximum of 1,213 g;
- 13 of 42 meals in the pessimistic run weigh 900 g or more.

There are two causes.

1. **Nothing bounds weight.** A dish heavy in water — cooked grains, vegetables, skyr — fills the energy share with a lot of grams. The scheduler sees only energy and macros.
2. **Cooked weights are shown as they are stored.** The recipe and the shopping list say "Cuscús cocido 600 g". A person buys and weighs about 230 g of dry couscous. The plate looks, and reads, twice as big as what is cooked from the packet.

## Outcome

- No plate is heavier than a ceiling for its meal: 750 g for breakfast, lunch and dinner, 250 g for the snacks and supper. The energy floor still outranks it, as in 012.
- Cooked grains and pasta are shown in dry weight in the recipe ("Cuscús: 240 g en seco (600 g cocido)").
- They are bought in dry weight on the shopping list, merged with the same food bought dry.
- Cooked legumes stay as they are, because they are bought cooked, in jars.
- The evaluator reports the grams of every plate, and the macro promise holds.

## Scope

**In:**
- a gram ceiling in the scheduler, on every path that sizes or places a plate;
- cooked-to-dry yields for 15 catalogue grains and pastas;
- the dry display in the meal detail and the meal views;
- dry summing in `buildShoppingList`;
- evaluator reporting;
- a read-only re-run of the production simulation for the profile that found 012;
- tests and docs.

**Out:**
- changing stored recipe grams;
- rewriting shopping lists already stored (they change on the next generation, swap or rebuild);
- cooked legumes;
- the prompt;
- a ceiling for professionals' edits.

## Acceptance criteria

1. **Gram ceiling.** `PLATE_GRAMS_MAX` = 750 g for breakfast, lunch and dinner, and 250 g for morning snack, afternoon snack and supper.
   - No scheduled plate weighs more than the ceiling for its slot. This holds on the first build, the balance, the swaps, the spread pass, distinct days and a person's swap.
   - The only exception is when the energy floor needs it, as with `PLATE_LIMIT`.
   - A slot that no dish fits falls back as in 012.
2. **Macros hold.** In the evaluator, no profile loses more than one day inside 5% against the run on `main`. Every plate is at or under its ceiling, and the grams are reported (max, mean, count over the ceiling).
3. **The real case.**
   - The read-only simulation of the 012 profile on the production library shows no plate over 750 g.
   - Its days inside 5% are reported, at least 12/14 on the whole library.
   - The owner runs it.
4. **Dry display.** For the 15 cooked grains and pastas listed in `0078`, the meal detail shows "{nombre}: {seco} g en seco ({cocido} g cocido)". The dry weight is the cooked weight divided by the yield and rounded to 5 g. Every other ingredient reads as today.
5. **Dry shopping.** In a new or rebuilt list, cooked grains and pastas are summed as their dry counterpart. They are merged with the same dry food when the catalogue has it, or shown as "{nombre} (en seco)" when it does not. The total is rounded up to 5 g.
6. **Docs.** Decision `0078` holds the ceilings and the yield table with its source. `ARCHITECTURE.md` and `decisions/LOG.md` record them.

## Open questions

- None. The 750 g and 250 g ceilings are the owner's (2026-10-01). The yields are standard cooking ratios, and `0078` records them.
