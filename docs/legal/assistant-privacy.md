# The assistant in `/privacidad` and `/condiciones` (project 023, phase 7)

> **I am not a lawyer.** This is the text and the reasoning a lawyer would check. Every clause
> is tied to the article it rests on and to what the code does (`path:line` at `09737447`,
> plus the sweep the lead described on branch `assistant-023-phase-7`). Anything that turns on
> an interpretation is marked **[lawyer]**.
>
> **Purpose**: the exact strings `/privacidad` and `/condiciones` gain or change before the
> `assistant` switch is thrown, in both languages, where each one goes, which version constant
> moves, the sentence `PRODUCT.md` needs, the mail the policy promises, the warning re-read
> against the final pages, and what goes to the lawyer's hour. **Audience**: the owner (who
> approves the wording and the processor named in it), the lead, `frontend`. **Committed**:
> yes. **Maintained by**: the `legal` agent. Written 2026-11-10. It completes
> [`assistant-warning.md`](./assistant-warning.md) § 3.2 and § 3.3, which listed what these
> pages had to say. This document says it.

## 0. In six lines

1. `/privacidad` gains one section (`id: 'asistente'`, § 3.1) and changes in **eleven** places (§ 3.2).
   `/condiciones` changes in **five** (§ 4).
2. **`TERMS_VERSION` goes from `2.1.0` to `2.2.0`**, together with `terms.updated`, in the same commit.
   No consent version moves: F5 was fixed by taking data out, not by asking for more.
3. **New finding F5, P0 at the switch, fixed the same day (§ 2.3).** The assistant was sending
   the person's **goal** to Anthropic. Our own policy classifies the goal as health data, and the
   consent that covers it says "solo para calcular tus objetivos y elegir tus platos". The owner
   chose option (a) and extended it to the way of eating: `goal` and `dietaryPatterns` are both
   out (prompt 1.2.0). The texts below describe that code.
4. **Retention, as built** (the lead's predicates): a conversation is deleted six calendar
   months after the last turn added to it; a usage row after 60 days. Both run in the daily
   sweep at 08:05 UTC and ship with this text. 60 days is fine in law (§ 2.4).
5. **Anthropic, checked on 2026-11-10 (§ 8):**
   - for an EEA customer the contracting entity is **Anthropic Ireland, Limited**;
   - the DPA is "incorporated into these Terms by reference" and rests on the SCCs (Modules
     Two and Three);
   - "Anthropic" does **not** appear on the public Data Privacy Framework list, active or
     inactive, while the control queries (Stripe, Vercel, Sentry) do;
   - "may not train models on Customer Content";
   - retention is "within 30 days", up to 2 years when flagged;
   - the DPA's Schedule 1 says "Special categories… None".
6. The warning needs no change (§ 7). The mail (§ 6) goes out **before** the switch.

## 1. What the product does at the switch (read in the code, not the plan)

**Flow A: sent to a processor.** Every message is handled in this order:

- **Our lexicon runs first, with no call** (`clinicalRefusal`,
  `packages/core/src/domain/Assistant/ClinicalRefusal.ts:7`). Its categories are child,
  condition, dose, eating disorder, medication and pregnancy. Whatever it catches reaches **no
  model**.
- **Anything else is labelled by the assistant's model**: the question alone, under
  `LABEL_SYSTEM_PROMPT` (`apps/api/src/modules/assistant/services/Assistant.service.ts`,
  `label()`; `QuestionLabel.ts:43`).
- **If the label says nutrition, the answer is streamed** (`claimed()`). The model receives:
  - the question;
  - a window of earlier **answered** turns from that conversation, at most 12 turns and 8,000
    characters (`HistoryWindow.ts:21`); declined turns are not replayed;
  - the system prompt built from `AssistantContext`. Its keys at `09737447` were cooking time,
    cuisines (only those onboarding offers), the active plan's days (date, dishes,
    accompaniments, figures, that day's targets, totals), dietary patterns (only
    vegetarian/vegan, `PoolPrompt.ts:405`), disliked dish names, **goal**, kitchen, language,
    liked foods, loved dish names, each meal's share of the day, and targets. **After F5, as
    the lead built it on branch `assistant-023-phase-7`** (prompt 1.2.0), `goal` and
    `dietaryPatterns` are gone, and the boundary test fails on any goal- or diet-shaped key.
    The rest is unchanged.
- **What it does not receive**: name, email, age, sex, weight, height, goal and way of eating
  (F5), allergies or intolerances (F1), both removed on 2026-11-10, conditions,
  medication, supplements, cupboard, check-in answers or comments.
- **Where it goes**: Anthropic directly, on its own key (`ai.config.ts:394-398`). The default
  model is `claude-haiku-5-5` (`Env.validation.ts:54`). The code does **not** set
  `inference_geo` (grep, 2026-11-10), so Anthropic's default, `"global"`, applies unless the
  workspace sets another (§ 8.5).
- **What is logged**: the `ai_call` event records feature, model, tokens and cost with
  `userId` null (`AnthropicStreamingClient.ts:191,233`). No log line holds a question or an
  answer (`Assistant.service.ts`, the class comment; Sentry drops `event.request`,
  `ErrorReporter.ts:138`).

**Flow B: stored here.**

- **`ai_conversations`** (`ai.schema.ts`, `userOwned`, so the owner's account cascades):
  - holds a title, which is the first 60 characters of the first kept question
    (`AssistantController.ts:13`);
  - `updated_at` is set only when a turn is added.
- **`ai_messages`** (cascades from the conversation): role, content, decline code, tokens.
  - A question the code itself judged clinical, by the lexicon **or** by the label, is stored
    with **empty** content and its code, and never titles the conversation
    (`Assistant.service.ts`, `kept`, F2).
  - An off-topic question is stored with its text.
  - An answer stopped part-way keeps what was shown, which had already passed the checks.
- **`assistant_usage`**: one row per message sent, holding the account, the time and whether
  the message was off topic. **No text.** It counts the fortnight's allowance (free 20,
  Premium 100) and the off-topic ceiling (10 per fortnight; past it, no model is called;
  `Allowance.ts:120-144`).
  - The window is the active plan's dates, or the last 14 days (`Allowance.ts:556-566`).
  - Deleting a message does not delete its row.
- **Deletion by the person**: a turn or a whole conversation, owner-scoped
  (`AssistantRepository.ts:140,160`). The read and delete routes stay open with the switch
  off. Only `standing` and `ask` sit behind `AssistantSwitchGuard`.
- **Deletion by the sweep** (the lead, 2026-11-10, `AssistantController.forget`):
  - `ai_conversations` where `updated_at` is older than six calendar months (UTC), cascading
    to `ai_messages`;
  - `assistant_usage` where `created_at` is older than 60 × 24 h;
  - both run in `GET /api/v1/cron/sweep-verifications` at 08:05 UTC daily, switch on or off.
- **Who reads it**: only `AssistantRepository` touches these tables (grep over `apps/api`,
  `packages/core` and `packages/database`). No admin route, no export and no care-link reader
  does. The person reads them through owner-scoped routes, and anybody else gets a 404.

**Not in the code**: an export of conversations. Today a request for portability or a copy
could only be met by somebody querying the database (§ 2.6, P2).

## 2. The analysis

### 2.1 Roles

- **NutrIA (the owner, as an individual) is the controller** for both flows. He decides that
  the question is sent, to whom, and what is kept (GDPR art. 4.7).
- **Anthropic is his processor** (art. 28). Its DPA says "With respect to Customer Personal
  Data, Customer is the controller and Anthropic is Customer's processor" (§ B.1). The
  contracting entity for a customer in the EEA is **Anthropic Ireland, Limited** (Commercial
  Terms, preamble).
- **One reading to confirm [lawyer]**: when Anthropic keeps a flagged conversation for up to 2
  years, and classification scores for up to 7, to enforce **its own** Usage Policy, it may
  be acting for its own purposes, and to that extent as a controller (EDPB Guidelines
  07/2020, a processor that determines its own purposes becomes a controller, art. 28.10).
  The policy text below describes the fact, and needs no answer to this question.
- **The dietitian has no role** in the assistant. They see nothing of it (§ 3.2, R10).

### 2.2 Legal basis per purpose

