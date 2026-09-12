# 0052 — Protein powder is for the people who take it, and a supplement says what it is

**Status**: accepted · **Date**: 2026-09-12 · **Deciders**: owner, agent

## Context

The first plan built under `0051` read right on every count it was built to, and a
reading of it found three more things:

- **Protein powder at breakfast, for somebody who never said they own any.** Asked for
  forty grams of protein at breakfast, the model reached for twenty grams of whey or pea
  protein in seven breakfasts of fourteen. Both are ordinary catalogue rows, so nothing
  stopped it.
- **A supplement form that asked the wrong question.** Every supplement was a name, a
  number of servings and "protein per serving (g)". Creatine has no protein; neither do
  vitamins or omega-3. The field was optional in the database and asked of all of them.
- **One protein at one meal.** The fortnight's cap held tuna to six meals, and all six were
  the afternoon snack.

The owner's words: protein powder only for whoever takes it, and that is what the
supplements section should say.

## Decision

- **A supplement has a kind** — protein powder, creatine, vitamins and minerals, omega-3,
  or other — from a short list, not guessed from its name. Protein grams are asked, stored
  and summed for a protein supplement only. Existing supplements with grams became protein
  supplements (migration `0027`, a hand-added data step); the rest became "other".
- **Protein supplements leave the catalogue of anybody who records none.** A curated list
  of five rows — the two powders, the two protein drinks, the protein bar — pinned by a
  test the way `CONDITION_EXCLUSIONS` is, and excluded the way a dislike is: out of the
  prompt, the library and the gate alike. A high-protein yoghurt is food and stays.
- **The only thing generation reads is whether a protein supplement exists.** Not the
  name, not the dose, nothing else in the health section, and it is read in `core`, as
  the condition exclusions of `0008` are. The AI module still cannot import the health
  layer (`health-boundary.spec.ts`); what reaches the model is a catalogue with or
  without protein powder in it, never the supplement.
- **A main protein at most three times in any one meal** of the fortnight
  (`PROTEIN_RULES.perSlot`), priced like the rest of `0051`'s protein rules rather than
  refused.

## Alternatives considered

- **A preference outside the health section** ("do you use protein powder?"). Simpler, and
  outside health consent, but the owner's point was that the supplements list is where this
  already belongs; a second place to say it is a second place to disagree.
- **Telling the model not to use protein powder.** Taste is the model's half of `0004`;
  what a person has in their kitchen is not, and a prompt line is a request, not a rule.
- **Recognising protein supplements by name.** "Whey", "Impact", "iso" — a guess that is
  wrong in both directions. The kind is one tap.

## Consequences

- Measured read-only on seven development profiles, none of whom records a protein
  supplement: macros inside 5% on all four, 98 of 98 days; no meal with protein powder;
  every meal within its share band; no protein twice in a day; a protein four times in one
  meal on two profiles whose pools had little else — priced, as designed.
- The health consent now has one more consequence for a plan: withdrawing it removes a
  protein supplement, and with it the powder from the next plan.
- Plans already generated are not re-judged. The next generation or swap is built from the
  new catalogue.
