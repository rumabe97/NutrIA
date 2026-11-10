# The assistant's opening warning (project 023, phase 5)

> **I am not a lawyer.** This is the text and the reasoning a lawyer would check, with every
> clause tied to the article it rests on and to what the code does (`path:line` at `336487e4`).
> Anything that depends on an interpretation is marked **[lawyer]**.
>
> **Purpose**: the words that open every conversation with the assistant, in both languages,
> where they go, why each clause is there, and what `/privacidad` and `/condiciones` must say
> before the `assistant` switch is thrown. **Audience**: the owner (who approves the wording),
> the lead, `frontend`, `backend`. **Committed**: yes. **Maintained by**: the `legal` agent.
> Written 2026-11-10 against `main` at `336487e4`
> ([`0104`](../decisions/0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md),
> [`0105`](../decisions/0105-only-a-nutritional-figure-has-to-be-the-services.md), PRD 023 criteria 12–13).

## 0. In five lines

1. The warning is § 1: four sentences and one link, the same in meaning in both languages.
2. It is **information, not consent**. Nothing is accepted or stored, so there is no version
   constant to create or bump. What proves it was given is the code and PRD 12's test.
3. It is worded to stay true whatever phase 7 decides about retention. It never says "until you
   delete it", "only you can read it", or "clinical questions never reach the model".
4. **Two things in the code block the switch, not the warning** (§ 3.1, F1 and F2), and two
   more do not: a P2 (F3) and a public sentence that shipping phase 7 makes true (F4). The
   worst: the assistant sends the model the names of the foods linked to a person's declared
   allergies and intolerances (`apps/api/src/modules/assistant/services/Assistant.service.ts:334`).
   That is health data. The published health consent says the model never receives it, and
   `0104` clause 3 says the assistant reads only what the plan generator reads.
5. Before the switch, `/privacidad` changes in nine places and `/condiciones` in four (§§ 3.2, 3.3).

## 1. The text

### es-ES: `assistant.warning`

```text
Estás hablando con un asistente de inteligencia artificial, no con una persona: puede equivocarse, y lo que dice no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado. Lo que escribes se envía al modelo que responde y se guarda para que puedas retomar la conversación, así que no escribas aquí enfermedades, medicación ni otros datos de tu salud. Si tienes una alergia, añádela a tu perfil, que es donde la tenemos en cuenta. Puedes borrar un mensaje o la conversación entera cuando quieras. Más en la {privacy}.
```

`assistant.warningPrivacy`: `política de privacidad`

### en-GB: `assistant.warning`

```text
You are talking to an AI assistant, not a person: it can get things wrong, and what it says does not replace the advice of a doctor or a registered dietitian-nutritionist. What you type is sent to the model that answers and kept so you can come back to the conversation, so please do not write about conditions, medication or anything else about your health here. If you have an allergy, add it to your profile, which is where we take it into account. You can delete a message or the whole conversation whenever you like. More in the {privacy}.
```

`assistant.warningPrivacy`: `privacy policy`

### Where it goes and how it is drawn

- **Keys**: `assistant.warning` replaces the `'__LEGAL_PENDING__'` placeholder that phase 5's
  work in progress already has. `assistant.warningPrivacy` is new. `assistant.warningLabel`
  (`Aviso` / its English) stays as the speaker line.
- **The allergy sentence is the only one beyond what PRD 12 and the brief require**: that it is
  AI, that it can be wrong, that it is not professional advice, not to write clinical details,
  and that the conversation is kept and can be deleted. If the warning reads too long on a phone, that sentence is
  the one the owner can drop without breaking a duty. I would keep it (clause 7 below).
- **The link**: `{privacy}` is drawn as a link to `withLocale('/privacidad#asistente', locale)`,
  as `CareInvitation.tsx:176` does for `#tu-dietista`. **Pasting the string is not enough.**
  `AssistantChat.tsx` in phase 5's work in progress prints `{t.warning}` as plain text, so the
  screen would show a literal `{privacy}` until the component splits it. The `asistente` anchor does not exist
  yet: phase 7 creates it as the `id` of the new privacy section (§ 3.2, item 1). Until then
  the link lands at the top of the page, which is acceptable only because the switch is off.