| Purpose | Data | Basis | Note |
| --- | --- | --- | --- |
| Answering the question (label + answer) | the question, the window, the context | art. 6.1.b (contract): the person asks | The assistant is a feature of the contract (terms § 4, T1). |
| Keeping the conversation so they can come back to it | `ai_conversations`, `ai_messages` | art. 6.1.b | The purpose the warning states ("para que puedas retomar la conversación"). |
| Counting messages (allowance, off-topic ceiling) | `assistant_usage` | art. 6.1.b for the allowance (a contractual limit); art. 6.1.f for the off-topic ceiling (protecting the service from abuse, recital 47) | The existing "Frenos contra el abuso" reasoning. |
| Screening answers against the profile's allergies | the profile's allergies, **read here, never sent** | the explicit profile consent (art. 9.2.a), **see the P2 below** | It protects the person. It is the reason the warning says "añádela a tu perfil". |
| Health data somebody types despite the warning | free text | **no art. 9.2 exception fits** | Minimised, not legitimised: the warning, the lexicon, F2, deletion at will, six months. [`assistant-warning.md`](./assistant-warning.md) § 4 item 17(a) **[lawyer]**. |

**P2, allergy screening against the consent's wording.** `profileConsent.body` says "Los usamos
**solo** para calcular tus objetivos y elegir tus platos". Withholding an assistant answer is
neither of those. It is the same protective use as filtering a plan, the data never leave our
server, and the person is told in the warning and in the new section. Still, the consent's
words do not name it.

- **Fix at the next consent bump** (not a reason for one now): "…para calcular tus objetivos,
  elegir tus platos y comprobar que nada de lo que te proponemos lleve algo que no puedes
  tomar".
- **[lawyer]** (§ 9, item 17(l)).

### 2.3 F5, P0 at the switch: the goal goes to Anthropic outside its consent

- **What happens**: `goal: preferences.goal` (`Assistant.service.ts`, `context()`) puts `weight_loss`,
  `maintenance` or `muscle_gain` into the assistant's prompt. Its key is at
  `AssistantContext.ts:89` and `:163`.
- **Our policy calls it health data**: "Cuáles de estos datos son especialmente protegidos"
  (es-ES.ts:2954) says "tu peso, tu altura y **tu objetivo**, porque dicen algo de tu salud".
- **The basis for it is the explicit profile consent** (es-ES.ts:2961), whose body limits it
  to calculating targets and choosing dishes. Answering questions is a new purpose, and
  Anthropic is a recipient that consent does not name. So, on NutrIA's own published
  classification, this is special-category data with no art. 9.2 basis: P0 on this folder's
  scale. Articles: GDPR arts. 9.1, 9.2.a ("para uno o más de los fines especificados"), 4.11
  ("específica"), 5.1.b.
- **Why it is raised only now**: in phase 5 I made it a question for the lawyer
  ([`assistant-warning.md`](./assistant-warning.md) § 3.1 F1(a) and § 4 item 17(g)) and called
  it no blocker. I had not weighed the consent's "solo". I would rather correct myself than
  soften it.
- **(a) Drop `goal` from `AssistantContext` (my recommendation).**
  - What it takes: drop the key and its prompt line if it has one, and update the boundary
    test's reviewed key list (`Assistant.boundary.test.ts:78`).
  - It is the same shape as the owner's F1 choice.
  - What stays: the targets and the plan's figures. The policy does not class them as
    specially protected, and they already reach the dish model under the same consent.
    Whether targets are health data under the broad reading of C-184/20 is a question for the
    lawyer, not a blocker (§ 9, item 17(g), amended).
  - What it costs: the assistant cannot say "como estás perdiendo peso…". The day's targets
    against its totals still show the deficit as numbers.
- **(b) A separate, optional consent the first time `/asistente` is opened.** It needs a new
  `ASSISTANT_CONSENT_VERSION`, can be withdrawn, and names Anthropic. It costs a screen, a
  stored acceptance, a text and a DPIA line.
- **(c) Reword the profile consent and bump `PROFILE_CONSENT_VERSION` to `1.2.0`.**
  **Not recommended.** It re-asks every account, and it folds an optional feature's purpose
  into the consent every plan depends on (art. 7.4).

**Decided on 2026-11-10 (`LOG.md`): option (a), widened.** The owner also took out the way of
eating (`dietaryPatterns`, vegetarian/vegan), on the same reasoning: `/privacidad` lists "una
forma de comer" in the same specially-protected sentence. That goes further than I asked. A
vegetarian or vegan pattern is not one the policy names as protected ("como «sin gluten» o «sin
lactosa», o una ligada a una religión"), but ethical veganism has been held to be a
philosophical belief (art. 9.1). Fewer data is the safe direction, and the text now says the
model is not told even that. **The texts in § 3 describe this code.**

### 2.4 Retention: the ruling, and the two figures

- **Conversations: six months after the last message.** This is the ruling I made in phase 5
  and the owner approved (`LOG.md`, 2026-11-10). GDPR arts. 5.1.e and 25.2. "Last message"
  means the last one **added**: deleting a turn does not restart the clock, so the policy says
  "su último mensaje", which is what the sweep reads.
- **The usage ledger: 60 days, accepted.** The allowance reads back to the active plan's
  `startDate` (`Allowance.ts:556-558`), and a pause moves `endDate` forward
  (`VacationRepository.ts:154`; up to 90 days per trip, `MAX_VACATION_DAYS`, and trips may
  follow one another). So a plan's window can run past 60 days. Rows older than that then drop
  out, and those messages are handed back. That leak runs in the person's favour. It is
  shorter retention, which is what art. 5.1.e asks for, and the lead accepted it on
  2026-11-10. A period tied to "your current plan" would satisfy art. 13.2.a as a criterion,
  but it has no upper bound. A fixed figure can be checked.
- **Anthropic's copy**: what its pages say (§ 8.4). **Deleting a conversation here does not
  reach it.** The policy says so.

### 2.5 Transfers

- **The contract.** The controller contracts with **Anthropic Ireland, Limited**, a processor
  established in the EEA, so handing it the request is not, as such, a transfer under chapter V.
- **The onward transfer.** Data at rest are stored in the US: "Currently, `"us"` is the only
  available workspace geo". Inference with the default `"global"` "may run in any available
  geography". So the data leave the EEA as an onward transfer by a processor to Anthropic,
  PBC and its infrastructure (art. 44, "including for onward transfers").
- **The mechanism.** The DPA's § I.1 incorporates "the SCCs Module Two (controller to
  processor) and/or Module Three (processor to processor)… deemed to have been executed". § I.4
  promises information for a transfer impact assessment on request.
- **The DPF list.** "Anthropic" returned no entry, active or inactive. The query went to the
  public list API on 2026-11-10, with the list file dated "Tuesday, November 10, 2026 6:00 AM
  EST". In the same query, Stripe (Stripe, LLC), Vercel (Vercel Inc.) and Sentry (Sentry.io)
  are active. So the policy does **not** say Anthropic is in the framework.
- **[lawyer]**: whether the art. 13.1.f sentence must say more than "Estados Unidos y otros
  países", given `"global"` inference (§ 9, item 17(n)).
- **The cheaper honest alternative**: pin inference to the US.
  - How: a workspace `default_inference_geo: "us"`, a Console setting, or `inference_geo: "us"`
    on each request.
  - What it costs: "priced at 1.1x the standard rate", which is roughly 10 % on a budget that
    expires unspent.
  - What it buys: one country in the sentence.
  - The owner decides. **Today the text says "y puede calcular la respuesta en servidores de
    otros países"**, which is true either way.

### 2.6 DPIA, DPO, the owner as an individual, rights

- **DPIA.** It already exists and is mandatory ([`dpia.md`](./dpia.md)). The assistant is a
  change in the risk (art. 35.11): free text that may hold health data, a new processor, and a
  new store. It gets an addendum ([`dpia.md`](./dpia.md) § 8). The residual risk is acceptable
  with the measures in § 1. No prior consultation (art. 36).
- **DPO.** Unchanged ([`analysis.md`](./analysis.md)): the core activity is not large-scale
  processing of special categories.
- **The owner as an individual.** The Commercial Terms define the customer as "you or the
  organization, company, or other entity that you represent", and their header says
  "Audience: Business". Two things depend on the key belonging to an organisation under these
  terms rather than to a consumer plan: the no-training sentence and the DPA. **The owner
  confirms it in the Console, and the contracting entity on his invoice**, before the switch
  (§ 10, box 5) **[lawyer]**.
- **Access (art. 15)** is the screen itself.
- **Erasure (art. 17)** is done in the screen, at once.
- **Portability (art. 20)** reaches conversations, which are provided by the person under a
  contract and processed automatically. The policy's existing line ("pídenoslo por correo")
  covers them. What is missing is a way to answer without the owner reading them, which PRD 11
  forbids: an export the person downloads, or a script that writes the file without anybody
  reading it. **P2**, sent to the lead (§ 10).

## 3. `/privacidad`: the strings

**Where**: namespace `privacy` in `apps/web/src/i18n/dictionaries/es-ES.ts` and `en-GB.ts`.

- **Shape**: `sections[]` of `{ id?, heading, paragraphs, list? }`. The key is `heading`, not
  `title`.
- **Placeholders**: only `{name}` and `{email}`. `legal.test.ts:28` fails on any other `{…}`
  left after filling, and `:37` fails on an `@` in the dictionary.
