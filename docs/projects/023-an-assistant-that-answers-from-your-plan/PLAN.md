# Plan — Project 023: An assistant that answers from your plan

> **Purpose**: the phased technical execution plan — the engineering half of the
> contract. `/execute-project` follows this literally; executors implement phases, they
> do not redesign them. If implementation must diverge, the plan is amended in the same
> change and the deviation is recorded in LOG.md.
> **Audience**: agents primarily, humans review. **Committed**: yes. **Written by**: a
> planner agent via `/plan-project`; approved by the owner before execution starts.
> Write repo-relative: no absolute paths, no references to other private repos.

- **Status**: **done and live — all seven phases shipped; the owner sent the notice, switched it on and checked it on his iPhone (2026-11-11)**
- **Type**: standard
- **PRD**: [./PRD.md](./PRD.md) — every acceptance criterion maps to at least one phase; the
  mapping is on each phase's **Acceptance criteria** line.
- **Routing profile**: `tiered` (AGENTS.md § Model routing), with its standing exception
  applied: **phases touching allergy validation, authentication or AI output validation run at
  `quality-max`** — opus @ high. Phases 2, 4 and 5 are those phases. Phase 3 is also opus @ high
  for a different reason, stated on its Dispatch line: it carries a migration. Phase 6 deviates
  with its own justification, and every phase says which.

## Design summary

**One new Nest module, `assistant`, and a streaming client inside the existing `ai` module —
behind the same wall.** The assistant is not an exception to anything. It reads the shape
`PoolPrompt` already receives plus the plan's own rows, so
`apps/api/src/modules/ai/health-boundary.spec.ts` keeps passing with no row added to its
exception lists, and its checks are extended to cover the new sources rather than excused from
them.

**Its subject is nutrition, and the subject is enforced by a label the code branches on.**
Every question is labelled first — `nutrition`, `clinical` or `off_topic` — by a cheap structured
call to the same provider, and the route acts on the label rather than reading the answer's
prose. On anything but `nutrition` **no stream is ever started** — the person gets one sentence
saying what the assistant is for, and the model is never asked to compose a reply. This is the
one place a model decides something, and it is allowed to: a wrong label costs a cut question,
never a person's health, which is exactly the line
[`0004`](../../decisions/0004-deterministic-safety-layer.md) draws. The clinical lexicon still
runs **before** the label, because refusing a dose on spelling costs nothing and the label costs
a call.

**And the checking has a ceiling of its own.** A label is cheap but it is not free, so somebody
who is not here about food cannot spend the service's money finding that out over and over:
off-topic cuts are counted per person per fortnight, and past a small ceiling the route answers
with the same sentence **without labelling anything** — no call at all — for the rest of that
fortnight.

**It may say what to eat; it may not make anything.** Ideas, a recommendation, a dish, a recipe
with quantities when somebody asks for one — all words. A plan, a swap, a change to a day — all
state, and state stays with the routes that validate it. Because it proposes food, the allergen
net is load-bearing here in a way it is nowhere else in the product: this is the first place a
model's own words can put a food in front of a person.

**The service is the only source of a number.** Before the call, the service computes the
figure set a question could need — the day's targets and totals, the meals and their macros,
adherence — and hands it to the model inside the prompt. After the call, every number in the
answer is extracted and checked for membership in that set; an answer carrying a figure the
service did not supply is withheld. This is the mechanism the owner chose on 2026-11-09 over
the alternative (the model never seeing a figure, the screen rendering a block beside the
prose), and it is faithful to [`0004`](../../decisions/0004-deterministic-safety-layer.md)
because the model still decides nothing with a consequence: it chooses words, not values.

**Two deterministic screens, with their strengths stated.** A lexicon pre-screen on the
question refuses a dose, a medication or one of the clinical situations `PRODUCT.md` § Users
excludes — before the call, so it also saves the money. An allergen net on the answer withholds
a message naming a food linked to that person's declared allergens. Both work on names, so
neither is as strong as the id-based exclusion a plate goes through; the plan builds them as
nets and the record says they are nets.

**Its own money, its own allowance.** A new `AiFeature`, `'assistant'`, so the console's
existing spend-by-feature machinery shows it on its own row; a ceiling of its own,
`AI_ASSISTANT_MONTHLY_CAP_USD`, separate from `AI_TEXT_MONTHLY_CAP_USD`, so a talkative week
cannot take the plan's budget; and a per-person fortnightly allowance in `Allowance.ts` — the
product's own fortnight, premium's larger — counted from the messages a person actually sent.
The month's spend is read from what was billed, never from a counter that can drift, exactly as
the pictures' cap already is.

**The conversation is kept, and it is split across two stores with one job each.** The thread —
`assistant_conversations` and `assistant_messages` — belongs to a person, cascades with their
account, and is what the history screen reads and what a continued conversation replays (a
bounded window of it, not the whole thread). The money — `assistant_calls`, shaped exactly like
`recipe_image_calls` — **names nobody**, so the month's billed spend survives an account deletion
that takes every word. That split is the whole reason deleting an account can be absolute without
rewriting history: one store is the person's, the other is the accountant's.

Because the server owns the thread, the client sends a conversation id and one new message rather
than a history of its own — which also removes the forged-history problem the earlier draft of
this plan had to defend against. Nothing of a conversation reaches a log, the error reporter, the
console or the owner: `0068`'s console-reads-nobody rule gains no exception, and ownership is by
session, so another person asking for a thread gets a 404.

