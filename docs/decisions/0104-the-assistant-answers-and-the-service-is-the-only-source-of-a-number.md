# 0104 — The assistant answers, and the service is the only source of a number

> **Purpose**: one decision record (ADR). Captures the WHY that chat sessions lose.
> **Audience**: future agents and humans. **Committed**: yes. **Maintained by**: agents
> draft one immediately after any decision that constrains future work. ADRs are
> immutable: a changed decision is a NEW record that supersedes the old one.

- **Status**: accepted — clause 4's **scope** superseded by [`0105`](./0105-only-a-nutritional-figure-has-to-be-the-services.md): only a nutritional figure is checked, so a recipe's quantities are not
- **Date**: 2026-11-09
- **Project**: docs/projects/023-an-assistant-that-answers-from-your-plan

## Context

`PRODUCT.md` § Scope has promised since v1 "a nutrition-only AI assistant with access to the
user's own plan", and `ROADMAP.md` has kept it last on purpose, for a reason that was about
money: every message is a model call against the same free daily allowance plan generation
needs, and a conversation has no ceiling where a plan is one call a fortnight. Shipping it meant
choosing between answering a question and building a plan.

That constraint lifted on 2026-11-09: the owner's Claude subscription carries API credits of its
own — about 100 € a cycle, **expiring at the end of each cycle** — on a provider this workspace
is already wired for. The assistant can pay from a different pocket.

What did not lift is the half the roadmap called harder than the plumbing: what it refuses to
answer and how that refusal is enforced in code rather than asked for in a prompt
([`0004`](./0004-deterministic-safety-layer.md)), and what it may read, given that most of what
it could usefully know about somebody is health data.

There is evidence, not a hunch. The gateway probe of 2026-09-12 put a short assistant prompt and
five questions to two free models: both refused almonds to a tree-nut allergy and both refused
to dose insulin, and one of them **invented a per-meal carbohydrate split inside the insulin
answer** — the exact figure a diabetic would dose from. The failure mode is not "the model says
no when it should say yes". It is "the model produces a plausible number nobody computed".

## Decision

Eight things, together:

1. **The assistant is answer-only — words against state.** It may say what to eat: an idea, a
   recommendation, a dish, a full recipe with its quantities when somebody asks for one. Those
   are words. It does not change a plan, swap a meal, fix a day, stage a change for a person to
   confirm, or generate a fortnight — not even asked directly, where it says so and points at
   the generator. Those are state, and state stays with the routes that validate it. Acting
   needs tool use behind the swap route's validators and is a separate project with its own
   record.
2. **Its subject is nutrition, and the subject is a branch in the code.** Every question is
   labelled before it is answered — `nutrition`, `clinical` or `off_topic` — by a cheap
   structured call, and the route acts on the **label**, not on whether the prose happens to
   refuse. Anything outside nutrition and dietetics is **cut immediately**: one sentence saying
   what the assistant is for, and the model is never asked to compose a reply — no stream is
   started. And the checking has a ceiling of its own, because a label is cheap and not free:
   past a small number of off-topic cuts in a fortnight, the route answers that same sentence
   **without labelling anything at all**, so somebody who is not here about food cannot spend the
   service's money finding that out over and over.
   **This is the one thing in this feature a model decides, and `0004` permits it**: that record
   draws the line by *consequence, not capability*, and a mislabelled question costs a declined
   question — never somebody's health. The clinical lexicon still runs **before** the label,
   because refusing a dose on spelling costs nothing and a label costs a call.
3. **It reads what the plan generator reads, and nothing more.** The shape
   `apps/api/src/modules/ai/prompts/PoolPrompt.ts` already receives, plus the active plan's rows
   as the service computes them. The mechanical wall — `health-boundary.spec.ts`, which fails
   the moment a source under the AI module so much as *imports* `Health`, `Care`,
   `Professional`, `Pantry` or `Admin` — is extended over the assistant's own sources and gains
   **no exception row**. Health data in the assistant is a future decision that supersedes part
   of `0004`; it is not this one.
4. **The service computes every figure, hands the set to the model, and checks what comes
   back.** Before the call, the service derives the numbers a question could need. After the
   call, every number in the answer is extracted and checked for membership in that set; an
   answer carrying a figure the service did not supply is withheld, not corrected. The model
   chooses words; it never chooses a value. This is `0004`'s boundary — *decided by consequence,
   not by capability* — applied to prose.