- **Same length**: both languages must keep the same number of sections (`legal.test.ts:42`).
- **Pasting**: the strings below contain no straight apostrophe, so they paste into
  single-quoted TypeScript as they are. The en-GB uses `’`.

### 3.1 The new section, `id: 'asistente'`

**Placement**: directly **after** `heading: 'La inteligencia artificial'` / `'Artificial
intelligence'` and before "Con quién compartimos tus datos" / "Who we share your data with". The
`id` is the same string in both languages, because the warning links to `/privacidad#asistente`
and `/en/privacidad#asistente` (`AssistantChat.tsx:249`).

#### es-ES

```ts
{
  id: 'asistente',
  heading: 'El asistente',
  paragraphs: [
    'Si usas el asistente, lo que escribes se envía a un modelo de inteligencia artificial para que te responda, y se guarda en tu cuenta para que puedas retomar la conversación. El asistente solo habla de nutrición —tu plan, recetas, ingredientes y macros—, no es un médico ni un dietista-nutricionista y nunca cambia tu plan.',
    'Lo que recibe el modelo con cada pregunta: tu pregunta; las preguntas y respuestas anteriores de esa misma conversación, hasta un límite; y, para que pueda hablar de tu plan, los días de tu plan activo con sus platos, sus acompañamientos y sus cifras, tus objetivos diarios y los de cada día, cuánto pesa cada comida en tu día, cuánto tiempo quieres dedicar a cocinar, los aparatos de tu cocina, las cocinas y los alimentos que te gustan, los nombres de los platos que te encantan y de los que no te gustan, y el idioma en que tiene que contestarte. Lo que viene de tu perfil y de tu plan va siempre con los nombres de nuestras listas. Nunca recibe tu nombre, tu correo, tu edad, tu sexo, tu peso, tu altura ni tu objetivo, tus alergias ni intolerancias, tu forma de comer (ni siquiera si eres vegetariano o vegano), ni tus enfermedades, tu medicación o tus suplementos.',
    'Antes de contestar, el mismo modelo lee tu pregunta para decidir si es de nutrición, si le corresponde a un profesional sanitario o si no tiene que ver con lo que hace. Algunas preguntas de salud —sobre enfermedades, dosis, medicación, embarazo o lactancia, trastornos de la conducta alimentaria o la alimentación de un niño— las detecta antes nuestro propio código, y esas no llegan a ningún modelo. Una pregunta que nuestro código o el modelo consideran de salud no se guarda: en la conversación queda solo la marca de que la hubo.',
    'Nuestro código revisa cada frase de la respuesta antes de enseñártela, y la para ahí si iba a nombrar algo que no puedes tomar según las alergias e intolerancias de tu perfil, a darte una cifra que no sale de tu plan o a decir que ha cambiado tu plan. Esa revisión la hacemos nosotros: al modelo no le decimos tus alergias. Por eso, si tienes una alergia, añádela a tu perfil: si solo la escribes en la conversación, ninguna de nuestras comprobaciones la tiene en cuenta.',
    'A quién va: a Anthropic, que la trata por encargo nuestro. Contratamos con Anthropic Ireland, Limited, en Irlanda. El modelo es Claude Haiku 5.5. Anthropic guarda lo que recibe en Estados Unidos y puede calcular la respuesta en servidores de otros países. Sus condiciones le prohíben entrenar sus modelos con ello y, según dice en sus páginas, borra la pregunta y la respuesta de sus sistemas como mucho a los 30 días; si sus sistemas automáticos marcan una conversación como contraria a sus normas de uso, puede guardarla hasta 2 años, y la puntuación de esa revisión hasta 7. Borrar aquí una conversación no borra esa copia.',
    'Tus conversaciones se guardan en tu cuenta, cada una con un título hecho con las primeras palabras de tu primera pregunta. Nadie más las lee en NutrIA: no aparecen en nuestra consola de administración, no las ve tu dietista si tienes uno y no van a ningún registro. Puedes borrar un mensaje o una conversación entera cuando quieras, y se borra al momento. Si no, una conversación se borra sola seis meses después de su último mensaje, y todas se borran al borrar tu cuenta.',
    'Para aplicar el límite de mensajes de cada quincena guardamos, por cada mensaje que envías, cuándo lo enviaste y si era sobre otra cosa que la nutrición, sin su texto. Ese recuento no se borra al borrar un mensaje —por eso un mensaje borrado sigue contando— y se borra solo a los 60 días, o al borrar tu cuenta.',
    'Tratamos tus preguntas y sus respuestas para darte el servicio que pides (contrato). Las alergias e intolerancias de tu perfil, con las que revisamos las respuestas, siguen bajo el consentimiento que nos diste para ellas.',
    'Te lo recordamos al empezar cada conversación: no escribas en el asistente enfermedades, medicación ni otros datos de tu salud. Si aun así lo haces, se envía y se guarda como el resto de la conversación, hasta que lo borres o se borre solo.'
  ]
}
```

#### en-GB

```ts
{
  id: 'asistente',
  heading: 'The assistant',
  paragraphs: [
    'If you use the assistant, what you type is sent to an artificial-intelligence model so that it can answer you, and kept in your account so that you can come back to the conversation. The assistant only talks about nutrition — your plan, recipes, ingredients and macros —, is not a doctor or a dietitian-nutritionist, and never changes your plan.',
    'What the model receives with each question: your question; the earlier questions and answers of that same conversation, up to a limit; and, so that it can talk about your plan, the days of your active plan with their dishes, side dishes and figures, your daily targets and each day’s own, how much each meal weighs in your day, how much time you want to spend cooking, the appliances in your kitchen, the cuisines and foods you like, the names of the dishes you love and of those you dislike, and the language it should answer in. What comes from your profile and your plan always goes by the names on our lists. It never receives your name, email, age, sex, weight, height or goal, your allergies or intolerances, your way of eating (not even whether you are vegetarian or vegan), or your conditions, medications or supplements.',
    'Before answering, the same model reads your question to decide whether it is about nutrition, whether it is one for a health professional, or whether it has nothing to do with what it does. Some health questions — about conditions, doses, medication, pregnancy or breastfeeding, eating disorders or feeding a child — our own code catches first, and those reach no model at all. A question our code or the model judges to be about health is not kept: all that stays in the conversation is a mark that there was one.',
    'Our code checks every sentence of the answer before showing it to you, and stops the answer there if it was about to name something you cannot have according to the allergies and intolerances on your profile, to give you a figure that does not come from your plan, or to say it has changed your plan. We do that check ourselves: the model is not told your allergies. So if you have an allergy, add it to your profile: if you only write it in the conversation, none of our checks takes it into account.',
    'Where it goes: to Anthropic, which processes it on our behalf. Our contract is with Anthropic Ireland, Limited, in Ireland. The model is Claude Haiku 5.5. Anthropic stores what it receives in the United States and may work out the answer on servers in other countries. Its terms forbid it to train its models on it and, according to its own pages, it deletes the question and the answer from its systems within 30 days at most; if its automated systems flag a conversation as breaking its usage rules, it may keep it for up to 2 years, and the score from that review for up to 7. Deleting a conversation here does not delete that copy.',
    'Your conversations are kept in your account, each with a title made from the first words of your first question. Nobody else reads them on NutrIA: they do not appear in our admin console, your dietitian does not see them if you have one, and they go into no record. You can delete a message or a whole conversation whenever you like, and it is deleted at once. Otherwise a conversation deletes itself six months after its last message, and all of them are deleted when you delete your account.',
    'To apply each fortnight’s message limit we keep, for every message you send, when you sent it and whether it was about something other than nutrition, without its text. That count is not deleted when you delete a message — which is why a deleted message still counts — and it deletes itself after 60 days, or when you delete your account.',
    'We process your questions and their answers to provide the service you ask for (contract). The allergies and intolerances on your profile, which we check the answers against, remain under the consent you gave us for them.',
    'We remind you at the start of every conversation: please do not write about conditions, medication or anything else about your health in the assistant. If you do anyway, it is sent and kept like the rest of the conversation, until you delete it or it deletes itself.'
  ]
}
```

#### Sources, clause by clause (for the comment block above the section; the page does not show it)