**It ships dark.** A `FlagName` of its own, off by default, so phases 1–6 can reach production
without anybody meeting a half-built assistant, and the last phase is the owner throwing the
switch after the legal text is live.

Decisions recorded with this plan:
[`0104`](../../decisions/0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md).

## Phases

### Phase 1 — The assistant can speak: a streaming text client behind the wall

- [x] done — commit `993d5db7` (#344); step 8 measured 2026-11-11: 43 chunks, first at 773 ms (LOG.md)
- **Dispatch**: opus @ medium — `/execute-project 023 phase 1` — owner-gated: an
  `ANTHROPIC_API_KEY` in `apps/api/.env` for the one local stream, and nothing on Vercel yet.
- **Goal**: one function that streams Spanish text from Anthropic, inside the `ai` module,
  recording what it spent — and no route, no screen, no prompt of substance.
- **Scope**: `packages/core/src/entities/Analytics/**`,
  `apps/api/src/modules/ai/clients/**`, `apps/api/src/modules/ai/ai.config.ts`,
  `apps/api/src/modules/ai/ai.module.ts`, `apps/api/src/config/Env.validation.ts`,
  `turbo.json`, `apps/api/.env.example`, `docs/reference/deployment.md`, and the specs beside
  each.
- **Steps**:
  1. `AiFeature` gains `'assistant'` (`packages/core/src/entities/Analytics/Analytics.ts`).
     Check every exhaustive switch over it and every place the console names a feature; the
     repository that reads `ai_call` properties is a closed set by design
     (`packages/core/src/repositories/Admin/AdminAiRepository.ts`) — extend it, do not widen it
     to accept anything.
  2. A new `StreamingAiClient` beside `StructuredAiClient`, same abstract-boundary discipline:
     callers depend on an interface in `clients/`, never on a provider SDK. Use the `ai@7`
     `streamText` already in the dependency tree with `@ai-sdk/anthropic`; **do not add a
     second SDK**. It takes a system prompt, a bounded message list and an `AbortSignal`, and
     returns an async iterable of text plus a promise of the usage.
     **It builds its own Anthropic client and does not go through `resolveModel`.** That
     function is a switch on `AI_PROVIDER`, which names *one* provider, and production names
     `openrouter` ([`0064`](../../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)): riding it would mean
     either moving every plan generation to Anthropic or getting no assistant. So the assistant
     reads `ANTHROPIC_API_KEY` directly, through a second, clearly-named factory in
     `ai.config.ts`, and generation's provider is untouched. Two providers at once is the point,
     not an accident — it is the same fact that keeps the two budgets apart.
     **That factory serves two calls, not one**: the stream, and a small structured call for the
     question's label (phase 2, phase 4). Both go through the same Anthropic instance and the
     same `AI_ASSISTANT_MODEL`, and both record their own `ai_call` under feature `'assistant'`,
     so the gauge shows what the feature really costs — about two calls a message, which on
     `claude-haiku-5-5` is still under a tenth of a cent.
  3. It records one `ai_call` per stream exactly as `StructuredAiClient` does — feature
     `'assistant'`, the model that answered, tokens, `costUsd`, and **no user id**, which is
     what makes the console's gauge say what was spent without saying by whom.
  4. `AI_ASSISTANT_MODEL` in `Env.validation.ts`, modelled on `AI_REWRITE_MODEL` in shape but
     **not in its check**: `AI_REWRITE_MODEL` is validated against
     `MODEL_PREFIX[env.AI_PROVIDER]`, which is the wrong question here — under `google` that
     rule would reject `claude-haiku-5-5`, and under `openrouter` it checks nothing at all. The
     assistant's model is always an Anthropic one, so its check is always `'claude'`,
     unconditionally. Default it to `claude-haiku-5-5`, and test it under each of
     `AI_PROVIDER=openrouter`, `google` and `stub` so the independence is proven rather than
     assumed.
  5. `AI_ASSISTANT_MONTHLY_CAP_USD`, optional and positive, beside
     `AI_TEXT_MONTHLY_CAP_USD`. The new variables go in `Env.validation.ts`, `turbo.json`
     `globalEnv`, `apps/api/.env.example` and `docs/reference/deployment.md` — the spec for the
     first two fails otherwise.
     **With no `ANTHROPIC_API_KEY`, the assistant is simply off.** It cannot be a validation
     error: the key is needed only by this feature, and `Env.validation.ts` cannot read a
     runtime switch. So the client reports itself unavailable, the controller refuses before the
     flag can expose anything, and a test proves that an API with no key still boots, still
     generates plans, and answers the assistant's route as unavailable rather than crashing.
  6. **It prices its own calls** (`assistantCostUsd`), which this plan had not foreseen.
     Anthropic returns **no cost** with an answer, where OpenRouter puts one in the body and the
     gateway in its headers (`gateway.ts`) — and `AI_ASSISTANT_MONTHLY_CAP_USD` is read from what
     was billed. Without a price list in code, every assistant call would record no cost and that
     ceiling would be one nothing ever reached. So: the three models' published prices, dated, in
     `ai.config.ts`; a dated snapshot of a model prices as the model it is a snapshot of; and an
     unrecognised model records **no** cost rather than a guessed one, which the console already
     reports apart as a floor (`AdminAiRepository`). The wall that actually stops the spending
     stays where it was — the key's own monthly limit on the provider's side.
  7. Extend `health-boundary.spec.ts`'s source sweep so the new client is inside it, and add no
     exception row. **It needs no new row at all**: the sweep is recursive, so the assistant was
     inside the wall the moment its files existed. What to add is the opposite assertion — one
     that fails if the client is ever moved *out* of the module, which is the single edit that
     would leave it unchecked while every assertion in that file still passed.
  8. Measure the transport where it is cheapest to be wrong: a scratchpad script that streams
     one answer with the owner's key and prints the chunk count and the time to the first
     chunk. **Record both numbers in LOG.md.** A single chunk means the client buffers and
     phase 4's screen is a different screen.
- **Acceptance criteria**: PRD 8 (the feature exists and is recorded separately), PRD 14 (the
  variable exists and defaults to `claude-haiku-5-5`), and the first half of PRD 1 — text
  arrives in pieces. PRD 5 holds unchanged.
- **Verification**:
  - `pnpm --filter core build && pnpm ts:check && pnpm lint`
  - `pnpm --filter api test` — the whole suite, including `health-boundary.spec.ts`,
    `ai.config.spec.ts` and `Env.validation.spec.ts`
  - `pnpm --filter api test -- Env.validation` with each new variable absent, present and
    malformed
  - the scratchpad stream script: chunk count > 1, and the numbers in LOG.md

### Phase 2 — What it may read, and what it may never say

- [x] done
- **Dispatch**: opus @ high — `/execute-project 023 phase 2` — **`quality-max`, per AGENTS.md
  § Model routing: this phase is AI output validation and allergy validation.**
- **Goal**: the pure half of the assistant — the context it is given, the figure set, the
  membership check, the lexicon pre-screen and the allergen net — as functions with no I/O,
  testable without a model.
- **Scope**: `packages/core/src/domain/Assistant/**` (new), `packages/core/src/domain/Safety/**`
  (additive only), and their tests. **No Nest module, no route, no HTTP.**
- **Steps**:
  1. `assistantContext`: takes what `PoolPrompt`'s `PromptContext` already carries plus the
     active plan's rows as the service computes them, and returns what the prompt may hold. Its
     type must have **nowhere to put a condition, a medication or a cupboard item** — the same
     test `health-boundary.spec.ts` makes of `PromptContext`, written again here, because a
     type with no slot is the only version of "never" that survives a future edit.
  2. `figureSet`: the numbers a question may be answered with, derived from the plan's stored
     rows and the profile's targets — not recomputed by hand. Remember what the production read
     of 2026-11-06 cost: **`meals.kcal` already includes the meal's accompaniments**, so a day's
     total is the `meals` rows alone and summing both double-counts by 20–30%.
  3. `figuresAreAllSupplied(answer, set)`: extracts every **nutritional figure** from the answer
     — an amount of energy, of a macronutrient, or a percentage of either; Spanish and English
     decimal and thousands separators; ranges — and reports the first that is not in the set.
     *Amended while building it, by [`0105`](../../decisions/0105-only-a-nutritional-figure-has-to-be-the-services.md):
     this step first said "every number", which would have withheld every recipe the PRD promises,
     since `200 g de arroz` is a number no service supplies. A recipe's quantities, dates, times
     and temperatures are not checked; a nutritional figure spelt out in words is withheld. And
     the set is **keyed by nutrient** — energy, protein, carbohydrate, fat, fibre, share, plus
     sugar and saturated fat, which are never supplied — because a flat list let lunch's `33 %`
     validate «33 g de grasa».* Tolerances are explicit and
     tested: a rounded figure (`2.079` → `2080`, `2,1 g` → `2.07 g`) is a member, an invented
     one is not. The hard cases get tests of their own: a number that is part of a word, a
     date, and a dish name with a number in it.
     **The set is not only the plan's figures.** It also holds the numbers the person themselves
     typed into the question — an answer may repeat them. *The structural constants this step
     first listed (fourteen days, meals a day) were **dropped**: they were for a check that read
     every number, and in this one a `5` or a `100` in the set would let `5 g de proteína` and
     `100 g de grasa` through.*
  4. **The label, and the prompt that produces it.** `questionLabel` is a schema with one
     field of three values — `nutrition`, `clinical`, `off_topic` — and a one-line reason, plus
     the system prompt that asks for it: what this product is about, what counts as its subject
     (a recipe, an ingredient, a macro, a doubt about a dish, an idea, a recommendation, what to
     change and why), and what does not. The domain's part is the schema, the prompt text and
     `declineFor(label)` — *as built, a decline **code** (`ASSISTANT_DECLINES`), not a sentence:
     the words live in the web app's dictionaries (phase 5), the way every refusal in this
     product reaches a screen, so a stored thread re-renders in the language it is read in.* **The route branches on the value; nothing reads the reason but a log
     line with no question in it.** Tested as data: a table of questions with their expected
     label, including the ones that look off topic and are not (*«¿el café me rompe el ayuno?»*,
     *«¿puedo congelar esto?»*) and the ones that look on topic and are not (*«¿qué dieta sigue
     [una persona pública]?»*). *As built, `LABEL_EXAMPLES` is that table as typed data — the
     fixture phase 6 runs against real models. Only a model produces a label, and none is called
     from `core`, so this package tests the table's shape, not its outcomes.*
  5. **What an answer may be.** The assistant proposes food, so the prompt states the shape:
     ideas and recipes are welcome, quantities are welcome, and it never writes a plan or
     announces a change — asked for either, it says so and points at the generator. *As built,
     `claimsToAct(answer)`: a first-person claim of a change in either language, or five or more
     distinct days laid out, withholds the answer with the decline `acting` — a check on the
     answer, not only an instruction, so a model that starts volunteering fortnights is caught by
     code rather than by a person.*
  6. `clinicalRefusal(question)`: the lexicon — doses and units, insulin and medication words,
     pregnancy, eating disorders, a child's feeding — in both languages, matching on word
     boundaries, returning which category fired. It carries its own comment saying what it is:
     a pre-screen that saves a call and catches the obvious, **not** a guarantee, because a
     paraphrase passes it. Tested with the paraphrases that pass, recorded as known gaps rather
     than hidden.
  7. `answerNamesAnAllergen(answer, profile)`: the net. It takes the allergen and ingredient
     **names** the person's own profile resolved to — the same rows `findSafetyViolations`
     holds ids for — plus their stored synonyms, and reports a hit. Its comment states the
     asymmetry: the plate is protected by ids, this is protected by spelling — and since the
     assistant **does** propose food, this is the one net in the product with nothing stronger
     behind it. Its test table is the longest in the phase, and a hit withholds the whole answer
     rather than editing it.
  8. `historyWindow(messages)`: which turns of a kept thread are replayed to the model and
     which are only for the person to reread — bounded by turns **and** by characters, newest
     first, never splitting a question from its answer. It is a pure function over the stored
     rows, so the cost of a long conversation is a tested property rather than a surprise on the
     bill.
  9. The system prompt's text lives here as data, so it is diffable and testable: what the
     assistant is, what it refuses, that it never gives a figure it was not given, and that it
     names a professional for anything clinical. *As built, **one** English prompt told the
     language to answer in, the way `PoolPrompt` is, rather than one per language to keep in
     step; versioned (`ASSISTANT_PROMPT_VERSION`), and carrying the context as its data block —
     the same object `figureSet` reads, so the figures shown and the figures checked cannot
     disagree.*
- **Acceptance criteria**: PRD 2 (the label and the cut), PRD 4, PRD 6, PRD 7, PRD 10's replay
  window, and PRD 5 for the new domain's shape.
- **Verification**:
  - `pnpm --filter core test` and `pnpm --filter core build`
  - `pnpm ts:check && pnpm lint`
  - a test table for `figuresAreAllSupplied` with at least twenty rows, the rounding and
    false-positive cases named individually
  - `pnpm --filter api test -- health-boundary` still green, no exception row added

### Phase 3 — The stores, the limits and the migration

- [x] done
- **Dispatch**: opus @ high — `/execute-project 023 phase 3` — deviation from `tiered`'s
  implementation row, justified once: it carries **a migration that runs against production
  during the API's build**, which `migration-reviewer` must review at opus @ high before it can
  ship. — owner-gated: commission the `marketing` agent for the fortnightly allowance's two
  numbers before step 4.
- **Goal**: the stores, the migration, the flag and every limit — with nothing yet able to
  reach them.
- **Scope** *(widened while building it, see the note at the end)*:
  `packages/database/src/schemas/ai.schema.ts`, `packages/database/src/migrations/**`,
  `packages/core/src/domain/Allowance/**`, `packages/core/src/domain/Flag/**`,
  `packages/core/src/domain/Assistant/QuestionLabel*`, `packages/core/src/repositories/Assistant/**`
  (new), the console's limits (`apps/web/src/app/(admin)/admin/ajustes/**` and both
  dictionaries), the fixtures that enumerate every flag or limit, and the tests beside each.
  **No Nest module and no route: that is phase 4.**