- **How it is shown** (AI Act art. 50.5: "de manera clara y distinguible a más tardar con
  ocasión de la primera interacción", and "se ajustará a los requisitos de accesibilidad"):
  - it is the first item of every conversation, new or reopened, before the field accepts
    anything, and nobody can dismiss it (PRD 12);
  - it reads as **NutrIA's notice**, not as one of the model's answers. It has its own speaker
    line (`Aviso`), it is not styled exactly like an answer, and it speaks of the assistant in
    the third person. The declines speak in the first person ("No puedo…", "He parado…"), and
    that is fine: those are the assistant talking;
  - it is real text in the DOM, readable by a screen reader, and it is not inside the live
    region that announces a streaming answer. The `accessibility` agent owns the detail.
- **No version constant.** It asks for nothing and stores nothing. If its words change later,
  record the change here; nothing has to be re-accepted. (Compare the profile consent, which is
  a consent and does have a version: § 3.1, F1, option b.)

## 2. Each clause, and what it rests on

Sources, read 2026-11-10: AI Act, Regulation (EU) 2024/1689, `DOUE-L-2024-81079`. Its
amendment, Regulation (EU) 2026/1744, `DOUE-L-2026-81147`, changes art. 50 only in its
paragraph 7 and adds art. 111.3 for art. 50.2; art. 50.1 and 50.5 are as published. GDPR,
`DOUE-L-2016-80807`: arts. 4.11, 7.4, 9.1, 12.1, 13, 20 and 25 read in it; art. 17 as
[`analysis.md`](./analysis.md) cites it. TRLGDCU, BOE-A-2007-20555, consolidated to 04/11/2026
(art. 60.1). Law 3/1991, BOE-A-1991-628, consolidated to 27/12/2025 (arts. 5.1 and 7.1). LOPDGDD, BOE-A-2018-16673, consolidated to 27/12/2025. Law 44/2003,
BOE-A-2003-21340, consolidated to 05/06/2021. Regulation (EU) 2017/745 (MDR),
`DOUE-L-2017-80916`. Anthropic's pages, as quoted in § 3.2.

| # | Clause (es-ES) | Why it is there | Rests on |
| --- | --- | --- | --- |
| 1 | "Estás hablando con un asistente de inteligencia artificial, no con una persona" | NutrIA is the **provider** of a system "destinado a interactuar directamente con personas físicas" that it puts into service under its own name ([`analysis.md`](./analysis.md) § 7). The switch is thrown after 2/8/2026, so art. 50.1 applies from the first conversation (art. 113; 2026/1744 gives no transitional period for 50.1). I do not rely on the "resulte evidente" exception. | AI Act art. 50.1 and 50.5. Anthropic's Usage Policy (effective 12/11/2026) says the same: "All consumer-facing chatbots or AI agents that communicate directly with external users must disclose to users that they are interacting with AI rather than a human." |
| 2 | "puede equivocarse" | No article requires these words. They are the honest half of clause 1, and what PRD 12 asks for ("what that means for the reliability of what it says"). They match the terms' "Contenido generado con inteligencia artificial" ("Aun así pueden contener errores"). | PRD 12; `terms` § "Contenido generado con inteligencia artificial" |
| 3 | "no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado" | The product's own published phrase, word for word (`privacy.intro`, es-ES.ts:2845; the terms' intro), so that the warning and the pages say the same thing. It keeps the **intended purpose** non-medical. Under the MDR, intended purpose is what the manufacturer says "en el etiquetado, en las instrucciones de uso o en el material o las declaraciones de promoción". Software with a "fin médico" of diagnosis, treatment or alleviation is a medical device. It also names the regulated profession whose work this is not: "actividades orientadas a la alimentación de la persona… adecuadas a las necesidades fisiológicas y, en su caso, patológicas". | MDR art. 2(1) and 2(12); Law 44/2003 art. 7.2.g. Whether this keeps the assistant outside the MDR is the same question as [`analysis.md`](./analysis.md) § 10 point 9 **[lawyer]** |
| 4 | "Lo que escribes se envía al modelo que responde" | Recipients have to be told when the data are collected, and this is the moment free text is collected. The warning names the category of recipient. `/privacidad` names the company (§ 3.2). It does not say *every* message is sent, because a question the clinical lexicon catches never is (`Assistant.service.ts:244-246`); over-telling is harmless, under-telling is not. | GDPR art. 13.1.e |
| 5 | "y se guarda para que puedas retomar la conversación" | The purpose of the store. It deliberately says nothing about **how long**, so that it stays true if phase 7 sets a cap (§ 3.2, item 5). The period goes in `/privacidad`. | GDPR art. 13.1.c and 13.2.a |
| 6 | "no escribas aquí enfermedades, medicación ni otros datos de tu salud" | A condition somebody types is special-category data. The CJEU reads "data concerning health" to include data from which health can be deduced (C-184/20 *OT*, 1/8/2022). No art. 9.2 exception fits a sentence volunteered in a chat: it is not an explicit consent, and not "manifiestamente público". So the honest move is to ask for less. **The warning reduces the risk; it is not a legal basis for what is typed anyway.** That residue is § 4, point 1 **[lawyer]**. | GDPR arts. 5.1.c, 9.1, 25.2 ("por defecto, solo sean objeto de tratamiento los datos personales que sean necesarios"); `0104` § Consequences |
| 7 | "Si tienes una alergia, añádela a tu perfil, que es donde la tenemos en cuenta" | A safety sentence, not a legal duty. The allergen net (`answerNamesAnAllergen`, `packages/core/src/domain/Assistant/AllergenNet.ts`) and the plan's own gate read the **profile**. An allergy written only into a chat has no code behind it. Somebody who types "soy alérgico a los frutos secos" and trusts that to protect them is the person this sentence is for. It is true whichever way F1 (§ 3.1) is fixed. | `terms` § "Alergias e intolerancias"; GDPR art. 5.1.c (the allergy lives in one place, under its consent) |
| 8 | "Puedes borrar un mensaje o la conversación entera cuando quieras" | Describes what the code does: `AssistantRepository.deleteTurn` / `deleteConversation` (`packages/core/src/repositories/Assistant/AssistantRepository.ts:140,160`), both owner-scoped. It does not claim that *everything* disappears. A row with no text stays in `assistant_usage` so the message still counts, and the provider keeps its own copy for a while (§ 3.2, item 5). `/privacidad` says both. | GDPR arts. 12.2 and 17 |
| 9 | "Más en la {privacy}" | One link, to the section about exactly this. It is a pointer, **not** the LOPDGDD art. 11 "información básica" layer: that layer needs the controller's identity, the purpose and the rights, and it is met by the policy the person was given at sign-up plus the new section published before the switch (GDPR art. 13.4 for what they already have). | GDPR art. 12.1 ("de fácil acceso"); LOPDGDD art. 11.1 |