5. **Two deterministic screens, and their weakness is written down.** A lexicon pre-screen on
   the question refuses a dose, a medication or one of the clinical situations `PRODUCT.md`
   § Users excludes, **before** the call, so it also saves the money. An allergen net on the
   answer withholds a message naming a food linked to that person's declared allergens. Both
   match on **names**, so neither is as strong as `findSafetyViolations`, which matches
   **ids** against a structured catalogue and therefore depends on no spelling. They are nets
   under a trapeze, not the trapeze: a paraphrase passes the first, a synonym nobody listed
   passes the second. What carries the paraphrase is the label (2), the fact that the assistant
   can state no figure of its own (4), and the professional-review notice sitting beside the
   conversation whenever the profile carries it.
   **The allergen net carries more weight here than anywhere else in this product, because the
   assistant proposes food.** Everywhere else a model's suggestion becomes a plate only after
   `findSafetyViolations` has compared ids; here its words reach a person directly. That is the
   single most load-bearing weakness in this design, and it is written down rather than implied:
   a hit withholds the whole answer, and nothing stronger stands behind it.
6. **Its own money and its own allowance.** A new `AiFeature`, `'assistant'`; a ceiling of its
   own, `AI_ASSISTANT_MONTHLY_CAP_USD`, separate from `AI_TEXT_MONTHLY_CAP_USD`; and a
   per-person **fortnightly** allowance in `Allowance.ts` — `assistantMessagesPerFortnight`,
   premium's larger than free's, over the product's own fortnight (the span of the plan in
   progress, counted as `planRedosPerFortnight` already counts one, falling back to the last
   fourteen days for somebody with no plan running) — counted from rows the service wrote. The
   roadmap's original fear — chat eating the plan's budget — returns as a *shared ceiling* if
   these are not separate, so they are separate, and a test proves generation still works when
   the assistant's ceiling is spent.
7. **The conversation is kept, it belongs to one person, and the money is counted somewhere
   that names nobody.** Two stores with one job each: the thread
   (`assistant_conversations` + `assistant_messages`, cascading from the account) is the
   person's, rereadable, continuable and deletable by them message by message or whole; the
   billing row (`assistant_calls`, shaped exactly like `recipe_image_calls`) **names nobody**. The
   split is what lets account deletion take **every word** while the month's billed spend stays
   true — one store could not do both.
   Because the server owns the thread, the client sends a conversation id and one message rather
   than a history of its own, which retires the forged-history problem instead of defending
   against it. Only a bounded window of a thread is replayed to the model.
   **Nothing of a conversation reaches anybody but its owner**: not a log line, not the error
   reporter, not a console screen, not an export, not a professional through a link. `0068`'s
   console-reads-nobody rule gains no exception, and ownership is by session, so another person
   asking for a thread gets a 404.
   **This reverses what this record said in its first draft**, which was that nothing typed
   would be stored at all — the shortest, most defensible privacy sentence available. The owner
   asked for a history on 2026-11-09. It is the right product call and it is not free: see the
   consequences.
8. **Every conversation opens with the warning, and the warning is the `legal` agent's text.**
   Not a banner somebody dismisses once: the first message in the thread, every time it is
   opened, in both languages, saying it is an AI, what that means for what it says, and that it
   does not replace a professional. The owner approves the wording; neither the planner nor the
   frontend writes it.

The model is `claude-haiku-5-5` **to begin with**, on the owner's choice of 2026-11-09 with the
three tiers' monthly costs in front of him. Project 023 phase 5 measures it against
`claude-sonnet-5-5` and `claude-opus-5-5` on the same ten questions, and `AI_ASSISTANT_MODEL`
follows what that shows — a variable on Vercel, not a deploy. The assistant builds **its own**
Anthropic client rather than riding `AI_PROVIDER`, which names one provider and names
`openrouter` in production: two providers at once is deliberate, and it is the same fact that
keeps the two budgets apart.

## Alternatives considered

- **The model never sees a figure**, and the screen renders a block of numbers the service
  computed beside the model's prose. Rejected by the owner on 2026-11-09: it cannot be wrong, and
  it cannot answer *"why is there so much lunch"* either — the answers read like a leaflet with a
  table stapled to it. The membership check keeps the same guarantee with the prose intact.
- **"No figure in an answer comes from the model", enforced by stripping numbers.** Rejected
  while planning, because it is unbuildable: filtering *any* number out of free text leaves
  either no digits — useless — or pattern-matching, which is the weak net clause 4 already admits
  being. The first draft of this project's PRD promised exactly that and was corrected before it
  was approved.