| ¶ | Clause | Code | Law |
| --- | --- | --- | --- |
| 1 | sent to a model, kept, nutrition only, never changes the plan | `Assistant.service.ts`, `claimed()`; `LABEL_SYSTEM_PROMPT`; `claimsToAct` | GDPR art. 13.1.c (purposes); AI Act art. 50.1 (that it is AI, said in full on the screen); PRD 12 |
| 2 | the context list and the "never" | `AssistantContext` **after F5 as built** (no `goal`, no `dietaryPatterns`; prompt 1.2.0), as the lead listed it on 2026-11-10; `HistoryWindow.ts:21` | GDPR arts. 13.1.c, 13.1.e, 5.1.a. Listed the way the dish paragraph lists its own, so that the two are read side by side and neither looks wider than it is. |
| 3 | label by the same model; the lexicon goes nowhere; health questions not kept | `decide()`, `ClinicalRefusal.ts:7`, F2 `kept` | GDPR arts. 5.1.c, 25.2, 9.1. "consideran de salud" covers both routes to `clinical`; the lexicon's six categories are listed, the label's are not promised. |
| 4 | the net and the allergy sentence | `answerNamesAnAllergen`, `figuresAreAllSupplied`, `claimsToAct`; F1 | GDPR art. 13.1.c; the warning's clause 7. A safety sentence and an honest one: the model may well "take into account" what it is told in the chat, but no check of ours does. |
| 5 | Anthropic, entity, model, location, no training, retention ("Sus condiciones le prohíben" = Commercial Terms § B; "según dice en sus páginas" = the privacy-center article, not the terms; no "filial": nothing read says so) | `ai.config.ts:394-398`, `Env.validation.ts:54`; no `inference_geo` | GDPR art. 13.1.e (recipient), 13.1.f (transfer), 13.2.a (period). Commercial Terms preamble and § B; data-residency page; privacy-center article (§ 8). "según sus propias condiciones" marks the 30 days as **its** statement, not ours. **The model's name must equal production's `AI_ASSISTANT_MODEL`**: if it ever differs, this sentence changes with `privacy.updated`. |
| 6 | stored, title, who sees, deletion, six months, cascade | `ai.schema.ts`, `AssistantController.ts:13`, `AssistantRepository.ts:140,160`, the sweep | GDPR arts. 5.1.e, 13.2.a, 17, 25.2; PRD 10–11. "Nadie más las lee en NutrIA" deliberately avoids "solo las ves tú", which [`assistant-warning.md`](./assistant-warning.md) § 2 rules out: Anthropic receives them, and the database can be opened to fix a fault. "no van a ningún registro" = no log line, no audit row, no analytics property. It stands beside "nadie la consulta salvo para arreglar un fallo" in «Cómo protegemos tus datos», which it does not contradict. |
| 7 | the usage ledger and its 60 days | `assistant_usage`; the sweep | GDPR arts. 5.1.c, 5.1.e, 13.2.a. Said because the screen already says a deleted message "sigue contando" (`assistant.deleteMessageBody`): the policy has to say what that rests on. |
| 8 | bases | — | GDPR arts. 6.1.b, 9.2.a, 13.1.c. The off-topic ceiling is also a legitimate-interest brake; the existing "Por nuestro interés legítimo… los frenos contra el abuso" covers it without a word more. |
| 9 | the residue | — | GDPR art. 5.1.a (fairness: do not let a person think a typed condition is safe there); `assistant-warning.md` § 2 clause 6. |

### 3.2 Existing sentences that change

Each row quotes the text **as published today** (`main` at `09737447`) and gives the
replacement. Unlisted sentences stay as they are.

**R1. «La inteligencia artificial», paragraph 1: one sentence added at the end.**

- es-ES current: `…La IA no toma ninguna decisión sobre ti: los límites de calorías y de proteína los aplican reglas fijas, no el modelo.`
- es-ES replacement: `…La IA no toma ninguna decisión sobre ti: los límites de calorías y de proteína los aplican reglas fijas, no el modelo. El asistente, que contesta preguntas sobre tu plan, usa otro modelo y tiene su propia sección, «El asistente».`
- en-GB current: `…The AI makes no decision about you: the calorie and protein bounds are applied by fixed rules, not by the model.`
- en-GB replacement: `…The AI makes no decision about you: the calorie and protein bounds are applied by fixed rules, not by the model. The assistant, which answers questions about your plan, uses another model and has its own section, "The assistant".`
- Why: the paragraphs below it describe "el modelo", the dish designer. Without a pointer, the
  section's "never" reads as covering every model. The label's refusal to answer a question is
  not a decision "sobre ti" with legal or similar effect (art. 22.1), so the sentence before it
  stays true.

**R2. «La inteligencia artificial», paragraph 4, "Nadie entrena…" (the sentence the switch makes false).**

- es-ES current: `Nadie entrena con ello ni lo guarda: solo usamos proveedores que borran la petición en cuanto responden y no la usan para entrenar ni mejorar ningún modelo. Lo exigimos en nuestra cuenta de OpenRouter y otra vez en cada petición. OpenRouter guarda solo datos técnicos de cada petición (tamaño, tiempo, coste), no su contenido.`
- es-ES replacement: `Lo que se envía para diseñar tus platos no lo guarda nadie ni se usa para entrenar: para eso solo usamos proveedores que borran la petición en cuanto responden y no la usan para entrenar ni mejorar ningún modelo. Lo exigimos en nuestra cuenta de OpenRouter y otra vez en cada petición. OpenRouter guarda solo datos técnicos de cada petición (tamaño, tiempo, coste), no su contenido. El asistente funciona de otra forma, como se explica en «El asistente».`
- en-GB current: `Nobody trains on it or keeps it: we only use providers that delete the request as soon as they answer and do not use it to train or improve any model. We require this in our OpenRouter account and again in every request. OpenRouter keeps only technical data about each request (size, time, cost), not its content.`
- en-GB replacement: `What is sent to design your dishes is kept by nobody and used for no training: for that we only use providers that delete the request as soon as they answer and do not use it to train or improve any model. We require this in our OpenRouter account and again in every request. OpenRouter keeps only technical data about each request (size, time, cost), not its content. The assistant works differently, as explained under "The assistant".`
- Why: "solo usamos proveedores que borran la petición en cuanto responden" is false the day
  Anthropic answers a question (≤ 30 days; § 8.4). GDPR arts. 5.1.a and 13.2.a.

**R3. «La inteligencia artificial», paragraph 5, the dish request (two absolute phrases).**

- es-ES current (fragments): `Ese nombre es lo único escrito por ti que llega al modelo, y viaja…` and `No guardamos lo que escribes: en cuanto el modelo responde, tu texto desaparece, y no queda en ningún registro.`
- es-ES replacement (fragments): `Ese nombre es lo único escrito por ti que llega al modelo que diseña los platos, y viaja…` and `No guardamos lo que escribes ahí: en cuanto el modelo responde, tu texto desaparece, y no queda en ningún registro.`
- en-GB current (fragments): `That name is the only thing written by you that reaches the model, and it travels…` and `We do not keep what you type: as soon as the model answers, your text is gone, and it is left in no record.`
- en-GB replacement (fragments): `That name is the only thing written by you that reaches the model that designs the dishes, and it travels…` and `We do not keep what you type there: as soon as the model answers, your text is gone, and it is left in no record.`
- Why: the assistant sends what you type and keeps it. Both phrases read as absolute.

**R4. «Qué datos recogemos y para qué»: two new list items, inserted after `'Uso del producto: …'` and before `'Lo que nos escribes: …'`.**

- es-ES:
  - `'Lo que escribes al asistente, si lo usas: tus preguntas, sus respuestas y el título de cada conversación, que son las primeras palabras de tu primera pregunta. Para que puedas retomar la conversación. Más en «El asistente».'`
  - `'Cuántos mensajes envías al asistente: cuándo envías cada uno y si era sobre otra cosa que la nutrición, sin el texto. Para aplicar el límite de mensajes de cada quincena.'`
- en-GB:
  - `'What you type to the assistant, if you use it: your questions, their answers and the title of each conversation, which is the first words of your first question. So that you can come back to the conversation. More under "The assistant".'`
  - `'How many messages you send the assistant: when you send each one and whether it was about something other than nutrition, without the text. To apply each fortnight’s message limit.'`
- Why: GDPR art. 13.1.c (purposes) and art. 5.1.a. The policy's own inventory has to list them.

**R5. «Cuáles de estos datos son especialmente protegidos»: one sentence added at the end.**

- es-ES current: `…tus enfermedades, tu medicación y tus suplementos; y lo que escribas sobre cómo te sienta el plan.`
- es-ES replacement: `…tus enfermedades, tu medicación y tus suplementos; y lo que escribas sobre cómo te sienta el plan. También lo sería lo que escribas sobre tu salud en una conversación con el asistente, aunque te pedimos que no lo hagas.`
- en-GB current: `…your conditions, medications and supplements; and anything you write about how the plan agrees with you.`
- en-GB replacement: `…your conditions, medications and supplements; and anything you write about how the plan agrees with you. So would anything you write about your health in a conversation with the assistant, although we ask you not to.`
- Why: GDPR art. 9.1; C-184/20. The section lists what NutrIA holds that is specially protected,
  and a typed condition would be.

