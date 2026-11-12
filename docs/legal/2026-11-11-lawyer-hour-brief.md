# The lawyer's hour: one brief (2026-11-11)

> **I am not a lawyer.** This brief was written by an agent. It does not answer any of the
> questions below. It puts them in a form a lawyer can answer quickly. Every "provisional view"
> is a reading for him to confirm or overturn. It is not a verdict, and nothing in this folder
> treats it as one.
>
> **Purpose**: to gather every `[lawyer]` / `[abogado]` mark in `docs/legal/` into one list,
> as it stands on 2026-11-11. Each item gets a question he can answer yes/no or with a number,
> the facts behind it, what changes with each answer, and a time budget. The list is ordered
> so the paid hour goes on what is live and touches a real person's health data. Everything
> else goes by mail, to the accountant (*gestor*), or to the owner himself.
> **Audience**: the owner, and the lawyer he hands it to. **Committed**: yes. The repository is
> public: no names, addresses, tax numbers or contracts appear here, and the documents the owner
> brings (invoices, DPAs, screenshots) stay outside it. **Maintained by**: the `legal` agent.
> When the lawyer answers, each answer is recorded in the source document the item points to,
> and then here.
>
> **Language.** The brief is in English, like the rest of this folder. Each question also
> carries its Spanish wording (*ES*), because that is what is put to a Spanish lawyer.

## 0. In ten lines

1. **An item** is one question the lawyer can answer yes/no or with a number. Sub-questions
   that share their facts count as one item. Every mark found by searching the folder for
   `[lawyer]`, `[abogado]`, "lawyer's hour" and "to confirm with a lawyer" is mapped in § 8.
   They reduce to **32 items**:
   - **9 for the hour**, budgeted at **54 minutes**, with 6 to spare (§ 2);
   - **19 by mail** (§ 3);
   - **4 for the *gestor*** (§ 4).
   - Another **15 marks are moot or already answered by facts** (§ 5).
   - The owner has **11 checks** he can do himself, with no lawyer (§ 6).
2. **The three that matter most**, all live today and all about health data:
   - **H1**: does a person's health datum written into the assistant need an art. 9.2 basis?
   - **H2**: are the daily targets we send to Anthropic health data?
   - **H3**: does a self-service OpenRouter account have the processor contract our published
     policy relies on?
3. **One item is new and dated: H7.** Nothing in this folder had yet asked whether art. 50.2 of
   the AI Act (marking in a machine-readable format) applies to **the assistant's answers**. The
   assistant went into service on 2026-11-11, after 2/8/2026. On the reading
   [`dish-pictures.md`](./dish-pictures.md) § 1.1 already applies to the pictures, the 2/12/2026
   grace period does not cover it. The recipes' own deadline (P2-8) **is 2/12/2026**. A search
   of the code found no machine-readable mark on either (§ 2, H7).
4. **Before the hour, the owner does O7** (§ 6): he gets OpenRouter's DPA text. H3 is a
   six-minute question with the document on the table, and a guess without it.

## 1. The facts the lawyer needs, as of 2026-11-11

