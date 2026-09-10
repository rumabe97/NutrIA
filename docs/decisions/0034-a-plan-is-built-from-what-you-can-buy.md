# 0034 — A plan is built from what you can buy

**Status**: accepted · **Date**: 2026-09-10 · **Deciders**: owner, agent

## Context

The roadmap carried one line for two jobs: "English alongside Spanish;
country-aware ingredient availability". The first was finished some time ago
without anybody crossing it off — 608 dictionary keys in both languages with
exact parity, no Spanish left in a component, recipes bound to a locale with
reuse scoped to it, ingredient names seeded in both, mail in both, and an
end-to-end suite proving an English account gets an English prompt, an English
plan and an English shopping list.

The second had not started, and the reason was written down in the onboarding
itself: the country field was deliberately **not asked for**, because nothing
read it, and a question whose answer changes nothing is the field that lies
(`0025`). The column existed; the question did not.

That is now the wrong trade. Registration is open, the product speaks two
languages, and the catalogue is Spanish enough that a British account would be
offered sobrasada, three kinds of pimentón and a Manchego.

## Decision

**An ingredient may name the countries where it is sold, and a plan is built
only from what the person can buy.**

- `ingredients.countries` is a text array of ISO 3166-1 alpha-2 codes. **Empty
  means everywhere**, and almost everything is empty — rice, eggs and chicken
  need no list. Thirty rows out of nine hundred and thirty name `ES`: protected
  designations, regional charcuterie, and jarred dishes with no shelf abroad.
- `loadCatalogue(locale, country)` drops the rows sold only somewhere else. The
  filter is in the query, so the model is handed a catalogue it *can* propose
  from — a dish never offered is a dish nothing downstream has to reject.
- **A country nobody stated filters nothing.** Null means no claim, and an
  account that never said where it is gets the whole catalogue, exactly as
  before the column existed. Guessing a country and then quietly withholding
  food over the guess is worse than not knowing.
- Onboarding asks, in the step that already asks where somebody was born, and
  offers **two** options. Two is what the catalogue can serve; a longer list
  would recreate the field that lies, and the fix for that is catalogue work,
  not a longer list.

## Why the list is short, and why that is the point

Claiming a food is unavailable somewhere is a claim, and one nobody here can
check for every country in the world. So the default is availability, and the
exceptions are the ones anybody can defend in a sentence: you cannot buy
Idiazábal in Manchester.

The short list is also what makes this safe. Filtering thins the pool, and a
thin pool is `GENERATION_POOL_TOO_SMALL`. Thirty of nine hundred and thirty
leaves eight hundred and ninety-nine, which is not a plan's problem.

## Consequences

- Somebody moving countries changes one answer and their next plan follows. The
  plans they already have do not change — the past is read-only (`0021`).
- The seed's upsert writes `countries`, so re-running it re-applies the list;
  the column is derived from the repository, like `classes` (`0023`).
- What is not built: a British catalogue. This decides *what a British account
  is not offered*, not what it is offered instead, and the second is catalogue
  work — cheddar, baked beans, the shelf a British kitchen actually has. Until
  then a British account eats the universal eight hundred and ninety-nine, which
  is a real fortnight rather than an apology.