**R6. «Por qué podemos tratar estos datos», paragraph 1.**

- es-ES current: `Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus pagos y los correos del servicio.`
- es-ES replacement: `Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus conversaciones con el asistente, tus pagos y los correos del servicio.`
- en-GB current: `To provide the service you ask for (contract): your account, profile, plans, payments and service emails.`
- en-GB replacement: `To provide the service you ask for (contract): your account, profile, plans, conversations with the assistant, payments and service emails.`
- Why: GDPR art. 13.1.c (legal basis per purpose).

**R7. «Con quién compartimos tus datos»: one list item, inserted after the OpenRouter item.**

- es-ES: `'Anthropic, que ejecuta el modelo del asistente, si lo usas, como se explica en «El asistente». Contratamos con Anthropic Ireland, Limited, en Irlanda; guarda los datos en Estados Unidos.'`
- en-GB: `'Anthropic, which runs the assistant’s model, if you use it, as explained in "The assistant". Our contract is with Anthropic Ireland, Limited, in Ireland; it stores the data in the United States.'`
- Why: GDPR art. 13.1.e.

**R8. «Transferencias fuera de la Unión Europea»: the whole paragraph is replaced.**

- es-ES current: `Algunos de estos proveedores son empresas de Estados Unidos o tratan datos allí: Vercel, Neon, Stripe, el proveedor de correo, Sentry, OpenRouter, DeepInfra y CoreWeave. Vercel, Neon, Stripe y Sentry están certificados en el Marco de Privacidad de Datos UE-EE. UU., que la Comisión Europea reconoce como garantía suficiente; con el proveedor de correo nos apoyamos en ese mismo marco o en las cláusulas contractuales tipo de la Comisión. OpenRouter no está en ese marco: con él nos apoyamos en las cláusulas contractuales tipo. DeepInfra y CoreWeave reciben la petición de OpenRouter y se comprometen con él a no guardarla ni usarla para entrenar; la petición no lleva nada que te identifique. Puedes pedirnos el detalle de cada garantía en {email}.`
- es-ES replacement: `Algunos de estos proveedores son empresas de Estados Unidos o tratan datos allí: Vercel, Neon, Stripe, el proveedor de correo, Sentry, OpenRouter, DeepInfra, CoreWeave y Anthropic. Vercel, Neon, Stripe y Sentry están certificados en el Marco de Privacidad de Datos UE-EE. UU., que la Comisión Europea reconoce como garantía suficiente; con el proveedor de correo nos apoyamos en ese mismo marco o en las cláusulas contractuales tipo de la Comisión. OpenRouter no está en ese marco: con él nos apoyamos en las cláusulas contractuales tipo. DeepInfra y CoreWeave reciben la petición de OpenRouter y se comprometen con él a no guardarla ni usarla para entrenar; la petición no lleva nada que te identifique. Con Anthropic contratamos a través de Anthropic Ireland, Limited, en Irlanda; Anthropic guarda los datos en Estados Unidos y, para calcular una respuesta, puede tratarlos en otros países. Anthropic no está en el Marco de Privacidad de Datos, y esos envíos se apoyan en las cláusulas contractuales tipo de la Comisión, que forman parte de su acuerdo de tratamiento de datos. Puedes pedirnos el detalle de cada garantía en {email}.`
- en-GB current: `Some of these providers are US companies or process data there: Vercel, Neon, Stripe, the email provider, Sentry, OpenRouter, DeepInfra and CoreWeave. Vercel, Neon, Stripe and Sentry are certified under the EU-US Data Privacy Framework, which the European Commission recognises as an adequate safeguard; with the email provider we rely on that same framework or on the Commission's standard contractual clauses. OpenRouter is not in that framework: with it we rely on the standard contractual clauses. DeepInfra and CoreWeave receive the request from OpenRouter and commit to it not to keep it or train on it; the request carries nothing that identifies you. You can ask us for the details of each safeguard at {email}.`
- en-GB replacement: `Some of these providers are US companies or process data there: Vercel, Neon, Stripe, the email provider, Sentry, OpenRouter, DeepInfra, CoreWeave and Anthropic. Vercel, Neon, Stripe and Sentry are certified under the EU-US Data Privacy Framework, which the European Commission recognises as an adequate safeguard; with the email provider we rely on that same framework or on the Commission’s standard contractual clauses. OpenRouter is not in that framework: with it we rely on the standard contractual clauses. DeepInfra and CoreWeave receive the request from OpenRouter and commit to it not to keep it or train on it; the request carries nothing that identifies you. With Anthropic our contract is through Anthropic Ireland, Limited, in Ireland; Anthropic stores the data in the United States and, to work out an answer, may process them in other countries. Anthropic is not in the Data Privacy Framework, and those transfers rest on the Commission’s standard contractual clauses, which are part of its data processing agreement. You can ask us for the details of each safeguard at {email}.`
  - The en-GB string is double-quoted in `en-GB.ts` today because of `Commission's`. The
    replacement uses `’` twice, so it can stay double-quoted or become single-quoted.
- Why: GDPR arts. 13.1.f, 44, 46.2.c, 28.4. § 2.5 and § 8.

**R9. «Cuánto tiempo guardamos tus datos»: paragraph 1 changed, and one paragraph added after it.**

- es-ES current: `Mientras tu cuenta exista. Al borrarla, todo lo que hay en ella se borra al momento: perfil, alergias, salud, planes, listas de la compra, lo que dijiste que tenías en casa, progreso y consentimientos.`
- es-ES replacement: `Mientras tu cuenta exista. Al borrarla, todo lo que hay en ella se borra al momento: perfil, alergias, salud, planes, listas de la compra, lo que dijiste que tenías en casa, progreso, conversaciones con el asistente y consentimientos.`
- es-ES new paragraph (second): `Tus conversaciones con el asistente se borran solas seis meses después de su último mensaje, si no las borras antes, y el recuento de los mensajes que le envías, a los 60 días. Anthropic borra lo que recibió del asistente como mucho a los 30 días, o hasta 2 años después si sus sistemas lo marcan como contrario a sus normas de uso (más en «El asistente»).`
- en-GB current: `While your account exists. When you delete it, everything in it is deleted at once: profile, allergies, health, plans, shopping lists, what you told us you already had at home, progress and consents.`
- en-GB replacement: `While your account exists. When you delete it, everything in it is deleted at once: profile, allergies, health, plans, shopping lists, what you told us you already had at home, progress, conversations with the assistant and consents.`
- en-GB new paragraph (second): `Your conversations with the assistant delete themselves six months after their last message, unless you delete them first, and the count of the messages you send it after 60 days. Anthropic deletes what it received from the assistant within 30 days at most, or up to 2 years later if its systems flag it as breaking its usage rules (more under "The assistant").`
- Why: GDPR art. 13.2.a. An enumeration of what an account's deletion removes that does not name
  a category reads as if that category survived. That is the same reasoning as the cupboard's
  entry, `textos/02`'s source block at es-ES.ts:3012-3020.

**R10. «Tu dietista en NutrIA», paragraph 2, the "No verá" sentence.**

- es-ES current: `No verá tus alergias ni intolerancias, tu correo ni tus comentarios escritos.`
- es-ES replacement: `No verá tus alergias ni intolerancias, tu correo, tus comentarios escritos ni tus conversaciones con el asistente.`
- en-GB current: `They will not see your allergies or intolerances, your email address or your written comments.`
- en-GB replacement: `They will not see your allergies or intolerances, your email address, your written comments or your conversations with the assistant.`
- Why: GDPR art. 13.1.e. The list of what the professional does **not** see is read as
  exhaustive; PRD 11. No care-link reader touches `ai_*` (§ 1).
- **No `CARE_CONSENT_VERSION` bump**: this makes the shared scope **no wider**. It names one more
  thing that is not shared.

**R11. «Tus derechos»: two list items.**

- es-ES current: `Acceso: ver qué datos tenemos, desde tu perfil o pidiéndolos por correo.` / `Supresión: borrar tu cuenta desde tu perfil, o pedirlo por correo.`
- es-ES replacement: `Acceso: ver qué datos tenemos, desde tu perfil —y tus conversaciones, desde el asistente— o pidiéndolos por correo.` / `Supresión: borrar tu cuenta desde tu perfil, o pedirlo por correo; y un mensaje o una conversación del asistente, desde el propio asistente.`
- en-GB current: `Access: see what data we hold, from your profile or by asking by email.` / `Erasure: delete your account from your profile, or ask by email.`
- en-GB replacement: `Access: see what data we hold, from your profile — and your conversations, from the assistant — or by asking by email.` / `Erasure: delete your account from your profile, or ask by email; and a message or a conversation with the assistant, from the assistant itself.`
- Why: GDPR arts. 12.2, 15, 17. Portability stays as it is ("pídenoslo por correo"), and it
  covers conversations. How it is answered without anybody reading them is the P2 in § 2.6.

