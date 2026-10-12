# 0002 — Which model writes the dishes, without anybody training on what we send

> **Purpose**: the `architect` agent's answer to the owner's question of 2026-09-25: *"What
> is my best option? I want to generate the diets the way they used to be, as accurate and as
> varied, and without depending on my library. A local model on Oracle, some other free
> provider, or which are the best and cheapest to pay for, like Kimi, DeepSeek, etc."*, under
> the rule the owner set the same day (below). It compares the routes against the code and the
> measurements, recommends a primary and a fallback, and proposes the measurement that comes
> before spending anything.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the
> `architect` agent; once merged it is not edited — a later review is a new report.
>
> Base: `main` at `ba1cefb` (with #114, project 005's phase 6, and #115, report
> [`0001`](./0001-deterministic-generation-2026-09-25.md), which this one builds on and does
> not repeat). Every number carries its label: **measured** (where), **estimated** (with the
> hypothesis) or **unknown**. Prices read from an API or a public page count as **measured**
> at that source and at that hour. While writing this report **no model or gateway call was
> made**: what was read was OpenRouter's public models API (`/api/v1/models`,
> `/models/{id}/endpoints`, `/endpoints/zdr`) and Vercel AI Gateway's (`/v1/models`) on
> 2026-09-25 at ~21:30 UTC, the terms pages dated in [Sources](#sources-read-on-2026-09-25),
> OmniRoute's public code at tag `v3.8.50` (the version of the owner's gateway,
> `ai-gateway.md` § 7) and the SDK installed in `node_modules`. Prices in dollars, as they are
> published; $1 ≈ €0.85–0.95 (**estimated**, rate not looked up).

## Revision 2026-09-25: no training

**What changed.** The first version of this report (same day, unmerged) recommended
`meta/muse-spark-1.3-contributor` as the primary. The owner then decided: *"I don't want to
train any model, it says so in the privacy policy."* It is a hard constraint: **nothing NutrIA
sends may be used by any provider to train or improve models**. The *contributor* tier exists
precisely for that (Meta trains on prompts and completions in exchange for the discount), so it
is out, and with it everything free that is in use today.

**Why the rule is the right one.** The published text of `/privacidad`
(`apps/web/src/i18n/dictionaries/es-ES.ts:1360`) says today that some free models "may use what
they receive to improve their models" and that "we are moving to providers that do not reuse
the data". `legal`'s draft (`docs/legal/textos/02-politica-privacidad.md:20-21, 97`, variant A,
⟦ia-encargado⟧) promises providers "on our instructions, under contract, without using it to
train or for anything of their own", and the DPIA lists as measure M3 "no training, zero
retention" (`docs/legal/eipd.md:125`). This report is redone to keep that promise.

**What else changed on review.** Three premises of the brief turned out to be incomplete (§ 2,
P12–P14): free Gemini is out not because it trains, but because its terms forbid serving EEA
users with it; the rule does **not** on its own settle `/consulta`'s P1-10, because Gemini's
clinical clause applies to the paid service too; and OpenRouter only signs its DPA with
Enterprise customers according to its help centre, which `legal` must clarify. And production,
today, breaks the rule (§ 3.1).

## 1. Verdict

**Yes, on conditions: pay very little for an open-weights model served only by providers that
retain nothing (ZDR), through OpenRouter, with privacy enforced on the account rather than in
the code. And until it is measured, production with no model.**

