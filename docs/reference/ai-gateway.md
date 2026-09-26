# AI providers runbook (OpenRouter, and the OmniRoute gateway)

> **Purpose**: how to make plan generation go through an OpenAI-compatible gateway
> ([`0050`](../decisions/0050-generation-can-go-through-a-gateway.md)) — what to set on
> the gateway, what to set on the API, how to tell it works and how to undo it. Most of
> it is owner-only: an agent can read the gateway but must not reconfigure it.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that invalidates it.
>
> Facts are labelled **confirmed** (measured, and how) or **hypothesis** (believed, with
> the open question), as reference docs must be.
>
> Production calls **OpenRouter directly** ([`0064`](../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)), §0; the gateway (§1–§7) stays for experiments and benchmarks.

## 0. Production: OpenRouter directly (`0064`)

With `AI_PROVIDER=openrouter` the pool builder calls `https://openrouter.ai/api/v1` itself, on paid models that never train on or retain what is sent. The rule is enforced in three layers; the first two are the owner's to set, the third is code.

**Checklist — the account** (openrouter.ai, settings → privacy), owner-only:
- [ ] Training on inputs **off**, for paid and free models.
- [ ] Zero data retention (ZDR) **on** for all models, and for the first-party Anthropic, OpenAI, Google and SpaceXAI endpoints.
- [ ] The workspace data discount (OpenRouter using inputs/outputs) **off**.

**Checklist — the key** (settings → keys), owner-only:
- [ ] A key for NutrIA alone, with a guardrail: allowed models only `deepseek/deepseek-v4.1-flash` and `minimax/minimax-m3`; ZDR required; a monthly credit limit (`0064` estimates 0.10–0.15 $ a fortnight).
- [ ] Stored only as `OPENROUTER_API_KEY` on the API project — never on the web project, never `NEXT_PUBLIC_`.
- [ ] No preset is needed: the code sends the models, the provider block and the reasoning effort. If one is kept for manual tests, it has no tools and response caching **off** (two people with the same profile would otherwise get the same dishes).