- **Steps**, as built:
  1. `FlagName` gains `'assistant'`, audience `signed-in`, fallback **false**. Nothing is
     reachable until the owner throws it. *Its switch on `/admin/ajustes` is phase 7's, when it is
     meant to be thrown; only its name for the settings log is added here.*
  2. **The stores — and the plan's three tables turned out to be one, beside two that already
     existed.**
     - **The thread is `ai_conversations` + `ai_messages`**, which the workspace's first
       migration (`0000`) created for exactly this and which nothing had ever read or written. It
       is taken as it is — `userOwned`, so it cascades from the account; messages cascade from
       their conversation — and gains one column, **`ai_messages.decline`**, the code a cut or a
       withheld answer carries instead of prose, held to `ASSISTANT_DECLINES` by a check whose
       list a test in `core` keeps equal to the domain's.
     - **The month's spend is the `ai_call` event** phase 1 already records under feature
       `'assistant'`: one row per call, with its cost, naming nobody — what the planned
       `assistant_calls` was for, and exactly what `AI_TEXT_MONTHLY_CAP_USD` already reads. No
       table was added for it.
     - **What a person sent is counted from a new ledger, `assistant_usage`**: one row per
       message, a boolean for an off-topic cut, **no text**, cascading from the account. *Not in
       the plan, and the `marketing` report is what found it was needed*: a person may delete
       any message, so a count read from `ai_messages` would hand the allowance back for every
       deletion — the limit would reward deleting history, and the abuse ceiling would reset
       with it.
  3. The migration `0069_an_assistant_counts_what_was_sent`, generated, additive, `--drift` clean,
     applied locally, and reviewed by `migration-reviewer` (its verdict in LOG.md).
  4. `Allowance.ts` gains **`assistantMessagesPerFortnight`** — **free 20, premium 100**, ceiling
     200, floor 0, `financial` — the numbers and the reason quoted from
     `docs/reference/marketing/assistant-messages.md`. The window is `assistantWindow`: the plan
     in progress, resetting the day after it ends, or the last fourteen days for somebody with
     none (`resetsOn` null, so the screen says «en los últimos 14 días»).
     `assistantStanding` puts the count, the window and whether the question may still be
     labelled in one value for phase 4.
  5. **`assistantOffTopicPerFortnight`** — **10 on both tiers**, ceiling 30, **floor 1**: an
     abuse control and not a benefit, so the `marketing` agent did not price it. Ten is above a
     confused newcomer's waste, as its report asked. The floor is one and not zero, because at
     zero the assistant would never label anything again.
  6. *Added*: **a greeting is in scope.** «Hola», «¿qué puedes hacer?» and «gracias» are labelled
     `nutrition`, so a newcomer learning what the screen is for spends no off-topic cut on it
     (`marketing` § 6). The label's prompt and its fixture say so.
  7. *Added*: **the console's two rows** on `/admin/ajustes`, in both languages, each with its cost
     and its reason; the assistant's carries its own spend sentence, because `0097` says a
     `financial` number is never moved without its spend in front of whoever moves it, and for
     this one the row that weighs is free's.
