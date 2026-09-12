# AI gateway runbook (OmniRoute)

> **Purpose**: how to make plan generation go through an OpenAI-compatible gateway
> ([`0050`](../decisions/0050-generation-can-go-through-a-gateway.md)) — what to set on
> the gateway, what to set on the API, how to tell it works and how to undo it. Most of
> it is owner-only: an agent can read the gateway but must not reconfigure it.
> **Audience**: humans and agents. **Committed**: yes. **Maintained by**: agents draft,
> owner approves. Update it in the same change that invalidates it.
>
> Facts are labelled **confirmed** (measured, and how) or **hypothesis** (believed, with
> the open question), as reference docs must be.

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
- **A combo hop costs real time.** The first model failing after 48 seconds and the
  second answering in 17 made a 65-second call (**confirmed**). The budget in §2 is what
  keeps a string of those inside the function.