**What every request carries** (code, `ai.config.ts` `openRouterRequest`, written over whatever the request had — **confirmed** by its spec on the posted body): `provider: { zdr: true, data_collection: 'deny', require_parameters: true }`, `models: [AI_MODEL, ...AI_FALLBACK_MODELS]` (OpenRouter's own fallback, inside one request), `reasoning` from `AI_REASONING_EFFORT` (`none` → `{ enabled: false }`), `usage: { include: true }`. The SDK retries nothing and no session header is sent. A model id ending `:free` is refused at boot.

**The API's environment:**

| Variable | Value |
| --- | --- |
| `AI_PROVIDER` | `openrouter` |
| `OPENROUTER_API_KEY` | the key above — boot is refused without it |
| `AI_MODEL` | `deepseek/deepseek-v4.1-flash` (the default when empty) |
| `AI_FALLBACK_MODELS` | `minimax/minimax-m3` |
| `AI_REASONING_EFFORT` | `none` — measured on full dev fortnights 2026-09-26: `low` left most requests at the 170 s budget and few fresh dishes; `none` kept 2–17× more fresh dishes with every day inside 5% |
| `AI_BASE_URL` | **empty** (or a path on `https://openrouter.ai`). Any other host is refused at boot — it would receive the OpenRouter key |
| `AI_PROVIDER_SORT` | `throughput` — measured 2026-09-26: default load-balancing sent parallel requests to ~120 s endpoints |
| `AI_PROVIDER_IGNORE` | `sail-research` — the ZDR endpoint that timed out most in the dev fortnights |
| `AI_MAX_OUTPUT_TOKENS_PER_DISH` | empty (1200) — caps a request that would return far more dishes than asked |
| `AI_BUDGET_SECONDS` | empty — 170 |
| `AI_REWRITE_STEPS` | `false` until decided: on OpenRouter every rewrite is a paid call |

**Seven fresh dishes a meal, three per request** (`0064` § 4): the first round asks each meal's shortfall as parallel requests of at most three dishes (7 → 3 + 3 + 1), inside the same budget; a later round asks one request per meal for what is still short. A 413 or 429 on one request is recorded in the call log and costs only its own dishes; the library covers them.

**Telling that it works:** `/admin`'s generation log shows per call the model that answered (a fallback shows as a different model than asked), the provider OpenRouter routed to, and the cost from `usage.cost`; `requestId` is the `gen-…` id on OpenRouter's activity page. **Rolling back:** `AI_PROVIDER=stub` (library only), what production ran while `0064` was settled — not `google`: Gemini's free tier is ruled out by `0064`.

## What changes and what does not

With `AI_PROVIDER=omniroute` the pool builder's calls go to the gateway instead of to a
vendor. The gateway holds the vendor keys and routes each call by model name; asked for
a **combo**, it tries its models in order until one answers. Everything deterministic
stays here: the model returns ingredients and grams, macros come from the catalogue, and
allergies are enforced by removal from the prompt and by the gate (`0004`).

The gateway does not lift the Google quota: it holds one Google key, so a Gemini model
behind it spends the same allowance. Its value is the free non-Google models in the same
combo.

## 1. The gateway, before anything points at it

Owner-only, on the gateway's own host and dashboard.

1. **The combo.** `NutrIA-Fallback`, strategy *priority*, in this order — **confirmed**
   on the weekly benchmark and on real regenerations, 2026-09-12:
   1. `opencode/muse-spark-1.2-contributor-free` — the one worth having first: seven of
      seven days within 5% on all four macros alongside the library, a call in 50 to 100
      seconds.
   2. `opencode/mimo-v2.5-free` — answers, but its dishes land far from their split;
      a fallback, not a first choice.
   3. `gemini/gemini-3.6-flash` — last, because its free tier is twenty requests a day
      and they are the ones generation would spend anyway.

   Not `big-pickle`: on the generation prompt it reasoned past every limit and returned
   nothing in two runs (**confirmed**). One combo retry with a two-second delay is what
   was measured.
2. **The execution limit.** `RATE_LIMIT_MAX_WAIT_MS=180000` in the gateway's environment,
   then restart it. The default, fifteen seconds, cuts every free model before it
   answers — `mimo` returned nothing at fifteen and answered at 180 (**confirmed**).
3. **The key the API will use** — its permissions dialog:
   - *Management Access*: **off**. This key lives on the API host; if it leaks it must
     not be able to reconfigure the gateway.
   - *Allowed Endpoints*: **Restrict**, and only *Chat / Messages*.
   - *Allowed Combos*: `NutrIA-Fallback` (and the assistant's own, when there is one).
   - *No-Log Payload Privacy*: **on**. Off, the gateway keeps every prompt and response in
     full (**confirmed**: its call-log files held the dishes' JSON), and a prompt carries
     somebody's targets, way of eating, dislikes and free-text allergies. This service
     keeps its own log of every call without the content.
   - *Prompt Compression*: **off**. Slugs and figures must arrive exactly as written.
   - *Own Cost and Token Usage*: on. Harmless; it is what answers `/api/v1/me/status`.
4. **`prompt_cache_key`.** The gateway adds it to OpenAI-format requests, and one
   upstream rejects it with a 400 — a combo absorbs that as one extra hop (**confirmed**).
   *Hypothesis*: the dashboard's `promptCacheEnabled` switch removes it; not verified.
5. **A management key, if wanted, stays off the API host.** Its read routes give the
   combo's order and per-step health, per-model latency and success, the free-tier
   catalogue and the month's usage (**confirmed**) — but no per-model limit or reset for
   these providers, which publish none. It carries the `manage` scope, which can change
   the gateway: restrict its endpoints to none and keep it on the owner's machine.

## 2. The API's environment

On the API project, beside what [`deployment.md`](./deployment.md) §2 lists:

| Variable | Value |
| --- | --- |
| `AI_PROVIDER` | `omniroute` |
| `AI_BASE_URL` | the gateway's public URL, ending in `/v1` |
| `OMNIROUTE_API_KEY` | the key from §1.3 — boot is refused without it when the provider is `omniroute` |
| `OMNIROUTE_MODEL` | `NutrIA-Fallback`; it wins over `AI_MODEL` for this provider |
| `AI_BUDGET_SECONDS` | leave empty — 170, which fits the 300-second function. Raise it only on a host without that limit |
| `GOOGLE_API_KEY` | keep it: it is the rollback (§4) |
| `AI_REQUESTS_PER_DAY`, `AI_TOKENS_PER_MINUTE` | leave empty: they describe a Google allowance, not the gateway's |
| `AI_REWRITE_STEPS` | `true` to let the daily cron rewrite old recipe methods (§6) |
| `AI_REWRITE_MODEL` | a combo of the free models without the Gemini step, e.g. `muse-spark` then `mimo`; empty uses `OMNIROUTE_MODEL` (§6) |
| `CRON_SECRET` | sixteen characters or more; the platform sends it on the cron's call |

Nothing here is `NEXT_PUBLIC_`, and nothing goes on the web project.

## 3. Telling that it works

After the deploy, one real generation, then `/admin`:

- **The generation log** lists it with the address that asked and every call: the model
  that answered, through which provider, our time and the gateway's, the tokens, and the
  dishes kept or dropped with the reason. A hop shows as a different model answering and
  as our time far above the gateway's.
- **The correlation id** on a call finds every hop of it in the gateway's own call log
  (**confirmed**). The session header this service sends (`x-omniroute-session`, the
  job id) comes back as `ext:<job>`, but the gateway's log groups calls by its own
  conversation id.
- **`outOfTime`** in a plan's metadata, or calls logged as `timeout`, mean the time
  budget cut the model short and the library covered the rest. If that becomes common,
  the cure is running generation where there is no function limit, not a smaller prompt.

## 4. Rolling back

`AI_PROVIDER=google` and redeploy. Nothing else changes: the prompt, the schema and the
log are the same for every provider.

## 5. Known behaviour

- **The gateway makes calls of its own** (*hypothesis* on why). On one regeneration it
  called the fallback model once more with the same correlation id after answering, and
  its log shows probes to models this service never asks for. They spend free quota; they
  are the gateway's configuration to change, not this code's.
- **On the platform a call can outlive its aborted signal** (**confirmed** in production,
  2026-09-12: the function's log listed one gateway request as still waiting when the
  function was killed at 300 s, well past its budget). The client therefore gives up on
  a call at its budget whatever the transport does, and the job runner fails a
  generation still running at 280 s — so a stuck call costs the model's dishes, never
  the plan or a frozen screen.
- **What a request weighs** (**confirmed** on dev, prompt 4.1.0, 2026-09-25). One pool
  request per meal; the catalogue is that meal's alone (`0062`, `0063`). The standard
  lunch prompt is ~12,500 characters (~4,100 tokens) against ~23,200 (~8,000) on 3.4.0;
  dinner ~52%, breakfast ~63%, the snacks ~69%. A gateway or model with a per-minute
  token limit still sees several such requests at once — every meal of a fortnight is
  asked for together.
- **No prompt caching was measured** on the free models that answered through the gateway
  (`cachedInputTokens` 0 on every successful call, 2026-09-24).
- **A combo hop costs real time.** The first model failing after 48 seconds and the
  second answering in 17 made a 65-second call (**confirmed**). The budget in §2 is what
  keeps a string of those inside the function.

## 6. The rewrite sweep

`/api/v1/cron/rewrite-steps` rewrites the method of recipes an older prompt wrote
(`STEPS_VERSION`), one model call each, through the same provider as generation — the
gateway, with `AI_PROVIDER=omniroute`. Measured through it on 2026-09-12, three calls, all
answered by `muse-spark` with no hop and all valid (**confirmed**):

| Dish | Prompt | Answer | Time |
| --- | --- | --- | --- |
| cooked main (15 min) | 637 tokens | 8,580 (7,810 reasoning) | 74 s |
| briefly cooked (6 min) | 491 | 3,209 (2,865) | 33 s |
| assembled | 432 | 2,375 (2,247) | 22 s |

A fifteenth of a generation's prompt, and a third to a half of its time — the reasoning is
what the time goes on. So one cron call is one bounded sweep inside the 300-second
function: three calls at a time, none started with less than 90 seconds left, every one
ended by 240 seconds whatever the transport does with its signal, twelve recipes fetched.
What a run does not reach is the next run's first. On 2026-09-12 production held 160 stale
recipes: two weeks at the daily run the Hobby plan allows, about fourteen hours hourly.

`AI_REWRITE_MODEL` gives the sweep a model of its own. `NutrIA-Fallback` ends in Gemini,
and a sweep that fell that far would spend the twenty requests a day generation may need;
a combo of the free models alone cannot (*hypothesis*: `muse-spark` then `mimo`, as
generation's first two steps — not yet created on the gateway). Each call is filed under
`rewrite:<recipe id>` in the gateway's log, and the API logs one line per rewrite: the
model that answered, the time and the tokens.

## 7. The free models

Measured on **2026-09-25** with `apps/api/scripts/bench-models.mjs` (**confirmed**): prompt
4.1.0 through the Oracle gateway (OmniRoute 3.8.50), one pass of 6 briefs per model
(omnivore breakfast, lunch, dinner, afternoon snack; vegan lunch, dinner), 6 dishes asked
per brief, a 2,400 kcal day, month 9, seed `phase6`. 42 calls, all free; none to Gemini.

| Model | Answered | Errors | Median s | Median tokens in / out (reasoning) | Cached > 0 | Dishes | Valid | Unknown slug | Foreign food | Median abs deviation kcal / P / C / F |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `groq/openai/gpt-oss-120b` | 0/6 | 400 ×6 (`json_validate_failed`, empty generation, ~7 s) | — | — | — | 0 | 0 | 0 | 0 | — |
| `groq/qwen/qwen3.8-27b` | 5/6 | 429 ×1 (output tokens a minute: limit 1,000, requested 2,048) | 5 | 3,977 / 2,048 | no | 14 | 2 | 3 | 7 | 26% / 30% / 48% / 47% |
| `openrouter/qwen/qwen3.8-27b:free` | 0/6 | 429 ×5, timeout ×1 | — | — | — | 0 | 0 | 0 | 0 | — |
| `openrouter/dots-studio/dots-3-note-preview:free` | 1/6 | timeout ×5 | 195 | 3,898 / 20,337 (12,008) | no | 6 | 5 | 0 | 1 | 8% / 20% / 15% / 17% |
| `openrouter/nex-agi/nex-n2.5-pro:free` | 0/6 | 401 ×1, 404 ×1, 429 ×4 | — | — | — | 0 | 0 | 0 | 0 | — |
| `openrouter/nvidia/nemotron-3-super-120b-a12b:free` | 0/6 | 502 ×2, 504 ×1, timeout ×3 | — | — | — | 0 | 0 | 0 | 0 | — |
| `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` | 2/6 | timeout ×4 | 143 | 4,498 / 6,149 (2,734) | no | 12 | 9 | 3 | 0 | 19% / 27% / 23% / 33% |

- **None of them carries generation alone.** Only `nemotron-3-ultra` returned usable dishes
  (correct Spanish, steps with heat and time), in 2 of 6 calls and ~143 s each; `dots` wrote
  good classic dishes but one answer took 195 s and 20k output tokens; Groq's `qwen3.8-27b`
  is fast but writes dishes whose names, ingredients and steps do not match.
- **Output is what costs time.** 4–8k output tokens for 6 dishes on `nemotron-3-ultra`;
  the time follows it.
- **No prompt caching** on any answered call (OpenRouter `cached_tokens: 0`, Groq no field,
  the gateway's `x-omniroute-cache` `MISS`) — the prompt audit's H6 is closed for these
  models.
- **Five timeouts fired late** (276 s instead of 200) because a unit-test run starved the
  machine's event loop; the script now marks such a timeout as stalled. The answers that
  did arrive took 143–195 s, so a clean run would likely read the same.
- **Hypotheses for the owner's gateway**: the gateway appears to cap Groq output at 2,048
  tokens (nothing was sent; Groq's 429 says "Requested 2048" and 3 of 5 answers stopped at
  exactly 2,048); and one OpenRouter model's rate limit appears to shut out the others (four
  429s for `nex` named `qwen3.8-27b:free`).

