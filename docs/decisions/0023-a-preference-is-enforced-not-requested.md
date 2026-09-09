# 0023 — A preference is enforced, not requested

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, on a user report)

## Context

A user wrote "pescado" in the onboarding's dislikes and was served salmon.

The mechanism was the one `0004` exists to forbid, in a place nobody had
looked: dislikes and the declared way of eating reached the model as two lines
of the prompt — `DISLIKES: pescado`, `WAY OF EATING: vegetarian` — and nothing
else. Every ingredient stayed in the catalogue the model was shown, no dish was
checked against them afterwards, and reuse offered the library's fish to
everyone. A model that ignored the line produced a plan the product then stored
and served. The same hole covered vegetarians and vegans, who could be served
meat.

`0004` drew the line at safety: *code decides what can hurt, the model decides
taste.* A dislike was filed under taste. That was the mistake — the model does
not decide taste either. It decides what to cook with the food it is given, and
which food it is given is ours to decide.

## Decision

**What a person will not eat is removed from the catalogue before the model
sees it, and from the library before reuse can offer it.**

- `ingredients.classes` records what a food *is* — `meat`, `pork`, `fish`,
  `shellfish`, `dairy`, `egg`, or a bare `animal` for honey, gelatine, lard and
  a meat stock. Four are derived from the allergen links at seed time; the rest
  the seed tags. `pork` implies `meat`; everything implies `animal`. The
  derivation that the substitution audit already used is now the seed's, so one
  rule feeds both.
- `resolvePreferences` (in `core/domain/Preference`) turns a profile into a set
  of excluded ingredient ids: a way of eating through the class map, and each
  dislike through, in order, an exact catalogue match plus everything made of it
  (`salmón` reaches `salmon-ahumado`), then a group word (`pescado` reaches
  every fish), then nothing.
- `GenerationContext` carries the result beside the safety profile, never
  inside it. Both remove food before it can be proposed, but one is a constraint
  and the other a preference: merging them would report a vegetarian's chicken
  as an allergy violation, and would let a preference fail a plan the way an
  allergy does.
- `PoolBuilder` filters the catalogue it shows the model, and drops any dish
  that arrives with a ruled-out ingredient anyway — a warning, not an error.
  Reuse filters the library the same way: a recipe already written is no more
  evidence that this person wants it than that it is safe for them.
- Only the dislikes the catalogue could **not** resolve are sent to the model,
  and only as a request. Naming the enforced ones there would suggest the
  request is what enforces them.

## Consequences

- A migration adds the column; the seed must be re-run for it to be filled, and
  until it is, every `classes` is empty and only exact-match dislikes bite.
- Not enforced, and honest about it: `halal` and `kosher` name how food was
  raised and prepared, which nothing here records; `flexitarian` is a direction,
  not a rule. They stay prompt lines.
- A person who rules out most of the catalogue can make a slot unfillable, and
  generation fails with `GENERATION_POOL_TOO_SMALL` naming the slot. That is the
  right failure: the alternative is serving them what they said they will not
  eat.
- Existing plans are untouched. This decides what a *next* plan is built from.