**What it deliberately does not say:**

- "Only you can read it." The provider receives every answered message, and `/privacidad`
  already admits database access "para arreglar un fallo" (es-ES.ts:2991).
- "Clinical questions never reach the model." Only the lexicon's catches are kept from it. A
  paraphrase goes to the label call (`Assistant.service.ts:248`), and a question the label
  misses goes to the answer.
- "Until you delete it." Retention is still open (§ 3.2, item 5).
- The model's or the company's name. That belongs in `/privacidad`, where it changes in one
  place if `AI_ASSISTANT_MODEL` or the provider changes.

## 3. What has to be true before the switch

### 3.1 In the code: four findings, two of which block the switch

No `backend` or `frontend` agent was reachable on 2026-11-10, so the lead carries these to
whoever owns the files.

**F1 · P0 at the switch: the model is told the names of what a person's allergies forbid.**
`Assistant.service.ts:334` puts `excludedFoods` into the context, which holds every declared
allergen and intolerance by name plus every food that contains one (`forbiddenFoods`,
`AllergenNet.ts:93-123`, `told: true`). The system prompt hands it over as "foods this person
cannot eat" (`packages/core/src/domain/Assistant/AssistantPrompt.ts:34`). The plan generator
receives nothing like it: `PoolPrompt` gets a catalogue **already filtered**, "le llega el
efecto, nunca el dato". A list of the form "huevo, mayonesa, tortilla…, cannot eat" reveals an
allergy or intolerance by deduction (C-184/20), so it is health data
([`analysis.md`](./analysis.md) § 1.2), and it goes to a processor in the United States. The
brief's "never health data" holds for the `Health` and `Care` tables, which the wall protects.
It does not hold for this field.