**R12. `privacy.updated`**: `Última actualización: {día} de {mes} de 2026` / `Last updated: {day} {month} 2026`, the day the dictionary change ships. If that is today: `Última actualización: 10 de noviembre de 2026` / `Last updated: 10 November 2026`.

**What stays, checked against the code:**

- «Cómo protegemos tus datos». "Los registros del servidor y de errores no guardan lo que
  escribes" is true (§ 1). "Tus enfermedades… no puede hablar con la inteligencia artificial"
  is true, and the boundary test still passes.
- «Cookies y almacenamiento». The assistant stores nothing in the browser: grep for
  `localStorage`/`sessionStorage`/`indexedDB` in any file naming the assistant.
- «Cambios en esta política». The intro. «Menores».
- «Uso del producto». The `ai_call` rows name nobody.

**The consent and invitation copies stay as they are, and why.** A sweep of both dictionaries
outside `privacy` and `terms` (2026-11-10) found three texts that say what a model receives or
what somebody does not see:

- **`profileConsent.ai`**: "Un modelo de inteligencia artificial diseña los platos… Nunca recibe…
  nada que escribas a mano". Its subject is the model that designs the dishes, and of that model
  it is true. R1 and R3 rescope the same phrase in the policy, because the policy now describes
  two models side by side; the consent describes one. Changing a consent's words means a new
  `PROFILE_CONSENT_VERSION` and every account asked again, for a sentence that is not false.
  **It stays.** Reword it at the next bump, which § 2.2's P2 already calls for.
- **`care.invitationNotShared`**: "No verá tus alergias, tus intolerancias ni tu correo". It sits
  under a positive list of what the dietitian sees, and conversations are not in that list. It
  is true, and it widens nothing. **It stays**, with no `CARE_CONSENT_VERSION` bump.
- **The professional's agreement**: "No verás sus alergias ni intolerancias, su correo, sus
  comentarios escritos ni nada de otras personas". The same reasoning applies. **It stays.**
- The check-in's "ya no llega al modelo" is scoped to the check-in comment, and it is true: the
  comment is not in the assistant's context.

**No consent version moves**, because F5 was fixed by taking data out.

- `PROFILE_CONSENT_VERSION` stays: nothing more under that consent leaves the server.
- `HEALTH_CONSENT_VERSION` stays: the wall holds.
- `CARE_CONSENT_VERSION` stays: R10 narrows nothing.
- The policy's "si el cambio afecta a cómo tratamos tus datos de salud, te pediremos tu
  consentimiento de nuevo" is therefore **not** triggered. It **would be** under F5 (b) or (c),
  or if the goal had stayed with nothing done.

## 4. `/condiciones`: the strings

**Where**: namespace `terms` in `es-ES.ts` and `en-GB.ts`.

**T1. «Contenido generado con inteligencia artificial»: a fourth paragraph, after the dish-request one.**

