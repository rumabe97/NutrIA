# 0047 — Dishes are designed to the whole split, per serving, at the person's own size

**Status**: accepted · **Date**: 2026-09-11 · **Deciders**: owner, agent

## Context

[`0045`](./0045-a-day-is-built-to-all-four-of-its-numbers.md) and
[`0046`](./0046-a-plan-that-misses-its-macros-is-scheduled-again.md) made the
scheduler fit all four macros and try harder when a plan misses. Neither can
make a day out of dishes that are not there. A second account's plan missed
carbohydrate and fat on most days: its targets asked for 55% of energy from
carbohydrate, and the dishes the library held for its slots averaged 26–34%
carbohydrate and 40–43% fat. No portion size turns a fat-heavy dish into a
starchy one.

The library is what the prompt asked for, and the prompt asked for the wrong
thing in three ways:

- **The size was wrong.** The per-slot brief was the slot's share computed over
  the slots *in the request*. Since [`0016`](./0016-one-round-per-slot-in-parallel.md)
  every request carries one slot, so every share was 1 and every dish was
  asked to hold the whole day's energy and protein in one serving. The model
  half-ignored it; library dishes came back 20–45% oversized.
- **Half the numbers were missing.** The model was told energy and protein,
  never carbohydrate or fat, so it landed them wherever the ingredients fell —
  and it topped up short dishes the easy way, with oil and cheese.
- **One line was false.** "A plan that meets the calories but falls short on
  protein is discarded in full" stopped being true with `0045`.

## Decision

**The prompt designs each dish to a per-serving brief on energy, protein,
carbohydrate, fat and fibre, sized by the person's own meal shape, and teaches
the model how a plate reaches a split.** `PROMPT_VERSION` 3.0.0.

- **Shares are over the whole day**, from the person's meal shape
  ([`0036`](./0036-which-meals-and-how-big.md)): a large lunch is briefed larger, a light
  snack smaller. A context without a shape uses the default shape; a requested
  slot the shape does not eat joins at its normal size rather than being
  briefed as a dish of nothing.
- **The day is stated whole**: four macros, fibre, and the split as percentages
  of energy, with the rule that every dish should sit near that split on its
  own so any combination lands on the day.
- **How to build to it**: 4/4/9 kcal per gram; fat weighed exactly and added
  last; a starch base when the split is high in carbohydrate, lean sources when
  it is high in protein and low in fat, vegetables and protein when it is low
  in carbohydrate; snacks at the day's split; raw and cooked weights by the
  slug's own name; a large brief is a large plate, a small brief a full plate
  of lighter food.
- **The goal as plate guidance**: the numbers already encode it, but the same
  numbers are reached by different plates for weight loss, muscle gain,
  performance, maintenance and healthy eating — the model's half of
  [`0004`](./0004-deterministic-safety-layer.md).
- **Event days**: when the fortnight has loaded days (`0043`), a third of the
  requested dishes are asked for at the loaded split, so those days have plates
  built for them.
- **Priorities, stated**: the catalogue, allergy and way of eating first; the
  numbers second; time, budget and habits third; taste and variety fourth.
  Way of eating and allergy stay enforced in code by removing rows from the
  catalogue — the prompt describes the order, it does not guarantee it.

**The steps stamp is split from the prompt version.** Recipes were stamped
with `PROMPT_VERSION`, and the rewrite sweep re-writes the method of every
recipe whose stamp differs — one model call each. 3.0.0 changes what a dish is
made of, not how its steps are written, so recipes are now stamped with
`STEPS_VERSION`, held at 2.8.0 and bumped only with the steps rules. Without the
split, this change would have spent the free tier re-writing the method of the
whole library for nothing.

## Alternatives considered

- **Composition-aware rotation**: pick the library dishes closest to the
  person's per-slot split instead of a shuffled dozen. Worth doing and not
  exclusive with this; it improves what the library already has, while this
  fixes what the library receives. Left for later.
- **Validate the model's dishes against the brief and reject misses.** The
  scheduler already prefers the dishes that fit, and a dish off the brief can
  still complete another person's day; rejecting it would spend quota to
  throw food away.
- **Tell the model a per-slot share of the request's slots, but send every
  slot in one request.** That undoes `0016`, which split requests per slot and
  ran them in parallel because one request that asks for every dish waits for
  every dish.

## Consequences

- New dishes should arrive near the person's split and size. Existing dishes
  are unchanged; an atypical profile — a high-carbohydrate athlete, a
  low-carbohydrate one — may need a few regenerations before the library holds
  enough suitable dishes, and `0046`'s second schedule covers the gap
  meanwhile.
- The effect is only measurable by regenerating: no test here spends model
  quota. `PoolPrompt.spec.ts` pins the brief arithmetic — a one-slot request is
  briefed at its share of the day, and one day's briefs add up to the day.
- `generation_metadata.promptVersion` distinguishes plans built from 3.0.0
  dishes from earlier ones.