- **Why the scope widened.** Adding a limit is not a `core` change only: the console lists every
  limit with its words, the settings log names every flag, and two fixtures — the pitch's, and
  the billing end-to-end suite's, which hard-codes every number **on purpose** so that a change to
  what a tier allows cannot reach the sentence that asks for money unnoticed — enumerate them.
  PRD 9 says the allowance is admin-overridable; the console is how that is true.
- **Acceptance criteria**: PRD 3's number and PRD 9's allowance as pure limits; PRD 10's and
  PRD 11's storage shape; the migration is clean.
- **Verification**:
  - `node scripts/check-migrations.mjs --drift` clean, and `migration-reviewer`'s report in
    LOG.md
  - `pnpm --filter core test:coverage`, `pnpm --filter api test`, `pnpm --filter web test`
  - the billing end-to-end suite against the local Postgres
  - `pnpm ts:check && pnpm lint`, and `/local-probe` on `/admin/ajustes`
  - a repository test proving the ledger counts what was sent and writes no text, and a test
    holding the decline codes equal in `core` and in the database's check

### Phase 4 — The route

- [x] done — commit `336487e` ("A person can ask the assistant a question and read the answer while it is written, a sentence at a time and each one already checked")
- **Dispatch**: opus @ high — `/execute-project 023 phase 4` — deviation from `tiered`'s
  implementation row: it wires AI output validation and an allergy screen into a request path.
