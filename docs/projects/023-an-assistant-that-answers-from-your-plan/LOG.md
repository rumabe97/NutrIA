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

## Phase 2 — What it may read, and what it may never say (2026-11-09)

- **Executor**: opus @ high, directly, on the owner's *«ve haciendo las fases siguientes»* — the
  phase's `quality-max` routing, met.
- **Result**: done. Pure functions only, in `packages/core/src/domain/Assistant/`, plus one
  additive export in `domain/Safety`. No Nest module, no route, no HTTP.
- **What was built**:
  - `assistantContext` — what the model is told about a person, and the only shape it can be
    told it in: the person-level half of `PromptContext`, the plan as stored, and the foods they
    cannot eat. A day's total is its `meals` rows summed **and nothing else**, and accompaniments
    arrive as names only, so the double count the 2026-11-06 production read made cannot be made.
  - `figureSet` + `figuresAreAllSupplied` — the nutritional-figure check (PRD 4), with
    `parseLocaleNumber` and `numbersIn`.
  - `questionLabelSchema`, `declineFor`, `LABEL_SYSTEM_PROMPT`, `LABEL_EXAMPLES`,
    `ASSISTANT_DECLINES` — the label and the codes a cut or a withheld answer carries (PRD 2).
  - `claimsToAct` — an answer that claims a change or lays out a plan is withheld (PRD 1's
    "answer only", as code).
  - `clinicalRefusal` — the lexicon, run before any call (PRD 6, first layer).
  - `forbiddenFoods` + `answerNamesAnAllergen` — the allergen net (PRD 7), and `synonymsOf`
    added to `domain/Safety/CustomAllergen.ts`: the curated synonym list read backwards.
  - `historyWindow` — what of a kept thread is replayed (PRD 10's window).
  - `assistantSystemPrompt` + `ASSISTANT_PROMPT_VERSION`.
  - `Assistant.boundary.test.ts` — the health wall, written again for this folder (PRD 5).
- **Evidence**:
  - `pnpm --filter core test:coverage` — **156 files, 4,409 tests, all passing** after the review
    round (4,272 before this phase: 135 in the assistant's domain, 2 for `synonymsOf`), and the
    domain's coverage floors hold.
  - The new folder alone: **135 tests; 100 % statements, functions and lines; 95.6 % branches**
    (the net 90.6 %, over the 90 % floor).
  - `pnpm ts:check` — 9 of 9 tasks. `pnpm lint` — 7 of 7. Prettier clean.
  - `pnpm --filter core build` — clean. `health-boundary.spec.ts` in the API — 39 passing, the
    file **untouched this phase**: no exception row added.
  - `figuresAreAllSupplied`'s table: **21 rows shown and 15 withheld**, each case named — the
    rounding, the false-positive and the kind-confusion cases individually, as the plan asked.
- **Deviations from plan** (each amended into the plan in this same change):
  - **The figure check reads nutritional figures, not every number** —
    [`0105`](../../decisions/0105-only-a-nutritional-figure-has-to-be-the-services.md),
    superseding the scope of `0104` clause 4, with PRD criterion 4 amended to match. The contract
    contradicted itself: it withheld any number the service did not supply *and* promised recipes
    with their quantities, and every recipe has `200 g de arroz` in it. Nobody reconciled the two
    when the owner asked for recipes the same evening; building the check is where it surfaced.
    The dangerous figure — the per-meal carbohydrate split the 2026-09-12 probe caught — is a
    nutritional one and is still checked.
  - **The structural constants were dropped from the set**, and that is a correction, not a
    simplification: in a check that reads only figures bound to a nutritional unit, a `5` or a
    `100` in the set would have let `5 g de proteína` and `100 g de grasa` through.
  - **Decline codes, not sentences.** `declineFor` returns a code; the words are the web app's
    (phase 5), as every refusal in this product is, so a stored thread re-renders in the
    language it is read in.
  - **One English system prompt**, told the language, like `PoolPrompt` — not one per language.
  - **`LABEL_EXAMPLES` is a fixture, not a test of outcomes.** Only a model labels; none is
    called from `core`. Phase 6 runs the table against real models.
- **Found while building it, and fixed before it shipped**:
  - Two false positives the first patterns had, which would have withheld exactly what the owner
    asked for: «para subir la proteína, añade 150 g de pechuga» read as a protein figure, and «usa
    nata al 18 %» as a fat figure. The gap allowed between a nutrient and its amount no longer
    admits a comma or a verb, and both cases are now rows in the table so a future widening
    cannot quietly undo them.
  - **The allergen net's usability hole is closed by the prompt, not by loosening the net.** The
    honest answer to «¿qué uso en vez de huevo?» names egg. The model is now handed the excluded
    foods and told never to write them, not even to warn of them — so a withheld answer means the
    model broke a rule it was given, and «Puedes usar plátano maduro…» answers the same question
    and is shown. Both are rows in the table.
  - The net adds plural and singular forms, which `CustomAllergen.ts` refuses on principle. The
    comment in both files now says why that is not a contradiction: there a derived form becomes a
    *promise*, here it only *withholds*, so over-matching is this file's safe direction and that
    file's dangerous one.
  - Free-text allergies that matched no catalogue row (`unenforceableLabels`) are **searched for
    and never told** — they are never sent to a model (prompt 4.0.0), and searching the answer
    after the fact is not sending them.
  - The root `pnpm ts:check` caught what vitest does not look at: a test fixture with
    `goal: 'maintain'` where the value is `'maintenance'`, and `import.meta` in a package that
    compiles to CommonJS. Both fixed; the second the way `provenance.test.ts` already does it.
- **Found in review, and fixed before the boundary — the most important change of the phase.**
  The first figure set was **one flat list** of every number in the context. A fortnight puts some
  350 figures in it, between 0 and 2,500, each with a ±5 % band, and almost any amount of grams
  lands within 5 % of *something*: lunch's `33 %` share made «33 g de grasa» a supplied figure, and
  the carbohydrate target made «240 g de proteína» one. The one-day fixture was too sparse to show
  it. The set is now **keyed by nutrient**, each pattern says which nutrient it read, and sugar and
  saturated fat — never supplied — have empty sets, so «62 g de azúcar» on a 62 g carbohydrate meal
  is withheld instead of passing as carbohydrate. The question contributes its nutritional figures
  by kind, so «tengo 30 años» no longer whitelists every 30. Six rows name these cases.
- **And one regression the fix itself introduced, caught by the table.** Closing the label patterns
  against backtracking («Proteína: 45 g» must not be read as «Proteína: 4») first forbade any
  separator after the amount — so «Calorías: 700.», with its sentence-ending full stop, stopped
  matching and an invented figure **passed**. The rule is now "no digit, and no separator followed
  by a digit". The existing row «Calorías: 700» going green when it should have stayed red is what
  showed it.
- **Known gaps, kept as tests rather than hidden**: the clinical lexicon lets «mi azúcar en sangre
  está alta», «tomo algo para el tiroides» and «me pincho por las noches» through — the label is
  what must catch them. And a quantity is not a figure, so «toma 300 g de arroz en cada comida» is
  not withheld by the figure check even though it implies a carbohydrate amount (`0105`,
  Consequences).
- **Decisions**: [`0105`](../../decisions/0105-only-a-nutritional-figure-has-to-be-the-services.md),
  and its line in `docs/decisions/LOG.md`.
- **Notes for phase 3**:
  - `assistant_messages` needs a **decline column** holding one of `ASSISTANT_DECLINES` (null for
    an answer that was shown), so a cut question and its decline are stored as a code and not as
    prose — and so `historyWindow`'s `replay` flag can be derived from it rather than stored
    twice: a turn is replayed only when neither it nor its partner was declined.
  - The off-topic ceiling counts rows whose decline is `off_topic`, in the same fortnight window
    as the allowance.
- **Notes for phase 4 — one of them a decision the owner has to see**:
  - **PRD 1 and PRDs 4 and 7 pull against each other, and this phase's functions make it concrete.**
    PRD 1 says an answer *appears progressively*; 4 and 7 say an answer with an invented figure or
    a forbidden food is *withheld* — and `figuresAreAllSupplied`, `answerNamesAnAllergen` and
    `claimsToAct` judge a **whole** answer. A hit in the last sentence means the first ten were
    already on screen. The plan's "before the last chunk is released" quietly assumes the server
    buffers everything, which would make phase 1's streaming pointless. Three honest shapes, and
    the choice changes what phase 5's screen is:
    1. **Buffer, then release** — nothing is shown until every check passes. Safest, and the answer
       arrives whole after a wait, which is what streaming was meant to avoid.
    2. **Check as it streams, sentence by sentence** — each sentence released only once the checks
       pass on everything so far. Mostly progressive; a hit stops the answer mid-way, and what was
       already shown was already safe.
    3. **Stream visibly and retract** — show everything, and replace it with the decline on a hit.
       The most fluid, and the one where a person may already have read the forbidden food.
    The planner's recommendation is **2**: it keeps the streaming the owner was promised, and it
    never shows a sentence the checks have not passed. To be put to the owner with options before
    phase 4 builds the route.

  - `forbiddenFoods` needs every ingredient's names **in every locale** (`ingredient_names`) with
    its allergen links, and every declared allergen's names. Loading them is the route's; the
    function is pure and tested here.
  - The label call goes through `ASSISTANT_CLIENT` — the existing `StructuredAiClient` on the
    assistant's model — with `questionLabelSchema` as its schema. Check `isAvailable` first: its
    null-model message says "check AI_PROVIDER", which is the wrong hint for this client.
  - `historyWindow` returns `{ role, text }`, which is `AiTurn` exactly.
- **Notes for phase 6**:
  - **, A measurement this phase could not make**: seed invented figures into real
    answers over a real fortnight and count how many the check lets through. Kind by kind, the set
    is still dense — fourteen days of per-meal protein at ±5 % cover a lot of the line. That count
    decides whether ±5 % is the right band, or whether per-meal figures should leave the set for
    day-level ones (`0105`, Consequences).

## The owner's two decisions at phase 2's boundary (2026-11-09)

Asked with options, both answered with the recommended one:

- **Each phase ships as it finishes.** The executor runs the whole of `/ship` at every phase
  boundary — the full gate, the pull request, CI, the merge, and production checked — and goes on
  to the next. Safe to do because nothing of the assistant is reachable until phase 7: no route,
  no screen, no switch. The gates the plan names still stop it: `owner-gated`, `owner-approves`
  and `human-verify` are not boundaries this authorisation reaches past.
- **The answer appears sentence by sentence, each one already checked.** The figure check, the
  allergen net and `claimsToAct` judge a whole answer, and PRD 1 promises one that appears as it is
  written; the two meet by releasing each sentence only once the checks pass on everything written
  so far. Chosen over buffering the whole answer, which would make phase 1's streaming pointless,
  and over streaming it live and retracting it, the one shape in which a person may already have
  read a food they cannot eat. Phase 4's step 1 and phase 5's step 1 are amended to say so.

## Phase 3 — The stores, the limits and the migration (2026-11-09)

- **Executor**: opus @ high, directly; `marketing` and `migration-reviewer` (opus @ high, its floor)
  commissioned as the plan asks.
- **Result**: done.
- **What was built**: the `assistant` flag (off); `assistantMessagesPerFortnight` (free 20,
  premium 100, ceiling 200, `financial`) and `assistantOffTopicPerFortnight` (10 on both, ceiling
  30, floor 1); `assistantWindow` and `assistantStanding`; the `assistant_usage` ledger and its
  repository; `ai_messages.decline`; migration `0069`; the console's two rows; greetings in scope
  for the label.
- **Evidence**:
  - `pnpm --filter core test:coverage` — **157 files, 4,427 tests**, floors holding.
    `pnpm --filter api test` — 125 suites, 1,755. `pnpm --filter web test` — 35 files, 302.
  - The billing end-to-end suite against the local Postgres — **62 of 62**: it hard-codes every
    limit on purpose, and now names the assistant's two.
  - `pnpm ts:check` 9/9, `pnpm lint` 7/7, `pnpm format` 7/7.
  - `node scripts/check-migrations.mjs --drift` clean; `0069` applied locally.
  - `/local-probe` on `/admin/ajustes` as a two-factor admin: 320, 390 and 1280 px, light and dark,
    six of six at 200 with no overflow; the two new rows looked at on their own at 320 px in both
    schemes. Design review against `apple-web-design`: the same row component and tokens as the
    six limits beside it, nothing new to judge; no P0 or P1. One P2 left as it is because every
    row already has it: «0,18 $» may wrap between the figure and the sign.
  - The probe account deleted and both servers stopped.
- **`migration-reviewer`'s verdict**: **no P0, P1 or P2 — safe to ship.** It read production in
  a read-only session by the repository's rules (`DATABASE_URL_PRO`, host asserted and never
  printed, `pantry_items` required): 8 accounts, **0 rows in `ai_messages` and
  `ai_conversations`**, 69 migrations applied, so `0069` runs next. Rolling the deploy back needs
  no schema change — the old API never names the new column or table. Four P3s:
  1. *Changing the decline list is a constraint change on a populated table* — **done**: the
     comment on `AI_MESSAGE_DECLINES` now says how to add and how to remove a code safely.
  2. *A `(conversation_id, created_at)` index on `ai_messages` is cheapest now, while it is
     empty* — **not taken**: a thread is read by conversation, a few dozen rows at most, and the
     existing `ai_messages_conversation_idx` serves that; if phase 4's measurements say
     otherwise, it is a hand-built release, which is the cost of waiting and is recorded here.
  3. *The plan and `0104` clause 7 named tables that do not exist* — **closed**: phase 3 is
     rewritten as built in the plan, the schema comment no longer cites clause 7 for what it did
     not say, and `docs/decisions/LOG.md` maps clause 7 onto the real tables.
  4. *Retention of the ledger* — **for phase 7**, below.
- **Deviations from plan** (the plan's phase 3 is rewritten as built, in this change):
  - **No new conversation tables.** `ai_conversations` and `ai_messages` were created by the
    workspace's first migration for exactly this, and nothing had ever used them. The plan said
    to create them; the code to read before planning was the schema, and this time it was read
    one phase late.
  - **No `assistant_calls`.** The `ai_call` event phase 1 records is already that row: one per
    call, priced, naming nobody, and what `AI_TEXT_MONTHLY_CAP_USD` already reads.
  - **A ledger the plan did not have, `assistant_usage`**, found by the `marketing` report: a
    count read from the messages a person may delete is a count that deleting refills.
  - **The scope widened to the console and to four fixtures**, for the reason the plan's phase
    3 now gives.
- **Decisions**: a line in `docs/decisions/LOG.md` mapping `0104` clause 7 onto what was built.
- **Notes for phase 4**:
  - Write one `assistant_usage` row for **every** message, cut, refused or withheld — the unit is
    a message sent. Then `assistantStanding(usageSince(userId, madridMidnight(window.since)))`.
  - **The count is read, then written, so two simultaneous sends can both pass with one
    message left.** Acceptable for a cost-bounded allowance; say "about", never "exactly". If it
    must be exact, `DishRequestRepository`'s transaction-scoped advisory lock is the precedent.
  - `ai_messages.content` is `NOT NULL` since `0000`. A declined turn carries its code in
    `decline` and an empty string in `content`, rather than a migration to relax the column.
  - The `assistant` switch's row on `/admin/ajustes` is **phase 7's**, when it is thrown; only its
    name for the settings log exists now.
- **Notes for phase 7, for the `legal` agent**: `assistant_usage` is a store of its own. Deleting a
  message leaves its ledger row **on purpose**, each row names a person with a time and an
  off-topic flag, it is insert-only, and only the current fortnight is ever read. `/privacidad`
  must not suggest that deleting a message deletes everything about it — and pruning rows older
  than the longest window (about fifteen days) is cheap data minimisation the agent may well ask
  for.
- **The owner's decision, left open and his** (`marketing` § "What is not mine to decide"): with
  no checkout, a free account that reaches 20 meets a premium card with nowhere to go. The
  report's option for the friends beta is to raise free to 100 from the console until a checkout
  exists — one click, about 1.50 $ a month across eight accounts.


## Phase 4 — The route (2026-11-09)

- **Executor**: opus @ high, directly; `invariant-reviewer` on the diff.
- **Result**: done.
- **What was built**: `apps/api/src/modules/assistant` — `POST /assistant/messages` streaming
  NDJSON (`conversation`, `text`…, `end {decline}` or `error`), `GET /assistant/standing`,
  `GET /assistant/conversations[/:id]`, `DELETE /assistant/conversations/:id` and
  `DELETE /assistant/messages/:id`, ownership from the session on every one; asking and the
  standing behind `AssistantSwitchGuard` (off: 404, then onboarding), reading and deleting not. `releaseSentences` /
  `flushSentences` in `core/domain/Assistant`; the conversation store and `AssistantController`
  in core; `AssistantUnavailableError` (503 `budget` / `no_model` / `provider`); the assistant's
  row and gauge on `/admin/generacion/ia`; `req.body.message` on pino's redaction list.
- **Evidence**:
  - `assistant.e2e-spec.ts` against the local Postgres — **21 of 21** after the review below:
    switch off is 404 on asking and the standing, for an unfinished account too, while the list
    still reads; no session is 404; of a burst of five at one message left, exactly one 200; a stream with ≥2 text events into an owned thread, the second
    question replaying the first exchange; 422 on an empty or 1001-character message; the
    allowance refusing the next message (429) with a 14-day window and `resetsOn: null` without a
    plan, and the day after `endDate` with one; a clinical question refused with **no** label or
    stream call; an off-topic question cut with nothing written, and past the ceiling **neither
    model asked**; an invented figure withheld with the sentences before it kept, and absent from
    the store; a declared allergen (milk) withheld; a plan-shaped answer cut with no plan
    generated; a second person 404 on read, delete, delete-turn and post-into; deleting a
    conversation leaves the count; deleting a turn leaves the other; deleting the account leaves
    no conversation and no ledger row; past `AI_ASSISTANT_MONTHLY_CAP_USD` a 503 with nothing
    counted, the text gauge unchanged and **a plan still generated**.
  - **Streaming through compression**: one case assembles the app with helmet and
    `compression()` in `CreateApp`'s order, asks for gzip over a real socket and times the
    chunks. A mutation (`Cache-Control: no-store` and `text/plain`) fails it — the body came back
    gzipped — and restoring the headers passes it.
  - `admin.e2e-spec.ts` and `text-cap.e2e-spec.ts` updated for the month's new `assistant` key
    (and the console's key allow-list); both pass. `admin`'s *never name who made a dish* needs an
    AI dish with an author made by an earlier suite: it fails alone on this database and passes in
    sequence — not this change.
  - `assistant-boundary.spec.ts`: the module imports nothing from health, care, the professional,
    the cupboard or the console; nothing under the console (API, core, web) mentions the
    conversation tables or their code. `pino.spec.ts`: every text field of the request schema is
    redacted, and a logged body never carries the question.
  - Core: Admin, Analytics, Assistant controllers/repositories/domain — 300 tests.
  - `/local-probe` on `/admin/generacion/ia` as a two-factor admin, 320/390/1280 px, light and
    dark: all 200, no overflow. The section looked at on its own at 320 px found the variable's
    name pushing its card past the screen edge — **fixed** with `overflow-wrap: anywhere` on the
    page's lines. Design review against `apple-web-design`: the same `Card`, `Gauge` and line
    styles as «Este mes»; no P0 or P1.
- **`invariant-reviewer`'s verdict**: **no P0**; two P1s and five P2s, **fixed in this change**:
  - *P1 — the allowance was read, then written after the label call*, so a burst at one message
    left all passed. Now `AssistantRepository.claimUse` counts and inserts in one transaction
    under `pg_advisory_xact_lock` on the person (the `MailBudgetRepository` precedent), before any
    model is asked; a 404 or a provider failure after it gives the claim back. e2e: five at once,
    one 200 and four 429.
  - *P1 — deleting the first question left its words in the conversation's title.* `deleteTurn`
    now re-titles from the next question, or empties the title, in the same transaction. e2e.
  - *P2 — label calls were logged uncosted* (a direct provider returns no price), so the monthly
    ceiling was a floor. `AiCallSettings.costOf` prices them with `assistantCostUsd`; spec.
    **Still uncosted, and accepted**: an answer cut on a decline is abandoned mid-stream, so its
    tokens never arrive — the console's uncosted count shows how many.
  - *P2 — switch off, an unfinished account got 409, not 404*: the switch guard now runs before
    its own onboarding check. *P2 — the deletes sat behind the switch*: now only asking and the
    standing do. *P2 — `turns` and `appendTurn` took no user id*: both are bounded by the owner
    now. *P2 — stored answers were never screened again*: an answer naming a food the person has
    since declared is shown and replayed as the `allergen` decline. All with e2e cases, plus a
    contained food split across two chunks and a free-text allergy never told to the model.
  - *P3s*: a cut question now carries its decline, so it is never replayed paired with another
    answer; the conversation is opened only after the label, so a provider failure leaves no
    empty thread. **Left**: the 503 while the budget is spent reports to Sentry on every ask, and
    the console's period tiles still include assistant dollars beside a month gauge that does not;
    the off-topic ceiling is read, not claimed, so a burst can pass it by a few — a few labels,
    never an answer.
- **Deviations from plan** (amended in the plan):
  - **The ask flow lives in the API service, not the core controller.** The stream client is the
    API's (`0104`: the model lives behind the AI module's wall), so the orchestration that holds it
    does too; core keeps the stores, the standing and every check.
  - **Order**: allowance (429) and availability/budget (503) come first and store nothing; then
    the thread; then the off-topic ceiling and the clinical lexicon, both before any call. The plan
    put the off-topic ceiling first; neither order asks a model, and this one tells a person over
    their allowance so before anything else.
  - **A label the provider cannot give is a 503 `provider`**, not counted — the message was
    never answered.
  - **The usage row is claimed before the label**, under a lock: a cut counts, an answer counts
    before it is asked for; a 429 or a `budget`/`no_model` 503 counts nothing, and a 404 or a
    `provider` 503 gives its claim back.
  - **`smoke:function` cannot prove the chunks**: through the exported function the route needs a
    session and a model key the script does not have. It now checks the route is mounted and
    denies as 404; the chunk proof moved to the e2e case above, through the same compression.
    **What neither proves** is whether the platform's own layer buffers — that rests on phase 5's
    look on a phone.
  - Sentry needed nothing: `ErrorReporter.ts` already drops every request body.
  - Lists are the newest 50 conversations, not paged; enough for a fortnight's allowance.
- **Notes for phase 5**:
  - The stream's first line is `{type:'conversation', id}`; the last is `end` with `decline` (null
    when the answer finished) or `error`. Declines: `acting`, `allergen`, `clinical`,
    `invented_figure`, `off_topic` — each needs its sentence on the screen.
  - 429 `QUOTA_EXCEEDED` carries `kind: 'assistant_message'` and the reset; 503
    `ASSISTANT_UNAVAILABLE` carries `budget`, `no_model` or `provider` in `message`.
  - A plan-shaped answer is cut on its fifth day name, so up to four day-lines can be shown
    before the cut; the screen should not read as though they were a plan.

## Phase 5 — The screen (2026-11-10)

- **Executor**: opus @ high, directly; the `legal` agent for the warning, the `accessibility` agent for the review.
- **Result**: built; **human-verify pending** (below).
- **What was built**: `/asistente` (a new conversation and the list of earlier ones, newest first) and
  `/asistente/[id]` (one conversation, carried on, deletable whole), both 404 while the switch is off;
  `components/AssistantChat` (the thread, the answer appearing as it is written, a sentence for every
  decline and every refusal, per-message delete with its consequence said first);
  `components/ConversationDelete`; `lib/assistant.ts` (the NDJSON reader and `threadItems`, which puts
  the warning first in every thread); a card on `/inicio` only while the switch is on; the
  professional-supervision notice beside the conversation whenever the profile carries it (PRD 6).
- **The warning**: the `legal` agent's text, **approved by the owner as written on 2026-11-10**
  (`docs/legal/assistant-warning.md` § 1), both languages, with its link to `/privacidad#asistente`
  (the anchor is phase 7's). Drawn as NutrIA's notice — a sunken surface with an edge, not an answer's
  card. `lib/assistant.test.ts` fails if a thread can be drawn without it, or if it is a placeholder.
- **Two P0s the `legal` agent found in phases 2 and 4, fixed here** (owner's choices in
  `docs/decisions/LOG.md`, 2026-11-10): **F1** — the model was told the names of what a person's
  allergies forbid, against the profile consent; `excludedFoods` is gone from the context and the
  prompt (1.1.0), the boundary test fails on any allergy-shaped key, and the e2e asserts the prompt
  never carries the declared allergen. **F2** — a question judged clinical was kept word for word and
  titled its conversation; it is now stored empty with its code, and the screen says it was not kept.
  The switch was never on: neither left the building.
- **Evidence**:
  - `assistant.e2e-spec.ts`: 21 of 21 (with F1 and F2 asserted). Core: 152 assistant tests. Web: 307
    tests, `tsc`, lint.
  - `/local-probe` on `/asistente`, `/inicio` and an unknown thread at 320/390/1280, light and dark,
    with the switch turned on **locally** through the admin API and off again: all fit, no `hint:`. The
    screenshots looked at: the warning first, the field labelled, the empty state, the card on
    `/inicio`. A question sent in both languages shows the 503 sentence (no model key locally) and
    keeps the question in the field. An unknown thread renders the 404 page.
  - **Design review** (`apple-web-design`): **PASS** — no P0 or P1; fixed: the focus lost when the
    send button disabled itself, the warning styled like an answer, a negative-margin header.
  - **`accessibility` agent**: two P1s and four P2s, **all fixed**: focus thrown to the heading when
    the address changed mid-answer (the address no longer changes; a reload finds the thread in the
    list); focus lost when a delete confirmation opened or closed (it now moves into it and back);
    a dimmed focus ring on the not-pressable button; controls truly disabled mid-answer when the last
    message was spent; two errors not announced; identical delete names. P3s fixed: typing during an
    answer is no longer wiped, a repeated status is announced again, the title breaks between words.
- **Not seen locally, and why**: a streaming answer, a stored thread and its delete controls — the
  local API has no model key, so no answer and no stored turn can be made by hand without writing a
  row, which this repository does not do. The e2e suite and the accessibility agent's mocked stream
  covered them. **Whether the platform buffers the stream** is the human-verify below.
- **Deviations from plan** (amended in the plan):
  - **No `/en/asistente`.** Signed-in screens keep their Spanish address in every language and take
    the language from the profile's cookie (`(app)/layout.tsx`); English is checked at `/asistente`
    with the English cookie.
  - **The address does not change to the thread's after the first answer** (focus, above).
  - **Turns written in this visit have no delete button until the page is read again**: their ids come
    from the server, and the stream does not carry them.
- **human-verify (pending)**: the owner opens `/asistente` on his iPhone and says whether the words
  arrive as they are written. **It needs the switch on in production, and the switch must not be on
  for anybody before phase 7's `/privacidad`.** The switch has one audience (every signed-in account),
  so this waits for the owner's decision — see the report of this phase.

## Phase 7 — The legal text, then the switch (2026-11-10)

- **Executor**: opus @ high, directly; the `legal` agent for `docs/legal/` and the texts.
- **Result**: the pages and the retention are built and go out in this change; **owner-gated**
  past it (below).
- **The order the owner chose** (2026-11-10, with options): phase 7 before phase 5's iPhone look,
  because that look needs the switch on, and the switch is one audience — every signed-in account —
  that must not see the assistant before `/privacidad` tells them about it. Phases 5 and 7 close
  together on that look.
- **What was built**:
  - **Retention** (the owner's six months; the `legal` agent's F3): `AssistantController.forget` —
    conversations whose `updated_at` (the last added turn) is more than six calendar months old,
    cascading to their turns, and `assistant_usage` rows past 60 days — in the daily
    `/cron/sweep-verifications` (08:05 UTC) through `AssistantRetentionService`, switch on or off.
    The plan's scope listed no backend for this phase; the retention is where the legal ruling
    becomes true, so it is here (amended).
  - **F5** (the `legal` agent, mid-phase): the goal and the way of eating are health data under the
    policy, consented to "only" for targets and dishes; the assistant no longer sends either
    (prompt 1.2.0). Owner's choice, `docs/decisions/LOG.md`.
  - **`/privacidad`** gains «El asistente» (`#asistente`, where the warning's link already points)
    and twelve changes (R1–R12); **`/condiciones`** five (T1–T5), `TERMS_VERSION` 2.2.0 with
    `terms.updated`; both dated 10 November 2026. Texts verbatim from
    `docs/legal/assistant-privacy.md`, approved by the owner the same day. **`PRODUCT.md`** gains the
    sentence on what a person types (plan step 3).
  - `docs/legal/` (the `legal` agent): `assistant-privacy.md`, and `analysis.md`,
    `record-of-processing.md`, `dpia.md`, `go-live-checklist.md`, `textos/02`, `03`, `06` updated.
- **Evidence**: `assistant.e2e-spec.ts` 22/22 (the retention against real Postgres: a conversation
  aged seven months and a count row aged 61 days go, the newer ones stay); the cron spec 38/38;
  core assistant controller and repository 28; web legal tests 23; `pnpm ts:check`.
- **Owner-gated, in this order** (the go-live checklist § 0 undecies):
  1. The pages are live (this change deployed).
  2. **The owner sends the notice mail** (`docs/legal/textos/06-correos.md` § Q) to every account.
  3. **No earlier than the next day, the owner throws the `assistant` switch** in `/admin/ajustes`.
  4. **human-verify** (phases 5 and 7): his own first conversation on his iPhone — whether the words
     arrive as they are written — recorded here as "confirmed by human on <date>".
  5. `docs/decisions/LOG.md` gains the dated line: live, on which model, under which ceiling.
- **Rides the lawyer's hour**: `docs/legal/assistant-warning.md` § 4 item 17 (a)–(g) and
  `docs/legal/assistant-privacy.md` § 9 (h)–(n). **After the switch, P2**: a way to answer a
  portability request for conversations without anybody reading them.

## The screen, reshaped as a chat app (2026-11-10)

- **Why**: the owner, after the first look: *«No me gusta la ux/ui. Quiero que sea un nuevo apartado
  en el menú, y el chat lo quiero como claude… Ahora los mensajes bajan todo el rato, junto con la
  caja de texto; y no se vacía.»*
- **What changed**: «Asistente» is a destination in the menu (desktop header and bottom bar), only
  while the switch is on (`GET /settings` in the signed-in layout); the `/inicio` card is gone. The
  conversation has the screen to itself: the history in a side column on a wide screen and in a sheet
  on a narrow one, with «Nueva»; the person's words in a bubble at the end of the line, the answers as
  plain text across the column; the box stuck to the foot of the screen, above the bottom bar and
  right above the keyboard once focused, growing with what is typed, **emptied the moment a question
  is sent** and refilled only if it never left; Enter sends, Shift+Enter starts a line; the end of the
  answer stays in view unless the person scrolled up. After a new conversation's first answer — never
  in the middle of one — the address becomes the thread's and the history gains it.
- **Checked**: `/local-probe` at 320/390/1280, light and dark, on `/asistente`, a thread, `/inicio`
  and `/plan` (the six-item bottom bar): all fit; one hint judged and fixed (the field under 44 px on
  touch). A two-turn thread was made on the local database through `AssistantController` for a
  `@probe.invalid` account (deleted after), and a further question sent with the stream simulated in
  the browser: the box empties, focus stays in it, the composer sits at the foot. Web: lint, types,
  307 tests.
- **Second pass, the same day** (the owner, from his phone: *«estaría guay que interpretara los
  asteriscos, que sea markdown, y que interprete fallos ortográficos… el error tiene que salir en
  mensaje normal, explicando el fallo y por qué no puede contestar»*, and *«no me gusta el focus
  del cuadro de texto»*): answers are drawn as a small Markdown (`lib/markdown.ts` — paragraphs,
  lists, bold lines for headings, bold, italic, code; built as elements, never HTML; tested); a
  decline and every failure are said as the assistant's own plain message, each saying what failed,
  that it did not count, and what to do (provider, no model, monthly ceiling, connection); the label
  and the answer prompts read typos as meant (`LABEL_SYSTEM_PROMPT` with two typed-on-a-phone
  examples; `ASSISTANT_PROMPT_VERSION` 1.3.0, which also allows that Markdown); the box's focus is
  its edge in the brand's colour with a soft halo, not a second ring. Looked at in a real browser at
  390, light and dark, with a simulated Markdown answer and a simulated provider failure.

## 2026-11-11 — The assistant's failures say why

- **Why**: the owner's iPhone hit five failures in a row at 07:02; production's `ai_call` rows said `ok: false`, no status, 1.3 s — and nothing more, because the failed row never carried the kind of failure the client already knew. The owner asked for a log table; a table holding the question or the answer would contradict `/privacidad` as published, so the existing row carries the reason instead.
- **What**: a failed `ai_call` now records `failure` (`provider` / `invalid_output` / `timeout` / `abandoned`), `errorType` (the provider's own code, e.g. `overloaded_error`, read by `providerErrorType` — never its message) and `finishReason`. `/admin/generacion/ia` lists the assistant's latest 10 failures (when, step, model, reason). The label step's warning log names the failure kind and status.
- **Checked**: core and API specs; local probe of `/admin/generacion/ia` with three seeded local rows (removed after).

## 2026-11-11 — The label step has room to finish

- **Why**: the owner asked «quiero comer gato asado» at 09:14 and the console's new failure list said: label step, `claude-haiku-5-5`, cut off at the length limit. The label's cap was 120 output tokens; the model ran past it on a provocative question.
- **What**: `LABEL_OUTPUT_TOKENS` 120 → 400 (under 0.0002 $ at Haiku's price); the label prompt asks for a reason of at most ten words, nothing before or after, and not to argue with a shocking question; `ASSISTANT_PROMPT_VERSION` 1.3.1.
