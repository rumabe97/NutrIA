# 0064 — Generation runs on paid, no-training models through OpenRouter

- **Status**: accepted
- **Date**: 2026-09-26
- **Project**: docs/projects/005-meal-and-season-catalogue
- **Supersedes**: the production route of [`0050`](./0050-generation-can-go-through-a-gateway.md)
  (the gateway stays for experiments) and the 2026-09-25 `decisions/LOG.md` line that chose
  `nemotron-3-ultra:free` → Gemini for project 005 phase 7.

## Context

The owner's rule, 2026-09-25: no provider may train on or reuse what NutrIA sends — the
privacy policy promises it. Every step of the gateway's production combo broke it:
contributor models, OpenRouter `:free` endpoints, and Gemini's free tier, whose terms also
forbid serving users in the EEA from the free quota. Production has run
`AI_PROVIDER=stub` (library only) since 2026-09-26 while this was settled.

Measured on 2026-09-26 with `apps/api/scripts/bench-models.mjs`, prompt 4.1.0, paid calls
the owner authorised (0.42 $), every request with `provider.zdr` and
`data_collection: deny` on an account with training off and zero data retention on:

| Model (reasoning) | Answered | Median s | Valid dishes | Split error (median, points) | $ per request |
| --- | --- | --- | --- | --- | --- |
| `deepseek/deepseek-v4.1-flash` (low) | 8/8 | 37 | 21/24 | 1.5 | ~0.012 |
| `deepseek/deepseek-v4.1-flash` (off) | 8/8 | 7 | 16/34 | 8.9 | ~0.004 |
| `minimax/minimax-m3` (low) | 8/8 | 14 | 17/20 | 8.7 | ~0.002 |
| `deepseek/deepseek-v4-pro-0813` (low) | 5/8 | 148 | 10/15 | 2.4 | ~0.047 |
| `z-ai/glm-5.3-flash` (low) | 4/8 | 146 | 6/12 | 3.2 | ~0.002 |
| `deepseek/deepseek-v4-flash-0731` (low / off) | 0/8 / 8/8 | timeout / 34 | 0 / 8/22 | — / 8.5 | — |
| `openai/gpt-oss-120b` (low) | 8/8 | 51 | 2/24 | 9.9 | ~0.001 |
| `mistralai/mistral-small-2603`, paid Nemotron | 0/8 | 429 on their ZDR endpoints | — | — | — |

The owner's muse-spark benchmark of 2026-09-12 measured about 11 points of split error.
Composition is what the scheduler cannot fix; size it scales (`0045`).

## Decision

1. **Generation calls OpenRouter directly**, not through the owner's gateway: one processor
   fewer, no dependency on the Oracle VM for availability, and OpenRouter's own model
   fallback and provider routing.
2. **Primary `deepseek/deepseek-v4.1-flash` at low reasoning effort; fallback
   `minimax/minimax-m3`**, also at low. Different companies; the primary is served by several
   ZDR providers.
3. **The no-training rule is enforced in three layers**: the account's privacy settings
   (training off for paid and free, ZDR on), the key's guardrail (only these two models, ZDR,
   a monthly cap), and a fixed `provider` block on every request (`zdr`,
   `data_collection: 'deny'`). No free-tier, contributor or Gemini route is configured.
4. **Seven fresh dishes per meal stay** (`0013`), asked as parallel requests of three,
   three and one, so each request keeps the latency of three dishes.

## Alternatives considered

- **muse-spark contributor, Gemini free, OpenRouter `:free`**: they train or their terms
  forbid this use.
- **A local model on the Oracle A1**: 10–20 minutes a request against a 170-second budget
  (`docs/reference/architecture/0001`).
- **Reasoning off**: seven seconds, but the split error of a model computing grams without
  thinking (~9 points) — the owner asked for plans as precise as before.
- **Through the gateway**: an extra hop and processor, and its own timeouts and caps.

## Consequences

- Generation now costs money: about 0.10–0.15 $ a fortnight at seven fresh dishes a meal
  (estimated from the measured cost per request), capped by the key's guardrail.
- `legal` checks OpenRouter's DPA and the subprocessors before the switch in production;
  `/privacidad` then moves to the no-training text.
- `/admin` reads the answering model, provider and cost from OpenRouter's response instead
  of the gateway's `x-omniroute-*` headers.