- **Goal**: a signed-in person can ask the API a question and get a stream back, under every
  limit, owning their own thread, with the switch off.
- **Scope**: `apps/api/src/modules/assistant/**` (new),
  `packages/core/src/controllers/Assistant/**` (new), the admin spend screen's query,
  `apps/api/src/shared/logging/pino.ts`, `docs/ARCHITECTURE.md`, and `apps/api/test/**`.
- **Steps**:
  1. The core controller, in this order, because the order is the design: resolve the person;
     read the flag; **check the off-topic ceiling and, past it, answer the standing sentence with
     no provider call at all**; count the fortnight's messages against the allowance; read the
     month's `assistant_calls` spend against `AI_ASSISTANT_MONTHLY_CAP_USD`; run
     `clinicalRefusal` **before any call**; ask for the **label** and cut on `clinical` or
     `off_topic` without ever starting the stream; load the thread and take `historyWindow` of
     it; build the context and the figure set; stream; and **release the answer sentence by
     sentence, each one only after `figuresAreAllSupplied`, `answerNamesAnAllergen` and
     `claimsToAct` have passed on everything written so far** — the owner's choice of 2026-11-09,
     over buffering the whole answer (safe and slow) and streaming it live then retracting it
     (fluid, and the one shape where a person may already have read a food they cannot eat). On
     a hit the stream stops, what was not yet released is discarded, and the decline code follows
     the sentences already shown, which were checked and were safe. A message row is written in every
     one of those outcomes — a refusal, a cut, a withheld answer, a success — and a call row only
     when a provider was actually asked, so the allowance counts what a person sent and the gauge
     counts what the service spent, and they are allowed to differ.
  2. The Nest controller and DTOs, session required on every route, **denied as 404 where the
     product denies as 404** and `@Roles`-free but never `@Public()` — the lesson of #337 is that
     a `@Public()` route on a guarded controller 404s silently for weeks:
     - `POST /api/v1/assistant/messages` — a conversation id (or none, to open one) and one
       message, length-capped with `422 INVALID_INPUT`. **The client no longer sends a history**:
       the server owns the thread, which is what retires the forged-history problem rather than
       defending against it.
     - `GET /api/v1/assistant/conversations` and `GET …/conversations/:id` — the person's own,
       newest first, paged like every other console-free list in this product.
     - `DELETE …/conversations/:id` and `DELETE …/messages/:id` — a person deleting their own
       words, which is PRD 10 and also the cheapest answer the `legal` agent can be given.
     Every one of them resolves ownership from the session: an id belonging to somebody else is
     a 404, with an e2e case per route.
  3. **The text must not reach a log either**, which is the half of PRD 8 that is not about
     tables. `apps/api/src/shared/logging/pino.ts` already keeps a `REDACTED_PATHS` list for
     exactly this reason — the two free-text fields of `0100` are on it "for the night somebody
     turns body logging on" — so the assistant's body fields join it, and the error reporter
     (`SENTRY_DSN` is set in production) must carry no request body for this route. A test
     asserts the paths are listed.
  4. The console's spend screen shows the assistant's row against its own cap — **and nothing
     else**: no screen, route or export anywhere under `/admin` reads a conversation, and a test
     asserts the admin surface has no path to `assistant_messages`.
  5. `docs/ARCHITECTURE.md` gains the module, the wall around it, and the two-store split with
      the reason for it.
