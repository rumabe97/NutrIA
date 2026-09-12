# 0050 — Generation can go through an OpenAI-compatible gateway

**Status**: accepted · **Date**: 2026-09-12 · **Deciders**: owner, agent

## Context

Generation's ceiling is the provider's free tier (`0006`, `0035`): one Gemini
key, one daily cap, shared by every plan. The owner runs OmniRoute, an
OpenAI-compatible gateway that holds the vendor keys itself, routes by model
name, and chains models into combos — `NutrIA-Fallback` falls from
`muse-spark` to `mimo` to `gemini-3.6-flash`. It runs on the owner's machine
and on an Oracle instance.

Wiring it to the pool builder surfaced three failures before a single dish
was accepted:

- **The loose JSON mode.** Without structured outputs the SDK asks for
  `{ type: 'json_object' }` — "return JSON", no shape. One model answered in
  prose; another returned JSON of another shape, and the pool builder crashed
  reading `dishes` off it.
- **Strict JSON Schema.** With structured outputs the SDK sends the schema
  with `strict: true`, OpenAI's contract: every object must carry
  `additionalProperties: false`. The wire schema cannot (Gemini rejects the
  keyword), so `muse-spark` answered 400 to every request, in under a second.
- **Retries stacked on failover.** The SDK retries a failed call twice. The
  gateway already moves a failed call to the next model of its combo, so a
  model that hung to the gateway's 180-second limit held one slot for nine
  minutes over three tries before the pool builder heard of it.

## Decision

- **A new provider, `AI_PROVIDER=omniroute`**, through
  `@ai-sdk/openai-compatible` at `AI_BASE_URL` (default
  `http://localhost:20128/v1`). The key is `OMNIROUTE_API_KEY`; the model is
  `OMNIROUTE_MODEL`, which wins over `AI_MODEL` for this provider and defaults
  to `NutrIA-Fallback`. There is no vendor-prefix check: a gateway alias names
  no vendor.
- **Structured outputs, sent non-strict** (`nonStrictSchema`). The whole wire
  schema still travels as guidance; the guarantee was never the wire schema
  but `generatedDishSchema` and the gates after it.
- **A response that parses but is not `{ dishes: [...] }` is a provider
  error**, reported and counted, not a crash.
- **No SDK retries behind the gateway** (`resolveMaxRetries`). Direct
  providers keep the SDK's two, since nothing else retries for them.
- **Nothing on the deterministic side moves** (`0004`): the model returns
  slugs and grams; macros come from the catalogue; allergies are enforced by
  removal from the prompt and by the gate.

## Alternatives considered

- **The loose JSON mode**, which needs no schema support from the gateway:
  prose and wrong shapes, measured.
- **Strict mode with an OpenAI-strict schema** (every property required,
  `additionalProperties: false` everywhere): `muse-spark` returned canonical
  keys with it, but Gemini rejects that keyword on direct calls and it was
  never tested through the gateway, so it would fork the wire schema per
  provider for a gain the downstream parse already gives.
- **Keeping the SDK's retries**: they repeat the gateway's whole wait.
- **The gateway as a way round the Gemini cap**: it holds one Google key, so
  `gemini/*` through it spends the same quota. Its value is the free
  non-Google models in the same combo, not more Google.

## Measurements

Weekly benchmark, a demanding synthetic profile (3,400 kcal, six meals,
gluten, milk, tree-nut and peanut allergies, lactose intolerance,
pescatarian, 30 minutes a dish, a carbohydrate load and a race), prompt
3.2.1. "Mixed" is what the app does: the library with the model's dishes in
front of it.

| Model | Dishes kept | Mixed week, days within 5% | Time |
|---|---|---|---|
| `muse-spark` (through the gateway) | 28 of 35 | 7/7 on all four macros | 233 s |
| `NutrIA-Fallback` | 34 of 37 | 7/7 on all four, worst 2.6% | 161 s |
| `mimo` | 78 of 175 | fat 6/7 (race day) | 699 s |
| `big-pickle` | 0 | — never answered within 180 s | 301 s |
| `gemini-3.6-flash` (direct) | 5 of 5, from the one call of 11 the daily quota let through | not measured | 77 s |

The direct Gemini run is the one that tells whether the 3.2.x prompt holds on
the provider production uses, and the free tier's daily cap cut it short:
ten calls answered 429. The dinner call that answered kept all five dishes,
invented no slug, and landed 9.2 points off the split — in line with the
others — which is a sign, not a measurement. To run again once the cap
resets. No run served an unsafe meal. `mimo` answered 0 dishes before the gateway's
execution limit was raised from 15 to 180 seconds.

## Consequences

- Which account a call spends against is the gateway's routing, not this
  code's. The combo's order is configuration the owner holds, on each
  instance.
- **Time is the open risk on the platform.** A generation runs inside one
  invocation (`BackgroundTask`, `waitUntil`), and `vercel.json` caps it at 300
  seconds. Nothing here bounds a model call: the gateway's own limit plus its
  internal retry reached Node's 300-second header timeout, and one run whose
  combo failed hop after hop took 645 seconds. Before production generates
  through the gateway, a call needs a deadline shorter than the function's —
  or pool building a time budget — so the library covers the gap instead of
  the platform killing the job mid-plan.
- The gateway adds a `prompt_cache_key` to OpenAI-format requests, and one
  upstream rejects it with a 400. A combo absorbs that as one extra hop.
- The pool builder keeps every valid dish a model returns. `mimo` returned
  175 for 30 asked, 78 of them valid and far from their split; a cap per slot,
  keeping the closest, is future work.