| | |
| --- | --- |
| Who answers | The owner, **a private individual**, not registered as *autónomo* and with no company ([`analysis.md`](./analysis.md) § 6). Nothing is charged today. Premium is granted by hand from `/admin` ([`textos/03`](./textos/03-condiciones-uso.md) § D bis). |
| Who uses it | A beta for people the owner knows (["the beta is friends"](./pantry.md), § 7 decision 1). The **professional** flag (project 004) and Stripe's live keys are **off** ([`go-live-checklist.md`](./go-live-checklist.md) § 1 step 4 and § 2, both unticked; `docs/ROADMAP.md`: "before the `professional` flag goes on… waits on the payments work"). |
| Health data held | Allergies, intolerances, weight, height, goal and way of eating, under an **explicit consent** (`PROFILE_CONSENT_VERSION` `1.1.0`; the text at `es-ES.ts:3219-3225`); the separate health section (`HEALTH_CONSENT_VERSION` `1.1.0`). `/privacidad` lists the specially protected data at `es-ES.ts:2983`. |
| Plan generation, **live since 2026-09-26** (`docs/decisions/LOG.md`, 2026-09-26, `0064`: "Generation runs on paid, no-training models through OpenRouter directly") | OpenRouter, Inc. (US, **not** in the DPF), which routes to DeepInfra or CoreWeave (US, zero retention, no training). The models receive the daily targets **and the goal ("perder peso")**, meal times, vegetarian/vegan, and likes by catalogue name (`es-ES.ts:3011`). They receive no identity, weight, allergies or free text, except a dish name a person asks for. **OpenRouter's DPA text is not in hand** (P1-11, [`go-live-checklist.md`](./go-live-checklist.md) § 0 bis, unticked). |
| Dish pictures, **live** | OpenRouter → Google Vertex. Labelled "IA", with a C2PA mark. An allergen judge reviews each picture, and the owner can accept one by hand against the judge ([`dish-pictures.md`](./dish-pictures.md); `es-ES.ts:3016`). |
| The assistant, **live since 2026-11-11** | Anthropic. The contract is with **Anthropic Ireland, Limited**. The model is `claude-haiku-5-5`. Data is stored in the US, and inference is **global**: "may run in any available geography" ([`assistant-privacy.md`](./assistant-privacy.md) § 8.5). Conversations are deleted **six months** after their last message, and the message count after 60 days. Nobody but the author reads them. The owner sent the notice mail ([`textos/06`](./textos/06-correos.md) § Q) and switched the assistant on, as recorded in commit `094a495c` and `docs/projects/023-…/LOG.md` (2026-11-11). On 2026-11-10 he checked, in Anthropic's Console, the organisation, the invoicing entity and the model (`docs/decisions/LOG.md`, 2026-11-10). |
| Mail | Sent through a **consumer Gmail account** over SMTP (P2-10). |
| Records | DPIA ([`dpia.md`](./dpia.md), with the assistant's addendum § 8), record of processing ([`record-of-processing.md`](./record-of-processing.md), row 10 for the assistant), breach procedure. |
| Texts in force | `TERMS_VERSION` `2.2.0` (`packages/core/src/entities/User/User.ts:27`). `/condiciones` still says "te avisaremos por correo antes de que se aplique" (`es-ES.ts:3534`), and `/privacidad` says the same (`es-ES.ts:3111`). |

## 2. The hour: nine items, in this order

Ordered by **risk × likelihood**, measured with three tests in this order. The first two
measure risk: **is it live today** (a dark feature harms nobody yet) and **does it touch a real
person's special-category data** (the worst harm this product can do). The third measures
likelihood: **can it be fixed without his answer?** If not, the exposure lasts until he
answers. A "no" to the third test ranks the item higher.

| # | Item | Live? | Art. 9 data of a real person? | Fixable without him? | Min |
| --- | --- | --- | --- | --- | --- |
| H1 | Health data written into the assistant | live since 11/11 | yes, sooner or later | no | 7 |
| H2 | Targets sent to Anthropic: health data? | live since 11/11 | maybe: that is the question | no | 8 |
| H3 | OpenRouter's DPA on a self-service account | live since 26/9 | under explicit consent | partly (O7) | 6 |
| H4 | Blocking (LOPDGDD art. 32) and every automatic deletion | live | yes: what is deleted | no | 6 |
| H5 | Transfers to Anthropic: "otros países", TIA, its own copy | live | incidental | partly (pin to US) | 8 |
| H6 | The "changes" clause, 59.4 and 126 bis | live text | no | no | 8 |
| H7 | AI Act art. 50.2 for the assistant and the recipes | live, **dated 2/12/2026** | no | yes (build it anyway) | 5 |
| H8 | Not a medical device, now with the assistant | live | no | no | 2 |
| H9 | A picture published by hand against the allergen judge | live | no | yes (stop doing it) | 4 |
| | | | | **Total** | **54** |

---

### H1. A health condition someone writes into the assistant

*Sources: [`assistant-warning.md`](./assistant-warning.md) § 4 item 17(a); [`assistant-privacy.md`](./assistant-privacy.md) § 2.2 (last row) and § 9 (i); [`dpia.md`](./dpia.md) R-A1.*

- **Question.** (a) If a person writes a condition or a medication into the assistant despite
  the warning, can we store it for up to six months and send it to Anthropic **without** an
  art. 9.2 exception, relying only on minimisation? Yes/no. (b) Must the DPA description we
  accept ("Special categories of personal data: None", Anthropic DPA Schedule 1 § B.3) say
  otherwise? Yes/no.
  *ES: (a) Si una persona escribe en el asistente una enfermedad o un medicamento pese al
  aviso, ¿podemos guardarlo hasta seis meses y enviarlo a Anthropic sin una excepción del
  art. 9.2, solo con medidas de minimización? (b) ¿Debe cambiar la descripción del DPA
  («categorías especiales: ninguna»)?*
- **Facts.**
  - *(Amended 2026-11-12, #371.)* Every new conversation opens with the full warning,
    including the request not to write illnesses, medication or other health details
    ([`assistant-warning.md`](./assistant-warning.md) § 1). Once a conversation has a message,
    the warning stays first in it but folds to one line: that it is an AI, and the same
    health request in the same words. A button opens the full text. A shorter line directly
    under the text box says both things again in every conversation, and a screen reader reads
    it with the box: «Te responde una IA: no escribas aquí datos de tu salud». (Whether it stays
    visible above a phone's on-screen keyboard has not yet been checked on a real phone.)
    Nothing about the warning
    is stored, and it cannot be dismissed
    ([`2026-11-11-redesign.md`](./2026-11-11-redesign.md) § 6).
  - Our own code catches some health questions before any model sees them. A question that
    our code or the model labels as being about health is **not stored**: only the mark stays
    (`es-ES.ts:3026`; F2).
  - Anything the code does not catch still reaches Anthropic for labelling.
  - The person can delete a message or a conversation at once. The sweep deletes it six
    months after the last message. No admin route, export or dietitian reads it.
  - Anthropic keeps what it receives for up to 30 days, or 2 years if flagged
    ([`assistant-privacy.md`](./assistant-privacy.md) § 8.4).
- **Provisional view (not a verdict).**
  - **No art. 9.2 exception fits cleanly.** 9.2.a needs an explicit consent that we do not
    ask for. 9.2.e (made manifestly public) does not fit a private conversation.
  - What we have done is what arts. 5.1.c and 25.1–2 ask for data the controller neither
    asks for nor uses. The DPIA accepts the residual risk (R-A1).
  - On (b): Anthropic's DPA is click-through and its schedule is not ours to edit. Art. 28.3
    asks the contract to set out "el tipo de datos personales", and incidental, discouraged
    data is arguably not a type we send. Rests on: GDPR arts. 9.1, 9.2, 5.1.c, 25, 28.3, as
    read in the cited documents (2026-11-10).
- **What changes with the answer.**
  - (a) **No** (a basis is needed): an optional, versioned consent the first time
    `/asistente` opens (`ASSISTANT_CONSENT_VERSION`, a screen, a stored acceptance, a DPIA
    line), or the code refuses anything health-shaped before sending **and** before storing.
  - (a) **Yes**: nothing changes, and the DPIA records his answer.
  - (b) **Yes**: the owner asks Anthropic in writing for an amended description, or accepts
    the gap on the record.
- **Minutes: 7.**

### H2. The daily targets and the plan's figures that go to Anthropic: health data?

*Sources: [`assistant-warning.md`](./assistant-warning.md) § 4 item 17(g), amended by
[`assistant-privacy.md`](./assistant-privacy.md) § 9; folds in [`analysis.md`](./analysis.md) § 10
items 2 and 3(c), the residual of P0-3 (§ 9, "whether the goal 'lose weight' is a health datum;
and whether veganism can be a philosophical conviction"), and [`pantry.md`](./pantry.md) § 5.3
(the cupboard entry "leche sin lactosa").*

- **Question.** (a) Are the daily energy and macro targets, and a plan's daily figures, sent
  **without** weight, height, age, sex, goal or name, "data concerning health" (art. 4.15, as
  C-184/20 *OT* reads it)? Yes/no. (b) Does a cupboard entry whose catalogue name carries a
  clinical qualifier ("leche sin lactosa") stay outside art. 9 while we infer nothing from it?
  Yes/no.
  *ES: (a) Los objetivos diarios de energía y macronutrientes, y las cifras del plan, enviados
  sin peso, altura, edad, sexo, objetivo ni nombre, ¿son datos relativos a la salud? (b) Una
  entrada de despensa como «leche sin lactosa», de la que no inferimos nada, ¿queda fuera del
  art. 9?*
- **Facts.**
  - **The assistant receives** the plan's days with their figures, the daily and per-day
    targets, the meal shares, cooking time, kitchen and likes. It **does not receive** name,
    email, age, sex, weight, height, goal, allergies, way of eating or conditions
    (`es-ES.ts:3025`).
  - Its basis is the contract (art. 6.1.b). The profile consent does not name Anthropic, and
    it says the data are used "solo para calcular tus objetivos y elegir tus platos"
    (`es-ES.ts:3221`).
  - The goal and the way of eating were taken out on 2026-11-10 (F5), because our own policy
    lists them as protected (`es-ES.ts:2983`). The targets are not on that list.
  - The dish model (OpenRouter) receives the targets, **the goal** ("tu objetivo (por ejemplo,
    perder peso)", `/privacidad`, `es-ES.ts:3011`) and vegetarian/vegan, **under** the explicit
    consent. For that flow the cautious path is already built, so an answer can only relax it.
    One gap was seen while writing this brief: the consent's own AI sentence lists "tus
    objetivos diarios" but **not the goal** (`profileConsent.ai`, `es-ES.ts:3220`), although
    the policy says the model receives it. The consent is only as informed as that sentence
    (GDPR arts. 4.11, 9.2.a). This goes to the lead as a wording finding, for the next consent
    bump.
- **Provisional view (not a verdict).**
  - **(a): no for the recipient.** A kilocalorie target with no weight, height, age or sex does
    not let anybody deduce a state of health "by comparison or deduction" (C-184/20 *OT*,
    1/8/2022). Deducing even a deficit needs the energy expenditure, which needs exactly what
    is withheld. The recipient-relative reading is C-413/23 P (4/9/2025).
  - **The weak point, stated plainly:** art. 9 governs **our** processing. In our hands the
    targets sit beside the weight and the goal they were computed from. A strict reading would
    make the transmission itself the processing of health data.
  - **(b): yes**, on the condition [`pantry.md`](./pantry.md) § 5.3 sets: no restriction is
    inferred or shown. A cautious reading of C-21/23 *Lindenapotheke* could go the other way.
    This folder never quoted a paragraph of that judgment (§ 5.1 explains why), so the lawyer
    should read it on how probable the inference must be.
- **What changes with the answer.**
  - (a) **Yes**: the assistant is processing art. 9 data with no 9.2 basis, live. That is P0
    on this folder's scale. The way out is either the targets taken out of `AssistantContext`
    (the assistant can then no longer compare a day with its targets), or the optional consent
    described in H1. `/privacidad` § «El asistente» changes in either case.
  - (a) **No**: nothing changes.
  - (b) **No**: a consent checkbox, `PROFILE_CONSENT_VERSION` raised to `1.2.0`, every account
    asked again, and a line in «Cuáles de estos datos son especialmente protegidos».
- **Minutes: 8.**

### H3. OpenRouter's processor contract (P1-11)

*Sources: [`analysis.md`](./analysis.md) § 4.4 a, § 9 P1-11, § 10 item 3(a);
[`go-live-checklist.md`](./go-live-checklist.md) § 0 bis; [`dpia.md`](./dpia.md) § 6 row 1;
`docs/decisions/0064-…`.*

- **Question.** (a) If OpenRouter's terms (§ 10.2) incorporate its DPA by reference "for
  commercial, for-profit purposes", is that a contract "por escrito, inclusive en formato
  electrónico" (GDPR art. 28.9) for a **self-service** account, even though OpenRouter's help
  centre says the signed DPA is for Enterprise customers? Yes/no. (b) While the text is not in
  hand, must plan generation stop? Yes/no.
  *ES: (a) Si las condiciones de OpenRouter (§ 10.2) incorporan por referencia su DPA para uso
  comercial, ¿basta como contrato por escrito (art. 28.9) para una cuenta de autoservicio?
  (b) Mientras no tengamos el texto, ¿hay que parar la generación de planes?*
- **Facts.**
  - Every plan generated since 2026-09-26 goes through OpenRouter (`docs/decisions/LOG.md`,
    2026-09-26). **Three places in this folder are stale on this point** and still say
    production runs `AI_PROVIDER=stub`: [`go-live-checklist.md`](./go-live-checklist.md) § 0 bis
    (its opening note) and [`analysis.md`](./analysis.md) § 0 item 6, § 1.3 and § 9 (P0-3's
    status). They predate the switch.
  - **Our published policy says** "OpenRouter no está en ese marco: con él nos apoyamos en las
    cláusulas contractuales tipo" (`es-ES.ts:3051`). Those clauses would live in the DPA
    nobody here has read.
  - The Enterprise DPA is public: SCC module 2, 72-hour breach notice, sub-processor notice
    ([`analysis.md`](./analysis.md) § 4.4 a).
  - **The stake:** if § 10.2 does not bind a self-service account, the published sentence is
    false and the generator has run since then without an art. 28 contract.
  - The owner can get the text himself (O7). That is not the lawyer's time.
- **Provisional view (not a verdict).**
  - **(a): yes, probably.** Art. 28.9 accepts electronic form. A clause in accepted terms that
    incorporates another document is a common way to conclude one, and a help article does
    not repeal the terms.
  - But arts. 5.2 and 24 require the controller to **demonstrate** the content of art. 28.3
    (a)–(h), and a text he has never seen demonstrates nothing. So the gap is one of
    accountability, cured by getting the text, more than one of lawfulness.
  - **(b): the folder's standing position is that it blocks.** [`analysis.md`](./analysis.md)
    P1-11 says "**Blocks the change**", and [`go-live-checklist.md`](./go-live-checklist.md)
    § 0 bis puts it under "they block the change". **Production runs against that position**,
    by the owner's choice. This brief does not soften it. Whether running on until O7 is done is
    defensible is the question, put to him without a tilt.
  - Rests on: GDPR arts. 28.3, 28.9 (read today in the BOE text, `DOUE-L-2016-80807`), 5.2, 24,
    46.2.c.
- **What changes with the answer.**
  - (a) **Yes**: the owner keeps the DPA and OpenRouter's written confirmation, dated, outside
    the repository. P1-11 is ticked.
  - (a) **No**: `AI_PROVIDER=stub` until there is a provider under a contract we hold. Either
    an OpenRouter Enterprise agreement, or a provider with a direct DPA (report `0002`'s plan B).
    The transfers sentence for OpenRouter is rewritten the same day.
  - (b) **Yes**: the same stop, today.
- **Minutes: 6** with the DPA on the table.

### H4. Blocking (LOPDGDD art. 32) against every deletion the product makes

*Sources: [`analysis.md`](./analysis.md) § 4.1 quinquies and § 10 item 15(c); now also the
assistant's sweep ([`assistant-privacy.md`](./assistant-privacy.md) § 1) and account deletion.*

- **Question.** Does the duty to block (art. 32.1, "cuando proceda a su rectificación o
  supresión") apply: (a) to a deletion the **person** makes (the account; a message or a
  conversation)? Yes/no. (b) To an **automatic** deletion at the end of a retention period
  (the assistant's six months and 60 days; the unconfirmed account at 30 days)? Yes/no.
  (c) If either is yes, for **how many years** is a blocked copy kept?
  *ES: ¿Obliga el art. 32 LOPDGDD a bloquear (a) cuando la persona borra su cuenta, un mensaje o
  una conversación, (b) cuando borramos automáticamente al acabar un plazo? (c) Si sí, ¿cuántos
  años?*
- **Facts.**
  - Nothing is blocked today. Every deletion is a `DELETE`.
  - The landing page promises "Se elimina todo: perfil, planes, progreso y conversaciones"
    (`es-ES.ts:2036`).
  - Art. 72.1.n LOPDGDD (read today, BOE-A-2018-16673, consolidated to 27/12/2025) lists "el
    incumplimiento de la obligación de bloqueo… cuando la misma sea exigible" among the
    **very serious** infringements.
- **Provisional view (not a verdict).**
  - Art. 32 is meant to keep evidence for liability.
  - (a): a literal reading says **yes** for a person's erasure, and this folder's own reading
    ("only the second", erasure under the data subject's right) leads there too.
  - (b): **no**. Nothing could ground a claim, and keeping a blocked copy of exactly what
    arts. 5.1.c and 5.1.e say to delete is the opposite of what they ask. Art. 32.5 lets the
    AEPD make exceptions.
  - Rests on: LOPDGDD arts. 32.1–32.5 and 72.1.n (read today); GDPR arts. 5.1.c, 5.1.e, 17.
- **What changes with the answer.**
  - (a) **Yes**: a blocked store (identified, reserved, readable only for a court or an
    authority, destroyed after (c) years), or art. 32.4's secure copy. It must hold **health
    data** too, which needs its own DPIA line. The landing sentence and `/privacidad`'s
    «Supresión» paragraph (`es-ES.ts:3080`) gain "except a blocked copy…".
  - (b) **Yes**: the same for every sweep, plus a question to the AEPD under art. 32.5.
  - (a) and (b) **no**: nothing changes.
- **Minutes: 6.**

### H5. Transfers to Anthropic: the countries, an impact assessment, and its own copy

*Sources: [`assistant-privacy.md`](./assistant-privacy.md) §§ 2.1, 2.5, 8, and § 9 (h), (j), (n);
[`assistant-warning.md`](./assistant-warning.md) § 4 item 17(d); [`dpia.md`](./dpia.md) R-A5.*

- **Question.** (a) Does "Anthropic guarda los datos en Estados Unidos y… puede tratarlos en
  otros países" satisfy art. 13.1.f? Or must the countries be named, which only pinning
  inference to the US makes possible? Yes/no. (b) Should we ask Anthropic for the transfer
  impact assessment information its DPA § I.4 offers? Yes/no. (c) For a conversation flagged
  under its Usage Policy (kept up to 2 years, scores up to 7), is Anthropic a **controller**
  (art. 28.10)? And if so, must `/privacidad` say so? Yes/no.
  *ES: (a) ¿Basta «Estados Unidos y otros países» para el art. 13.1.f, o hay que nombrarlos
  fijando la inferencia en EE. UU.? (b) ¿Pedimos a Anthropic la información para una evaluación
  de impacto de la transferencia (DPA § I.4)? (c) Para la copia que guarda si marca una
  conversación, ¿Anthropic es responsable del tratamiento, y hay que decirlo?*
- **Facts.**
  - The contracting entity is Anthropic Ireland (an EEA processor). There is an onward
    transfer to Anthropic, PBC and US infrastructure on SCC Module Three, which the DPA deems
    executed (§ I.1).
  - Anthropic is **not** on the DPF list (queried 2026-11-10).
  - The sub-processor page would not render for the agent (O5).
  - The owner decided on 2026-11-10 to keep inference **global** (`docs/decisions/LOG.md`).
    Pinning it to the US costs "1.1x the standard rate" on the assistant's model spend
    ([`assistant-privacy.md`](./assistant-privacy.md) § 8.5).
  - Two Anthropic pages differ on retention (§ 8.4). The policy states the upper bound.
- **Provisional view (not a verdict).**
  - **(a): probably no.** WP260 rev.01 (the art. 29 Working Party's transparency guidelines,
    whose endorsement by the EDPB was **not consulted** today), annex, the row on art. 13.1.f,
    read today: "the information provided
    on transfers to third countries should be as meaningful as possible to data subjects; this
    will generally mean that the third countries be named". "Otros países" names none. The
    same row asks for "where and how the relevant document may be accessed". Our "Puedes
    pedirnos el detalle de cada garantía" does that.
  - **(b): yes.** It is free to ask and costs a mail.
  - **(c): probably yes.** A processor that decides its own purpose for that copy is a
    controller to that extent (art. 28.10; EDPB Guidelines 07/2020, as cited in § 2.1). The
    policy already describes the fact, and naming the role is one clause.
- **What changes with the answer.**
  - (a) **No**: either the owner pins inference to the US (O3), and `/privacidad`'s ¶ 5, R7
    and R8 drop "otros países" in the same change; or he takes the risk with the reading on
    the record.
  - (b) **Yes**: the owner sends the request (O6).
  - (c) **Yes**: one clause in «El asistente» and a note in the record of processing, row 10.
    No version moves (it is information, not consent).
- **Minutes: 8.**

### H6. The "changes" clause, the free account under Book II, and "continuing means accepting"

*Sources: [`analysis.md`](./analysis.md) § 9 P1-15 and § 10 items 12 and 16;
[`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) § 4.3–4.4,
§ 7 items 1 and 3; [`textos/03`](./textos/03-condiciones-uso.md) § D bis.2–D bis.4;
[`assistant-privacy.md`](./assistant-privacy.md) § 6 and § 9 (m).*

- **Question.** (a) Is the free account a contract within TRLGDCU Book II under art. 59.4,
  given that product use is recorded under legitimate interest? Yes/no. (b) Do you approve
  the rewritten clause in [`textos/03`](./textos/03-condiciones-uso.md) § D bis.3 as drafted?
  Yes / yes with changes. (c) Under it, does "seguir usando NutrIA significa aceptar" hold for
  a change that makes nothing worse? Yes/no. (d) How many days' notice does a change that
  makes things worse need? A number.
  *ES: (a) ¿La cuenta gratuita es contrato del libro II por el art. 59.4? (b) ¿Aprueba la
  cláusula reescrita? (c) ¿Vale «seguir usando = aceptar» para lo que no empeora nada?
  (d) ¿Con cuántos días de antelación hay que avisar de un cambio que empeora?*
- **Facts.**
  - The clause in force promises a mail before any important change (`es-ES.ts:3534`;
    `en-GB.ts:3389`). It gives no "valid reason" for a unilateral change (TRLGDCU art. 85.3).
  - On 2026-10-20 a free account's past fortnights went behind premium, and no mail was sent
    (the owner's decision, [`textos/03`](./textos/03-condiciones-uso.md) § D bis.2).
  - For the assistant the mail **was** sent (§ 1). Its own text set the gap at "no earlier
    than the day after".
  - The rewrite names the valid reasons. It promises "un aviso que puedas guardar" (a durable
    medium, art. 126.d) and 30 days to leave at no cost (art. 126 bis) for a change that makes
    things worse.
- **Provisional view (not a verdict).**
  - (a): arguably **yes**, because personal data beyond what the service strictly needs are
    processed (art. 59.4).
  - (b): yes. It gives art. 85.3 its reasons and art. 126 its medium.
  - (c): yes for changes with no negative effect, which art. 126 bis does not reach. The
    weakness is that silence is weak evidence of consent.
  - (d): the TRLGDCU text consulted gives "antelación razonable" and no number. A month is
    the reading this folder would defend, but it rests on no source (**not consulted**:
    guidance or case law on what is reasonable).
  - Rests on: TRLGDCU arts. 59.4, 60.1, 61.2, 80, 85.3, 126, 126 bis (consolidated text read
    2026-10-20 and 2026-11-10); Law 7/1998 arts. 5 and 7.
- **What changes with the answer.**
  - (b) **Yes**: `frontend` replaces the paragraph in `terms` «Cambios en estas condiciones»
    in both dictionaries. `TERMS_VERSION` goes from **`2.2.0` to `2.3.0`**, with
    `terms.updated`, in the same commit. Because the clause in force promises a mail, the
    change of clause is itself announced by mail, using [`textos/06`](./textos/06-correos.md)
    § G as the pattern.
  - (a) **No**: art. 126 bis stops reaching free accounts, and the clause can be simpler for
    them.
  - (d): the number goes into the clause in place of "antes de que se aplique".
  - The 2026-10-20 change itself (§ 10 item 16(b), "de menor importancia"?) is historical. The
    lawyer may skip it. The one-minute cure offered at the time still stands: grant Premium to
    the account it affected.
- **Minutes: 8.**

### H7. AI Act art. 50.2: machine-readable marking of the assistant's answers and the recipes. **New, raised 2026-11-11.**

*Sources: [`analysis.md`](./analysis.md) § 7 and § 10 item 8; P2-8; [`go-live-checklist.md`](./go-live-checklist.md) § 3;
[`dish-pictures.md`](./dish-pictures.md) § 1.1. Not previously marked for the assistant.*

- **Question.** (a) Is the assistant a system put into service on 11/11/2026, so that
  art. 50.2 applies to its answers **now**, with no art. 111.3 grace? Yes/no. (b) For text, is
  a machine-readable label in the API response (a field and a header) and in the page's HTML
  enough to be "marcados en un formato legible por máquina"? Yes/no.
  *ES: (a) ¿El asistente se puso en servicio el 11/11/2026, de modo que el art. 50.2 se le
  aplica ya, sin el plazo del art. 111.3? (b) Para texto, ¿basta una marca legible por máquina
  en la respuesta de la API y en el HTML?*
- **Facts.**
  - Art. 50.2 (read today, BOE text `DOUE-L-2024-81079`): providers of systems "que generen
    contenido sintético de audio, imagen, vídeo o texto, velarán por que los resultados de
    salida… estén marcados en un formato legible por máquina", with solutions effective "en la
    medida en que sea técnicamente viable". Its exceptions (standard editing assistance; not
    substantially altering the input) do not fit a chatbot.
  - Art. 111.3 (added by Regulation 2026/1744, as cited in
    [`dish-pictures.md`](./dish-pictures.md) § 1.1) gives four months, to **2/12/2026**, only
    to systems placed on the market before 2/8/2026. That covers the recipes.
  - The assistant's stream sends `Content-Type: application/x-ndjson` and no AI marker
    (`apps/api/src/modules/assistant/controllers/Assistant.controller.ts:100`). A search of
    `apps/api/src`, `apps/web/src` and `packages/core/src` found no machine-readable AI mark on
    recipe text either. The pictures do carry C2PA.
- **Provisional view (not a verdict).**
  - (a): **yes**, on the reading this folder already applied to the pictures: a feature
    switched on after 2/8/2026 is put into service then. Guidelines C(2026) 5054, point 153,
    covers systems "placed on the market or put into service before 2 August 2026".
  - (b): **yes, probably**. Robust watermarking of short text is not "técnicamente viable" at
    this scale, and the article itself scales the duty to feasibility and cost. **Not
    consulted for text**: what the Code of Practice says about text specifically.
- **What changes with the answer.** Either way, the marker gets built before 2/12/2026: a field
  on recipe and assistant responses, a header, and an attribute in the HTML. (a) **Yes** makes
  the assistant's part overdue today, so it ships first. (b) **No** means the lawyer names the
  technique he expects. Sent to the lead with this brief: `backend` and `frontend` own it.
- **Minutes: 5.**

### H8. Still not a medical device, now that an assistant answers questions

*Sources: [`analysis.md`](./analysis.md) § 7 (medical device) and § 10 item 9.*

- **Question.** With an assistant that talks about nutrition and refuses diagnosis, dosing and
  treatment, does NutrIA stay outside Regulation (EU) 2017/745? Yes/no.
  *ES: Con un asistente que habla de nutrición y rechaza diagnósticos, dosis y tratamientos,
  ¿NutrIA sigue fuera del Reglamento 2017/745?*
- **Facts.** Its declared purpose is not medical (the terms and the footer). The only rule
  derived from a disease is coeliac disease → gluten (`0008`). The assistant's refusals are
  described at `es-ES.ts:3026`.
- **Provisional view (not a verdict).** **Yes**: qualification turns on the manufacturer's
  intended purpose (MDR, `DOUE-L-2017-80916`, as cited in
  [`assistant-warning.md`](./assistant-warning.md) § 2, read 2026-11-10), and nothing here
  claims to diagnose, prevent or treat.
- **What changes with the answer.** **No** would mean stopping the assistant and the
  professional workspace until there is a regulatory plan. **Yes** means advertising and texts
  keep away from "treat", "cure" or "for your condition".
- **Minutes: 2.**

### H9. A dish picture the owner publishes by hand against the allergen judge

*Sources: [`dish-pictures.md`](./dish-pictures.md) § 1.7, § 4.4 (the trail, "it cuts both ways")
and § 7 (f); [`analysis.md`](./analysis.md) § 10 item 11(f).*

- **Question.** If somebody is harmed in connection with a picture published by hand after the
  judge rejected it for an allergen, does the `picture.accepted` record weigh **for** the owner
  (diligence, TRLGDCU art. 147) or **against** him (he published knowing)? For / against.
  *ES: Si alguien sufre un daño relacionado con una imagen publicada a mano tras el rechazo del
  revisor por un alérgeno, ¿el registro le favorece (diligencia) o le perjudica (lo sabía)?*
- **Facts.** The judge rejects only for a visible allergen the recipe lacks. Publishing by hand
  takes two steps, a notice and a trail row. Every picture says it is AI-generated and that
  the ingredient list is what counts.
- **Provisional view (not a verdict).** **It cuts both ways**, as the source says. The record
  proves the process, and it also proves knowledge for that picture. The safer practice needs
  no answer: do not publish by hand a picture rejected for an allergen. Civil Code art. 1902
  was **not consulted**.
- **What changes with the answer.** **Against**: the manual door is removed for pictures
  rejected for an allergen. That is a code change, and the judge only ever rejects for that
  reason. **For**: nothing changes.
- **Minutes: 4.**

---

## 3. By mail: nineteen items the lawyer can answer in writing

Each item gives the question, the facts (as a link), the provisional view, what follows, and
the lawyer's reading time. "Dark" means the feature is off, so nothing changes until it goes on.

**The order to answer them in**, ranked by risk × likelihood like the hour, with live items
first: M3, M15, M4, M8, M16, M17, M19, M14, M9, M10, M11, M13, M12, M18, M5, M6. Then the dark
ones: M1, M2, M7. The numbers follow the source documents, not this order.

**M1. Roles in project 004** (dark). Independent controllers with an allocation clause, or
joint controllers (art. 26), or a processor contract? *ES: ¿Responsables independientes con
cláusula de reparto, corresponsables o encargado?*
- Facts: [`analysis.md`](./analysis.md) §§ 2, 2.4; [`textos/01`](./textos/01-acuerdo-profesional.md)
  clause 4; [`breach-procedure.md`](./breach-procedure.md) (the closing source note: the
  breach-duty split if joint controllership were found).
- View: independent controllers, because the purposes are not common (EDPB 07/2020 §§ 70–71).
  The clause covers art. 26.1–2 in case a court disagrees.
- If joint controllers: the essence of the arrangement is published (art. 26.2), and
  `PROFESSIONAL_AGREEMENT_VERSION` rises. If processor: a DPA with each professional.
- 5 min.

**M2. The practice plan's terms are B2B** (dark). (a) Is a registered professional who buys
for their practice outside the consumer withdrawal right? (b) Is a 12-month liability cap valid
between businesses? *ES: ¿Un profesional que contrata para su consulta no es consumidor? ¿Vale
el tope de 12 meses?*
- Facts: [`textos/04`](./textos/04-condiciones-consulta.md) §§ 6, 8.
- View: yes to both (TRLGDCU arts. 3 and 102; Civil Code arts. 1102–1103).
- If no: § 6 gains a withdrawal clause, and § 8 is rewritten.
- 3 min.

**M3. The recipient-relative reading (C-413/23 P), once for all its uses** (live). Can a
request or a mail that carries no identifier be treated as non-personal for a recipient with no
reasonable means of re-identifying, while it stays personal for us? *ES: ¿Vale la lectura
relativa de C-413/23 P para tratar como no personal, para quien no puede reidentificar, una
petición o un correo sin identificadores?*
- It applies to:
  - the companies that run the model, which are not sub-processors per OpenRouter and are not
    in the DPF ([`analysis.md`](./analysis.md) § 4.4 b, § 10 item 3(b), P2-11);
  - the owner's alert mails ([`2026-09-29-mail-to-the-owner.md`](./2026-09-29-mail-to-the-owner.md)
    § 6.1);
  - a sampled request that may carry a typed dish name ([`analysis.md`](./analysis.md) § 4.4 c).
- View: yes, with the companies named in the policy and the closed list of allowed providers.
- If no: a provider with a direct contract for generation, and the alerts carry less.
- 4 min.

**M4. OpenRouter's anonymous categorisation** (live). (a) Is OpenRouter a controller for its
sampled categorisation (art. 28.10)? (b) Is the disclosure compatible under art. 6.4 with the
current notice? *ES: ¿OpenRouter es responsable de su muestra de categorización? ¿Es compatible
la comunicación con el aviso actual?*
- Facts: [`analysis.md`](./analysis.md) § 4.4 c, § 10 item 3(d), P2-12 (the owner accepted it
  with a notice, 2026-09-26).
- View: (a) yes. (b) yes, with the notice.
- If no: the owner presses for exclusion (O9), or typed dish names stop going to OpenRouter.
- 3 min.

**M5. A consumer Gmail account as the mail processor** (live). Is it acceptable under
art. 28? *ES: ¿Es aceptable una cuenta de Gmail de consumo como encargado del correo?*
- Facts: [`analysis.md`](./analysis.md) § 4.2 table, P2-10.
- View: **no**. Consumer terms are not an art. 28 contract. **Not consulted**: Google's
  consumer terms were not read for this brief.
- **Do not spend his minutes on this one.** Move to a transactional provider with a DPA (O10),
  and the transfers sentence names it.
- 1 min.

**M6. The legal notice, now, and a domicile in a public repository** (live text). (a) Does
LSSI art. 10 bind a free beta that is not yet sold? (b) Can a domiciliation or professional
address satisfy art. 10.1.a? *ES: ¿La LSSI art. 10 obliga ya a una beta gratuita? ¿Sirve un
domicilio profesional o de domiciliación?*
- Facts: [`analysis.md`](./analysis.md) § 6, P1-7; [`textos/07`](./textos/07-aviso-legal.md).
  The LSSI annex, letter a (read today, consolidated to 23/01/2025), covers services "no
  remunerados por sus destinatarios, en la medida en que constituyan una actividad económica
  para el prestador". Art. 10.1.e asks for the tax number.
- View: (a) probably yes, since a product built to be sold is an economic activity.
  (b) probably yes (**not consulted**: no source on domiciliation addresses was read).
- If yes: the owner fills `address`, `taxId` and `phone` in `legalIdentity.ts` (he does it, not
  an agent), and `/aviso-legal` ships before the live keys, or now if (a) is yes.
- 3 min.

**M7. Payments, as one bundle for the day Stripe goes live** (dark). Who owes the withdrawal
right, the form and the withdrawal function with Stripe *Managed Payments*? Is the
art. 11a function needed now? How is the button worded with a free trial? Are 30 days' notice
of a price change required, or only proposed? *ES: con Managed Payments, ¿quién debe el
desistimiento, el formulario y la función de desistimiento? ¿Cómo se rotula el botón con
prueba gratuita? ¿Los 30 días de aviso de un cambio de precio son exigibles?*
- Facts: [`analysis.md`](./analysis.md) § 10 items 4 and 7, P1-8, P2-6;
  [`textos/03`](./textos/03-condiciones-uso.md) § C and § D (the price-change note);
  [`go-live-checklist.md`](./go-live-checklist.md) § 2.
- View: as in those sections. Implement the function (it is cheap).
- It decides which variant of § C ships.
- 5 min, **at launch, not now**.

**M8. Accepting the terms: the rest of D5** (live).
- Questions:
  - (a) Does a free account need the LSSI art. 28 confirmation, and through which channel for
    a Google sign-in?
  - (b) How long are the version and date of acceptance kept after the account is deleted
    (art. 17.3.e)? A number.
  - (c) Is the basis for storing the version art. 6.1.b or 6.1.f?
  - (d) Is art. 15 met by the copy-by-mail route when a screen refuses a locked fortnight?
- *ES: (a) ¿Confirmación del art. 28 LSSI en la cuenta gratuita? (b) ¿Cuánto tiempo se guarda
  la versión aceptada tras borrar la cuenta? (c) ¿Base 6.1.b o 6.1.f? (d) ¿Se cumple el art. 15
  con la copia por correo?*
- Facts: [`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md)
  § 7 items 2, 5 and 6; [`analysis.md`](./analysis.md) § 10 item 16(c).
- View: (a) a line in the verification mail. (b) The limitation period, which also depends on
  H4. (c) 6.1.b. (d) yes.
- If not: the verification mail and `/privacidad`'s periods change.
- 4 min.

**M9. Per-address brakes** (live). Is legitimate interest enough to count attempts and mails
for addresses with no account, informing only in `/privacidad`? And may those rows expire on
their own rather than go with the account?
- Facts: [`analysis.md`](./analysis.md) § 4.1 ter, § 10 item 13.
- View: yes to both.
- If no: notice at the point of collection, and deletion with the account.
- 2 min.

**M10. Three security and authentication cookies with no banner** (live). Are these exempt
under LSSI art. 22.2? (a) The "browser already signed in" cookie, with 90 days renewed on each
password sign-in as a "limited" duration. (b) The "trust this device" cookie of two-step
verification, kept 30 days. (c) A passkey cookie set when the sign-in page loads, before the
person picks a key, as something "expresamente solicitado".
- Facts: [`analysis.md`](./analysis.md) § 4.1 quater, § 10 item 14;
  [`textos/02`](./textos/02-politica-privacidad.md), the ⟦dos-pasos⟧ and ⟦llaves-de-acceso⟧
  source notes.
- View: yes to all three (WP194 §§ 3.2–3.3, as cited there).
- If no: a consent banner for that cookie, or a shorter period.
- 3 min.

**M11. Deleting an account nobody confirmed** (live). Must an art. 6 basis be named for
erasure by period? Are thirty days from sign-up defensible?
- Facts: [`analysis.md`](./analysis.md) § 4.1 quinquies, § 10 item 15(a)–(b).
- View: no basis is needed (if one had to be cited, 6.1.c), and yes to thirty days.
- If no: one clause in `/privacidad`.
- 2 min.

**M12. A consent-state code in the owner's mail as health data** (live). Can
`GENERATION_PROFILE_CONSENT_REQUIRED`, seen by whoever holds the console, be health data under
C-184/20?
- Facts: [`2026-09-29-mail-to-the-owner.md`](./2026-09-29-mail-to-the-owner.md) § 6.2.
- View: no. It is a state of consent.
- If yes: the code leaves the mail.
- 1 min.

**M13. Removing a lost second factor** (live procedure). Four questions:
- (1) art. 12.6 neither obliges nor authorises asking for identity here;
- (2) is the residual risk acceptable for an account with health data;
- (3) are 12 months of keeping the mail proportionate;
- (4) is cancelling without proof on "it wasn't me" prudent?
- Facts: [`removing-a-second-factor.md`](./removing-a-second-factor.md) § 8.
- View: yes, yes, yes, yes.
- If no: a second check, or a refusal when a practice plan is active.
- 3 min.

**M14. When a consent does not have to be asked again** (live precedents). (a) Does a cut in
what is processed never require consent again, even if the text describing it changes?
(b) When a consent version rises and nobody proceeds without accepting it, does that replace
the notice mail the policy promises?
- Facts: [`textos/05`](./textos/05-consentimientos-cliente.md) (the `PROFILE_CONSENT_VERSION`
  note); [`textos/02`](./textos/02-politica-privacidad.md) (the dish-name header note).
- View: yes to both (art. 7.2 bites when a purpose is added, not removed).
- If no: re-asking on reductions, and mails on bumps.
- 2 min.

**M15. The allergy check on the assistant's answers** (live). Is a protective use on our server
(withholding an answer that names an allergen in the person's profile) within a consent whose
body says "solo para calcular tus objetivos y elegir tus platos"? *ES: ¿Cabe en ese
consentimiento un uso protector en nuestro servidor?*
- Facts: [`assistant-privacy.md`](./assistant-privacy.md) § 2.2 (the P2), § 9 (l).
- View: yes in substance (it protects the person and leaves our server for nobody), but the
  words do not name it.
- In either case: the wording drafted there goes in at the next consent bump. If no, the bump
  is now: `PROFILE_CONSENT_VERSION` `1.2.0`.
- 2 min.

**M16. The assistant's remaining questions** (live).
- Questions:
  - (c) Are six months from the last message defensible?
  - (e) Does Anthropic's Usage Policy exclusion for "Wellness content… nutrition" cover it?
  - (f) May a portability request be answered with a file a script writes, unread, within
    the one month of art. 12.3?
  - (k) Can a private individual not registered as *autónomo* be the "Customer" of
    "Audience: Business" Commercial Terms?
- Facts: [`assistant-warning.md`](./assistant-warning.md) § 4 item 17;
  [`assistant-privacy.md`](./assistant-privacy.md) §§ 2.4, 2.6, 8.1, 8.6, 9.
  On (f): on 2026-11-11 the working tree held an **uncommitted** "Descargar mis conversaciones"
  export (`assistant.export`, `ConversationExport.tsx`). It is not in `main` and not described
  here as the product. Once it is merged and live, (f) is answered by the product and drops
  off this list.
- View: yes; yes; yes (no screen is required by law); yes, because a tax registration is not
  a capacity to contract (**not consulted**: no source on (k) was read).
- If (k) is no: the no-training sentence and the DPA are in doubt until the owner registers.
  That links to G1.
- 3 min.

**M17. The cupboard: "the effect, never the datum", and a statistical purpose** (live).
(a) Does a transmission whose content was ordered by a datum the recipient never receives
amount to communicating that datum (art. 4.2)? (b) Can data collected under 6.1.b carry a
statistical further purpose on that basis alone (recital 50), with no 6.1.f line of its own?
- Facts: [`pantry.md`](./pantry.md) § 9.2, § 7 (recital 50); `0077`.
- View: no; yes.
- If (a) is yes, the policy's "le llega el efecto, nunca el dato" (`0077`) is reread wherever
  it is used. If (b) is no, the legitimate-interest sentence gains four words.
- 3 min.

**M18. The pictures as "deepfakes", and "IA" for "AI"** (live, already labelled).
(a) Is a realistic photo of a dish a deepfake (art. 3.60)? (b) Is there any risk in "IA" rather
than "AI"?
- Facts: [`dish-pictures.md`](./dish-pictures.md) §§ 1.3, 7 (a)–(b).
- View: (a) probably yes; (b) no.
- The product labels everywhere already, so a "no" only lightens the burden.
- 1 min.

**M19. A period and a fingerprint** (live). (a) Are 12 months a proportionate period for
the account-security rows (`auth.password_changed`, `auth.sessions_revoked`) in `audit_logs`?
A number. (b) Is the five-character hash prefix sent to Have I Been Pwned to check a breached
password personal data? Yes/no.
- Facts: [`analysis.md`](./analysis.md) § 4.1 bis ("to confirm with a lawyer… I found no
  specific legal period"); [`textos/02`](./textos/02-politica-privacidad.md), the
  breached-password source note.
- View: (a) yes, 12 months. (b) no.
- If (b) is yes: HIBP is named in «Con quién compartimos» and «Transferencias», and its terms
  are accepted as a recipient's.
- 2 min.

**Also, one line each, no answer needed to act:**
- An express licence over what a person types to the assistant: not needed
  ([`textos/03`](./textos/03-condiciones-uso.md) § J, last paragraph).
- Civil-liability insurance with cyber and data cover before the professional flag: for the
  lawyer or a broker ([`analysis.md`](./analysis.md) § 6).

## 4. For the *gestor* (accountant), not the lawyer

- **G1. Registration.** Modelo 036 (*alta censal*), RETA if the activity is habitual, IRPF on
  activity income: when do they start, at the first euro charged, or earlier? This also changes
  `/privacidad`'s "persona física" wording and the legal notice
  ([`analysis.md`](./analysis.md) § 6; § 10 item 5).
- **G2. VAT** with and without Stripe *Managed Payments*: with it, Link is the seller and
  settles the VAT. How does the owner document invoicing Stripe? (§ 6, "[accountant]")
- **G3. `tax_id_collection`** in Checkout for the B2B practice plan, yes or no (P2-6).
- **G4. Anthropic's invoice.** Whether VAT appears on it, and whether to give Anthropic a tax
  number once registered (see O2). It does not change the contract (Commercial Terms, H5).

## 5. Moot, or answered by facts since the mark was written

| Mark | Why it no longer needs the lawyer |
| --- | --- |
| 17(b), separate consent for the allergy list | The owner chose option (a) on 2026-11-10. The model is never told what a person cannot eat (`docs/decisions/LOG.md`). It reopens only if someone wants to send the list. |
| 17(c), "until they delete it" vs a cap | Decided: six months (LOG, 2026-11-10). Only "is six months defensible" remains (M16). |
| 17(d), the Commercial Terms and their DPA for this key | On 2026-11-10 the owner checked, in the Console, that the organisation is under the Commercial Terms and that the invoicing entity is Anthropic Ireland, Limited (LOG). The DPA is incorporated and its SCCs are deemed executed ([`assistant-privacy.md`](./assistant-privacy.md) § 8.2). What is left is in H5 and M16(k). |
| 17(k), the key's organisation | Checked by the owner (same LOG line). The legal remainder is M16(k). Keeping the evidence is O1–O2. |
| 17(m), "what if no mail is sent" | The mail was sent and the switch thrown (commit `094a495c`). Whether the gap was at least one day is the owner's to show from his Sent folder (O8). The question for future changes is H6(d). |
| 17(n), whether to pin to the US | Decided: global (LOG, 2026-11-10). The question of whether the sentence is enough stays, as H5(a). |
| 11(c), C2PA through OpenRouter | Measured on 2026-09-27: it arrives. |
| 11(d), the console as an "exposure" | Its author says not to spend the hour: the page labels it anyway. |
| 11(e), the art. 50.4 human-review exception | The product does not rely on it. |
| 11(g), the judge's sentence misleading? | The owner took clause (b). It is live (`es-ES.ts:3016`: "como su pan o su leche, porque una imagen no muestra de qué está hecho"). |
| [`analysis.md`](./analysis.md) § 4.3, free text to models that train | No model that trains receives anything since `0064` (2026-09-26). |
| [`analysis.md`](./analysis.md) § 4.4 d, the Gemma prohibited-use policy | On the reading there, it does not bind for Gemma 4, and it would not reach NutrIA even if it did. |
| [`pantry.md`](./pantry.md) § 9.3, art. 13.3 or only 5.1.a | By the document's own words, the answer "changes nothing about what was actually done". |
| D5 § 7 item 3, second half (the 25 and 28 September mails), and item 4 (§ 6.A "important"?) | Historical: no action follows from either answer today. The live part is H6. |
| [`analysis.md`](./analysis.md) § 9 (the dish request's refusal wording) | It is marked but asks nothing ("nothing here is an obligation either way"). |

## 6. What the owner checks himself (not the lawyer's time)

Keep every screenshot, PDF or reply **dated and outside the repository**, because art. 5.2
asks him to be able to show it. Menu names below are what to look for. They are not exact
labels, because the agent cannot see his Console.

- **O1. Anthropic: organisation, not a consumer plan** (done 2026-11-10, per LOG; now keep the
  evidence).
  1. In the Anthropic Console, open the organisation's settings.
  2. Screenshot the organisation's name and the page that shows the account is a Console (API)
     organisation. Those accounts run under the Commercial Terms, whose header reads
     "Audience: Business" ([`assistant-privacy.md`](./assistant-privacy.md) § 8.1).
- **O2. Anthropic: the contracting entity.**
  1. In the Console's billing section, download the latest invoice as a PDF.
  2. Check that the issuer is **Anthropic Ireland, Limited**.
  3. Note whether VAT is charged, for G4.
  4. File it.
- **O3. Anthropic: where inference runs** (decided: global).
  1. Nothing to do unless he changes his mind.
  2. If he wants `/privacidad` to name only the US: in the workspace that holds the production
     key, set inference geography to `us` (the platform page quoted in
     [`assistant-privacy.md`](./assistant-privacy.md) § 8.5; the API accepts
     `inference_geo: "us"` per request). It costs 1.1× the standard rate.
  3. Tell `legal` **before** switching, so ¶ 5, R7 and R8 drop "otros países" in the same change.
- **O4. Anthropic: no training opt-in.**
  1. In the Console's privacy or data settings, check that no option to share API data with
     Anthropic for training or feedback is switched on.
  2. Our "no entrena" rests on § B of the Commercial Terms and on "never used for model
     training without your express permission" (§ 8.4).
- **O5. Anthropic: the sub-processor list** (H5).
  1. Open `trust.anthropic.com/subprocessors` in a normal browser. The page is drawn by
     script, which is why the agent could not read it.
  2. Save it as a PDF with the date.
  3. Send `legal` the list of names and countries.
- **O6. Anthropic: the transfer impact information** (only if H5(b) is yes). Through the privacy
  contact the DPA names, ask for "the information reasonably necessary for a transfer impact
  assessment" (DPA § I.4). File the reply.
- **O7. OpenRouter: the DPA. Do this before the hour** (H3).
  1. Request access at `trust.openrouter.ai`.
  2. Download the DPA and the sub-processor list.
  3. Write to OpenRouter support asking for written confirmation of two things: that the DPA
     its terms § 10.2 incorporate "for commercial, for-profit purposes" applies to his paid
     self-service account, and that it includes the standard contractual clauses.
  4. Bring the DPA and the reply to the hour
     ([`go-live-checklist.md`](./go-live-checklist.md) § 0 bis).
- **O8. The notice mail, as evidence** (H6).
  1. In the Sent folder, find the § Q mail ([`textos/06`](./textos/06-correos.md)).
  2. Save it with its date, time and number of recipients (blind copy).
  3. Find when the `assistant` switch was turned on in `/admin`.
  4. The two times together show whether the "no earlier than the next day" promise was kept.
- **O9. OpenRouter: account settings and the categorisation.**
  1. Screenshot, with the date, each of these settings: training off; zero data retention on;
     "use of inputs/outputs" off; prompt logging off; allowed providers DeepInfra and
     CoreWeave; and the key limited to its models (the open box in
     [`go-live-checklist.md`](./go-live-checklist.md) § 0 bis).
  2. Ask OpenRouter in writing to exclude his account from the anonymous categorisation
     (P2-12, M4).
- **O10. Mail provider** (M5).
  1. Choose a transactional mail provider that offers a DPA. **Price it first.**
  2. Tell `legal` which one it is, so the transfers sentence and the record of processing
     name it.
- **O11. Numbers for the hour.**
  1. In `/admin` → Personas › Consentimientos, read how many accounts exist and how many are
     on an older `TERMS_VERSION`.
  2. The lawyer weighs H6 differently for a handful of friends than for strangers.

## 7. What to bring to the hour

- This brief, open at § 2.
- The OpenRouter DPA and its written confirmation (O7). Without them, H3 is a guess.
- Anthropic's Commercial Terms and DPA, as dated in [`assistant-privacy.md`](./assistant-privacy.md)
  § 8. Also the invoice (O2) and the sub-processor PDF (O5).
- The live `/privacidad` (sections «El asistente», «Transferencias», «Supresión») and
  `/condiciones` (section «Cambios en estas condiciones»).
- [`textos/03`](./textos/03-condiciones-uso.md) § D bis.3, printed: H6(b) asks him to approve
  that text.
- §§ 3 and 4 of this brief, to hand over for written answers.

## 8. Coverage: every mark in the folder, and where it went

The search covered `[lawyer]`, `[abogado]`, `[accountant]`, `[lawyer/accountant]`, "lawyer's
hour", "confirm with a lawyer" and "el/al abogado" over every file in `docs/legal/` and
`docs/legal/textos/`, with the text around each hit read. A banner that only says how marks are
used, or that "nothing new" goes to the lawyer (`2026-09-29-mail-to-the-owner.md` addenda 5 and
6), asks nothing and is not listed.

| Source mark | Goes to |
| --- | --- |
| `analysis.md` § 10: item 1 | M1 |
| item 2, 3(c), P0-3's residual (goal, veganism) | H2 |
| 3(a), § 4.4 a, P1-11 | H3 |
| 3(b), § 4.4 b, P2-11 | M3 |
| 3(d), § 4.4 c (controller; dish-name sample) | M4 (and M3) |
| 4, 7; go-live § 2 (the button with a trial); P2-6 (legal half) | M7 |
| 5; P2-6 (tax half) | G1–G3 |
| 6; § 6 (domicile); `textos/07` | M6 |
| 8; § 7 (art. 50.2) | H7 |
| 9; § 7 (medical device) | H8 |
| 10; § 4.2 table; P2-10 | M5 |
| 11(a), 11(b); `dish-pictures.md` § 1.3 | M18 |
| 11(c), 11(d), 11(e), 11(g); `dish-pictures.md` §§ 1.6, 2, 4.6 | § 5 |
| 11(f); `dish-pictures.md` § 4.4 (the trail) | H9 |
| 12 = D5 § 7 items 1 and 3 | H6 |
| D5 § 7 items 2, 5, 6 | M8 |
| D5 § 7 item 3 (second half), item 4 | § 5 |
| 13 | M9 |
| 14 | M10 |
| 15(a)–(b) | M11 |
| 15(c), § 4.1 quinquies | H4 |
| 16(a), (b), (d); P1-15; `textos/03` § D bis.2–3 | H6 |
| 16(c) | M8 |
| § 4.3 (free text to training models), § 4.4 d (Gemma policy), § 9 (refusal wording) | § 5 |
| § 6 (insurance) | § 3, last lines |
| `assistant-warning.md` § 4 item 17(a); `assistant-privacy.md` § 9 (i) | H1 |
| 17(b), (c) (choice), (d), (k) (facts), (m) (no-mail half), (n) (choice) | § 5 |
| 17(c) (defensible), (e), (f), (k) (legal) | M16 |
| 17(g), amended | H2 |
| 17(h), (j), (n); `assistant-privacy.md` § 2.1; `dpia.md` R-A5 | H5 |
| 17(l); `assistant-privacy.md` § 2.2 | M15 |
| 17(m) (future notice) | H6(d) |
| `pantry.md` § 5.3 (and its restatements in §§ 0, 7, 8) | H2(b) |
| `pantry.md` § 7 (recital 50), § 9.2 | M17 |
| `pantry.md` § 9.3 | § 5 |
| `2026-09-29-mail-to-the-owner.md` § 6.1 | M3 |
| `2026-09-29-mail-to-the-owner.md` § 6.2 | M12 |
| `removing-a-second-factor.md` § 8 items 1–4 | M13 |
| `textos/05` (the reduction note); `textos/02` (the dish-name header note) | M14 |
| `textos/03` § J (licence) | § 3, last lines |
| `textos/04` §§ 6, 8 | M2 |
| `textos/02` (the cupboard header note) | M17 |
| `analysis.md` § 3 table (prompt 4.4.0 and "losing weight") | H2 |
| `analysis.md` § 4.1 bis (12 months for security rows) | M19(a) |
| `analysis.md` § 4.1 quater (the cookie and its 90 days) | M10(a) |
| `analysis.md` § 4.1 quinquies (basis; thirty days) | M11 |
| `analysis.md` § 6 (`[lawyer/accountant]`, `[accountant]`) | G1, G2 |
| `analysis.md` § 9 P1-15 ("de menor importancia") | H6 |
| `2026-09-29-accepting-the-legal-texts.md` §§ 3.2, 3.3, 4.3, 4.4, 5, 6.B (the in-body marks behind § 7) | H6, M8, § 5 as their § 7 items |
| `assistant-warning.md` § 2 table, rows 3 (MDR) and 6 (what is typed) | H8, H1 |
| `assistant-privacy.md` § 2.2 table (free text), § 2.5 (13.1.f), § 2.6 (the owner as an individual), § 6 (no mail) | H1, H5, M16, H6 |
| `dpia.md` § 1.2 (the cupboard row), § 8 R-A1, R-A2, R-A5 | H2(b), H1, H2, H5 |
| `dish-pictures.md` § 1.5 ("IA" for "AI") | M18 |
| `dish-pictures.md` § 5 IMG table (the act of the owner's) | H9 |
| `removing-a-second-factor.md` (the art. 12.6 note) | M13 |
| `breach-procedure.md` (the closing source note on joint controllership) | M1 |
| `textos/02` (the sampled dish-name note) | M3 |
| `textos/02` (the breached-password note) | M19(b) |
| `textos/02` ⟦dos-pasos⟧ and ⟦llaves-de-acceso⟧ notes | M10(b), (c) |
| `textos/03` § D (the 30 days of a price change) | M7 |
| `textos/03` § D bis.4 (the "two marks" of the clause) | H6 |
| `textos/05` (the screen-instead-of-mail note for the care consent) | M14 |
| `textos/06` §§ H, L, N source notes (recital 26; C-413/23 P) | M3 |
| `textos/06` § I source note (the consent-state code) | M12 |
| `breach-procedure.md`, banner | not a question |
| `go-live-checklist.md` § 0 decies and § 0 undecies, "the lawyer's hour" | this brief |

## Sources (read for this brief, 2026-11-11)

- Regulation (EU) 2024/1689 (AI Act), the BOE text `DOUE-L-2024-81079`: art. 50.1–50.4, read
  today. Art. 111.3 and Guidelines C(2026) 5054 point 153 are cited from
  [`dish-pictures.md`](./dish-pictures.md) § 1.1 (read 2026-09-27) and not re-read.
- Regulation (EU) 2016/679 (GDPR), the BOE text `DOUE-L-2016-80807`: arts. 28.2–28.3, 28.9 and
  28.10, read today. Other articles are as cited in the source documents.
- LO 3/2018 (LOPDGDD), BOE-A-2018-16673, consolidated to 27/12/2025: arts. 32 and 72.1.n, read
  today.
- Law 34/2002 (LSSI-CE), BOE-A-2002-13758, consolidated to 23/01/2025: art. 10.1 (a)–(e) and the
  annex, letter a, read today.
- Article 29 Working Party, *Guidelines on transparency under Regulation 2016/679*, WP260
  rev.01 (11/04/2018), annex, the row on arts. 13.1.f / 14.1.f, read today.
- Everything else is as cited, with its date, in the source documents each item links to.
  Anthropic's pages are as read and quoted on 2026-11-10 in
  [`assistant-privacy.md`](./assistant-privacy.md) § 8.
- The code and texts at `094a495c`: `apps/web/src/i18n/dictionaries/es-ES.ts` (lines cited
  above), `apps/api/src/modules/assistant/controllers/Assistant.controller.ts:100`, the version
  constants in `packages/core/src/entities`, and `docs/decisions/LOG.md` (2026-11-06,
  2026-11-10).