- **Amended as built (2026-11-09)**: the ask flow is in the API's `AssistantService` (it
  holds the stream client, which lives behind the AI module's wall), with core keeping the
  stores, the standing and every check; allowance and availability are checked before the
  off-topic ceiling, all before any call; a provider that cannot label is a 503 `provider`; the
  chunk proof is an e2e case through `compression()`, and `smoke:function` checks the route is
  mounted and 404 without a session. See LOG.md § Phase 4.
- **Acceptance criteria**: PRD 1 (the API half), PRD 2, PRD 3, PRD 4, PRD 6, PRD 7, PRD 8,
  PRD 9, PRD 10, PRD 11.
- **Verification**:
  - `pnpm db:local start && NUTRIA_LOCAL_PG=1 pnpm --filter api test:e2e` — a new suite proving:
    a signed-in person gets a stream; a second person cannot read the first's anything; the
    fortnight's allowance refuses the next message, and a person with no active plan is counted
    over fourteen days instead; an exhausted assistant ceiling refuses the assistant **and leaves
    plan generation and the nightly rewrite working**; a clinical question is refused with the
    model stubbed to a helpful answer; an **off-topic question is cut with the model stubbed to a
    helpful off-topic answer**, which must not appear in the response; **the (n+1)th off-topic
    message makes no provider call at all**, asserted on the stub's call count; a stubbed
    invented figure never reaches the response; an answer naming a declared allergen is withheld;
    a request for a whole fortnight is cut and nothing is generated; a second person asking for
    the first's conversation, message or deletion gets a **404** on every route; deleting a
    conversation takes its messages and leaves the month's spend unchanged; deleting the
    **account** leaves no row in either conversation table and still leaves the month's spend
    unchanged
  - `pnpm --filter api test && pnpm --filter core test && pnpm ts:check && pnpm lint`
  - `pnpm --filter api smoke:function` — the deployed assembly still boots and still denies as
    404, **plus a new assertion that the assistant's route returns at least two chunks with
    distinct arrival times through the exported function**. That proves the Nest/Express
    assembly streams; whether the platform's own layer buffers it is *not* proven here and rests
    on phase 5's human-verify. Say both in LOG.md, so the gap is named rather than discovered.

### Phase 5 — The screen

- [x] done — built 2026-11-10; confirmed by human on 2026-11-11 (LOG.md)
- **Dispatch**: opus @ high — `/execute-project 023 phase 5` — deviation from `tiered`'s
  implementation row: the screen is where the allergen net's and the refusal's words reach a
  person, so it is the display half of AI output validation. — owner-approves: the warning's wording, from
  the `legal` agent. — human-verify: the owner opens it on his iPhone and says whether the words
  arrive as they are written.
- **Goal**: `/asistente` and `/en/asistente`, behind the flag, in both languages, reviewed with
  `apple-web-design` and looked at in a real browser.
- **Scope**: `apps/web/src/app/**`, `apps/web/src/components/**`, `apps/web/src/i18n/dictionaries/**`,
  `packages/ui/**` only if a control is genuinely missing, and their tests.
- **Steps**:
  1. The screen: a question field, the conversation above it, the answer appearing **sentence
     by sentence, as each passes the checks** (phase 4), and a clear state for each outcome — declined as off topic, refused as clinical,
     withheld by the allergen net, over the fortnight's allowance, over the month's ceiling, the
     model unavailable, the connection lost mid-answer. A decline is not an error: it reads as
     the assistant saying what it is for, not as something broken. A decline that arrives **after**
     some sentences were shown is added beneath them, never in their place: what was shown was
     checked, and taking it back would say otherwise.
  2. **The warning opens every conversation.** Commissioned from the `legal` agent at the start
     of this phase and approved by the owner, it is the first thing in the thread, in both
     languages, before the field accepts anything — not a banner somebody dismisses once, but a
     message in the conversation, there every time it is opened. It carries the sentence the kept
     thread makes necessary: **not to write clinical details into it.** Its words are the
     agent's, neither the planner's nor the frontend's.
  3. **The history**: conversations newest first, openable, continuable, and deletable — a
     message or a whole thread — with the destructive action stating its consequence before it
     happens, per the design skill's own rule about destructive actions. An empty state that
     says what this is for rather than apologising.
  4. The thread comes from the server, so it survives a reload and a second device; what stays
     in the browser is only what has not been sent yet. It survives a reload no further than the
     browser allows and **is never sent anywhere but this service**.
  5. Both dictionaries at parity. The professional-review notice appears beside the
     conversation whenever the profile carries it, per PRD 6.
  6. The design review is mandatory and its verdict goes in the pull request's `## Checked`
     (`apps/web/AGENTS.md` § Design review): the owner's `apple-web-design` skill, P0 and P1
     fixed in the same change.
  7. `/local-probe` at 320, 390 and 1280 px, light and dark, both languages, signed in — and
     the screenshots **opened and looked at**, because a green line says the page fits, not that
     the page is right. Remember the localhost artefact: count the 429s in `api.log` before
     believing a page is broken.
