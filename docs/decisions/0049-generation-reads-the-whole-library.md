# 0049 — Generation reads the whole library, and a day's portion search has a ceiling

**Status**: accepted · **Date**: 2026-09-11 · **Deciders**: owner, agent

## Context

The owner asked for a library of about five hundred dishes, written once and
checked in code, so that every kind of plan — light, abundant, every diet and
allergy — has dishes built for it before the model is asked for anything. The
first 232 were loaded into the development database, from a copy of
production, and two things surfaced before any of it could reach production.

- **The library was read as a sample.** `findReusable` read 300 recipes with no
  `ORDER BY`. With 535 Spanish dishes, whichever 300 Postgres returned first
  were the only ones a generation, a swap or a mid-plan rebuild could see; one
  account had no lunch it could eat in the rows it was shown, though the
  library held them. And the per-person rotation shuffled a list whose own
  order was not fixed.
- **A six-meal day is 531,441 portion combinations.** The portion search is
  exhaustive (`0045`), and the spread pass (`0048`) sizes two days for every
  exchange it prices. A fortnight of six meals took 98 seconds to schedule on
  the code in production — twice that when a plan is scheduled again (`0046`),
  on top of the model's minutes, against a 300-second function.

## Decision

- **The whole library is read**, up to a ceiling of 5,000 recipes, in slug
  order. Safety, dislikes and the rotation filter what this reads, so it has to
  read all of it.
- **A day prices at most 59,049 portion combinations** — what a five-meal day
  already priced. Windows grow a step at a time, biggest meal first, so every
  day of five meals or fewer keeps the whole window it had, and a sixth meal
  narrows the lighter ones first. Inside the spread pass the ceiling is 6,561,
  a four-meal day's whole search.

## Measurements

On the development copy with 535 dishes, one fortnight at a time:

| | Before | After |
|---|---|---|
| Six meals, scheduling time | 97.6 s | 28.6 s |
| Five meals, scheduling time | 9.5 s | 13.9 s (the pool grew from 220 to 381) |
| Profiles that can be scheduled from the library alone | 5 of 7 | 6 of 7 |

Days inside 5% across every profile with a plan: energy 84 of 84, protein 84,
carbohydrate 83, fat 81. With the seed grown to 475 dishes (778 recipes), every
one of the seven profiles on the copy can be scheduled from the library alone,
and all 98 of their days land inside 5% on all four macros, with no day serving
its meals out of the size order the person chose; a six-meal fortnight on that
library schedules in 33 seconds, fourteen of fourteen days inside. Before the whole library was read, the 15%-protein
profile of `0048` missed protein on all fourteen days; with it, none. The
fat days still missing belong to one restricted account whose supper and lunch
dishes are few; the batches still to load are written for it.

## Alternatives considered

- **A larger window with a time limit.** A deadline makes the same input give
  a different plan on a slower machine; a count of combinations does not.
- **A smarter portion search** — coordinate descent, or a solver. Worth doing if
  six meals become common; the ceiling bounds the cost today without changing
  what four- and five-meal days get.

## Consequences

- The dishes loaded so far exist only in development. Production receives them
  only when the owner says so.
- Six-meal days are sized a little more coarsely on their light meals; the
  measured six-meal profile still landed fourteen of fourteen days inside 5%.
