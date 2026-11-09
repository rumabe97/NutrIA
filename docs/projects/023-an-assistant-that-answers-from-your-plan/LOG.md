# LOG — Project 023: An assistant that answers from your plan

> **Purpose**: append-only execution record. One entry per phase (plus one per
> deviation): what happened, evidence it works, what changed against the plan. This is
> the file future agents read to learn "what was decided in phase X and why".
> **Audience**: humans and agents. **Committed**: yes — one commit per phase, made by
> the owner at the phase boundary. **Written by**: the executing agent, appending only.
> Write repo-relative: no absolute paths, no references to other private repos.

<!-- Entry format — copy per phase:

## Phase N — Title (YYYY-MM-DD)

- **Executor**: model + effort actually used.
- **Result**: done | partial | blocked.
- **Evidence**: verification commands run and their outcomes (test counts, build
  results). Claims without evidence don't belong here.
- **Deviations from plan**: none, or what changed and why — with the plan amended in the
  same change.
- **Decisions**: links to any docs/decisions/ records created.
- **Notes for the next phase**: anything the next executor must know.
-->

## Planning — the decisions this project was born with (2026-11-09)

- **Executor**: opus @ high, via `/plan-project`.
- **Result**: PRD approved by the owner the same day, plan written, [`0104`](../../decisions/0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md) recorded. **The owner approved the PRD and then the plan on 2026-11-09**, after two rounds of
  tightening; phase 1 is unblocked and waits only on a key.
- **What the owner decided**, with the options and the prices in front of him:
  - **Answer only.** No acting on the plan, not even a change staged for confirmation.
  - **It reads what the plan generator reads**, and the health wall stays mechanical and
    unchanged. No record superseding any part of
    [`0004`](../../decisions/0004-deterministic-safety-layer.md).
  - **`claude-haiku-5-5`**, from a measured comparison against `claude-sonnet-5-5` and
    `claude-opus-5-5`, and reversible by a variable rather than by a deploy.
  - **The money is a monthly, expiring allowance** — the API credits his subscription
    carries, about 100 € a cycle, lost if unspent. The ceiling that matters is monthly, and
    there is nothing to save for next month.
- **What the planner found in the code, which shaped the PRD**:
  - `AiClient.generate` is structured output only: the assistant needs a streaming text
    client behind the same module wall, not a second SDK.
  - `AI_PROVIDER=anthropic` and `@ai-sdk/anthropic` are already wired and already a
    dependency; the default model for that provider is `claude-sonnet-5`, and
    `Env.validation.ts` requires an anthropic model id to contain `claude`.
  - The spend machinery already exists in the shape this needs: `ai_call` events carry a
    `feature`, the console reads spend by feature, and `recipe_image_calls` is the precedent
    for a per-call cost table read as the month's truth rather than as a counter.
  - `findSafetyViolations` compares **ids**, never names. A screen over free text therefore
    cannot be as strong as the one a plate goes through, and the PRD says so in criterion 5
    instead of implying otherwise.
- **Notes for the first phase**: whether the API can hold a streaming response on its
  deployment, and for how long, is unmeasured. `apps/api/vercel.json` gives the function
  `maxDuration: 300` and ships `dist/` through `vercel/index.js`, and nothing in the
  repository returns a **progressive** response today: the one `StreamableFile` in
  `AdminCatalogue.controller.ts` hands over a complete buffer with its length, which is not a
  precedent for this. Measure it before any route is written — the screen's design depends on
  the answer, and a function that buffers turns criterion 1 into a different screen.

- **One criterion was corrected before approval, and the correction is the project's most
  useful finding.** The PRD's first draft of criterion 2 said "no figure about a plan shown in
  an answer comes from the model", with a test stubbing the model to return a plausible wrong
  number. That is **unbuildable**: filtering *any* number out of free text leaves either no
  digits — not an assistant — or pattern matching, which is the weak net criterion 5 already
  admits being. It now names a mechanism instead: the service computes the figure set, hands it
  to the model, and membership of every extracted number is checked before the answer is shown.
  A criterion that cannot be verified is worse than a missing one, because the plan downgrades
  it quietly at implementation time.
- **The owner chose the stronger-reading of the two safe shapes** (2026-11-09): the model
  *receives* the figures and says them in its own words, rather than never seeing them while the
  screen paints a block beside the prose. Both are `0004`-faithful — the service is the only
  source either way — and the rejected one cannot answer *«por qué tanta comida en el almuerzo»*.