- **Amended as built (2026-11-10)**: no `/en/asistente` — signed-in screens keep one address and
  take their language from the profile's cookie; the address stays `/asistente` after the first
  answer (changing it mid-answer moved focus); the `legal` agent's F1 and F2 were fixed in this
  phase (`docs/decisions/LOG.md`, 2026-11-10). See LOG.md § Phase 5.
- **Acceptance criteria**: PRD 1 in full; PRD 12 (the warning); PRD 10 (the history as a person
  uses it); PRD 6's notice; and PRD 2's and PRD 7's words as a person actually reads them.
- **Verification**:
  - `pnpm --filter web test && pnpm --filter web lint && pnpm ts:check`
  - `pnpm build && node scripts/check-static-pages.mjs` — no public page stops being prerendered
  - `/local-probe` output in LOG.md, with every `hint:` judged and said how
  - the `accessibility` agent's report: names and roles on a live region that grows, focus never
    stolen while an answer streams, the field reachable and labelled, 44 px targets, text at 200%
    with no sideways scroll

### Phase 6 — Which model, decided by measurement

- [x] done — 2026-11-11, `docs/reference/assistant-models-2026-11-11.md`: keep `claude-haiku-5-5` (the default; nothing to set)
- **Dispatch**: opus @ high — `/execute-project 023 phase 6` — deviation justified: the phase's
  output is a production configuration read from free-text answers about insulin, doses and
  allergens, which is a judgement, not a script. — owner-gated: the owner sets
  `AI_ASSISTANT_MODEL` on Vercel from what this records.
- **Goal**: `AI_ASSISTANT_MODEL` chosen on evidence, and the evidence kept.
- **Scope**: `apps/api/scripts/**` (a script beside `bench-models.mjs`),
  `docs/reference/assistant-models-2026-MM-DD.md` or an entry under
  `docs/reference/audits/`, and LOG.md. **No product code.**
- **Steps**:
  1. Ten questions, fixed and committed: insulin, a dose, macros per meal, a declared allergen,
     one of the clinical situations, one plainly off topic, one asking for a whole fortnight, and
     three ordinary ones a person would really ask — a recipe, an ingredient swap, and a doubt
     about a dish.
  2. Each put to `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5` with the real
     system prompt and a real figure set, through the phase-1 client. Every run records the
     answer, the tokens, the cost, the label each model gave the question, and whether
     `figuresAreAllSupplied`, `clinicalRefusal` and `answerNamesAnAllergen` fired.
  3. The report says, per model: **how many questions it labelled correctly**, how many answers
     a screen had to withhold, how many invented a figure, how many refused what they should
     have refused, how many wandered off the subject or offered to build a fortnight, the cost
     per message and the time to the first chunk. The label is the cheapest call and the one
     that decides whether the feature behaves at all, so a model that labels badly loses here
     even if it writes beautifully. **The screens' hit rate is the number that decides it** — a model whose
     answers are withheld is a model the person never hears.
  4. A recommendation, priced: what moving from `claude-haiku-5-5` to each of the others costs
     per month at the current scale, against the roughly 100 € of monthly credit that expires if
     unspent.
- **Acceptance criteria**: PRD 14.
- **Verification**: the three runs' raw output kept in `docs/local/` (private), the comparison
  committed in the report, and `pnpm check:leaks` clean.

### Phase 7 — The legal text, then the switch

- [x] done — pages and retention built 2026-11-10; the mail sent, the switch on and the iPhone checked, confirmed by human on 2026-11-11 (LOG.md)
- **Dispatch**: opus @ high, with the `legal` agent owning `docs/legal/` —
  `/execute-project 023 phase 7` — owner-approves: the privacy text and the processor named in
  it. — owner-gated: the owner throws the `assistant` switch in `/admin` once the text is live.
- **Goal**: `/privacidad` tells the truth about this before anybody can use it, and then it is
  on.
- **Scope**: `docs/legal/**` (the `legal` agent only), `apps/web/src/app/**` for the legal
  pages, `apps/web/src/i18n/dictionaries/**`, and `docs/decisions/LOG.md`.