What it contradicts:

- the explicit health consent every account gave, `profileConsent.ai` (es-ES.ts:3119,
  en-GB.ts:2970), "Nunca recibe… tus alergias ni intolerancias";
- `/privacidad` (es-ES.ts:2927);
- `0104` clause 3, "It reads what the plan generator reads, and nothing more". No clause of
  `0104` records the choice to tell the model these names. It lives in a code comment
  (`AllergenNet.ts`, "the prompt makes that fair") and in the boundary test's reviewed key list.
  So option (a) below brings the code back to the record, and option (b) needs a new record
  that supersedes clause 3.

The policy also promises "si el cambio afecta a cómo tratamos tus datos de salud, te pediremos
tu consentimiento de nuevo" (es-ES.ts:3010). Thrown as it is, the switch sends health data to a
recipient that no consent names, against a published text. That is P0 on both of this
folder's counts.

Two ways out. The owner decides:

- **(a) Stop sending it (my recommendation for go-live).** Drop `excludedFoods` from the
  context and its prompt line, and update the boundary test's key list. The net still works,
  because it runs on our side against `forbidden`, which never leaves the server.
  - What changes: the allergy contradiction goes, with no change to any consent.
  - **One question stays, and it is not a third blocker unless the lawyer makes it one.** The
    goal (for example `weight_loss`) and the targets go to a new recipient for a new purpose.
    `profileConsent.ai` describes dish design only. On the broad reading of
    [`analysis.md`](./analysis.md) § 10 point 3(c), where "losing weight" is health data, the
    consent needs a sentence about the assistant and `PROFILE_CONSENT_VERSION` goes up. On the
    narrow reading, the new policy section is enough. **[lawyer]**, § 4 item 17(g).
  - What it costs: more withheld answers. "¿Qué uso en vez de huevo?" will often get an answer
    that names egg, and the net withholds it. Phase 6's withhold rate will show by how much.
- **(b) Keep sending it, under a consent of its own.** An optional, versioned consent asked
  the first time `/asistente` is opened (a new `ASSISTANT_CONSENT_VERSION`), withdrawable, and
  naming the recipient. Withdrawing it stops the list being sent.
  - Why not rewrite the profile consent instead: it is the condition for getting any plan at
    all. Folding an optional feature's purpose into it would make it neither specific nor
    freely given for that purpose (GDPR arts. 4.11 and 7.4).
  - What it costs: a screen, a stored acceptance, the text, and a DPIA addendum.

**F2 · P0 at the switch: a question the code has itself judged clinical is kept, word for
word.** `Assistant.service.ts:212` stores `content: question` whatever the decline. On a
`clinical` decline that question is, by the code's own verdict, most likely about somebody's
health, and it stays in the thread with no art. 9.2 exception. The conversation's title is
also taken from it (`AssistantController.open(…, question)`, `:209`). This is not the
incidental case of clause 6: here the code knows.

- **Smallest fix**: on `clinical`, store the user turn with empty content and the decline code,
  and do not title the conversation from it. The screen shows the decline under a "pregunta
  retirada" line.
- **Cost**: somebody cannot reread a question they were told to take to a professional.

**F3 · P2: `assistant_usage` has no end.** Each row names a person and a time, and it is needed
only for the fortnight window and the off-topic ceiling. It is kept for the life of the account
(`packages/database/src/schemas/ai.schema.ts:86-93`; no sweep). A period is required
(GDPR art. 5.1.e).

- **Smallest fix**: delete rows older than the longest window the allowance can read. 60 days
  covers a fortnight stretched by a pause (`0032`); `backend` should confirm the real maximum.
  Do it in the daily sweep that already runs (`/api/v1/cron/sweep-verifications`).

**F4 · P0 on this folder's scale, P3 for any real person: the landing page already advertises
the assistant.** `landing.features`, es-ES.ts:1978 ("Asistente de nutrición… Conoce tu plan.")
and en-GB.ts:1885, is public. It describes a feature nobody can open while the switch is off.
That is pre-contractual information that is not true (TRLGDCU art. 60.1, Law 3/1991 art. 5.1,
as [`analysis.md`](./analysis.md) P0-4 reasoned). It becomes true the day the switch is thrown.