- **The owner tightened the scope the same evening, and one of his four points made a sentence
  of this planner's own decision record false.** What he said, 2026-11-09:
  1. **Only nutrition and dietetics** — recipes, ingredients, macros, doubts, recommendations,
     what to change: the same subject as the rest of the application, and nothing else.
  2. **No plans and no swaps, but ideas and recipes yes** — *«si pide una receta en
     específico»*, it writes it.
  3. **The first message is the warning about the AI**, in whatever words the `legal` agent
     requires.
  4. **The allowance is fortnightly**, premium's larger, with the numbers from `marketing`.
  Point 2 is what broke the record: `0104` said the allergen net was weak *"and that is why the
  assistant never proposes food to eat"*. It now does propose food — an idea, a dish, a recipe —
  so that net went from a belt beside braces to **the only thing standing between a model's own
  words and what somebody eats**. Everywhere else in this product a suggestion becomes a plate
  only after `findSafetyViolations` has compared ids; here it reaches a person directly. The
  record was corrected before it was committed, and clause 5 now names it as the single most
  load-bearing weakness in the design.
- **How the subject is enforced, and why a model is allowed to decide it.** A nutrition lexicon
  the question must *match* would fail closed — *«¿me cunde congelar esto?»* declined, the
  feature reading as broken — so the question is **labelled** instead, by a cheap structured
  call, and the route branches on the value. That makes a model the decider of one thing, which
  `0004` permits precisely because of how it draws its line: a mislabelled question costs a
  declined question, never somebody's health. It also closes, honestly, the gap this plan had
  already admitted: the clinical lexicon misses a paraphrase, and the label catches it.
- **Two more instructions the same evening, and the second reversed a decision this planner had
  already made** (2026-11-09):
  5. **Off topic is cut immediately, and checking has its own limit** — *«el asistente lo corta
     inmediatamente, y hasta un poco de límite en comprobar esto»*. So: on any label but
     `nutrition` no stream is ever started, and off-topic cuts are counted per person per
     fortnight against a ceiling of their own, past which the route answers the standing sentence
     **with no provider call at all**. That second half is the owner noticing something the plan
     had not: the label is cheap, but it is not free, and a person who is not here about food
     should not be able to spend the service's money proving it. It is an abuse control, not a
     tier benefit, so `marketing` is not asked for the number.
  6. **It must keep a conversation history.** This **reverses** what the PRD and `0104` said
     that afternoon — that nothing typed would be stored, which was the shortest and most
     defensible privacy sentence this product could have had. It was the wrong trade: a chat
     nobody can reread, continue tomorrow or open on another device is missing most of what makes
     a conversation worth having.
- **What the history costs, written down before anybody builds it.** A store of free text people
  write about their own food will eventually hold a condition somebody volunteered — *«soy
  celíaco»* typed into a thread is not a row behind a consent. It does not break the wall, which
  is about what the code can reach, and the module still imports nothing from `Health`. What it
  does is give the opening warning a second job (**say not to type clinical details**) and put
  retention, deletion and the policy's wording on the lawyer's pending hour. `PRODUCT.md` needs a
  sentence too, drafted in phase 6: its promise that recorded conditions "never reach a prompt"
  is about what the product *records*, and leaving that unsaid makes a true paragraph read as a
  false one.
- **The design that came out of it, and why it is three tables and not one.** Deleting an account
  must take **every word**, and the month's billed spend must stay true afterwards. One store
  cannot do both, so the thread (`assistant_conversations` + `assistant_messages`) cascades from
  the account, and the money (`assistant_calls`) is shaped exactly like `recipe_image_calls` and
  **names nobody**. A side effect worth having: with the server owning the thread, the client
  sends a conversation id and one message, which **retires** the forged-history attack the
  earlier draft had to defend against with a 422.
- **Routing**: `tiered`, with AGENTS.md's standing exception applied to phases 2, 3 and 4
  (AI output validation and allergy validation → `quality-max`, opus @ high), and phase 5
  deviating with its justification on the Dispatch line.

## Phase 1 — The assistant can speak (2026-11-09)

- **Executor**: opus @ high, directly in the planning session at the owner's request
  (*«empieza ya aquí»*). The plan prices this phase at opus @ medium; running it higher costs
  more and risks nothing, and it is recorded rather than quietly done.
- **Result**: **partial** — steps 1 to 7 done, step 8 blocked on a key only the owner can put
  in place.