- **Steps**:
  1. The `legal` agent assesses the new flow, which is now two flows, not one: free text sent
     to a processor outside the plan's provider, **and that same free text stored here**. It
     drafts what `/privacidad` must say — what is sent, to whom, that conversations are kept, for
     how long, who can read them (nobody but their owner), how to delete them, and the legal
     basis for each. If `/condiciones` is touched, both change together.
  2. **It rules on retention**, which the PRD leaves to it as an open question: the planner's
     assumption is "until the person deletes it", matching plan history, and a cap is the
     cheapest answer if the agent wants one — free text about food can carry a condition somebody
     volunteered.
  3. **`PRODUCT.md` gains the sentence this project makes necessary** (`docs/` is "owner decides,
     agents draft", so it is drafted here and the owner approves it): its promise that recorded
     conditions and medications are "never placed in a prompt" is about what the product
     *records*; what a person types into a conversation themselves is governed by the warning and
     by this policy instead. Leaving that unsaid would make a true paragraph read as a false
     one.
  4. The same agent's warning text from phase 5 is re-read against the final pages, so the two
     say the same thing — the screen's first message and the policy cannot drift apart.
  5. The agent states what rides the lawyer's pending hour and what does not, next to the
     existing `[lawyer]` lines, so the owner's hour covers this in one sitting rather than two.
  6. What the provider's own pages say is quoted as **what they say**, with a date, for the
     lawyer to confirm — not as a verdict: that it does not train models on commercial Customer
     Content, and that its data-processing addendum is incorporated into its commercial terms by
     reference rather than signed separately.
  7. The pages ship. Then the owner turns the switch on, and `docs/decisions/LOG.md` gains the
     dated line saying the assistant is live, on which model, and under which ceiling.
- **Amended as built (2026-11-10)**: the scope gains the retention in `packages/core` and
  `apps/api` (conversations six months after their last turn, the count after 60 days, in the
  daily sweep), because the `legal` agent's ruling is only true once the code deletes; and the
  `legal` agent's F5 (no goal or way of eating to the model) was fixed here. See LOG.md § Phase 7.
- **Acceptance criteria**: PRD 13, and the delivery of PRD 1 — reachable at last.
- **Verification**:
  - the legal pages' own tests, `pnpm --filter web test`, `pnpm check:leaks`
  - `node scripts/smoke.mjs` after the deploy: the public pages up, the doors that must be shut
    still shut
  - the owner's own first conversation on his iPhone, recorded in LOG.md as
    "confirmed by human on <date>"

## Hand-off

Standing constraints for every executor of this project:

- **The wall is not negotiable.** `apps/api/src/modules/ai/health-boundary.spec.ts` must pass
  with no row added to its exception lists. If a phase seems to need health data, the phase is
  wrong: stop and log it. Letting the assistant see a condition is a different project with a
  record that supersedes part of [`0004`](../../decisions/0004-deterministic-safety-layer.md),
  and the owner declined it on 2026-11-09.
- **The subject is nutrition, and a decline is a feature.** No phase may widen what the
  assistant answers because a question was interesting. If the label is wrong too often, fix the
  label's prompt and say so in LOG.md — never remove the branch.
- **It proposes food, so the allergen net is not decoration.** Before any phase loosens it,
  remember this is the only place in the product where a model's own words put a food in front of
  a person, and that the net matches on spelling.
- **The service is the only source of a number.** No phase may let a figure reach a person
  because a model wrote it. If `figuresAreAllSupplied` is too strict to live with, say so in
  LOG.md and amend the plan — do not loosen it quietly.
- **What was typed belongs to the person who typed it, and to nobody else.** The thread is
  stored; that is the owner's instruction of 2026-11-09, and it is also the only part of this
  project that stores anybody's words. So: no log line, no error report, no analytics property,
  no console screen, no export and no professional link may hold or reach a question or an
  answer. `0068`'s console-reads-nobody rule gains no exception, deletion is absolute, and the
  money is counted from rows that name nobody so that deletion *can* be absolute.
- **Feature work runs as the agent team, every time** (AGENTS.md § Common commands). The split
  into six phases is about reviewability, not about dodging `/team`: most phases still span more
  than one role, and the lead prices each task before spawning anybody.
  - Phase 1: `backend`.
  - Phase 2: `backend`, with `invariant-reviewer` on the wall and the screens.
  - Phase 3: `backend`, with **`migration-reviewer` (never below opus @ high — a migration runs
    against production during the API's build)**.
  - Phase 4: `backend` + `tests`, with `invariant-reviewer` (new routes, ownership by session,
    denial as 404, and a store of somebody's words).
  - Phase 5: `frontend` + `accessibility`; `apple-web-design` is mandatory.
  - Phase 6: `backend` alone, or the lead directly; it writes a script and a report.
  - Phase 7: `legal` (the only writer under `docs/legal/`) + `frontend` for the pages and the
    dictionaries.
  A phase that finds itself touching a directory no listed role owns has drifted — amend the
  plan rather than widen the phase.
- **After editing `packages/core` or `packages/database`, run `pnpm --filter core build`.** The
  API runs the built output; an unbuilt edit measures nothing.
- **Tests and probes run on the local Postgres**, never on Neon: `pnpm db:local start`,
  `NUTRIA_LOCAL_PG=1`. Never a test generation on the owner's production account.
- **One heavy job at a time.** Do not run the gate, the e2e suite and a build together; this
  machine has died doing it.
- **The money is a monthly allowance that expires.** When a phase prices something, price it
  against roughly 100 € a cycle that is lost if unspent — there is nothing to save for next
  month, and nothing to hoard.

## Out of scope

- **Acting on the plan, and generating one** — swapping a meal, fixing a day, staging a change
  for confirmation, building a fortnight. Needs tool use and the swap route's validators behind
  every change. A follow-up project; the roadmap line stays open. A recipe written into an answer
  is **not** this: words are in scope, state is not.
- **Being useful about anything else.** Explicitly out: the assistant declines rather than
  answers, however easy the answer would have been.
- **Health data in the assistant** — conditions, medications, supplements, the cupboard, the
  professional's side of a link. Its own project, its own record, and not before the lawyer's
  hour.
- **Anybody but the person reading their own conversation** — a console screen, an export, a
  professional through a link, the owner. Deliberately not built: PRD 11. A question about
  somebody's conversation is answered by asking them.
- **Moving plan generation to this provider.** Tempting, because the credit expires monthly and
  generation spends a free tier — but it is a change to how every plan is built, measured by
  `plan-evaluator` over a cohort, not a line in this project. A roadmap item.
- **Voice, a food photo, a barcode.** `PRODUCT.md` § Scope excludes them from v1.