- **Cheapest fix**: ship phase 7.
- **The alternative**: take the card down until then.
- The owner decides.

### 3.2 `/privacidad`: what phase 7 must say (es-ES and en-GB together)

1. **A new section, `id: 'asistente'`, "El asistente"**, covering:
   - what is sent: the question; a bounded window of that conversation's earlier answered
     turns; and the context, listed the way the dish-design paragraph lists its own (goal,
     targets and the plan's days with their figures, meal shape, cooking time, kitchen,
     vegetarian/vegan, cuisines, liked/loved/disliked foods and dishes, the language);
   - that every question is first labelled by the same model
     (`apps/api/src/modules/ai/ai.module.ts:89-93`, on `AI_ASSISTANT_MODEL`), and that a
     question caught by our clinical screen goes nowhere;
   - to whom, for what, on which basis. Contract (GDPR art. 6.1.b): the person asks. Plus
     art. 9.2.a only if F1 takes option (b).
2. **The sentences that become false at the switch**:
   - es-ES.ts:2929 / en-GB.ts:2788, "Nadie entrena con ello ni lo guarda: solo usamos
     proveedores que borran la petición en cuanto responden". That is false for Anthropic
     (item 5). Scope it to dish design and OpenRouter, and give the assistant its own sentence.
   - es-ES.ts:2927 / en-GB.ts:2786: true as it stands only if F1 takes option (a), and only
     because it is scoped to designing dishes. The new section must not be read against it.
3. **"Con quién compartimos tus datos"** (es-ES.ts:2937-2945): add Anthropic.
4. **"Transferencias"**: add Anthropic and its mechanism. Phase 7 has to **fetch, not assume**:
   - whether Anthropic, PBC is on the Data Privacy Framework list;
   - which entity this account contracts with. The Commercial Terms, effective 17/6/2025, say
     "Anthropic Ireland, Limited if Customer resides in the European Economic Area";
   - the DPA's transfer clauses. The DPA "is incorporated into these Terms by reference" (§ C).
   - That this key is a Console API key under the Commercial Terms, rather than anything bought
     as a consumer, is for the owner to confirm. The no-training sentence depends on it
     **[lawyer]**.
5. **"Cuánto tiempo guardamos tus datos"**:
   - **Conversations: my ruling is a cap**, and the planner's "until the person deletes it" is
     the alternative. Free text about food will sooner or later hold a condition somebody
     volunteered, and a cap is the cheapest way to stop that piling up (GDPR arts. 5.1.e and
     25.2). **My recommendation: a conversation is deleted automatically 6 months after its last
     message.** It is one constant, one query in the existing daily sweep, and one sentence. The
     alternatives are 90 days, 12 months, or none. The owner decides **[lawyer]**. The warning
     is true under every option.
   - **The usage ledger**: the period F3 sets.
   - **Anthropic's own copy**: on its page "How long do you store my organization's data?"
     (updated 1/7/2026), it says it deletes "inputs and outputs on our backend within 30 days of
     receipt or generation". When its systems flag a Usage Policy violation it keeps them "for
     up to 2 years", with "trust and safety classification scores for up to 7 years". Deleting a
     conversation here does not reach that copy. Quote it as what the page says, dated, for the
     lawyer to confirm.
6. **"Qué datos recogemos"**: two new items.
   - "Lo que escribes al asistente": the conversations and their titles, which are the opening
     words of the first question.
   - "Cuántos mensajes envías al asistente": a count with no text, so a deleted message still
     counts.
7. **"Cuáles de estos datos son especialmente protegidos"**: add that a conversation may hold
   health data if somebody writes it there, and that we ask them not to.
8. **Who can read a conversation**: nobody but its owner. Not the console, not an export, not a
   professional through a link. Add "ni tus conversaciones con el asistente" to what the
   dietitian does **not** see (`#tu-dietista`, es-ES.ts:2913). Database access only to fix a
   fault, as the security paragraph already says.
