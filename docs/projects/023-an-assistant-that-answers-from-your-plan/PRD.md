# PRD — Project 023: An assistant that answers from your plan

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's decisions of 2026-11-09 — approved by the owner before
> the plan is written. Repo-relative: no absolute paths, no other repositories.

- **Status**: approved
- **Roadmap item**: [`docs/ROADMAP.md`](../../ROADMAP.md) § "Last, and deliberately so" —
  **The assistant**. It is also the one line of [`docs/PRODUCT.md`](../../PRODUCT.md) § Scope
  that v1 promises and has never had: *"A nutrition-only AI assistant with access to the
  user's own plan."*

## Problem

A person gets fourteen days of food and no way to ask about them. Every question the product
provokes — *why is there so much lunch*, *can I swap this for what I have*, *is this enough
protein for the gym*, *why does it keep giving me lentils* — has to be answered by reading a
screen that was not built to answer it, or not at all. The product's own § Experience
principles promise an explanation at the point of doubt; today the only thing that explains a
plan is the plan.

It has been last on the roadmap for one reason, written there: every message is a model call
against **the same free daily allowance plan generation needs**, and unlike a generation — one
call a fortnight per person — a conversation has no ceiling. Shipping it meant choosing
between answering a question and building a plan.

That reason is now gone, and only that one. The owner's Claude subscription carries **API
credits of its own, about 100 € a month, that expire at the end of each billing cycle**: a
recurring budget, not a reserve, on a provider this workspace already knows how to speak to —
`@ai-sdk/anthropic` is a dependency and `ai.config.ts` has an `anthropic` branch. It knows how
to speak to it **instead of** the plan's provider, though, never beside it: `AI_PROVIDER` picks
one, and production picks `openrouter` ([`0064`](../../decisions/0064-generation-runs-on-paid-no-training-models-through-openrouter.md)). The
assistant therefore builds its own Anthropic client from `ANTHROPIC_API_KEY` and leaves
generation's provider alone — two providers at once, on purpose, which is also what keeps the
two budgets apart.

What has **not** gone away is the hard half, also written on that roadmap line: what it
refuses to answer and how that refusal is enforced in code rather than asked for in a prompt
([`0004`](../../decisions/0004-deterministic-safety-layer.md)), and what it is allowed to
read, given that most of what it could usefully know about somebody is health data.

Evidence that the hard half is real, from the gateway probe of 2026-09-12 recorded on the same
roadmap line: both free models refused almonds to a tree-nut allergy and refused to dose
insulin, and one of them **invented a per-meal carbohydrate split inside the insulin answer** —
exactly the figure a diabetic would dose from.

## Outcome

When this ships:

- A signed-in person can ask about their own plan and their own food, in their account's
  language, on a screen of its own, and get an answer that arrives visibly rather than after a
  silence. The conversation opens with the warning about what it is — written by the `legal`
  agent — before anybody has typed anything.
- **It answers about nutrition and nothing else.** Recipes, ingredients, macros, a doubt about a
  dish, an idea for a meal, a recommendation, what to change and why: those are its subject, the
  same subject as the rest of the application. Anything outside it is **cut immediately** — no
  answer is written, no stream is started — and the cut is a branch in the code rather than a
  hope about the prose. Somebody who keeps trying runs out of tries: checking costs a call, so
  the checking has its own small ceiling.
- **A conversation can be reread and carried on.** The thread is kept, it belongs to one person,
  that person can delete any of it whenever they like, and all of it goes when the account
  goes.
- Every number in that answer was computed by this service. The model is never the source of a
  figure about somebody's plan, and a question that asks for one gets the service's arithmetic
  or nothing.
- The assistant knows exactly what the plan generator already knows about a person, and
  nothing more. The mechanical wall around the AI module
  (`apps/api/src/modules/ai/health-boundary.spec.ts`) passes **unchanged**, with no new
  exception, and covers the assistant too.
- A question that belongs to a clinician — a dose, a medication, one of the clinical situations
  § Users excludes from v1 — does not reach the model at all. It is answered with the
  product's own professional-review notice.