- **Primary: `deepseek/deepseek-v4-flash-0731`**, on OpenRouter, restricted to ZDR endpoints
  with structured output (20 providers meet it; the cheapest, DeepInfra, at $0.06 / $0.18 per
  million tokens, **measured** in OpenRouter's API). "The way it used to be" — 7 new dishes per
  meal — costs **~$0.007–0.017 per generation**: **~$0.3–0.9 a month at 50 generations, ~$3–9
  at 500, ~$33–87 at 5,000** (**estimated**, § 4.2). The reasoning can be turned off, which is
  what makes it fit inside 170 s.
- **Fallback: `mistralai/mistral-small-2603` (Mistral Small 4)**, also ZDR on OpenRouter, served
  by Mistral itself, with an endpoint in the EU. A different company, different weights,
  different infrastructure: if the primary goes down, it does not go down with it. ~$0.02–0.06
  per generation, and it only costs anything when the first one fails.
- **Nobody has measured either of them with this prompt.** The only measured quality there was,
  muse-spark contributor, is out under the rule. That is why the recommendation is conditional:
  phase 1 (§ 8) measures 5 non-training candidates with **36 calls for ≤ $0.43 in the worst
  case** (~$0.10 expected), and the numbers give the final order.
- **Gemini, neither free nor as a fallback.** Free, its terms only allow paid services for EEA
  users; paid, it does not train, but it costs 3–20 times what DeepSeek does and its "clinical
  practice" clause still closes `/consulta` (P1-10).
- **Local on Oracle: no** (unchanged: 10–20 min per request, **estimated**; a 27B gave 2 valid
  dishes of 14, **measured**). **Free: there is no route that keeps the rule and works**: the
  only free one with no retention that writes usable text is `qwen3.8-27b:free` (ModelRun), and
  that model has already been measured as useless (§ 4.5).
- **"Without depending on the library", taken literally, no** (unchanged, § 4.4): the old 7/7
  was library + model. What can be recovered is the "used to be": 7 new dishes per meal, from a
  model that answers.

Conditions:

1. **Today, production with no model** (`AI_PROVIDER=stub`): it is the only way to keep the rule
   at €0 while measuring (§ 3.1). It costs little: with today's free models, most plans already
   come out of the library alone.
2. **Privacy is enforced on the OpenRouter account, not in the code**: training off (paid and
   free), ZDR endpoints only, and a *guardrail* on the key with the list of allowed models and a
   monthly spend cap (§ 4.3). A request cannot loosen those settings; a code mistake can, at
   worst, fail.
3. **The owner authorises in writing** the 36 (+12 optional) paid calls and the budget (§ 8,
   phase 2), after buying ~$10 of credit.
4. **Project 005's phase 7 is rewritten** (§ 4.6): a combo with no free models and no Gemini, 7
   new dishes per meal in parallel requests of 3 + 3 + 1, reasoning effort by configuration.
5. **`legal` reviews before production** the contract with OpenRouter and its providers, where
   processing happens and the transfers (§ 5); afterwards, `/privacidad` moves to variant A.

## 2. Premises checked

| # | Premise | Status | Evidence |
| --- | --- | --- | --- |
| P1 | "The diets used to be that accurate and varied" | **confirmed**, but with a model that can no longer be used | The owner's benchmark, 2026-09-12: muse-spark 1.2 contributor, 33 valid dishes out of 30 asked for, ~11 points of mean error, 7/7 days within 5% on all four macros. Dev: 25 of 32 dishes accepted (**measured**, `plan_generation_jobs.ai_calls`). That model is the tier that trains (P7). |
| P2 | "It used not to depend on the library" | **wrong** | The 7/7 was a mixed week: each meal asks for 19 dishes, up to 12 from the library and 7 from the model (`packages/core/src/domain/Variety/Rotation.ts:27, 48-61`); if the model fails, the library covers the whole plan (`full_library`, `PlanGeneration.service.ts:244-256`). |
| P3 | "A local model on Oracle can do it" | **wrong** | § 4.5. It would keep the rule (nothing leaves the machine), but not the time or the quality. |
| P4 | "There is another free provider that would do" | **wrong** | Everything free that has been measured either trains or cannot write these dishes (§ 4.5). |
| P5 | "Kimi and DeepSeek are the best and cheapest paid ones" | **half confirmed** | DeepSeek V4 Flash is among the cheapest on ZDR endpoints too ($0.06 / $0.18 on DeepInfra). Kimi is not: K2.5 on ZDR is $0.45 / $2.25, 10–12 times more (**measured**, OpenRouter `/endpoints`). Neither has been measured on this task. |
| P6 | "muse-spark contributor is on OpenRouter at 0.10 / 0.20" | **confirmed**, and **ruled out** by P7 | OpenRouter `/models` (2026-09-25): a single endpoint (Meta), not ZDR. |
| P7 | "Contributor means Meta trains on the prompts" | **confirmed** | Meta: "Heavily discounted token pricing in exchange for permission to use your prompts and completions to train future Meta models". The standard tier: "your prompts and completions are not used to train Meta models". |
| P8 | "Reasoning can be turned off or lowered" | **depends on the model** | Vercel `/v1/models` (2026-09-25): DeepSeek V4 Flash `none`…`high`; GLM 5.3 Flash `low`/`high`/`max`; gpt-oss `low`/`medium`/`high`; Nemotron 3 Ultra `none`/`medium`/`high`. On OpenRouter the field is `reasoning: { effort }` (their documentation; `none` turns it off). In NutrIA nothing is sent today (`StructuredAiClient.ts:64-66`). Whether lowering it makes the dishes worse: **unknown**. |
| P9 | "The budget is 280 s" | **a nuance** | 280 s is the job (`PlanJobRunner.service.ts:38`); the model has **170 s** (`Env.validation.ts:121`). |
| P10 | "nemotron free logs the prompts to improve NVIDIA products" | **confirmed** | OpenCode Zen (updated 2026-09-25) and the model's page on OpenRouter: "Your use is logged for security purposes and to improve NVIDIA products and services". Its free endpoint is also absent from OpenRouter's ZDR list. |
| P11 | "OpenRouter `:free` requires consenting to training or logging" | **confirmed** for the ones in use | OpenRouter's FAQ: providers that log data or have no confirmed policy are not routed to "unless the model training toggle is switched on". Of the text `:free` models, only `qwen3.8-27b:free` (ModelRun) and two `ling-3.0` (Novita) are on the ZDR list (**measured**, `/endpoints/zdr`). |
| P12 | "Free Gemini trains on what we send it" | **wrong for an owner in the EEA**; it is out for another, stronger reason | *Gemini API Additional Terms* (in force since 2026-03-23): "If you're in the European Economic Area, Switzerland, or the United Kingdom, the terms under 'How Google uses Your Data' in 'Paid Services' apply to all Services… even though they are offered free of charge" — that is, it does not train. But, under *Use Restrictions*: "You may use only Paid Services when making API Clients available to users in the European Economic Area". **Serving NutrIA's users on the free quota breaks those terms today**, fallback step or not. |
| P13 | "`/consulta`'s P1-10 is settled by the same rule" | **half wrong** | The clause "You may not use the Services in clinical practice, to provide medical advice…" sits in *Use Restrictions* and applies to all services, **paid included**. P1-10 only closes if Gemini leaves the combo, which is what I recommend; with paid Gemini as a fallback it would stay open for `/consulta`. |
| P14 | "Paying OpenRouter gives us a processor contract" | **a hypothesis for `legal` to settle** | Their terms (updated 2026-08-31, § 10.2) incorporate a DPA for commercial use; their help centre says the signed DPA is for Enterprise customers and that everybody else can only read it. One or the other decides variant A. |
| P15 | "Phase 7 (3 dishes per request) keeps what it used to be" | **wrong** | After round 1, `PoolBuilder` covers what is missing from the library **before** asking again (`PoolBuilder.service.ts:177-191`): the new share per meal drops from 7 to 3. |

## 3. What is there today

### 3.1 Production breaks the rule today

- **The documented combo** (`docs/reference/ai-gateway.md` § 1) is
  `opencode/muse-spark-1.2-contributor-free` → `opencode/mimo-v2.5-free` →
  `gemini/gemini-3.6-flash`, and 005's phase 7 decided to move to
  `nemotron-3-ultra-550b-a55b:free` → Gemini (`docs/decisions/LOG.md` 2026-09-25;
  `docs/projects/005-meal-and-season-catalogue/PLAN.md` § Phase 7). What is configured in the
  gateway right now I do not know: that is the owner's. **Every step of both combos breaks the
  rule**: contributor trains Meta; free MiMo, "collected data may be used to improve the model"
  (OpenCode Zen); free nemotron, logged to improve NVIDIA; free Gemini, forbidden for EEA users
  (P12).
- **The published text is honest today**: variant B warns about the reuse. What is broken is the
  owner's rule, not the policy.
- **The way to keep it now, at €0, already exists**: `AI_PROVIDER=stub` makes `resolveModel`
  return `null` (`apps/api/src/modules/ai/ai.config.ts:56-90`) and the pool builder calls nobody
  (`PoolBuilder.service.ts:199-202`); the plan comes out of the library, which landed 153 of 154
  days within 5% (**measured** in `0001` § 3.4). Little is lost: in phase 6 the best free model
  answered 2 of 6 calls (**measured**, `ai-gateway.md` § 7). The risk: a very restricted profile
  without enough dishes gets `GENERATION_POOL_TOO_SMALL`
  (`PlanGeneration.service.ts:258-267`) instead of a plan with new dishes; how many production
  profiles that is: **unknown**.
- **The rule reaches further than generation**: the step rewrite (`AI_REWRITE_MODEL`,
  `ai-gateway.md` § 6) uses the same gateway; and the illustrations only go to Google with
  `AI_PROVIDER=google` and billing on (`ai.config.ts:158-164`; `Env.validation.ts:122-129`),
  which is a paid service and does not train. With `stub`, the rewrite stops.

### 3.2 How a request travels, and where the rule can be enforced

- **Changing model touches no code.** With `AI_PROVIDER=omniroute`, the pool builder calls the
  gateway by model or combo name (`ai.config.ts:68-87`); the combo is the owner's configuration.
- **The SDK lets OpenRouter's own fields through.** `@ai-sdk/openai-compatible` 3.0.52 copies
  into the body any key of `providerOptions.omniroute` that is not its own
  (`node_modules/.pnpm/@ai-sdk+openai-compatible@3.0.52…/dist/index.js:593-600`), and NutrIA
  already transforms every body in one place (`transformRequestBody: nonStrictSchema`,
  `ai.config.ts:86, 110-118`). A fixed `provider` block fits there.
- **OmniRoute 3.8.50 forwards the body as-is from OpenAI to OpenAI**
  (`open-sse/translator/index.ts:405-413`, "same-format passthrough"), has no rules that strip
  fields for OpenRouter (`open-sse/translator/paramSupport.ts`), and **adds to every request the
  OpenRouter *preset* configured on the connection** (`open-sse/executors/default.ts:854-861`;
  in the panel, "OpenRouter preset" when editing the connection, CHANGELOG #3878/#3921). Its
  keys hold a list of allowed models (`allowed_models`, `src/lib/db/jsonMigration.ts:104`). All
  of this is **read off the code**: that it behaves that way in the owner's gateway is a
  **hypothesis** until phase 2's first call.
- **OpenRouter, for its part** (documentation read on 2026-09-25):
  - Account *Settings › Privacy*: allow or disallow providers that train, separately for paid
    and free models; and ZDR for the whole account. The account settings and the request's are
    combined with **OR** for ZDR: a request can ask for more, never for less.
  - Per-key *guardrails* (created in the panel): a spend cap resetting daily/weekly/monthly,
    allowed models, allowed providers, ZDR; they intersect with the account settings.
  - Per request: `provider: { zdr, data_collection: "deny", only, require_parameters, max_price,
    … }`. **Careful**: a preset and the request merge shallowly — if the request sends its own
    `provider`, it replaces the preset's entirely.
  - OpenRouter stores neither prompts nor responses unless logging is switched on; "OpenRouter
    use of inputs/outputs" (a 1% discount) is off by default. It does sample "a small number of
    prompts for categorization", anonymously (§ 9).
- **Structured output, not strict** (unchanged): `json_schema` with `strict: false` (`0050`).
  With `require_parameters: true`, OpenRouter only routes to endpoints that support the schema;
  every candidate in § 4.1 has a ZDR one that does (**measured**, `/endpoints`).
- **Latency and volume** (unchanged): one call per meal in deficit, in parallel, up to 3 rounds
  under 170 s (`PoolBuilder.service.ts:21, 171`); ~20k input tokens per generation with 4.1.0
  (**measured**, `ai-gateway.md` § 5); muse-spark wrote ~2,300–3,700 tokens per dish while
  reasoning, ~400–740 of visible dish, and `nemotron-3-ultra` ~1,025 (**measured**, dev
  2026-09-12 and phase 6).
- **The measurement exists and today only admits free models.**
  `apps/api/scripts/bench-models.mjs` rejects any id that does not end in `:free` or start with
  `groq/` (`:264-275`) and anything naming Gemini; it sends no reasoning control and no provider
  preferences (`:314-333`); it already accepts `--max-tokens` (`:169`). Under the new rule,
  **its filter is backwards**: it lets through exactly what trains.

## 4. Proposal

### 4.1 The options under the rule

Prices: the cheapest ZDR endpoint with structured output on OpenRouter (`/endpoints`,
2026-09-25). "ZDR" = on OpenRouter's `/api/v1/endpoints/zdr` list. Cost per generation: § 4.2.

| # | Option | Keeps the rule? | Quality on this task | ZDR endpoints with a schema | $/M in / out (ZDR) | $/generation (B′) | Reasoning | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **DeepSeek V4 Flash 0731** | yes, with ZDR | **unknown** | 20 | 0.06 / 0.18 (DeepInfra fp8) | 0.007–0.017 | can be off | recommended primary |
| 2 | **Mistral Small 4 (2603)** | yes (ZDR; Mistral does not train on the paid API) | **unknown** | 3 (Mistral: `zdr`, `eu`, `us`) | 0.15–0.165 / 0.60–0.66 | 0.019–0.061 | default, unset | recommended fallback; EU possible |
| 3 | **GLM 5.3 Flash** | yes, with ZDR | unknown | 24 | 0.045 / 0.14 (InferenceNet fp4); 0.075 / 0.25 (DeepInfra fp4) | 0.005–0.024 | `low`…`max` | a cheap alternative |
| 4 | **gpt-oss-120b** | yes, with ZDR | unknown (on Groq, 400 ×6 because of Groq's JSON validation) | 17 | 0.03–0.037 / 0.17 | 0.005–0.015 | `low`…`high` | a cheap alternative |
| 5 | **Paid Nemotron 3 Ultra** | yes (DeepInfra, ZDR) | **measured in its free version**: 9 of 12 dishes valid, 19–33% deviation, 2 of 6 answers (phase 6) | 1 | 0.50 / 2.20 | 0.067–0.20 | `none`/`medium`/`high` | a control: it separates infrastructure from quality |
| 6 | DeepSeek V4 Flash 0423 · V4.1 Flash | yes, with ZDR | unknown | 7 · 16 | 0.09 / 0.18 · 0.14 / 0.42 | 0.008–0.019 · 0.015–0.041 | can be off | the 0731 is the same family, cheaper and with more providers |
| 7 | **Paid Gemini 3.8 / 3.6 Flash** (Vertex on OpenRouter, or a Google key with billing) | yes (paid does not train; Vertex is ZDR) | NutrIA's original provider's, with earlier prompts; unmeasured on 4.1.0 | 3–4 | 0.375 / 1.875 (flex); 0.75 / 3.75 | 0.054–0.33 | `low`/`high` | clinical clause: never `/consulta` (P13) |
| 8 | MiniMax M3 · Kimi K2.5 · DeepSeek V4 Pro | yes, with ZDR | unknown | 3 · 3 · 6 | 0.23 / 0.96 · 0.45 / 2.25 · 1.30 / 2.60 | 0.03–0.09 · 0.07–0.20 · 0.12–0.28 | varies | more expensive with no measured reason |
| 9 | Standard muse-spark 1.3 · Qwen 3.8 Flash | they do not train, but **they are not ZDR on OpenRouter** (Meta and Alibaba, one provider each) | muse-spark's, probably (same weights: **hypothesis**) · unknown | 0 | 1.25 / 4.25 · 0.15 / 0.47 | 0.15–0.40 · 0.02–0.05 | yes | only through Vercel AI Gateway with ZDR, which needs the Pro plan (§ 4.5) |
| 10 | A local model on Oracle A1 | yes | it would not have any (P3) | — | €0 | €0 | — | does not fit in the time |

**Out under the rule**, with the provider's own source:

| Route | Why not | Source (date) |
| --- | --- | --- |
| `meta/muse-spark-*-contributor` (OpenRouter, Vercel, OpenCode) | trains Meta's models on prompts and completions | Meta, pricing page; OpenCode Zen (2026-09-25) |
| OpenRouter `nvidia/nemotron-*:free` | "logged… to improve NVIDIA products and services"; not on the ZDR list | OpenCode Zen (2026-09-25); the model's page on OpenRouter |
| OpenRouter `:free` in general | they are routed to providers that log, or with no confirmed policy, only with training allowed on the account; the only ZDR ones (`qwen3.8-27b:free`, `ling-3.0-*:free`) either do not work or are unmeasured | OpenRouter's FAQ; `/endpoints/zdr` (2026-09-25) |
| Gemini, free quota | it cannot be offered to EEA users; and there is no processor contract | *Gemini API Additional Terms*, in force 2026-03-23 |
| Free OpenCode Zen | Big Pickle, MiMo, Ling: "collected data may be used to improve the model"; nemotron and muse-spark as above. Space Bunny says it neither retains nor trains, but it is an unnamed model, "during its free period", with no contract | OpenCode Zen, updated 2026-09-25 |
| DeepSeek's own API | trains by default and processes the data in China; and it only offers `json_object` | a third-party summary (betterclaw.io, 2026-09-15); DeepSeek, JSON mode |
| Free Mistral (Experiment / Studio Free) | "we may use your data (input and output) to train" | Mistral's help centre |

**Allowed but useless**: free Groq does not train and offers ZDR (its terms), but
`gpt-oss-120b` gave 400 ×6 and `qwen3.8-27b` 2 valid dishes of 14 (**measured**, phase 6).

### 4.2 Cost per generation and per month

Assumptions (**estimated** from § 3.2): a four-meal shape; scenario **B′** ("the way it used to
be"): 7 new dishes per meal in requests of ≤ 3 → 12 calls, ~60k input tokens, 28 dishes; output
**600 tokens per dish without reasoning** (the measured visible dish) or **2,750 reasoning** (the
measured median for muse-spark, an upper bound for the rest). No caching. At the price of each
model's cheapest ZDR endpoint with a schema.

| Model | ZDR endpoint | $/M in / out | $/gen. without reasoning | $/gen. reasoning | Month at 50 / 500 / 5,000 |
| --- | --- | --- | --- | --- | --- |
| GLM 5.3 Flash | InferenceNet fp4 | 0.045 / 0.14 | 0.005 | 0.013 | 0.3–0.7 / 3–7 / 25–67 |
| gpt-oss-120b | AkashML / DeepInfra bf16 | 0.037 / 0.17 | 0.005 | 0.015 | 0.3–0.8 / 3–8 / 25–77 |
| **DeepSeek V4 Flash 0731** | **DeepInfra fp8** | **0.06 / 0.18** | **0.007** | **0.017** | **0.3–0.9 / 3–9 / 33–87** |
| DeepSeek V4 Flash 0423 | DeepInfra fp8 | 0.09 / 0.18 | 0.008 | 0.019 | 0.4–1.0 / 4–10 / 42–96 |
| GLM 5.3 Flash | DeepInfra fp4 | 0.075 / 0.25 | 0.009 | 0.024 | 0.4–1.2 / 4–12 / 44–119 |
| DeepSeek V4.1 Flash | DeepInfra fp8 | 0.14 / 0.42 | 0.015 | 0.041 | 0.8–2.0 / 8–20 / 77–204 |
| **Mistral Small 4** | **Mistral ZDR** (EU: 0.165 / 0.66) | **0.15 / 0.60** | **0.019** | **0.055** | **1.0–2.8 / 10–28 / 95–276** |
| MiniMax M3 | CoreWeave fp4 | 0.23 / 0.96 | 0.030 | 0.088 | 1.5–4.4 / 15–44 / 150–439 |
| Gemini 3.8 / 3.6 Flash | Vertex flex | 0.375 / 1.875 | 0.054 | 0.167 | 2.7–8.3 / 27–83 / 270–834 |
| Kimi K2.5 | SiliconFlow int4 | 0.45 / 2.25 | 0.065 | 0.200 | 3.2–10 / 32–100 / 324–1,001 |
| Nemotron 3 Ultra | DeepInfra fp4 | 0.50 / 2.20 | 0.067 | 0.199 | 3.3–10 / 33–100 / 335–997 |
| Gemini 3.8 / 3.6 Flash | Vertex standard | 0.75 / 3.75 | 0.108 | 0.334 | 5.4–17 / 54–167 / 540–1,669 |
| DeepSeek V4 Pro | DeepInfra fp8 | 1.30 / 2.60 | 0.122 | 0.278 | 6.1–14 / 61–139 / 608–1,391 |

How to read it:

- **The fallback barely shows on the bill**: it is only paid for when the primary fails fast
  (4xx, 5xx, 429); a *timeout* no longer leaves room for another step inside 170 s (**measured**:
  one hop cost 65 s, `ai-gateway.md` § 5).
- **OpenRouter spreads across the allowed endpoints** with a preference for price, but not always
  the cheapest: DeepSeek 0731's worst ZDR endpoint (NextBit, 0.352 / 1.056) costs $0.039–0.10 per
  generation. A `max_price` in the preset bounds it (§ 4.3).
- At **a few hundred plans a month, the model costs what a coffee does**; at 5,000, Vercel
  Hobby's CPU and Neon's transfer run out first (`0001` § 3.5).
- Not counting the credit purchase fee (5.5%, minimum $0.80, **measured** in OpenRouter's FAQ),
  meal swaps (≤ 1 call of 3 dishes when the library has no substitute) or retries.

### 4.3 How it is enforced, so that a code mistake cannot reach somebody who trains

In layers, strongest first. **The first two are the guarantee**: they do not depend on NutrIA or
on OmniRoute, and a request cannot loosen them.

1. **The OpenRouter account, *Settings › Privacy*** (owner): training **off** for paid **and**
   free models; "OpenRouter use of inputs/outputs" off (it is by default); prompt logging off;
   **ZDR for the whole account** on. If the account is also used for other things of the owner's
   and he does not want ZDR on all of them, layer 2 does the same for NutrIA alone.
2. **A *guardrail* on the OpenRouter key OmniRoute uses** (owner, panel *Workspaces ›
   Guardrails*): ZDR enforced, **allowed models** = only the measured ones (later, only the two
   chosen), and a **monthly spend cap** (say $5). With that, even if the combo or the code asks
   for another model, OpenRouter refuses it, and a month's spend never passes the number the
   owner writes.
3. **In OmniRoute** (owner): an OpenRouter *preset* (`@preset/nutria-zdr`, created on OpenRouter)
   with `provider: { zdr: true, data_collection: "deny", require_parameters: true, max_price: {
   prompt: 0.20, completion: 0.70 } }`, set in the connection's "OpenRouter preset" field;
   NutrIA's combo **with `openrouter/…` steps only** (no `opencode/…`, no `gemini/…`, no
   `groq/…`, no `nvidia/…`); and NutrIA's key with its allowed models reduced to that combo
   (today "Allowed Combos", `ai-gateway.md` § 1.3). This covers what OpenRouter cannot see: the
   gateway sending the request to **another** of its keys (the free Gemini one, OpenCode). The
   `max_price` lets Mistral in (0.165 / 0.66) and keeps DeepSeek's expensive endpoints out.
4. **In NutrIA** (code, amended phase 7): the same `provider` block on every body, in
   `ai.config.ts` beside `nonStrictSchema`, with a spec pinning it. It is the third layer, not
   the guarantee: if it is missing, layers 1–3 hold; and if it is sent, it **replaces the
   preset's entirely** (a shallow merge), so it must be complete.
5. **Watching**: every call already stores the model that answered and the provider the gateway
   names (`StructuredAiClient.ts:78-89`, `x-omniroute-provider`), visible in `/admin`. A model
   off the list is the signal to stop.

**Does OmniRoute forward a per-request `provider`?** By its code, yes (§ 3.2), and it also has
the per-connection preset, which does not depend on the request. That is why the rule does not
rest on it forwarding anything: the account and the *guardrail* are the guarantee; the preset and
the request are the second line. Phase 2's first call confirms it by reading which provider
answered.

**`/consulta` and P1-10**: with this combo, with no Gemini and nothing that trains, P1-10 is
closed by the exit `legal` had already written ("take Gemini out of the combination",
`docs/legal/analisis.md:479`). No separate model is needed for `/consulta` (this report's old
phase 4 disappears). What remains is for `legal` to review each model's terms (OpenRouter § 5.1,
*Model Terms*) in case any carries a clinical clause like Gemini's.

### 4.4 "Without depending on the library": the honest answer

Unchanged from the first version, except the model:

- **The part that can be had: the model writing its share again, always.** A paid model that
  answers returns `0013`'s 7 new dishes per meal, which is "the way it used to be".
- **The part that cannot: the whole plan coming from the model** (19 dishes per meal). The
  accuracy comes from the scheduler having somewhere to choose from (153/154 days from the
  library alone, **measured** in `0001`; with 12 dishes per meal it fell to 6/14 and 4/14 days
  on carbohydrate and fat, `0046`); with no library, a provider going down leaves the user with
  no plan; it costs ~3 times more (28 calls per generation) and the code can only ask for 9 per
  meal across 3 rounds. And with models whose quality nobody has measured, betting the whole
  plan on them is a worse idea than it was.

### 4.5 Alternatives considered and why they lost

| Alternative | The reason it loses |
| --- | --- |
| **Vercel AI Gateway** (Vercel is already one of NutrIA's processors and is in the DPF) | On Hobby, "do not train" is only enforced per request (`disallowPromptTraining`, free); ZDR and the provider list for a whole team need Pro. The guarantee would live in the code, which is exactly what the owner does not want. It is the best option **if** Pro ever happens (`0001` § 9 already names it as the next limit): there, standard muse-spark 1.3 and Qwen 3.8 Flash do work with ZDR. And buying credit cancels its free monthly credit. |
| **Mistral's API directly** as the fallback | A direct contract with an EU company and data in the EU — the cleanest thing for `legal` — but it is another account, another bill and another cap, and ZDR there is requested from support with a justification. If `legal` does not accept the contracts via OpenRouter, it is the fallback's plan B. |
| **Paid Gemini as the fallback** | 3–20 times DeepSeek's price per generation; P1-10 stays open for `/consulta`; its one advantage (a different gateway, if used with its own key) is already covered by the library: if OpenRouter goes down, the plan comes out anyway (`full_library`). A third step only if Mistral, GLM and gpt-oss fail the measurement, and never for `/consulta`. |
| **Keep the free combo until the paid one is ready** | A few more days breaking a hard rule to gain little: the best free model answered 2 of 6. |
| **A local model on Oracle A1** | 2 OCPU / 12 GB: a 7–9B at 2.5–4 tokens/s, 3–9 min just to read the prompt; a 3-dish request, 10–20 min (**estimated**, `0001` § 10); a 27B already gave 2 valid of 14. |
| **Kimi K3, DeepSeek V4 Pro, Claude Haiku** | $0.12–1.33 per generation with no evidence that they write better dishes. |

### 4.6 What project 005's phase 7 should be

For the lead to amend with the owner. As it stands, it asks for what the rule forbids
(`nemotron-3-ultra:free` → Gemini) and lowers the new share from 7 to 3 per meal (P15).

- **Title**: "Generation on paid models that do not train".
- **Goal**: every call goes to an endpoint with no training and no retention; every meal gets its
  7 new dishes (`0013`); a rejection never costs the job.
- **Depends on**: the measurement phase (§ 8, phase 2) and the OpenRouter account being
  configured.
- **Steps**:
  1. **7 new dishes per meal in parallel requests of ≤ 3** (3 + 3 + 1) in round 1, instead of one
     request with the library behind it. Latency is that of one 3-dish request (output sets the
     time, `0016`); cost is today's plus the repeated input (~40k tokens, ~$0.002–0.004 with
     DeepSeek).
  2. **Rejections for size or quota fall to the next round** without breaking the job (the
     current step 2, unchanged).
  3. **Reasoning effort by configuration**: an optional `AI_REASONING_EFFORT` that
     `StructuredAiClient` passes as `providerOptions.omniroute.reasoning = { effort }`
     (OpenRouter's native field; empty, nothing is sent, as today). With its place in
     `Env.validation.ts`, `turbo.json` `globalEnv`, `apps/api/.env.example` and
     `docs/reference/deployment.md`.
  4. **The fixed `provider` block** on every body (§ 4.3, layer 4), with a spec.
  5. Specs: no request asks for more than 3 dishes; a meal asks for its 7 in parallel; a 429 on
     one request leaves the others untouched; the body carries `provider` and, when configured,
     `reasoning`.
  6. `docs/reference/ai-gateway.md`: the recommended combo (§ 4.7) with the measurement's
     numbers, the OpenRouter account settings, the correction about free Gemini (P12) and the
     withdrawal of the free steps.
- **Verification**: the plan's, plus: a fortnight in dev through the gateway with the calls
  stated in advance (12 under B′ with 4 meals), each `ai_calls` with a provider from the ZDR
  list; *human-verify*: the owner generates a fortnight in production after changing the combo.
- And in `LOG.md`, the phase 7 line of 2026-09-25 is replaced by the new decision, and the
  "Measuring generation spends no Gemini request" one still stands.

### 4.7 The recommendation, concretely

**Combo `NutrIA-Fallback`** (the owner's configuration in OmniRoute), after the measurement:

1. `openrouter/deepseek/deepseek-v4-flash-0731`, at whatever effort the measurement endorses
   (expected: `none`).
2. `openrouter/mistralai/mistral-small-2603`.
3. Nothing else. Behind it is the library, the safety net it has always been.

If the measurement reverses the order or rules one out, next on the list is GLM 5.3 Flash, then
gpt-oss-120b; paid Gemini only as a last resort and never for `/consulta`. `AI_REWRITE_MODEL`:
the same combo, or empty.

## 5. Requirements

- **Code** (nothing new on the safety path):
  - `bench-models.mjs` (phase 2): the filter, reversed; `--allow-paid`, `--reasoning-effort`, the
    `provider` block, and storing the provider that answered.
  - The amended phase 7: parallel requests, `AI_REASONING_EFFORT`, the `provider` block.
- **Infrastructure**: none new. OpenRouter is already in the gateway.
- **Money** (the owner's decision): $10 of credit + $0.80 of fee (≈ €9.2–10.3), once. The
  measurement spends ≤ $0.43 (≤ $0.74 with the optional second pass); the rest pays for
  production: ~600–1,500 generations with DeepSeek (**estimated**). A monthly cap in the
  *guardrail*.
- **The owner's decisions**:
  1. production to `stub` now, or wait for phase 5 and break the rule for a few days;
  2. ZDR across the whole OpenRouter account or only in NutrIA's *guardrail*;
  3. authorise the calls and the budget for phase 2 in writing;
  4. the amended phase 7 (§ 4.6);
  5. the monthly spend cap.
- **`legal`, before production**:
  1. **A processor contract with OpenRouter**: whether the DPA in their terms (§ 10.2,
     "incorporated by reference" for commercial use) applies to an ordinary paid account, or is
     only signed with Enterprise, as their help centre says (P14). What it says about the model
     providers (sub-processors?) and about the standard clauses.
  2. **Where processing happens**: OpenRouter routes from the US; DeepInfra is a US company;
     Mistral has an EU endpoint (`mistral/eu`). If the EU has to be pinned for Mistral, it can be
     with `only`/`order` (**hypothesis** about the syntax with the tag).
  3. **Transfers**: OpenRouter and DeepInfra on the EU-US Data Privacy Framework list
     (`dataprivacyframework.gov`), or standard clauses in the DPA.
  4. **Each model's terms** (OpenRouter § 5.1): no clinical-use clause.
  5. **OpenRouter's anonymous categorisation** (§ 9): whether it fits inside "nor for anything of
     their own".
  6. Afterwards, **`/privacidad` moves to variant A** (`02-politica-privacidad.md:97`), the
     variant B sentence about transfers goes (`:118`), and the DPIA (M3), the record of
     activities (row 2), `analisis.md` (P0-3, P1-10 and the sentence about free Gemini, P12) and
     the checklist are updated. In the meantime, variant B is still true: it claims more risk
     than there will be, not less.
- **The owner's time**: § 8, phase 1 (≈ 30 min); reading 6 dishes from each candidate (30 min);
  changing the combo and the key in OmniRoute (15 min); a fortnight in production.

## 6. Risks

| Risk | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- |
| **Privacy: the gateway sends a NutrIA request to another of its keys** (free Gemini, OpenCode) through a badly edited combo | users | medium: the gateway holds those keys for the owner's other uses | a model or provider off the list in `ai_calls` (`/admin`) | a combo with `openrouter/…` only and NutrIA's key limited to that combo (§ 4.3, layer 3); `stub` while it is fixed |
| **Privacy: turning ZDR on in the account before changing the combo** | users | high if done in that order | OpenRouter's `:free` steps fail and the combo falls through to free Gemini, which breaks its terms in the EEA | the order in § 8: `stub` first, then the account |
| **Legal: no signed DPA with OpenRouter** (P14) | the owner | medium | — | `legal` decides; plan B: Mistral directly (EU) as primary or fallback, or Vercel Pro |
| **Privacy: OpenRouter's anonymous categorisation** | users | low (sampled, with no account or id) | — | `legal` decides whether it fits; if not, a route without OpenRouter (Mistral directly, Vercel Pro) |
| **Money: a loop or an abuse burns credit** | the owner | low: generation is already limited per account (`0015`, `0042`) | `costUsd` in `/admin`; an OpenRouter alert | the *guardrail*'s cap with a monthly reset; once reached, OpenRouter refuses and the plan comes out of the library |
| **Quality: no candidate passes the measurement** | users | medium: zero measurements | phase 2 | it stays on `stub` (library alone) at €0, which keeps the rule; or paid Gemini for ordinary users, with the owner deciding the price |
| **Quality: fp4 versus fp8 depending on which provider it lands on** | users | medium | different deviation between calls to the same model | measure with the provider pinned (phase 2); in production, `quantizations` in the preset if needed |
| **Production on `stub`: a restricted profile without enough dishes** | users with many exclusions | low–medium | `GENERATION_POOL_TOO_SMALL` in `/admin`'s jobs | back to the combo as soon as phase 5 is ready; today those profiles already depended on a free model that answered 2 of 6 |
| **Latency: DeepInfra slower than expected** | users | unknown | `timeout`/`outOfTime` in `ai_calls` | reasoning `none`; B′; Mistral first |
| **Schema: a provider ignores `json_schema`** | nobody (a recoverable failure) | low with `require_parameters` | `invalid_output` in `ai_calls` | `require_parameters: true` in the preset and in the request |
| **Price: an endpoint rises or disappears** | the owner | medium over months | the bill | another ZDR endpoint of the same model (there are 20); none of the nutrition code changes |
| **Food safety** | users | **none new**: the model still decides nothing (`0004`) | — | the same gates for any provider (`PoolBuilder.validate`, `assertPlanIsSafe`) |

## 7. Cost and effort

| Piece | Effort | Money | Variables |
| --- | --- | --- | --- |
| Production to `stub` | 5 minutes of the owner's | 0 | — |
| The OpenRouter account (credit, privacy, *guardrail*, preset) | 30 minutes of the owner's | $10.80 once | — |
| Changes to `bench-models.mjs` | 1–2 agent-hours | 0 | — |
| The measurement (phase 2) | 1–2 h of wall clock | ≤ $0.43 worst case, ~$0.10 expected (+ ≤ $0.31 for the optional pass) | real output per dish; retries: none, the script does not retry |
| The amended phase 7 | 1–1.5 agent-days | 0 | specs with a fake clock, already foreseen |
| `legal`'s review and the `/privacidad` text | 0.5–1 agent-day + whatever the lawyer says | 0 | P14 |
| Production | — | ~$0.3–0.9/month at 50 generations, ~$3–9 at 500, ~$33–87 at 5,000 (DeepSeek, B′) | reasoning effort, number of meals (3–6), meal swaps, the real endpoint |

## 8. Plan

Each phase ships on its own. None spends money without the owner's written authorisation naming
the number of calls and the budget; none calls Gemini; none calls a model that trains.

**Phase 0 — Keep the rule today (owner, 5 min, €0).** In the API's Vercel project,
`AI_PROVIDER=stub` and redeploy. Metric: empty `ai_calls` on new jobs and plans generated
normally from the library. Stop (go back) if jobs fail with `GENERATION_POOL_TOO_SMALL` more
often than they did before.

**Phase 1 — The OpenRouter account (owner, ~30 min).** The exact steps:

1. Buy **$10 of credit** on OpenRouter (with the fee, $10.80 ≈ €9.2–10.3).
2. *Settings › Privacy*: **turn training off** for paid and for free models; check that
   "OpenRouter use of inputs/outputs" and prompt logging are off; **turn ZDR on** for the whole
   account (or, if the account has other uses, leave it to the *guardrail*).
3. *Workspaces › Guardrails › New Guardrail*, assigned to the key OmniRoute uses: a **$5 spend
   cap with a monthly reset**, **ZDR enforced**, and **allowed models**:
   `deepseek/deepseek-v4-flash-0731`, `mistralai/mistral-small-2603`, `z-ai/glm-5.3-flash`,
   `openai/gpt-oss-120b`, `nvidia/nemotron-3-ultra-550b-a55b`.
4. **Write the authorisation**, for example: "I authorise 36 paid calls for phase 2 (and 12 more
   if the second pass is needed) to those five models, up to a maximum of $1." The lead records
   it in `LOG.md`.

**Phase 2 — Measure dry, with the real prompt (agent, 1–2 h).**

- *Changes to `bench-models.mjs`* (the rest of the script unchanged):
  - The filter, reversed (`:269`). The line
    `if (!model.endsWith(':free') && !model.startsWith('groq/')) {`
    becomes
    `if (!options.allowPaid.has(model)) {`
    with the message "is not named in --allow-paid", and `--allow-paid id,id` read like the other
    flags (`options.allowPaid`, a `Set`, empty by default). No `:free` or `groq/` gets through
    any more: the first may train and the second are already measured. Gemini's rule
    (`:265-267`) stays.
  - `--reasoning-effort <none|minimal|low|medium|high>`, which adds `reasoning: { effort }` to
    the body (OpenRouter's field; not `reasoning_effort`).
  - On **every** request, fixed:
    `provider: { zdr: true, data_collection: 'deny', require_parameters: true, allow_fallbacks: false, only: ['deepinfra', 'mistral'] }`.
    With ZDR, that list leaves one provider per model (DeepInfra for four, Mistral for Mistral
    Small), so what is measured is what is later served and the price is known.
  - Store the response's `body.provider` beside `answeredModel` (`:360`): it is the proof of
    where it went.
- *The calls* (`--dishes 3`, phase 6's 6 briefs — omnivore breakfast, lunch, dinner and afternoon
  snack; vegan lunch and dinner —, `--month 9`, `--max-tokens 16000`, one pass, through the
  gateway):

  | # | Model (gateway id) | Provider | Reasoning | Calls | Worst case $ |
  | --- | --- | --- | --- | --- | --- |
  | 1 | `openrouter/deepseek/deepseek-v4-flash-0731` | DeepInfra fp8 (0.06 / 0.18) | `none` | 6 | 0.019 |
  | 2 | `openrouter/deepseek/deepseek-v4-flash-0731` | DeepInfra fp8 | `medium` | 6 | 0.019 |
  | 3 | `openrouter/mistralai/mistral-small-2603` | Mistral ZDR (≤ 0.165 / 0.66) | not sent | 6 | 0.069 |
  | 4 | `openrouter/z-ai/glm-5.3-flash` | DeepInfra fp4 (0.075 / 0.25) | `low` | 6 | 0.026 |
  | 5 | `openrouter/openai/gpt-oss-120b` | DeepInfra (bf16 0.037 / 0.17; turbo 0.15 / 0.60) | `low` | 6 | 0.063 |
  | 6 | `openrouter/nvidia/nemotron-3-ultra-550b-a55b` | DeepInfra fp4 (0.50 / 2.20) | not sent — phase 6's control | 6 | 0.228 |
  | | **Total** | | | **36** | **≤ $0.43 (≈ €0.37–0.41)** |
  | 1b | A second pass over the best two (optional) | | | 12 | ≤ $0.31 |

  Worst case: 5,500 input tokens and 16,000 of output (the `--max-tokens` cap) on every call, at
  the pinned provider's most expensive price. Expected: **~$0.10** ($0.06–0.20), with 4,500 of
  input and 3 dishes of 600–2,750 tokens. **Why 6 calls per configuration and not 12**: it is a
  sieve — it covers the four meals and the vegan profile — and pass 1b repeats only what is worth
  repeating. **Why nemotron**, the most expensive: it is the only one with measured quality (in
  its free version), and it separates what was infrastructure (timeouts) from what is the model;
  it is the first to drop if the owner wants to spend less (the total falls to ≤ $0.20).
- *Passing metrics, per configuration*: 6/6 answers (≥ 11/12 with 1b); p90 ≤ 120 s; ≥ 80% valid
  dishes; median deviation ≤ 15 points on kcal, P, C and F (muse-spark before: ~11; free
  nemotron: 19–33); 0 `foreign_food`; ≤ 1 unknown slug; every answer's provider on the ZDR list;
  and the owner reads 6 dishes from each one blind: "would I put this in my plan?".
- *Stop* if no configuration passes: production stays on `stub` at €0, which keeps the rule; and
  the question goes back to the owner with two exits and their price: paid Gemini for ordinary
  users ($0.05–0.33 per generation, never `/consulta`) or Vercel Pro with standard muse-spark.

**Phase 3 — The code (the amended phase 7, § 4.6).** 1–1.5 days. Metric: green specs; a fortnight
in dev through the gateway with the calls stated in advance, 0 job failures, days within 5% on all
four macros equal to or better than with the library alone (`evaluate-plans.mjs --compare`),
`costUsd` visible in `/admin`. Stop if the fortnight comes out worse than with no model.

**Phase 4 — `legal` (before production).** The six points of § 5. Stop if OpenRouter's DPA does
not cover an ordinary paid account: decide between Mistral directly and Vercel Pro before going
on.

**Phase 5 — Production, with a cap (owner).** On OpenRouter, the `@preset/nutria-zdr` preset
(§ 4.3) and the *guardrail* narrowed to the two chosen models; in OmniRoute, the preset on the
connection, § 4.7's combo and NutrIA's key limited to that combo; on Vercel, `AI_PROVIDER=omniroute`
again. A week watching `/admin`: ≥ 95% of calls answered by the first step, job p90 < 200 s, cost
per generation within § 4.2, plans with low `backfilled`, **no model or provider off the list**.
Stop if the first step answers < 80% (raise the fallback or lower the effort) or if a provider off
the list appears (back to `stub`).

## 9. What I do not know

- **The quality of any of the non-training candidates** on this task: zero measurements, except
  nemotron's free version. Phase 2.
- **Whether OmniRoute really forwards `provider` and `reasoning`** and applies the connection's
  preset: its code says it does; no call has checked. Phase 2's first one will say (the provider
  that answered; `reasoning_tokens` at 0 with `none`).
- **How OmniRoute's panel exposes** a key's allowed-model list: the field exists in its database;
  the runbook only documents "Allowed Combos".
- **Whether OpenRouter's DPA covers an ordinary paid account** (P14), whether OpenRouter and
  DeepInfra are in the DPF, and whether the anonymous prompt categorisation is off with ZDR.
  `legal`, and OpenRouter's support if needed.
- **DeepInfra's and Mistral's speed with this prompt**, and how much Mistral Small 4 writes per
  dish at its default reasoning.
- **Which combo is in the production gateway today** (it is the owner's configuration).
- **How many production profiles do not fit in the library alone** (the risk of `stub`): `0001`
  measured it on its profiles, not on the real ones.
- **How many generations a month there will be.** Below ~500, the model costs under $10 a month on
  any reasonable assumption; above that, the limits are Vercel and Neon.

## Sources (read on 2026-09-25)

- OpenRouter: [the model list](https://openrouter.ai/api/v1/models), `/api/v1/models/{id}/endpoints`
  and [ZDR endpoints](https://openrouter.ai/api/v1/endpoints/zdr) (read ~21:30 UTC);
  [provider selection](https://openrouter.ai/docs/guides/routing/provider-selection);
  [provider data policies](https://openrouter.ai/docs/guides/privacy/provider-logging);
  [ZDR](https://openrouter.ai/docs/guides/features/zdr);
  [what OpenRouter stores](https://openrouter.ai/docs/guides/privacy/data-collection);
  [presets](https://openrouter.ai/docs/guides/features/presets);
  [guardrails](https://openrouter.ai/docs/guides/features/guardrails);
  [per-key limits](https://openrouter.ai/docs/guides/overview/auth/provisioning-api-keys);
  [reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens);
  [FAQ (fee, free models)](https://openrouter.ai/docs/faq);
  [terms, updated 2026-08-31](https://openrouter.ai/terms);
  [the DPA in the help centre](https://openrouter.zendesk.com/hc/en-us/articles/47828437697051-How-do-I-get-OpenRouter-s-Data-Processing-Agreement-DPA-for-GDPR-compliance);
  [Nemotron 3 Ultra (free)](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free).
- OmniRoute: public code at tag [`v3.8.50`](https://github.com/diegosouzapw/OmniRoute/tree/v3.8.50)
  (`open-sse/executors/default.ts`, `open-sse/translator/index.ts`, `paramSupport.ts`,
  `src/lib/providers/requestDefaults.ts`, `src/lib/db/jsonMigration.ts`, `CHANGELOG.md`).
- Meta: [Model API pricing](https://dev.meta.ai/docs/pricing-rate-limits).
- Google: [Gemini API Additional Terms, in force 2026-03-23](https://ai.google.dev/gemini-api/terms).
- OpenCode: [Zen, updated 2026-09-25](https://opencode.ai/docs/zen/).
- Mistral: [ZDR](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr);
  [using data to train](https://help.mistral.ai/en/articles/323757-do-you-use-my-user-data-to-train-your-artificial-intelligence-models).
- Groq: [your data on GroqCloud](https://console.groq.com/docs/your-data).
- Vercel AI Gateway: [models](https://ai-gateway.vercel.sh/v1/models) (fields `zdr`, `no_training`,
  `reasoning_options`);
  [disallow prompt training, 2026-09-10](https://vercel.com/docs/ai-gateway/security-and-compliance/disallow-prompt-training);
  [ZDR, 2026-09-22](https://vercel.com/docs/ai-gateway/security-and-compliance/zdr);
  [pricing, 2026-09-08](https://vercel.com/docs/ai-gateway/pricing).
- A third-party summary on DeepSeek and others: [betterclaw.io, 2026-09-15](https://www.betterclaw.io/blog/ai-provider-training-data-policy-2026).
- DeepSeek: [JSON mode](https://api-docs.deepseek.com/guides/json_mode).