9. **Rights**:
   - Access is the screen itself.
   - **Portability** (GDPR art. 20) reaches conversations, since they are provided under the
     contract. Today a request "por correo" could only be met by the owner reading the
     database, which PRD 11 forbids even to him. Either an export in the product, or a raw
     export the owner sends without reading. P2 **[lawyer]**.

Also for phase 7, and none of it is optional:

- **The mail.** The policy promises a mail "antes de que se aplique" for anything important. A
  new recipient and a new store of free text is important. Send it before the switch, using
  [`textos/06`](./textos/06-correos.md) § G as the pattern. This is not the 2026-10-20 case,
  which narrowed a screen and added no recipient.
- **The health consent.** The profile consent is re-asked if F1 takes option (b), and even then
  a separate consent is better. It may also be re-asked under option (a), if the lawyer takes
  the broad reading of the goal (F1, § 4 item 17(g)).
- **The date.** `privacy.updated` moves.
- **The rest of this folder.** [`analysis.md`](./analysis.md) § 7 still says "there is no
  conversational assistant in the code", and § 1.3 needs the assistant. The
  [`record-of-processing.md`](./record-of-processing.md) gains an activity. The
  [`dpia.md`](./dpia.md) gains free text that may hold health data and a new processor
  (art. 35.1 review). The tables are `ai_conversations`, `ai_messages` and `assistant_usage`,
  not the names `0104` clause 7 gives.
- **Anthropic's Usage Policy.** Its "High-risk Areas" include "Medical — diagnosing a
  condition; recommending, starting, stopping, or adjusting a treatment or medication,
  including dose", which is the very ground the clinical refusal cuts. Its exclusions include
  "Wellness content, such as education on sleep, stress, nutrition, or exercise". My reading:
  the assistant, with its refusals, stays in the exclusion and needs no human review before an
  answer **[lawyer]**.

### 3.3 `/condiciones`: what phase 7 must say

1. **"Contenido generado con inteligencia artificial"**: a paragraph on the assistant. Its
   answers are generated by AI and can be wrong. It is not advice from a doctor or a
   dietitian-nutritionist. It may decline a question or withhold an answer. It never changes
   the plan. Health details should not be written there.
2. **"El plan gratuito y Premium"**: messages to the assistant per fortnight join the list of
   limits that differ by tier. Deleting a message does not give it back, and the assistant
   stops answering everybody for the rest of the month if its monthly budget runs out.
3. **"Uso aceptable"**: using the assistant for something other than nutrition, or trying to
   make it say what it refuses to, sits beside "intentar saltarse… las medidas de seguridad".
4. **"Responsabilidad"**: "las decisiones de salud que tomes a partir de un plan" becomes "a
   partir de un plan o de una respuesta del asistente".

**`TERMS_VERSION`: it goes up, to `2.2.0`, with `terms.updated`, in the same commit.** Items 2
and 4 change meaning, and the house rule says any change of meaning raises it
([`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) § 5.4).
If phase 7 ships item 1 alone, the
[`textos/03`](./textos/03-condiciones-uso.md) § I precedent (describing a new feature without
touching anybody's rights) keeps it at `2.1.0`.

## 4. For the lawyer's hour (beside [`analysis.md`](./analysis.md) § 10)

17. **The assistant** (2026-11-10, project 023):
    - (a) A condition somebody types into the conversation despite the warning: is it enough
      that the warning asks them not to, that they can delete it, that it is capped and that
      nobody else reads it? Or does storing it need its own art. 9.2 basis? My reading: the
      mitigation is what the law can ask for incidental data, but no exception fits cleanly.
      **Five minutes.**
    - (b) F1 option (b): is a separate optional consent the right basis for telling the model
      what a person cannot eat?
    - (c) Retention: is 6 months from the last message defensible, and is "until they delete
      it" not?
    - (d) Anthropic: the Commercial Terms and their DPA for this account, the transfer
      mechanism, and the 30-day / 2-year retention as the page states it.
    - (e) Does the Usage Policy's wellness exclusion cover this assistant?
    - (f) Portability of conversations without the owner reading them.
    - (g) The goal (`weight_loss`) and the targets sent to Anthropic for the assistant: does
      the profile consent, whose AI sentence describes dish design only, cover them? This is
      the same question as point 3(c), for a new recipient.