- The assistant cannot take the plan's budget. It spends under a ceiling of its own, with a
  per-person fortnightly allowance, and `/admin` shows its spend on its own row beside the
  others.
- What was typed is kept for the person who typed it, and for nobody else: not the console, not
  a log, not an error report, not the owner. What the month's spend is counted from carries
  counts and cost and **names nobody**, so deleting an account can take every word without
  changing what was billed.
- `/privacidad` says, before any of this is reachable, that free text goes to a model, which
  one, and what is kept.

## Scope

**In:**

- One screen, in Spanish and English, reachable by a signed-in person, that takes a question
  and shows an answer as it is written.
- **Ideas, a recommendation and a recipe on request** — it may say what to eat, suggest a dish
  and write out a recipe with its ingredients and quantities, because that is a question about
  food and it is words. What it may not do is **make** anything: no plan, no swap, no change to
  a day, not even staged for confirmation.
- **A topic gate that cuts rather than argues**: the question is labelled before anything is
  written, and anything that is not nutrition or dietetics gets one sentence saying what this is
  for — no answer, no stream, no negotiation. With a ceiling on the cutting itself, because each
  check is a call: past it, the assistant stops answering for that person's fortnight.
- **A history**: conversations listed, rereadable and continuable, each one owned by the person
  who had it, deletable by them message by message or whole, and gone with the account.
- **The opening warning**: the first thing in the conversation, every conversation, saying it is
  an AI, what that means for what it says, that it is not a clinical consultation, and — now that
  the thread is kept — **that clinical details should not be typed into it**. In the words the
  `legal` agent gives, not the planner's.
