# 0016 — One round, one request per slot in parallel, the library covers the rest

- **Status**: accepted
- **Date**: 2026-09-09
- **Project**: none (task, at the owner's report)

## Context

After [`0013`](./0013-a-third-of-every-plan-is-fresh.md) and the 930-row
catalogue, the owner reported plans taking much longer. Production agreed: the
last two took 197 s and 232 s with **three model calls each** (≈40k input,
29–43k output tokens), against 56 s and one call before.

Two things were slow. Output volume: sixteen fresh dishes with documented steps
are 12–15k output tokens, and a model writes those at a fixed rate whatever we
do — one request that asks for all of them waits for all of them. And the retry
loop: when the first round came back short, the builder asked again, a whole
second prompt and a whole second wait, for a handful of dishes the library could
have supplied in a millisecond.

## Decision

**Each slot is asked in its own request, all at once; a short first round is
covered from the library before the model is asked again.**

- `PoolBuilder` fans a round out as one `generate` per slot with a shortfall,
  in parallel. Latency is set by the longest single response — a quarter the
  size of one for four slots — and the token cost is unchanged. Usage sums
  across the requests; a request that fails records the provider error, and a
  round where none succeeded ends the loop as before.
- Generation now hands the builder a `backfill`: the safe library dishes that
  rotation held back for freshness, minus last fortnight's and the dislikes.
  After the first round, whatever is still short is covered from there; the
  model is asked a second time only if the backfill cannot cover it. The plan
  still gets what the first round wrote fresh — the third is asked for, and
  usually delivered — and `backfilled` on the plan says how many library dishes
  filled in.
- The generation screen polls with backoff — 1 s, 2 s, 4 s, then 6 s — instead
  of every 1.5 s: a fifth of the requests, no slower to notice the end.

## Consequences

- A plan is normally one round: three to six parallel requests, one wait of
  roughly a single slot's output. Expect a minute or two rather than three or four.
- The fresh third is a target, not a guarantee, when the model under-delivers:
  the shortfall is library, which was always the alternative and is what the
  fallback path already did in the worst case.
- Parallel requests count against the provider's per-minute request limit; a
  plan's handful is well inside the free tier's.