- **A model-based classifier for the clinical refusal.** Rejected as the *primary* mechanism: it
  makes a model the decider of something with a physical consequence, which is what `0004`
  forbids. It survives as the **second** layer behind the deterministic lexicon, which is where
  clause 2's label puts it — the lexicon refuses what spelling can catch, the label catches the
  paraphrase, and the figure check catches what both miss.
- **A deterministic topic gate** — a nutrition lexicon the question must match to be answered.
  Rejected: it is the clinical lexicon's weakness mirrored, and worse. A lexicon that *refuses*
  on a hit fails open, which is survivable; one that *admits* on a hit fails closed, so every
  ordinary question phrased in words nobody listed — *«¿me cunde congelar esto?»* — is declined,
  and the feature reads as broken rather than as careful.
- **Letting the assistant act, or generate a fortnight, since it already holds the context.**
  Rejected by the owner on 2026-11-09: what makes a plan safe is the scheduler, the validators
  and the allergy gate, and a conversation that wrote state would have to re-earn all three. A
  recipe inside an answer is the cheap most of that value with none of the risk.
- **Letting the assistant read conditions and medications under a consent.** Rejected for this
  version by the owner: it breaks a mechanical test by design and needs its own legal basis. The
  assistant is more useful with it, which is why it is a project and not a quiet widening.
- **Keeping generation and the assistant on one provider and one budget.** Rejected: one shared
  ceiling is the roadmap's original problem in a new currency.
- **Not storing the conversation at all** — the browser keeps it, the server keeps counts. This
  was the decision in this record's first draft, and the owner overruled it the same day. What it
  bought was the shortest privacy sentence this product could have: *what you type is not stored*.
  What it cost was a chat nobody can reread, continue tomorrow or open on another device, which
  is most of what makes a conversation worth having. Overruled knowingly, with the cost written
  into the consequences below rather than discovered later.
- **A nutrition lexicon as the gate** (the mirror of the clinical one) — see the entry above on
  the deterministic topic gate: a screen that *admits* on a hit fails closed.
- **Letting the console read conversations**, for support or for curiosity. Never considered
  seriously, and recorded here so nobody considers it later: `0068` built a console that reads
  nobody, and the first exception is the one that ends that property.

## Consequences

**Easier.** The console's existing spend machinery shows the assistant on its own row with no
new repository. A per-call cost table read as the month's truth is a pattern this workspace
already runs (`recipe_image_calls`). The provider is already wired, so no new SDK and no new
secret shape. And `/privacidad` has a short true thing to say — *what you type is sent to a
model to answer you and is not stored here* — rather than a long hedge about a transcript.

**Harder.** Every message now costs two calls — the label and the answer — still under a tenth
of a cent on `claude-haiku-5-5`, but twice the latency floor, so the label's prompt has to stay
short. Every answer passes two screens and a membership check before a person sees it,
so a withheld answer is a real failure mode the screen must explain, and the model comparison in
project 023 phase 5 is decided by *how often each model's answers get withheld* rather than by
how good they read. `figuresAreAllSupplied` needs real tolerance work — a rounded figure is a
member, an invented one is not — and it is the piece most likely to be too strict in practice.

**And harder in a way that is worth naming on its own: the history changed this project's legal
footprint.** A store of free text that people write about their own food will, sooner or later,
contain a condition somebody volunteered — *«soy celíaco»* typed into a chat is not a row behind a
consent, it is a sentence in a thread. That does not break the wall in clause 3, which is about
what the *code* can reach, and the module still imports nothing from `Health`. What it does is
make the opening warning (clause 8) carry a second job — **say that clinical details should not be
typed here** — and it puts retention, deletion and the policy's wording on the lawyer's hour that
was already pending. The planner's assumption, for the `legal` agent to confirm or cap: kept until
the person deletes it, as `PRODUCT.md` already promises for plan history, and gone with the
account. `PRODUCT.md`'s own paragraph needs a sentence too, or a true promise — that recorded
conditions never reach a prompt — starts reading like a false one.

**Committed to.** A monthly ceiling that must be watched, because the credit funding it expires
unspent and the product has no billing to fall back on. A fortnightly allowance per person,
priced by the `marketing` agent before it ships, and an off-topic ceiling beside it that is an
abuse control rather than a tier benefit, so it is set in code with its reason in the log. Two
pieces of text that must come from the `legal` agent and stay in step — the opening warning and `/privacidad` — both live before the
switch is thrown, riding the lawyer's hour that is still pending. And an honest record of which
guarantees are load-bearing and which are nets: the wall and the figure check hold by
construction, the label holds because a wrong one is harmless, and the two lexicon screens hold
only as far as spelling does — which is why the next person to widen what this assistant may say
should start by reading clause 5.