- The person's own context, and only what the plan generator already receives: preferences,
  cuisines, dietary pattern, cooking time, what they avoid — the shape
  `apps/api/src/modules/ai/prompts/PoolPrompt.ts` is handed today — plus the rows of their
  active plan as the service computes them (day totals, targets, the plan's own meals).
- A deterministic refusal, before the model call, for doses, medications and the clinical
  situations § Users puts outside v1.
- A deterministic net over what comes back, for a food linked to a declared allergen.
- Its own `AiFeature`, its own monthly spend ceiling, its own per-person fortnightly allowance,
  and
  its own row in the console's spend screen.
- A model chosen by measurement and changeable by configuration — `claude-haiku-5-5` to begin
  with, `AI_ASSISTANT_MODEL` to move.
- The legal text the new data flow requires, drafted by the `legal` agent and approved by the
  owner before the screen is reachable.

**Out, deliberately:**

- **Acting, and generating.** It does not change a plan, swap a meal, fix a day or stage a
  change for confirmation, and it does not generate a plan — not even when asked for one
  directly, where it says so and points at the generator. The line is *words against state*: a
  recipe written in an answer is words; the same dish entering somebody's Thursday is state, and
  state belongs to the routes that validate it. Acting needs tool use behind the swap route's
  validators, and it is its own project.
- **Anything that is not nutrition.** Not a general assistant, not a search engine, not company.
  A question about the weather, about code, about the news or about the person's day is declined,
  whatever it would cost to answer it.
- **Health data.** Conditions, medications, supplements, the cupboard, the professional's side
  of a link. Letting the assistant see any of it breaks a mechanical test by design and needs a
  record that supersedes part of `0004`; the owner declined it for this version on 2026-11-09.
- **Anybody but the person reading their conversation.** Not the console, not the owner, not a
  professional through a link, not an export. `0068` built a console that reads nobody and this
  does not become its exception; a question about somebody's conversation is answered by asking
  them.
- **Being a dietitian.** No diagnosis, no treatment, no dosing, no clinical nutrition. The
  product's answer to those is a professional, and that is unchanged.
- **Voice, images, a food photo.** Text in, text out.

## Acceptance criteria

1. **It answers, and it opens by saying what it is.** A signed-in person on `/asistente` (and
   `/en/asistente` at parity) finds the warning already in the conversation, types a question,
   and the answer appears progressively; the screen says it is being written while it is, and
   says what happened when it fails. Verified by an end-to-end suite against a stubbed model and
   by a look in a real browser at 320, 390 and 1280 px, light and dark, both languages.
2. **It answers about nutrition and cuts everything else immediately.** Every question is
   labelled before anything is written — on topic, clinical, or outside the subject — and the
   route **branches on the label**. On anything but `nutrition` **no stream is ever started**: the
   person gets one sentence saying what the assistant is for, and the model is never asked to
   compose a reply. A question about the weather, about code or about the person's day gets that
   same cut whatever the model would have said, proven with the model stubbed to a helpful
   off-topic answer that must not reach the screen. The label is the one thing in this feature a
   model decides, and it may: being wrong costs a cut question, never a person's health, which is
   the test [`0004`](../../decisions/0004-deterministic-safety-layer.md) sets — *the boundary is
   drawn by consequence, not by capability*.
3. **Checking has its own ceiling.** A label costs a call, so somebody who is not here about food
   cannot spend the service's money finding that out over and over. Off-topic cuts are counted
   per person per fortnight against a small ceiling of their own, and past it the route answers
   with the same sentence **without labelling anything at all** — no call, no spend — for the
   rest of that fortnight. The number is admin-overridable like every other limit, and a test
   proves the (n+1)th off-topic message makes no provider call.
4. **No nutritional figure in an answer is the model's.** The service computes the figures a
   question needs — the day's targets and totals, a meal's macros, the meal shape — and hands that
   **set** to the model, so it can say *"tu jueves son 2.079 kcal"* in its own words. What the
   answer may not contain is a **nutritional figure** — an amount of energy, an amount of a
   macronutrient, or a percentage of either — that is not in the set it was given (within the
   product's own ±5 %), and an answer carrying one of the model's own invention is withheld. A
   recipe's quantities (`200 g de arroz`, `2 huevos`) are not nutritional figures and are not
   checked; the same recipe claiming `45 g de hidratos` is. A nutritional figure written in words
   (`unas dos mil calorías`) cannot be checked and is withheld. *Amended 2026-11-09 by
   [`0105`](../../decisions/0105-only-a-nutritional-figure-has-to-be-the-services.md): the first
   version checked every number, which contradicted this PRD's own promise of recipes with their
   quantities.* Proven with the model stubbed to answer with a plausible wrong figure — which must
   not reach the screen — and with a stub that quotes the supplied figures, which must.
5. **The wall holds.** `health-boundary.spec.ts` passes with no row added to its exception
   lists, and its checks extend over the assistant's own sources: the assistant's module
   imports nothing from `Health`, `Care`, `Professional`, `Pantry`, `Admin`, their
   repositories, or the `care`, `health-data` and `owner-alerts` modules.
6. **The obvious clinical question never costs a call, and none of them gets an answer.** Three
   layers, and only the first is spelling:
   - A question whose text matches the clinical lexicon — a dose, a unit of medication, insulin,
     pregnancy, an eating disorder, a child's feeding — is refused **before** any call, with the
     professional-review notice the product already uses. A test proves it with the model
     stubbed to a compliant answer, so a pass cannot come from the model behaving. This is a
     pre-screen that saves the money and catches the obvious; a paraphrase passes it, and the
     PRD says so rather than implying a wall.
   - What catches the paraphrase is criterion 2's label: `clinical` is one of its three values,
     and the route cuts on it exactly as it cuts an off-topic question.
   - And what catches what both miss is criterion 4: an answer of that kind needs a figure
     nobody supplied, so it is withheld.
7. **A net on the way out, and it now carries weight.** An answer naming a food linked to one of
   that person's declared allergens or intolerances is withheld and replaced by a message that
   says so. This matters more here than anywhere else in the product: the assistant **proposes
   food** — an idea, a dish, a recipe on request — so for the first time a model's own words can
   put a food in front of somebody. Its limits are recorded rather than hidden: it matches on
   names, where `findSafetyViolations` matches ids against a structured catalogue and depends on
   no spelling. It is a net, and the plan builds it as one.
8. **It cannot starve the plan.** The assistant records `ai_call` events under a feature of its
   own and spends against `AI_ASSISTANT_MONTHLY_CAP_USD`, separate from
   `AI_TEXT_MONTHLY_CAP_USD`. A test proves plan generation and the nightly rewrite are
   unaffected when the assistant's ceiling is exhausted, and the console's spend screen shows
   the assistant's own row against its own cap.
9. **A person has a fortnightly allowance, and premium's is bigger.** Messages per person per
   **fortnight** — the product's fortnight, the span of the plan in progress, counted the way
   `planRedosPerFortnight` already counts one, with the last fourteen days as the window for
   somebody who has no plan running. The numbers are `assistantMessagesPerFortnight` in
   `Allowance.ts`, free and premium, priced by the `marketing` agent, admin-overridable like
   every other allowance, and counted from the messages the person actually sent. A test asserts
   premium's is never the smaller.
10. **The conversation is kept, and it belongs to one person.** Threads are listed newest first,
    rereadable, and can be carried on; the model is replayed a bounded window of the thread it is
    continuing, not the whole of it. The person can delete one message or a whole conversation at
    any time, and deleting the account deletes every word. Ownership is by session, like
    everything else in this product: another signed-in person asking for that conversation gets a
    **404**, not a 403, and an e2e case proves it.
11. **What was typed reaches nobody else — not even the owner.** No console screen, no admin
    route, no export and no professional link reads a conversation; `0068`'s console-reads-nobody
    rule gains no exception. The request body is excluded from the request log
    (`REDACTED_PATHS`) and from the error reporter's context, with a test asserting the paths are
    listed. And what the month's spend is counted from is a separate per-call row that **names
    nobody**, exactly as `recipe_image_calls` does, so deleting an account can take every word
    without changing what was billed.
12. **The warning is the `legal` agent's text, it cannot be skipped, and it says what not to
    type.** The first thing in every conversation, in both languages, before any input is
    accepted: that it is an AI, what that means for the reliability of what it says, that it does
    not replace a professional, and — because the thread is now kept — that clinical details
    should not be written into it. The owner approves the wording. A test asserts a conversation
    cannot be started without it and that it is not something a person dismisses once and never
    sees again.
13. **The record is honest before it is reachable.** `/privacidad` (and `/condiciones` if it
    touches them) say that what somebody types is sent to a model, name the processor, say that
    conversations are stored, for how long, who can read them and how to delete them — drafted by
    the `legal` agent, approved by the owner, shipped in or before the change that makes the
    screen reachable. `PRODUCT.md`'s health-data paragraph gains the sentence this project makes
    necessary: that its promise about conditions never reaching a prompt is about what the
    product *records*, and that free text somebody types themselves is governed by the warning
    instead.
14. **The model is chosen by measurement.** The same ten hard questions — insulin, a dose, macros
    per meal, a declared allergen, a clinical situation, an off-topic one, and the rest ordinary
    — are put to `claude-haiku-5-5`, `claude-sonnet-5-5` and `claude-opus-5-5`, and the
    comparison is recorded. `AI_ASSISTANT_MODEL` is set from what it shows, and moving it later
    is a variable on Vercel, not a change of code.

## Open questions

For the owner, before the plan is approved:

- **The fortnightly allowance's two numbers.** Settled in shape by the owner on 2026-11-09 —
  per fortnight, and premium's larger — so what is left is the `marketing` agent's to price
  against criterion 8, with the standing rule that it prices a tier limit before it is built.
  One thing for it to weigh: a question costs well under a cent to serve, so these numbers are
  not protecting a budget, they are deciding what premium is worth.
- **How long a conversation is kept, and whether the `legal` agent will allow "until the person
  deletes it".** The planner's assumption, stated so it can be overruled: kept indefinitely like
  plan history, which `PRODUCT.md` § Scope already promises is "kept forever and never
  overwritten", and deleted on demand or with the account. The `legal` agent may impose a cap in
  phase 6 — free text about food can carry a condition somebody volunteered, and a shorter
  retention is the cheapest answer to that if it wants one.
- **Whether the plan's own generation should move to this provider too.** Not this project, but
  the credits expire monthly and generation currently spends OpenRouter's free tier: a line for
  the roadmap, not a phase here.