- **Evidence**:
  - `pnpm --filter core build` — clean.
  - `pnpm ts:check` in `apps/api` — clean.
  - `pnpm lint` in `apps/api` — clean, `--max-warnings 0`.
  - `pnpm test` in `apps/api` — **125 suites, 1,755 tests, all passing** (124 and 1,738 before
    this phase: one new suite, seventeen new tests).
  - `pnpm --filter core test` — 4,272 passing.
  - `pnpm exec prettier --check 'src/**/*.ts'` — clean after formatting the three new files.
  - `pnpm deadcode` — clean.
  - **The whole application booted once with the new injection graph**: one end-to-end suite
    against the local Postgres (`NUTRIA_LOCAL_PG=1`, `access`, 13 tests, 25 s). `ai.module.spec.ts`
    proves `AiModule` in isolation and would not have caught a token the real context cannot
    resolve — which is exactly the mistake made and fixed in this phase, where the settings token
    and its value briefly shared a name.
  - The seven new cases of `AnthropicStreamingClient.spec.ts`: the answer arrives in pieces; the
    row is priced by arithmetic rather than by a copied figure; no row names anybody; a stream
    nobody reads to the end is still counted; the configured key never reaches the message a
    failure carries; a budget that ends a stream reads as a timeout and not as the key; and with
    no key at all the client is unavailable instead of broken.
- **Deviations from plan** (both amended into the plan in this same change):
  - **A price list in code, which the plan had not foreseen** — now step 6. Anthropic returns
    **no cost** with an answer, where OpenRouter puts one in the body and the gateway in its
    headers, and `AI_ASSISTANT_MONTHLY_CAP_USD` is read from what was billed. Without it every
    assistant call would have recorded no cost and that ceiling would have been one nothing ever
    reached — a cap that looks configured and does nothing being strictly worse than no cap at
    all. Bounded on purpose: an unrecognised model records **no** cost rather than a wrong one,
    which the console already reports apart as a floor.
  - **Step 7 needed nothing added.** The wall's sweep is recursive, so the assistant's sources
    were inside it the moment they existed. What went in instead is the assertion in the other
    direction: a row that fails if the client is ever moved *out* of the module — the one edit
    that would leave it unchecked while every other assertion in that file still passed. (The
    same lesson that keeps recurring here: a step can already be done and its own text not know
    it, so grep the code an item names before starting it.)
- **What the code found out, which no amount of planning would have**: `streamText` **does not
  throw a provider's error at whoever is reading the stream.** It hands it to `onError` and ends
  the text quietly, so every promise then rejects with the SDK's own *"No output generated. Check
  the stream for errors."* A first version reported exactly that — which would have turned a bad
  key, an exhausted quota and a model that does not exist into one sentence naming none of them,
  the precise failure `StructuredAiClient` exists to avoid. Found by a test asserting the
  credential was redacted and getting a message with no credential in it because there was no
  message. The client now captures what the provider said and reports that.
- **Decisions**: none new;
  [`0104`](../../decisions/0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md)
  already covered this phase.
- **Notes for the next phase**:
  - The assistant's provider is **one factory, two callers**: `StreamingAiClient` (the answer)
    and `ASSISTANT_CLIENT` (the label, through the `StructuredAiClient` that already existed —
    no second implementation was needed, and none should be added).
  - `ASSISTANT_SETTINGS` is the injection token; `ASSISTANT_CALL_SETTINGS` is the value. They
    were briefly the same name, which type-checks as nonsense: Nest takes the object as a token.
  - **For any test that fakes a model**: a provider's usage is *nested per kind*
    (`inputTokens: { total, noCache, cacheRead, cacheWrite }`), not the flat shape the SDK hands
    a caller. A mock with the flat shape streams text perfectly and reports zero tokens, which is
    a priced call recording no price — it cost twenty minutes here.
  - **An abandoned answer is counted but not costed**, and that is the one path where spend
    escapes the monthly ceiling: the token counts for a stream nobody finished reading never
    arrive, so its row carries `costUsd: null` and the month's sum is a floor. What bounds it is
    the person's own fortnightly allowance, which must therefore count a message **in every
    outcome** — the controller in phase 4 writes that row before it knows how the answer ends.
  - **A provider error after partial text** ends the stream quietly and then throws from the
    generator, so the route can be handed half an answer and then a failure. That is a state the
    screen has to have: not an error page, and not a half-sentence presented as an answer.
  - `StructuredAiClient.generate`'s message for a null model says "check AI_PROVIDER", which is
    the wrong hint for `ASSISTANT_CLIENT` — its model comes from `ANTHROPIC_API_KEY`. Check
    `isAvailable` before calling it rather than reading that message.
  - Step 8 is the measurement the screen's design depends on: chunk count and time to the first
    chunk, through the real provider and then through `smoke:function`. Until it is run, nobody
    knows whether the deployment hands over a progressive response or one buffered lump.