- es-ES: `'El asistente contesta con inteligencia artificial a preguntas sobre tu plan, recetas, ingredientes y macros. Puede equivocarse, y lo que dice no es el consejo de un médico ni de un dietista-nutricionista. Nunca cambia tu plan: los cambios se hacen desde Plan. Puede no contestar una pregunta —si es de salud, si no es de nutrición, o si la respuesta iba a nombrar algo que nos has dicho que no puedes tomar o a darte una cifra que no sale de tu plan— y, si para una respuesta a medias, lo que ya has leído estaba revisado. No escribas en él enfermedades, medicación ni otros datos de tu salud: lo que escribes se envía al modelo que responde y se guarda en tu cuenta, como explica la política de privacidad.'`
- en-GB: `'The assistant answers questions about your plan, recipes, ingredients and macros with artificial intelligence. It can get things wrong, and what it says is not the advice of a doctor or a dietitian-nutritionist. It never changes your plan: changes are made from Plan. It may not answer a question — if it is about health, if it is not about nutrition, or if the answer was about to name something you have told us you cannot have or to give you a figure that does not come from your plan — and, if it stops an answer part-way, what you have already read had been checked. Please do not write about conditions, medication or anything else about your health in it: what you type is sent to the model that answers and kept in your account, as the privacy policy explains.'`
- Why: TRLGDCU art. 60.1 (the service's main characteristics, before contracting); Law 7/1998
  art. 5.5 (clarity); Law 3/1991 arts. 5.1 and 7.1. A declined answer is not a breach because
  the contract says declining is the service. AI Act art. 50.1 (on the screen; here as the
  contract's description). The warning's clauses 1–3 and 6, in the contract's voice.

**T2. «El plan gratuito y Premium», `paragraphs[0]`: one phrase changed and two sentences added.**

- es-ES current: `NutrIA se puede usar gratis, con unos límites en los planes que puedes rehacer, las comidas que puedes cambiar y los eventos de cada plan. Con el plan gratuito…`
- es-ES replacement: `NutrIA se puede usar gratis, con unos límites en los planes que puedes rehacer, las comidas que puedes cambiar, los eventos de cada plan y los mensajes que puedes enviar al asistente cada quincena. Un mensaje al asistente cuenta aunque después lo borres. Si en una quincena le haces muchas preguntas que no son de nutrición, deja de contestar durante el resto de esa quincena, y si el asistente llega a su límite de gasto del mes, deja de contestar a todo el mundo hasta el día 1; tu plan y todo lo demás siguen funcionando. Con el plan gratuito…` (the rest of the paragraph unchanged)
- en-GB current: `NutrIA can be used for free, with limits on the plans you can redo, the meals you can swap and the events in each plan. On the free plan…`
- en-GB replacement: `NutrIA can be used for free, with limits on the plans you can redo, the meals you can swap, the events in each plan and the messages you can send the assistant each fortnight. A message to the assistant counts even if you delete it afterwards. If in a fortnight you ask it many questions that are not about nutrition, it stops answering for the rest of that fortnight, and if the assistant reaches its spending limit for the month, it stops answering everybody until the 1st; your plan and everything else keep working. On the free plan…` (the rest of the paragraph unchanged)
- Why: TRLGDCU art. 60.1 and 60.2.b (main characteristics, including limits); art. 80.1.a
  ("concreción, claridad y sencillez"). Each sentence is what the code does: the allowance
  (`Allowance.ts:120,143`), the ledger not refunded on deletion, the off-topic ceiling (10, with
  no call past it), `AssistantUnavailableError('budget')`.
  - The numbers (20 / 100) are shown on the screen (`assistant.left`) and stay out of the terms,
    as the other limits do.
  - The rolling-14-day case is covered by "esa quincena", because the screen calls it "los
    últimos 14 días".
  - "La seguridad alimentaria… es la misma con Premium y sin él" stays true: the net does not
    depend on the tier.

**T3. «Uso aceptable»: one list item, after `'Intentar saltarse los límites del plan gratuito o las medidas de seguridad.'`.**

- es-ES: `'Usar el asistente para algo que no sea la nutrición, o intentar que diga lo que no debe o que se salte sus comprobaciones.'`
- en-GB: `'Using the assistant for anything other than nutrition, or trying to make it say what it must not or get around its checks.'`
- Why: Law 7/1998 art. 5.5. It sits beside the existing security clause. It also mirrors
  Anthropic's Usage Policy duties on the operator (§ 8.6).

**T4. «Responsabilidad», paragraph 1.**

- es-ES current: `No respondemos de las decisiones de salud que tomes a partir de un plan sin consultar a un profesional, ni de los productos que compres.`
- es-ES replacement: `No respondemos de las decisiones de salud que tomes a partir de un plan o de una respuesta del asistente sin consultar a un profesional, ni de los productos que compres.`
- en-GB current: `We do not answer for health decisions you take from a plan without speaking to a professional, nor for the products you buy.`
- en-GB replacement: `We do not answer for health decisions you take from a plan or from an answer of the assistant without speaking to a professional, nor for the products you buy.`
- Why: the same allocation as for a plan, extended to the new output. It is still bounded by
  "Respondemos… de todo aquello que la ley no permite excluir" and "Nada de esto limita los
  derechos que tienes como consumidor" (TRLGDCU arts. 86 and 128-149: no exclusion of
  liability for harm the trader causes). Whether the clause survives an unfair-terms review is
  the existing question for the lawyer ([`analysis.md`](./analysis.md) § 10).

**T5. «Propiedad intelectual»: one phrase.**

- es-ES current: `Lo que tú escribes —tu perfil, tus comentarios— sigue siendo tuyo;`
- es-ES replacement: `Lo que tú escribes —tu perfil, tus comentarios, tus preguntas al asistente— sigue siendo tuyo;`
- en-GB current: `What you write — your profile, your comments — remains yours;`
- en-GB replacement: `What you write — your profile, your comments, your questions to the assistant — remains yours;`
- Why: Law 7/1998 art. 5.5. It is what the product does: questions are stored for the person
  alone and never shared or reused. Without it, the only clause about written text names
  something else.

**`TERMS_VERSION`: from `2.1.0` to `2.2.0`, and `terms.updated`, in the same commit.**

- Why it moves: T2 adds a limit and T4 extends an exclusion. Both change meaning, and the house
  rule raises the version for any change of meaning
  ([`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) § 5,
  "any change of meaning in `terms`… raises `TERMS_VERSION` and `terms.updated` in the same
  commit").
- What it does: it records which version a **new** account accepts. Existing accounts are
  **not** re-asked, because nothing gates on it (`auth.config.ts:137` writes it at sign-up only).
  For them, the clause "Cambios en estas condiciones" applies: notice by mail before it
  applies, and continued use. Hence the mail in § 6.
- `terms.updated`: `Última actualización: {día} de {mes} de 2026` / `Last updated: {day} {month} 2026`.

## 5. The sentence `PRODUCT.md` needs (plan step 3)

**Where**: `docs/PRODUCT.md`, the paragraph "On the health data the product now collects", after
its last sentence ("…never deducted from what a plan must supply."). Draft:

> All of this is about what the product **records**. The assistant (project 023) sends a model
> what a person types into a conversation, and nothing can stop somebody typing a condition or a
> medication there. That text is governed instead by the warning that opens every conversation,
> which asks them not to, and by `/privacidad` § «El asistente». It produces none of the three
> things above. A question the code itself judges clinical is not kept. Anything else typed is
> kept only for its author, until they delete it or six months after the conversation's last
> message.

Why each part: the promise "never placed in a prompt" stays true of what is **recorded** (the
`Health` tables, the wall), and the paragraph says so instead of growing an exception. "Produces
none of the three things": no exclusion, no suggestion, no notice comes from chat text (no
reader of `ai_messages` outside `AssistantRepository`). "Not kept": F2. "Only for its author":
PRD 11.

## 6. The mail before the switch (pattern: [`textos/06`](./textos/06-correos.md) § G)

Also filed as [`textos/06`](./textos/06-correos.md) § Q.

- **When**: once, to every account, **after** both pages are published and **before** the switch.
  The switch is thrown no earlier than the day after, as in § G. `{date}` is the day the owner
  plans to throw it. If the date slips, the mail is not resent. If the switch is wanted earlier,
  the mail goes earlier: never the reverse.
- **Why**: the policy promises "Si cambiamos algo importante… te avisaremos por correo antes de
  que se aplique", and the terms promise the same. A new recipient, a new store of free text and
  a new limit are important. This is not the 2026-10-20 case, which narrowed a screen and added
  no recipient.
- **If the owner does not send it** (he said on 2026-10-20 "no voy a mandar correos"):
  - the change applies without the notice both pages promise, which is a published promise
    broken (TRLGDCU art. 60.1; GDPR arts. 5.1.a and 13.3);
  - and in the terms, continued use is weak evidence of acceptance of T2 and T4 **[lawyer]**.
  - **I would not throw the switch without it.**

| Field | es-ES | en-GB |
| --- | --- | --- |
| `subject` | `Llega el asistente de NutrIA, y cambian la política de privacidad y las condiciones` | `NutrIA’s assistant is coming, and the privacy policy and terms are changing` |
| `intro` | `A partir del {date}, NutrIA tiene un asistente: puedes preguntarle por tu plan, por recetas, ingredientes y macros, y te contesta una inteligencia artificial. Es opcional: si no lo usas, no se envía ni se guarda nada nuevo sobre ti.` | `From {date}, NutrIA has an assistant: you can ask it about your plan, recipes, ingredients and macros, and an artificial intelligence answers. It is optional: if you do not use it, nothing new about you is sent or kept.` |
| `what` | `Si lo usas, lo que escribes se envía a Anthropic, que ejecuta el modelo, junto con tu plan, tus objetivos diarios y tus gustos; nunca tu nombre, tu correo, tu peso, tus alergias ni tu salud. Anthropic no entrena con ello y lo borra como mucho a los 30 días, salvo que sus sistemas lo marquen como contrario a sus normas de uso. Tus conversaciones se guardan en tu cuenta para que puedas retomarlas: no las ve tu dietista ni aparecen en nuestra consola, puedes borrarlas cuando quieras y se borran solas seis meses después de su último mensaje. Por favor, no escribas en el asistente nada sobre tu salud.` | `If you use it, what you type is sent to Anthropic, which runs the model, together with your plan, your daily targets and your tastes; never your name, email, weight, allergies or health. Anthropic does not train on it and deletes it within 30 days at most, unless its systems flag it as breaking its usage rules. Your conversations are kept in your account so that you can come back to them: your dietitian does not see them and they do not appear in our console, you can delete them whenever you like, and they delete themselves six months after their last message. Please do not write anything about your health in the assistant.` |
| `terms` | `Las condiciones de uso cambian para incluirlo: los mensajes al asistente tienen un límite por quincena, más alto con Premium; el asistente puede equivocarse y no sustituye a un profesional; y no respondemos de las decisiones de salud que tomes a partir de una respuesta suya sin consultar a un profesional, como ya pasaba con los planes.` | `The terms of use change to include it: messages to the assistant have a limit each fortnight, higher with Premium; the assistant can get things wrong and does not replace a professional; and we do not answer for health decisions you take from one of its answers without speaking to a professional, as was already the case with plans.` |
| `choose` | `Los detalles están en {privacyUrl}, en «El asistente», y en {termsUrl}. Si tienes cualquier duda, escríbenos a {email}. Si no estás de acuerdo, puedes no usar el asistente o borrar tu cuenta desde tu perfil.` | `The details are at {privacyUrl}, under "The assistant", and at {termsUrl}. If you have any question, write to us at {email}. If you do not agree, you can simply not use the assistant, or delete your account from your profile.` |

**Sources:**

- The two promises: policy «Cambios en esta política»; terms «Cambios en estas condiciones».
- GDPR arts. 12.1, 13.1.e–f and 13.3.
- TRLGDCU art. 60.1.
- "nunca tu peso, tus alergias ni tu salud": § 3.1 ¶ 2.
- "no entrena", "30 días": § 8.
- "Es opcional: si no lo usas…": no row is written and no call is made until somebody sends a
  message.
- A service mail, not a commercial one: LSSI art. 21 does not apply.
- No template exists. If it is sent by hand, use blind copy (BCC), as in § G.
- `{privacyUrl}` and `{termsUrl}` are `/privacidad#asistente` and `/condiciones`, or their `/en`
  forms for an English account.

## 7. The warning, re-read against the final pages (plan step 4)

| Warning clause | What the pages now say | Same thing? |
| --- | --- | --- |
| "asistente de inteligencia artificial, no con una persona: puede equivocarse" | terms T1 "Puede equivocarse" | yes |
| "no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado" | policy intro, terms intro, T1 | yes. T1 says "no es el consejo de", in a contractual voice, with the same meaning. |
| "Lo que escribes se envía al modelo que responde" | § 3.1 ¶ 1–3: sent, labelled, the lexicon's catches go nowhere | yes. The warning over-tells (it does not exclude the lexicon's catches), which is harmless. |
| "y se guarda para que puedas retomar la conversación" | ¶ 1 and ¶ 6, with six months | yes. The period lives in the policy, as planned. A clinical question is not kept (¶ 3), and the screen says so at that moment ("Pregunta no guardada"). |
| "no escribas aquí enfermedades, medicación ni otros datos de tu salud" | ¶ 9, R5, T1 | yes, the same words |
| "Si tienes una alergia, añádela a tu perfil, que es donde la tenemos en cuenta" | ¶ 4: the check reads the profile, and the model is not told | yes. It is now true for a second reason (F1). |
| "Puedes borrar un mensaje o la conversación entera cuando quieras" | ¶ 6, ¶ 7, R11: deleted at once; the count stays; Anthropic's copy is not reached | yes. The warning never says "everything disappears". |
| "Más en la {privacy}" → `/privacidad#asistente` | the section's `id` is `asistente` in both languages | yes, once § 3.1 ships. The link is already drawn (`AssistantChat.tsx:249`). |

**Verdict: the warning needs no change, and no constant moves.**

## 8. What Anthropic's own pages say (plan step 6), read on 2026-11-10

These are quoted as **what they say**, for the lawyer to confirm, and are not my verdict. The
quotes in quotation marks were checked word for word against the raw HTML (fetched with `curl`
and searched with `grep`) after a summarising fetch. Where a page could not be read, it says so.

1. **Commercial Terms of Service**, "Effective Jun 17, 2025", "Audience Business".
   - Preamble: "'Anthropic' means Anthropic Ireland, Limited if Customer resides in the
     European Economic Area ('EEA'), Switzerland or UK, and Anthropic, PBC if Customer resides
     anywhere else."
   - Preamble: the terms are "an agreement between Anthropic and you or the organization,
     company, or other entity that you represent ('Customer')".
   - § B: "Anthropic may not train models on Customer Content from Services."
   - § C: "Data submitted through the Services will be processed in accordance with the
     Anthropic Data Processing Addendum ('DPA'), which is incorporated into these Terms by
     reference." The site footer: "Services in the EU are provided by Anthropic Ireland
     Limited."
2. **Data Processing Addendum**, "Effective Feb 24, 2025".
   - Preamble: it "is incorporated into and forms part of the Anthropic Commercial Terms of
     Service or other agreement".
   - § B.1: "Customer is the controller and Anthropic is Customer's processor" (from the
     raw page, checked word for word).
   - § A.8 and § I.1: "the SCCs Module Two (controller to processor) and/or Module Three
     (processor to processor)… are hereby incorporated by reference and will be deemed to have
     been executed".
   - Schedule 1 § B.3: "Special categories of personal data (if applicable): None."
   - **No mention of the Data Privacy Framework.** So the DPA needs no separate signature, and
     its SCCs are deemed executed: the plan's step 6 claim holds as the pages state it.
3. **The DPF list**: the public participant API (the one `dataprivacyframework.gov/list` calls),
   queried on 2026-11-10, with the list file dated "Tuesday, November 10, 2026 6:00 AM EST".
   - "Anthropic", active: 0. Inactive: 0. "Claude": 0.
   - Controls, active: Stripe 1 (Stripe, LLC), Vercel 1 (Vercel Inc.), Sentry 1 (Sentry.io),
     Neon 1 (Databricks, Inc.).
   - So I write "no está en el Marco", and I say how I know.
4. **Retention, two pages that differ.**
   - The privacy-center article "How long do you store my organization’s data?", dated "July 1,
     2026":
     - "For Anthropic API users, we automatically delete inputs and outputs on our backend
       within 30 days of receipt or generation, except…";
     - "We retain inputs and outputs for up to 2 years and trust and safety classification
       scores for up to 7 years if your chat is flagged by our automated trust and safety
       systems as violating our Usage Policy."
   - The platform page "API and data retention": "Conversation content (your prompts and
     Claude’s outputs) is not retained by default; the exception is Covered Models, which
     require 30-day retention." Its Covered Models are the Fable and Mythos families, and Haiku
     5.5 is not one. Also: "Retained data is never used for model training without your express
     permission", and "if a chat or session is flagged, Anthropic may retain inputs and outputs
     for up to 2 years".
   - The policy states the **upper bound** ("como mucho a los 30 días"), which is true under
     both pages. Which one governs is item 17(j).
5. **Data residency** (platform page):
   - inference geo `"global"` is the "Default. Inference may run in any available geography";
   - "Currently, `"us"` is the only available workspace geo";
   - US-only inference "is priced at 1.1x the standard rate".
6. **Usage Policy**, "Effective Nov 12, 2026". That is two days after this was written, and it
   is the version that will be in force at the switch.
   - "All consumer-facing chatbots or AI agents that communicate directly with external users
     must disclose to users that they are interacting with AI rather than a human. This
     disclosure must be provided at a minimum at the beginning of each chat session or in the
     product interface." The warning does this.
   - Among the high-risk areas: "Medical — diagnosing a condition; recommending, starting,
     stopping, or adjusting a treatment or medication, including dose".
   - Among the exclusions: "Wellness content, such as education on sleep, stress, nutrition, or
     exercise."
7. **Sub-processors** (`trust.anthropic.com/subprocessors`): the page is drawn by script and did
   not read with either tool on 2026-11-10. The owner or the lawyer reads it in a browser (§ 9,
   item 17(h)).

## 9. For the lawyer's hour (beside [`analysis.md`](./analysis.md) § 10 and [`assistant-warning.md`](./assistant-warning.md) § 4)

Item 17 grows. Items (a)–(f) stand as written in `assistant-warning.md` § 4.

- **(c) is decided**: six months from the last message, owner, 2026-11-10. The question for the
  lawyer is now only whether six months is defensible.
- **(g) is amended.** With F5 fixed (goal and way of eating out), the remaining question is
  whether the **targets** and the plan's figures sent to Anthropic are health data under
  C-184/20.
- **(h) Transfers.**
  - EU processor (Anthropic Ireland) and onward transfer to Anthropic, PBC and US
    infrastructure, on SCC Module Three.
  - Is the policy's sentence enough?
  - Should a transfer impact assessment be asked for (DPA § I.4)?
  - Who are the sub-processors? The page would not render (§ 8.7).
- **(i) "Special categories: None"** in the DPA's Schedule 1, against free text that may hold
  health data despite the warning.
  - Does art. 28.3 ("el tipo de datos personales") require the description to say so?
  - Or is incidental, discouraged data outside what a description must foresee?
  - Five minutes.
- **(j) Anthropic's retention.**
  - Which of the two pages governs (§ 8.4)?
  - Is Anthropic a controller for its trust-and-safety copy (2 years) and its scores (7 years)?
- **(k) The owner as an individual under "Audience: Business" Commercial Terms**, and the key's
  organisation. The no-training sentence and the DPA depend on it.
- **(l) The allergy screening** of answers, under a consent whose body says "solo para calcular
  tus objetivos y elegir tus platos" (§ 2.2 P2). Is a protective use on our server within it?
- **(m) Notice before the switch.**
  - Is one day before enough for a terms change that adds a limit and extends an exclusion
    (TRLGDCU art. 85.3; Law 7/1998)?
  - What follows if the owner sends no mail (§ 6)?
- **(n) `"global"` inference.** Does "Estados Unidos y… quizá en otros países" meet art. 13.1.f,
  or must the countries be named, which only pinning to the US makes possible?

## 10. Before the switch: the boxes

Also added to [`go-live-checklist.md`](./go-live-checklist.md) § 0 undecies.

1. [ ] **F5 merged**. `goal` and `dietaryPatterns` out of `AssistantContext` (prompt 1.2.0) and
   the boundary test updated. Built on branch `assistant-023-phase-7` on 2026-11-10; the box is
   ticked when that code is in production with the text. Without it, ¶ 2's "Nunca recibe… tu
   objetivo… tu forma de comer" is false.
2. [ ] **The sweep** (both deletions) is merged and deployed with the dictionary change. The six
   months and the 60 days are not published before the code that keeps them.
3. [ ] **`/privacidad`**: § 3.1 and R1–R12, both languages, with the comment blocks.
   **`/condiciones`**: T1–T5, `TERMS_VERSION` `2.2.0` and `terms.updated` in the same commit.
   `pnpm --filter web test` (`legal.test.ts`) green, and `sh scripts/check-leaks.sh` clean.
4. [ ] **`PRODUCT.md`** gains § 5's sentence (owner approves; `docs/` is "owner decides").
5. [ ] **The owner confirms**:
   - in the Console, that the key `ANTHROPIC_API_KEY` belongs to an organisation under the
     Commercial Terms, not a consumer plan;
   - on his invoice, that the contracting entity is Anthropic Ireland, Limited;
   - that production's `AI_ASSISTANT_MODEL` is empty or `claude-haiku-5-5`, the model ¶ 5 names;
   - and whether he pins inference to the US (§ 2.5). If he does, ¶ 5, R7 and R8 may drop "otros
     países", and only then.
6. [ ] **The mail** (§ 6) is sent, and the switch is thrown no earlier than the next day.
7. [ ] **The landing card** (`landing.features`) becomes true at the switch (F4). Nothing to do
   but throw it.
8. [ ] **P2, after the switch, not before**: a way to answer a portability or copy request for
   conversations without anybody reading them (§ 2.6).

## 11. What changed elsewhere in this folder

- [`textos/02-politica-privacidad.md`](./textos/02-politica-privacidad.md): a header entry
  pointing here. These strings are the source for those sections until the file is folded back
  into one text.
- [`textos/03-condiciones-uso.md`](./textos/03-condiciones-uso.md): § J, pointing here.
- [`textos/06-correos.md`](./textos/06-correos.md): § Q, the mail in § 6.
- [`analysis.md`](./analysis.md) § 7: the art. 50.1 line no longer says there is no assistant.
- [`record-of-processing.md`](./record-of-processing.md): row 10, the assistant.
- [`dpia.md`](./dpia.md) § 8: the addendum.
- [`assistant-warning.md`](./assistant-warning.md): § 3.2 and § 3.3 point here; § 0 gains F5.
- [`go-live-checklist.md`](./go-live-checklist.md) § 0 undecies.
- [`README.md`](./README.md): the index line.
