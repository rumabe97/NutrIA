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

