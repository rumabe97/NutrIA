# The assistant and food supplements (project 023, decision `0108`)

> **I am not a lawyer.** This is the text and the reasoning a lawyer would check. Every clause
> is tied to the article it rests on and to what the code does. Anything that depends on an
> interpretation is marked **[lawyer]**.
>
> **Purpose**: what the law says about an AI assistant giving general information on food
> supplements, the words of the fixed notice under such an answer, what the prompt and the code
> must refuse, which published sentences change, and what blocks shipping. **Audience**: the
> owner (who approves the wording), the lead, `backend`, `frontend`. **Committed**: yes.
> **Maintained by**: the `legal` agent. Written 2026-11-16 against `main` at `65417e56` **plus the
> working tree as read that day**: prompt `1.4.0` (`AssistantPrompt.ts`), `Supplement.ts`
> (`asksOnlyOfSportsSupplements`, `isAboutSupplements`, `micronutrientAmount`, `noticeFor`), the
> `dose` let-through in `clinicalRefusal`, the decline `supplement_amount` (migration `0070`), and
> [`0108`](../decisions/0108-the-assistant-answers-about-supplements-under-a-notice.md). The code
> was uncommitted and changing while I read it. Function names are cited, not lines.
> **Re-read 2026-11-17** by the `legal` agent against the working tree of the branch
> `assistant-answers-about-supplements` (still uncommitted), after the lead built the fixes:
> `Supplement.ts` (`AMOUNT_FAMILIES`, `SUPPLEMENT_CEILINGS_MG`, `NO_AMOUNT`, `BANNED_SUBSTANCES`,
> `withheldSupplementAmount`, which replaced `micronutrientAmount`, `isAboutSupplements`,
> `noticeFor`) and its tests, `clinicalRefusal` and its tests, prompt `1.4.0`, `QuestionLabel.ts`,
> `Assistant.service.ts`, `AssistantChat.tsx`, both dictionaries and `TERMS_VERSION`. § 0, § 1,
> § 3.1, § 3.3, § 4.1, § 5 and § 6 now say what is built; § 2 stands as written. **I read the
> tests; I did not run them** (a gate was running). The measurement quoted is the lead's.
> It sits beside [`assistant-warning.md`](./assistant-warning.md) and
> [`assistant-privacy.md`](./assistant-privacy.md), which stand except where § 6 below replaces
> their strings. For `/privacidad` § «El asistente» ¶ 1, ¶ 2, ¶ 4 and ¶ 9, for `/condiciones` T1
> and for `TERMS_VERSION`, **this document wins** over [`assistant-privacy.md`](./assistant-privacy.md)
> § 3.1 and § 4 (and so over what [`textos/02`](./textos/02-politica-privacidad.md) and
> [`textos/03`](./textos/03-condiciones-uso.md) point to).

## 0. In eight lines

1. **No supplement-specific law binds NutrIA directly.**
   - RD 1487/2009, Regulation 1924/2006 and Regulation 1169/2011 bind whoever makes, labels,
     advertises or sells a food. NutrIA sells none (§ 2).
   - They are still the right **ceiling** for what the assistant says. The law that does bind
     NutrIA is consumer liability (TRLGDCU art. 147), the GDPR and the AI Act.
2. **The notice** (§ 3) is 220 characters in es-ES and 210 in en-GB. Three of its clauses carry
   legal weight; "under 18" is cut because accounts are 18+. It is computed and never stored, so
   it has no version constant.
3. **Blocks shipping (§ 5): nothing, as of the second re-read on 2026-11-17.** All four findings
   of 2026-11-16 are fixed in the working tree (uncommitted; tests read, not run by me):
   - **S1, P0 at ship — fixed.** `/privacidad` ¶ 4 and `/condiciones` T1 now name the
     nutritional figures and "una cantidad de un suplemento que no nos corresponde dar", in both
     languages, exactly as § 6. `TERMS_VERSION` is `2.3.0`; both `updated` strings say
     17 November 2026.
   - **S2, P1 — fixed.** Amounts for the owner's four only (`AMOUNT_FAMILIES`), each stated in the
     prompt; `SUPPLEMENT_CEILINGS_MG` withholds creatine over 3 g, caffeine over 400 mg and
     omega-3 over 3 g, and any per-kilo amount of those three; any IU amount and any amount of
     anything else are withheld too. `0108` now says 3 g.
   - **S3, P1 — fixed.** «¿Para qué sirve el magnesio?» turns the check and the notice on, and so
     does a vitamin or mineral asked about with any form of «tomar» / "take" (`INTAKE`), whatever
     food word is in the question; tests name the three phrasings that slipped through.
   - **S4, P1 — fixed.** A `banned` lexicon category, read first, refuses before any call; the
     `dosis` let-through never applies beside one. The § 4.2 names are in the list, except
     diuretics and laxatives, left to the label by the lead's decision (§ 5.1).
4. **Advisable (P2/P3):** the four `/privacidad` sentences and the nudge not to say what you take
   are in the working tree; the prompt carries every § 4.1 line (§ 4.1); the DPIA and record
   lines are written; the marketing words to avoid stand (§ 5.2).
5. **No consent version moves.** The wall holds: declared supplements still never reach a model.
   The policy's "te pediremos tu consentimiento de nuevo" is not triggered.
6. **No mail is owed.** There is no new recipient, no new limit and no new exclusion (§ 6.3).
7. **The opening warning stays as approved** (§ 8).
8. **The lawyer's hour gains item 18** (§ 9): five questions, about twenty minutes.

## 1. What the product does (read in the code, not the plan)

*Rewritten 2026-11-17 against the working tree. The 2026-11-16 version described `SPORTS`,
`MICRONUTRIENTS` and `micronutrientAmount`, which no longer exist.*

- **Before any model.** `clinicalRefusal` reads its lexicon on the question; any hit is refused
  as `clinical` and the question is stored empty.
  - **`banned` is read first**: `BANNED_SUBSTANCES` in `Supplement.ts` (steroids, SARMs,
    clenbuterol, DNP, GH, EPO, ephedrine and ephedra, yohimbe, DMAA and its kin, sibutramine,
    higenamine, "quemagrasas" / "fat burner", "post ciclo"…). A hit refuses whatever else the
    question says, «dosis» or not.
  - **The `dose` let-through**: «dosis» / «dose» is not cut when `asksOnlyOfSportsSupplements` is
    true and no child word (`hijo`, `niña`, `my son`…) is in the question. That function is true
    only when one of the four families in `AMOUNT_FAMILIES` is named (creatine, caffeine,
    omega-3, protein powder; "epa" and "dha" alone do not count), **no** `NO_AMOUNT` term is
    (vitamins, minerals, melatonin, pre-workouts, BCAAs, glutamine, beta-alanine, citrulline,
    carnitine, herbs…) and **no** banned term is. Every other category (medication, pregnancy,
    condition, eating disorder, child) is read on the same question.
- **The label** (`LABEL_SYSTEM_PROMPT`) calls a general supplement question from an adult
  `nutrition`, including the usual amount of the four. It still calls `clinical`:
  - a supplement taken to treat, prevent or cure something;
  - a supplement beside a medication, a disease, a symptom or a blood test;
  - substances that are medicines or banned in sport;
  - somebody under 18 taking a supplement; pregnancy, breastfeeding, an eating disorder or a
    child.
- **The answer** (`assistantSystemPrompt`, `1.4.0`): § 4.1 line by line. In short, amounts for
  the four only and only these (creatine 3 g a day, no loading phase; caffeine at most 200 mg at
  a time and 400 mg a day; omega-3 250 mg of EPA and DHA a day, never above 3 g; protein powder
  the label's serving, never protein or kcal per scoop); never per kilo; nothing else gets an
  amount; no disease claim, no promised result, no brand, never asks what the person takes,
  banned substances in one sentence; a professional when a medication, condition, symptom, test
  result, pregnancy, breastfeeding, eating disorder or under-18 is mentioned; never presents
  itself as a health professional.
- **After the answer**, on everything shown so far, sentence by sentence (`verdict` in
  `Assistant.service.ts`, in this order): allergen, nutritional figure (`0105`), then
  **`withheldSupplementAmount`**, then claims to act. It withholds (decline
  `supplement_amount`):
  - any amount in international units, **whatever the exchange is about**;
  - when `isAboutSupplements` is true: a creatine, caffeine or omega-3 amount over
    `SUPPLEMENT_CEILINGS_MG` or followed by «por kilo» / «/kg» / «per kilo»; any mg or µg amount of
    anything else; a gram amount of anything else straight before its name or beside a daily
    word. A food and what it carries («un vaso de leche aporta 250 mg de calcio») passes, unless
    a pill word, a supplement word or a daily word is in the sentence. A protein-powder amount
    passes this check (it is food; a protein figure is the figure check's).
  - The check reads `topicOf`: this question **and the previous one**, so a follow-up is read
    with what it follows.
  - Known gaps, kept as tests: «una cápsula al día», «el doble de lo que pone», «Mil UI».
- **`isAboutSupplements`** is true when the question (with the previous one) or the answer names
  one of the four or a generic word (any word starting «suplement» / «supplement», «complemento
  alimenticio», «multivitamínico»), or when the question names a `NO_AMOUNT` term and **no**
  `FOOD` word («tiene», «lleva», «aporta», «dan», «alimentos», «contains»…).
- **The notice.**
  - `noticeFor` returns `'supplement'` when something was shown and `isAboutSupplements` is true.
  - The service sends it with the stream's `end` **and** with `error` (a stream that failed
    part-way keeps its notice), and works it out again for every assistant turn each time a
    thread is read (`noticed`). It is never stored.
  - A decline before anything was shown (a lexicon or label refusal, or a withheld first
    sentence) carries no notice: `noticeFor` needs a non-empty answer.
  - Its words are `assistant.notices.supplement` in both dictionaries. `AssistantChat.tsx` draws
    it as a `<p role="note">` after the answer, as a sibling of `AssistantMarkdown`, so
    **outside** the `data-ai-generated` element (#359).
- **What the model is told about the person**: unchanged.
  - Not their declared supplements, conditions or medication. `Assistant.boundary.test.ts` and
    `health-boundary.spec.ts` stand.
  - It is told the plan's days, targets and tastes ([`assistant-privacy.md`](./assistant-privacy.md) § 1).
- **What is kept**:
  - A supplement question labelled `nutrition` is **stored with its text**, like any other
    answered question.
  - A `clinical` one is stored empty (F2).
  - A `supplement_amount` decline keeps the question and what was shown before the stop.
  - A `banned` question is refused as `clinical` and stored empty, like every lexicon refusal.

## 2. The law, rule by rule

| Rule | Does it bind NutrIA? | What it gives the assistant |
| --- | --- | --- |
| **RD 1487/2009** (food supplements), BOE-A-2009-16109, consolidated to 27/03/2018 | **No, directly.** Art. 1.2: it "se aplicará a las empresas de producción, transformación, envasado, almacenamiento, distribución, importación y comercialización". NutrIA is none of them. | **The ceiling and the notice's words.** <br>• Art. 5.4: no attributing to a supplement "la propiedad de prevenir, tratar o curar una enfermedad humana, ni se referirá en absoluto a dichas propiedades". <br>• Art. 5.3: no suggesting "que una dieta equilibrada y variada no aporta las cantidades adecuadas de nutrientes en general". <br>• Art. 5.5.b–d: the label must carry "la dosis del producto recomendada para consumo diario", "la advertencia de no superar la dosis diaria expresamente recomendada" and "la afirmación expresa de que los complementos alimenticios no deben utilizarse como sustituto de una dieta equilibrada". <br>• **Annex (since RD 130/2018), maximum daily amount in a supplement:** "Monohidrato de creatina. 3 g"; "Ácidos grasos omega-3 (DHA + EPA). Suma total 3 g"; "L-glutamina. 5 g"; "L-leucina. 3 g"; "L-carnitina… 2 g". Caffeine, beta-alanine and citrulline are not in it. These are national figures: the "Disposición adicional única. Cláusula de reconocimiento mutuo" says the decree's requirements "no se aplicarán a los complementos alimenticios legalmente fabricados o comercializados en otros Estados miembros", so they are Spain's ceiling, not an EU-wide one. <br>• Art. 2.1: a supplement is a food "comercializado en forma dosificada". Whether a tub of protein powder is a supplement or an ordinary food for sportspeople depends on how it is sold; either way it is a food. |
| **Regulation (EC) 1924/2006** (claims), OJ L 12, 18.1.2007 (corrected text) | **Not on my reading [lawyer].** <br>• Art. 1.2: it applies to claims "efectuadas en las comunicaciones comerciales, ya sea en el etiquetado, la presentación o la publicidad de los alimentos que se suministren como tales al consumidor final". <br>• Recital 4: it "no debe aplicarse a las declaraciones efectuadas en comunicaciones no comerciales tales como… las comunicaciones e información no comerciales en la prensa". <br>• NutrIA sells a subscription, not a food, and names no product. <br>• **The reading fails the moment an answer names a brand, a shop, a link or a discount**: that starts to be a commercial communication for a food. Hence the brand rule (§ 4). | **The ceiling for claims.** Never say more than an authorised claim says, and never claim disease-risk reduction (art. 2.2.6). |
| **Regulation (EU) 432/2012** (authorised health claims), OJ L 136, 25.5.2012, as published | Same as 1924/2006. | **The usual amounts that have a legal anchor:** <br>• creatine: "La creatina mejora el rendimiento físico en series sucesivas de ejercicios breves de alta intensidad", with "una ingesta diaria de 3 g de creatina"; <br>• EPA/DHA: "contribuyen al funcionamiento normal del corazón", with "una ingesta diaria de 250 mg de EPA y DHA"; <br>• protein: "Las proteínas contribuyen a que aumente la masa muscular"; <br>• melatonin: 0.5 mg (jet lag) and 1 mg (falling asleep). <br>**There is no caffeine entry** in the list as published. I did not open the consolidated list, and later amendments may add one. |
| **Regulation (EU) 1169/2011** (food information), OJ L 304, 22.11.2011, as published | **No, directly.** Art. 1.3: it applies "a los operadores de empresas alimentarias". Its definition of food information reaches "herramientas tecnológicas modernas" (art. 2.2.a), but only in the hands of such an operator. | Art. 7.3, the same rule as RD 1487 art. 5.4: food information "no atribuirá a ningún alimento las propiedades de prevenir, tratar o curar ninguna enfermedad humana". |
| **RD 1907/1996** (advertising with a claimed health purpose), BOE-A-1996-18085, no amendments | **Only to NutrIA's own advertising.** Art. 4 forbids "cualquier clase de publicidad o promoción directa o indirecta, masiva o individualizada" of products with a claimed health purpose that: <br>• "sugieran propiedades específicas adelgazantes o contra la obesidad" (4.2); <br>• "sugieran o indiquen que su uso o consumo potencian el rendimiento físico, psíquico, deportivo o sexual" (4.12). <br>An answer about a product NutrIA does not sell is not its advertising. A landing card that sells the assistant **with** those words starts to be [lawyer]. | No "fat burner", no slimming promise, no "boosts performance" in NutrIA's marketing of this feature (§ 5.2, A5). |
| **RDL 1/2015** (medicines), BOE-A-2015-8343, consolidated to 31/07/2026 | Indirectly. Art. 2.a: a medicine is any substance "que se presente como poseedora de propiedades para el tratamiento o prevención de enfermedades". | **A supplement presented as treating is, by presentation, a medicine.** That is why the disease-claim rule is not style. **Melatonin:** in July 2021 AEMPS withdrew "Melatonin 3 mg cápsulas" as an unauthorised medicine (art. 2.a), comparing it with an authorised medicine "siendo la dosis de dicho principio activo de 2 mg" (ref. ICM (MI), 3/2021). That is one case, not a published threshold, so the assistant states **no** melatonin amount. |
| **Ley 44/2003** (health professions), BOE-A-2003-21340, consolidated to 05/06/2021; **Código Penal art. 403**, BOE-A-1995-25444, consolidated to 09/04/2026 | **The line not to cross.** <br>• Art. 7.2.g: the dietitian-nutritionist's activity is food "adecuadas a las necesidades fisiológicas y, en su caso, patológicas" of **the person**. <br>• Art. 403.1 punishes "actos propios de una profesión" without the degree; 403.2.a aggravates it if one "se atribuyese públicamente la cualidad de profesional". | **My reading [lawyer]:** general information about a supplement, given to somebody whose health the assistant does not know, and stated as what a healthy adult usually takes, is not the act of a profession. Advice fitted to this person's body, plan or condition would come closer. That is why: <br>• the amount is phrased as usual, never as theirs; <br>• no mg/kg (it does not know their weight); <br>• the assistant never calls itself a dietitian; <br>• anything clinical is cut. |
| **TRLGDCU** (consumers), BOE-A-2007-20555, consolidated to 04/11/2026 | **Yes.** Art. 147: providers of services answer for harm "salvo que prueben que han cumplido… los demás cuidados y diligencias que exige la naturaleza del servicio". Art. 148 (special, near-strict regime) names "servicios sanitarios", which NutrIA does not claim to be [lawyer]. | **The legal reason for S2.** An amount the model invents above Spain's national maximum (creatine) or above EFSA's safety level (caffeine) is the failure of diligence art. 147 asks about. The terms' "No respondemos de las decisiones de salud que tomes a partir de… una respuesta del asistente" is bounded by "todo aquello que la ley no permite excluir". |
| **Ley 7/1998** (general terms), BOE-A-1998-8789, consolidated to 16/03/2019 | **Yes**, for `/condiciones`. Art. 6.2: "Las dudas en la interpretación de las condiciones generales oscuras se resolverán a favor del adherente." | **The legal reason for S1.** "una cifra que no sale de tu plan" is read the way the person reads it, as any number. |
| **AI Act**, Regulation (EU) 2024/1689, as read in [`assistant-warning.md`](./assistant-warning.md) § 2 (and its amendment 2026/1744) | **Yes, already met.** Art. 50.1 is met by the opening warning "a más tardar con ocasión de la primera interacción" (art. 50.5). Art. 50.2 marking shipped (#359). | The notice's "de una IA" is **not** required by art. 50; the owner asked for it, and it costs 9 characters. Not re-read today. |
| **GDPR**, as read in [`assistant-warning.md`](./assistant-warning.md) § 2 | **Yes.** Arts. 4.15, 9.1, 5.1.c, 25.2. **CJEU C-21/23 *Lindenapotheke*, 4/10/2024** (press release 159/24, read; the judgment not opened): data entered when ordering pharmacy-only medicines are health data, because "a link is established between that person and a medicinal product, its therapeutic indications or its uses". | **«Tomo creatina» and «tomo hierro» are not the same.** <br>• A sports supplement taken by a healthy adult has no therapeutic indication. It reveals a habit, and on my reading it is **not** health data. <br>• A vitamin or a mineral, iron above all, is close to *Lindenapotheke*: it suggests a deficiency. It is **likely** health data. <br>• NutrIA's own policy calls "tus suplementos" specially protected. That sentence is about the ones **recorded** in the health section, under consent. <br>Verdict on this: § 5.2, A1. |
| **Sport** — Código Penal art. 362 quinquies; the 2026 list of prohibited substances, Resolución de 2/12/2025 (CSD), BOE-A-2025-25042, in force 1/1/2026 under LO 11/2021 | **The reason to refuse.** Art. 362 quinquies punishes whoever "prescriban, proporcionen, dispensen, suministren, administren, ofrezcan o faciliten" prohibited substances, including to "deportistas no federados que practiquen el deporte por recreo". | Giving information is not supplying [lawyer]. But a stack or a cycle is the next thing to it, so the assistant gives neither (§ 4.2). |
| **EFSA**, Scientific Opinion on the safety of caffeine, 27/5/2015, DOI 10.2903/j.efsa.2015.4102 (EFSA's topic page read; the opinion itself not opened) | No; it is scientific advice. | **The caffeine ceiling:** <br>• "Single doses of caffeine up to 200mg – about 3mg per kilogram of body weight… from all sources" for healthy adults; <br>• "up to 400mg per day… except pregnant women"; <br>• pregnancy: 200 mg a day. |
| **Anthropic Usage Policy** (effective 12/11/2026, as quoted in [`assistant-privacy.md`](./assistant-privacy.md) § 8.6) | Contract, not law. | Its high-risk "Medical" area includes a medication "including dose". Its exclusion covers "education on… nutrition, or exercise". **My reading [lawyer]:** usual amounts of sports supplements for healthy adults sit in the exclusion; medicines and micronutrient doses do not, and they are refused. |

**Accessibility** (Ley 11/2023 and the EAA) adds nothing specific here. The notice is text under an
answer and follows the warning's rules (§ 3.3).

## 3. The notice

### 3.1 The text

**Key**: `assistant.notices.supplement`, in `apps/web/src/i18n/dictionaries/es-ES.ts` and
`en-GB.ts`. **In both dictionaries verbatim** (compared character by character on 2026-11-17).

**es-ES** (220 characters):

```text
Información general de una IA, no un consejo para ti. Sigue la etiqueta y no superes la dosis diaria recomendada. Con medicación, una enfermedad, embarazo o lactancia, pregunta antes a tu médico o dietista-nutricionista.
```

**en-GB** (210 characters):

```text
General information from an AI, not advice for you. Follow the label and do not exceed the recommended daily dose. With medication, a condition, pregnancy or breastfeeding, ask your doctor or a dietitian first.
```

Neither has a straight apostrophe, so both paste into single-quoted TypeScript.

**On length.** At 320 px a chat column holds about 36–40 characters a line at body size. That is
**about six lines**, not one or two. Two lines (about 80 characters) cannot hold the three clauses
that carry weight. If six lines is too much, the minimum below is about four, and it keeps those
three clauses.

**Minimum** (es-ES 154, en-GB 150):

```text
Información general de una IA, no un consejo para ti. Sigue la etiqueta. Con medicación, una enfermedad, embarazo o lactancia, pregunta antes a tu médico.
```

```text
General information from an AI, not advice for you. Follow the label. With medication, a condition, pregnancy or breastfeeding, ask your doctor first.
```

### 3.2 Each clause, ranked

| # | Clause | Weight | Why | Rests on |
| --- | --- | --- | --- | --- |
| 1 | "Sigue la etiqueta y no superes la dosis diaria recomendada" | **Carries the most weight. Keep "Sigue la etiqueta" in any version.** | The label is where the law puts the amount and the warning. Pointing to it makes the "no amount for vitamins" rule coherent, and it puts the product's own regulated maximum above whatever the assistant said. "no superes la dosis diaria recomendada" is the label's own mandatory wording, so the person finds the same words on the tub. The minimum drops the second half and keeps "Sigue la etiqueta". | RD 1487/2009 art. 5.5.b–c; TRLGDCU art. 147 |
| 2 | "Con medicación, una enfermedad, embarazo o lactancia, pregunta antes a…" | **Carries weight. Keep.** | By design the assistant cannot see these (the wall, `0108` clause 7), so this sentence is the only place the cases it is blind to are covered. They are the same groups the RD's annex warns about: "No debe ser consumido por mujeres embarazadas o en período de lactancia", "personas que estén siendo tratadas con antidepresivos". EFSA sets a lower caffeine level in pregnancy. | RD 1487/2009 annex; EFSA 2015; TRLGDCU art. 147; GDPR art. 25 (it informs without asking for the data) |
| 3 | "Información general…, no un consejo para ti" | **Carries weight. Keep.** | It states the intended purpose: general information, not an act fitted to "las necesidades fisiológicas y, en su caso, patológicas" of this person. It also matches the warning's "no sustituye el consejo de…". | Ley 44/2003 art. 7.2.g; CP art. 403; MDR intended purpose ([`assistant-warning.md`](./assistant-warning.md) clause 3) **[lawyer]** |
| 4 | "de una IA" | Owner's requirement; not a legal duty here | Art. 50.1 is met by the opening warning, and the folded warning line repeats it on every screen. Keep it because the owner asked ("avisando que es una IA"). It is 9 characters. | AI Act art. 50.1, 50.5 (already met) |
| 5 | "…a tu médico o dietista-nutricionista" | Wording | Names the regulated profession, as the warning does. "colegiado" is dropped for length; the warning keeps it. In en-GB, "dietitian" is the UK protected title. The minimum keeps "médico" alone. | Ley 44/2003 art. 7.2.g |
| — | "o tienes menos de 18 años" (the working tree's draft) | **Cut** | Accounts are 18+ (`auth.legalAge`, `underMinimumAge`, terms § age). The lexicon and the label already cut a child. The clause cost 26 characters and bought nothing the product does not already enforce. | Terms; `clinicalRefusal` (`child`) |

### 3.3 How it is drawn (for `frontend`)

- **Under the answer, as NutrIA's notice, not the model's words.** It must sit **outside** the
  element marked `data-ai-generated` (#359). It is NutrIA's own fixed text, and marking it as
  AI-generated would be false (AI Act art. 50.2 marks the model's output, not ours).
  **Built so** (2026-11-17): a `<p role="note">` after `AssistantMarkdown`, not inside it.
- It is real text in the DOM and read after the answer. It is not inside the live region while
  the answer streams. Once the stream ends it may be announced once. The `accessibility` agent
  owns the detail.
- **It is shown on a withheld answer too, when something was shown before the stop**: the
  service sends `noticeFor(topic, shown)` with the decline. That is right: what was shown was
  about a supplement. When the very first sentence is withheld, `shown` is empty and no notice
  is drawn; the `supplement_amount` decline then stands alone, and its own words send the person
  to the label, a doctor or a dietitian, so nothing the notice carries is lost. **P3**, no change
  needed.
- **On a stream that breaks without an `error` event** (the network drops), the client keeps
  what was shown with `notice: null` until the thread is read again, when the service attaches
  it (`AssistantChat.tsx`, the `catch` path). **P3**, left as it is by the lead's decision
  (2026-11-17): what was shown is still shown, and the notice returns on the next read.
- **No version constant.** It asks for nothing and stores nothing, and `0108` clause 4 computes
  it on every read. A change of words is recorded here.

## 4. What the assistant must refuse

### 4.1 The system prompt (`assistantSystemPrompt`): the lines to have

Prompt `1.4.0` already carries some of these; **bold** marks what it lacked on 2026-11-16 or had
to change.

**Status, 2026-11-17** (prompt `1.4.0` in the working tree, `AssistantPrompt.ts`, the block
"Food supplements"):

| Line | In the prompt? |
| --- | --- |
| 1 | **Yes**: the four, each with its amount; "no loading phase, and never more"; caffeine "counting coffee and tea"; protein per scoop never stated; the rest listed by name with no amount. |
| 2 | **Yes.** |
| 3 | **Yes.** |
| 4 | **Yes.** |
| 5 | **Yes** (completed on the second re-read): "no 'boosts' beyond what the evidence says" added. |
| 6 | **Yes.** |
| 7 | **Yes.** |
| 8 | **Yes** (completed on the second re-read): "no cycle, no stack, no post-cycle, no source". |
| 9 | **Yes** (completed on the second re-read): "Melatonin: no amount; at some strengths it is a medicine, so it is a pharmacist's or a doctor's to advise." |
| 10 | **Yes**, with the symptom and the test result. |
| 11 | **Yes.** |

1. **Amounts only for four things, and these amounts.** Replace "creatine, protein powder,
   omega-3, caffeine and the like" with a closed list:
   - **creatine: 3 g a day, with no "loading phase"**. That is Spain's national maximum in a
     supplement and the amount the authorised claim names (RD 1487/2009 annex; Reg. 432/2012);
   - **caffeine: no more than 200 mg at a time and 400 mg a day for a healthy adult, counting
     coffee** (EFSA 2015), and never per kilo of body weight;
   - **omega-3: 250 mg a day of EPA and DHA is what the authorised heart claim names; never more
     than 3 g a day** (Reg. 432/2012; RD 1487/2009 annex);
   - **protein powder: the serving on the label** (protein per scoop is never stated, `0105`).
   - **Anything else, including pre-workouts, BCAAs, glutamine, beta-alanine, citrulline and
     carnitine: no amount; the label's.**
2. Say an amount as what a healthy adult usually takes, never as what this person should take.
   **Never work an amount out from the person's weight, targets or plan** (there is no weight in
   DATA, and doing so would fit it to them, Ley 44/2003 art. 7.2.g).
3. Never say or suggest that a supplement prevents, treats, cures or relieves a disease or a
   symptom (RD 1487 art. 5.4; Reg. 1169/2011 art. 7.3; RDL 1/2015 art. 2.a).
4. Never say a varied diet cannot provide enough, **and never that this person's plan falls short
   so they need a supplement. It may say what their plan's food already provides** (RD 1487 art.
   5.3).
5. **Never promise a result**: no "burns fat", no "makes you lose weight", no "boosts" beyond what
   the evidence says (RD 1907/1996 art. 4.2 and 4.12 as the standard; Reg. 1924/2006 as the
   ceiling).
6. Never name a brand, a product, a shop, a link, a price or a discount code (Reg. 1924/2006
   art. 1.2 and recital 4: this keeps the answer non-commercial).
7. **Never ask whether the person takes a supplement, which ones, or why; answer in general**
   (GDPR arts. 5.1.c and 25.2; A1).
8. Nothing about a substance in § 4.2 except one sentence: it is not a food supplement, it is a
   doctor's matter. **No amount, no how-to, no source, no cycle, no stack, no "post-cycle"**
   (CP art. 362 quinquies).
9. **Melatonin: no amount; at some strengths it is a medicine in Spain, so a pharmacist or a
   doctor** (AEMPS 2021).
10. A medication, a condition, **a symptom, a test result**, pregnancy, breastfeeding, an eating
    disorder or under 18: no advice on the supplement, a professional instead (prompt has it;
    add the two in bold to match the label).
11. **Never present itself as a dietitian-nutritionist or any health professional** (CP art.
    403.2.a).

### 4.2 Substances: never a supplement, never an amount

Each substance was found by name in the source cited, except the market name marked †, which the
list gives under its chemical name. "List 2026" is BOE-A-2025-25042.

| Substance (search terms) | What it is | Source |
| --- | --- | --- |
| Anabolic steroids: testosterona, nandrolona, estanozolol, oxandrolona, trembolona, metandienona; "prohormonas" such as androstenediona; prasterona / **DHEA** | Medicines or unapproved; prohibited at all times | List 2026, S1.1 |
| **SARMs**: ostarina / enobosarm, ligandrol / LGD-4033, RAD140, andarina, S-23, YK-11 | Unapproved; prohibited | List 2026, S1.2 |
| **Clembuterol** / clenbuterol | Prohibited anabolic agent | List 2026, S1.2 |
| **DNP**, 2,4-dinitrofenol; péptido **BPC-157** | Not a medicine nor a food: "sustancias sin aprobación". DNP is sold as a fat burner. | List 2026, S0 |
| Hormona de crecimiento (GH), IGF-1, **EPO** | Prohibited peptide hormones and growth factors | List 2026, S2.1, S2.2.3, S2.3 |
| **Efedrina**, pseudoefedrina, metilefedrina | Stimulants, prohibited in competition above a threshold | List 2026, S6 |
| **Efedra** (the herb and its preparations) | **Prohibited in food** | Reg. 1925/2006 Annex III Part A, added by Reg. 2015/403 |
| **Yohimbe** / yohimbina bark | **Prohibited in food** | Reg. 1925/2006 Annex III Part A, moved there by Reg. 2019/650 |
| **DMAA** / metilhexanamina, octodrina (1,5-dimetilhexilamina; sold as "DMHA" †), BMPEA, oxilofrina / metilsinefrina | Stimulants found in pre-workouts and "quemagrasas"; prohibited | List 2026, S6 |
| **Sibutramina** | A withdrawn medicine found in "slimming" products; prohibited | List 2026, S6 |
| **Higenamina** | Beta-2 agonist found in pre-workouts; prohibited | List 2026, S3 |
| Diuretics and laxatives taken to lose weight | Medicines; diuretics prohibited | List 2026, S5 |
| Insulina, semaglutida / Ozempic, liraglutida, tirzepatida / Mounjaro, levotiroxina | Medicines (already in the `medication` lexicon) | RDL 1/2015 art. 2.a |
| **Melatonina** | A medicine at some strengths: AEMPS withdrew 3 mg, citing an authorised 2 mg medicine | AEMPS, ICM (MI), 3/2021 |
| Sinefrina (bitter orange), cafeína | **Not prohibited**: they are in the 2026 monitoring programme. Caffeine gets the § 4.1 ceiling. Synephrine gets no amount, because it is in no list that gives one. | List 2026, note to S6 |

**"Quemagrasas" / "fat burner"** is not a substance but a promise (RD 1907/1996 art. 4.2). The
label already sends it to `clinical`.

These terms are not only prompt words. They are also for the lexicon (S4).

**In `BANNED_SUBSTANCES`, second re-read 2026-11-17**: every row above, with the English forms,
"s 23", "metilefedrina", "dimetilhexilamina" and a bare "gh" added after the first re-read,
**except diuretics and laxatives**. That is **the lead's decision** (2026-11-17): «¿qué alimentos
son laxantes?» is a food question, and a lexicon word would refuse it; diuretics and laxatives
taken to lose weight are left to the label (`clinical`) and the prompt (medicines). Melatonin,
synephrine and caffeine are rightly not there: they are amount rules (`NO_AMOUNT`,
`AMOUNT_FAMILIES`), not refusals.

## 5. Findings, each with a verdict

### 5.1 What blocks shipping

**As of the second re-read on 2026-11-17, nothing.** Each finding below keeps its 2026-11-16 reasoning and ends with a
**Status** line saying what fixed it in the working tree. A status is a reading of the code and
its tests, not a test run.

**S1 · P0 at ship: two published sentences become literally false, and the fix is two strings.**

- **The sentences.** `/privacidad` § «El asistente» ¶ 4: "la para ahí si iba a… darte una cifra
  que no sale de tu plan". `/condiciones` T1: "Puede no contestar una pregunta —… o a darte una
  cifra que no sale de tu plan—".
- **Why they become false.** In the code, "cifra" means a nutritional figure (`0105`). The person
  reads any number. «Lo habitual son 3 g de creatina al día» is a number that does not come from
  their plan, and it is shown.
  - In the terms the person's reading is the one that counts (Ley 7/1998 art. 6.2).
  - In the policy, art. 5.1.a (fairness) and art. 12.1 (clear and plain language) apply.
  - A recipe's "200 g de arroz" was already the same imprecision. The same fix closes it.
- **Owner**: the lead (dictionaries), § 6.
- **Status (2026-11-17): fixed.** ¶ 4 and T1 in `es-ES.ts` and `en-GB.ts` are § 6's replacements,
  character for character. `TERMS_VERSION` is `2.3.0` (`User.ts`, its comment dated 17 November
  2026); `terms.updated` and `privacy.updated` say 17 November 2026 in both languages.

**S2 · P1: the amounts are the model's, unbounded, and wider than the owner's decision.**

- **What the owner decided**: usual amounts for protein powder, creatine, omega-3 and caffeine.
- **What the code did (2026-11-16; names since replaced, § 1)**:
  - the prompt says "and the like";
  - `SPORTS` adds pre-workouts (`pre entreno`, `preworkout`), BCAAs, glutamine, beta-alanine and
    citrulline;
  - pre-workouts are mixtures that are sometimes sold with substances in § 4.2 (DMAA,
    higenamine, synephrine);
  - nothing tells the model a number.
- **Why that matters**:
  - `0108` itself writes "three to five grams of creatine". Spain's national maximum daily amount
    of creatine in a supplement is **3 g** (RD 1487/2009 annex; a product lawfully sold in another
    member state may carry more), and the authorised claim names 3 g.
  - `micronutrientAmount`'s own comment gives "de 3 a 6 mg de cafeína por kilo" as an amount that
    **passes**. For a 90 kg person, 6 mg/kg is 540 mg in one go, against EFSA's 200 mg single dose
    and 400 mg a day.
  - `0004` draws the line by consequence. TRLGDCU art. 147 asks for the diligence the service's
    nature demands. An over-maximum amount that the model chose is the case both are about.
- **Smallest fix (backend)**:
  - § 4.1 line 1 in the prompt: a closed list of four, with the four amounts;
  - move every other `SPORTS` term to the no-amount group, so `asksOnlyOfSportsSupplements` lets
    «dosis» through for the four only;
  - correct the creatine sentence of `0108` in a new record, or in its log, since ADRs are
    immutable.
- **Advisable, not blocking**: a code check that withholds a caffeine amount over 400 mg, or any
  per-kilo amount, and a creatine amount over 3 g. That is the same shape as
  `micronutrientAmount`.
- **Status (2026-11-17): fixed, and the advisable check built too.**
  - The prompt carries the closed list with the four amounts (§ 4.1 line 1).
  - `AMOUNT_FAMILIES` holds the four; pre-workouts, BCAAs, glutamine, beta-alanine, citrulline,
    carnitine and the rest are in `NO_AMOUNT`, so «dosis» is let through for the four only
    (tests: «¿Qué dosis de beta alanina tomo?» and «¿Qué dosis de pre-entreno?» are refused).
  - `withheldSupplementAmount` withholds creatine over 3 g, caffeine over 400 mg and omega-3
    over 3 g (`SUPPLEMENT_CEILINGS_MG`), a per-kilo amount of those three, any IU amount and any
    amount of anything else; tests name «de 3 a 5 g», «20 g diarios», «de 3 a 6 mg de cafeína por
    kilo», «600 mg», «5 g… de omega 3» and «0,1 g por kilo».
  - `0108` (still uncommitted, so not yet immutable) now says 3 g, and records the "3 to 5 g" as
    the first build's measurement.
  - **The lead's measurement** (`apps/api/scripts/assistant-models.mjs --supplements`,
    `claude-haiku-5-5`, two runs): 26 of 26 labelled as expected both times; with the final
    prompt every amount stated was one the prompt supplies (3 g creatine; 200 and 400 mg
    caffeine; 250 mg and 3 g omega-3), and the amount check withheld none. I did not run it.
  - **Residual, P3, left as it is by the lead's decision (2026-11-17)**: a per-kilo amount of
    protein powder («0,3 g de whey por kilo») passes `withheldSupplementAmount`, which lets every
    protein-powder amount through as food. The lead's reason is that the figure check withholds
    grams of protein. That is true of «1,6 g de proteína por kilo», but **not** of the powder
    named as such: `FigureSet.ts`'s `NOT_A_FOOD` reads «proteína en polvo», «whey» or «de suero»
    as an ingredient, not a figure. So that phrasing is held by the prompt alone ("never work an
    amount out per kilo"). Protein powder is a food with no legal maximum; I accept the decision
    at P3.

**S3 · P1: the code check the owner decided on does not run on the lead's own example.**

- **The decision as given**: for vitamins and minerals "a check in code withholds an answer that
  breaks this".
- **What happened (2026-11-16; names since replaced, § 1)**:
  - `micronutrientAmount` returns null unless `isAboutSupplements` is true;
  - for «¿Para qué sirve el magnesio?» (a `nutrition` example in `LABEL_EXAMPLES`) it is false: a
    micronutrient, no intake verb, no `SPORTS` or generic word;
  - so an answer «se suelen tomar 300 mg de magnesio al día» is neither withheld nor noticed,
    unless it happens to say «suplemento» or «cápsula».
- **Rated against the decision, not against likelihood.** The lead's later `GENERIC_STEM` (any
  word starting «suplement» / «supplement») makes it likelier that the answer turns the check on,
  but nothing makes it certain, and `Supplement.test.ts` has no case for this question.
- **Smallest fix (backend)**: when the question names a micronutrient and the answer states a
  `MICRO_AMOUNT` (mg, µg, UI) beside a daily word («al día», «diario», «a day», «per day», «daily»),
  treat it as a supplement amount, withhold it, and attach the notice. Food content such as «el
  yogur tiene 120 mg de calcio» does not carry a daily word, so it stays answered. The lead
  chooses the pattern; the requirement is that the lead's own example is covered by a test.
- **Status (second re-read, 2026-11-17): fixed.**
  - `isAboutSupplements` is true when what was asked (this question and the one before it)
    names a `NO_AMOUNT` term and either no `FOOD` word **or** any form of «tomar» / "take"
    (`INTAKE`, `/ (?:tom[a-z]*|take|takes|taking) /`). So «¿Para qué sirve el magnesio?», «¿Cuánta
    vitamina D tiene que tomar un adulto?», «¿Tomo el hierro con alimentos?» and «¿Cuánto calcio
    tiene el yogur? ¿Debería tomar magnesio?» all turn the check and the notice on; all are tests,
    and the first two of the new three with a withheld amount («15 µg», «14 mg»).
  - An IU amount is withheld whatever the exchange is about; a follow-up is read with the
    question before it (`topicOf`).
  - **Still a net, P3**: a vitamin or mineral asked about with a food word and no intake verb
    («¿Qué me aportan las vitaminas?») is read as food, and an amount stated there with no
    supplement word passes. The prompt forbids it.
  - **Over-reach, harmless**: `tom[a-z]*` also matches «tomate» and «tomillo», so «¿Qué tiene más
    vitamina C, el tomate o la naranja?» is read as a supplement exchange and gets the notice. A
    food's content («el tomate tiene 14 mg») still passes as a label. Over-noticing harms nobody.

**S4 · P1: the new let-through rests the banned-substance case on a model.**

- **Before 2026-11-16**: «dosis» was cut by code whatever came with it.
- **On 2026-11-16**: «¿qué dosis de creatina y clembuterol?» passes `asksOnlyOfSportsSupplements` (a
  `SPORTS` term, no micronutrient) and reaches the label. Only the label's "substances that are
  medicines or banned in sport" stands between it and an answer. `0104` clause 5 puts a
  deterministic screen first for exactly this kind of question.
- **Smallest fix (backend)**: a `banned` list of the § 4.2 terms.
  - Any hit refuses before any call, as `medication` does, or joins that category.
  - `asksOnlyOfSportsSupplements` is false whenever one is named.
  - The tests name «dosis de creatina y clembuterol» and «ciclo de ostarina».
- **Status (2026-11-17): fixed.**
  - `BANNED_SUBSTANCES` (`Supplement.ts`) is the lexicon's first category, `banned`; a hit is
    refused as `clinical` before any call and the question is stored empty.
  - `asksOnlyOfSportsSupplements` is false whenever a banned term is named.
  - `ClinicalRefusal.test.ts` names «¿Qué dosis de creatina y clembuterol?», «¿Me recomiendas un
    ciclo de ostarina?», «¿Qué quemagrasas con efedrina funciona mejor?» and «Are SARMs safe?», all
    `banned`. «Epa, ¿qué dosis de paracetamol tomo?» stays a `dose` refusal.
  - Medicines stay in the `medication` category, read on the same question («¿Qué dosis de
    creatina tomo con la metformina?» is `medication`).
- **Names (second re-read, 2026-11-17): added**, except diuretics and laxatives, which the lead
  left to the label on purpose (§ 4.2, after the table). Any name still missing is a hole the
  label and the prompt cover, not code (`0108`, consequences).
- **Wording, P3.** The `clinical` decline a banned question gets ("Esto le corresponde a un
  profesional sanitario: dosis, medicación, embarazo…") is true of it: a SARM or clenbuterol is
  a medicine or unapproved, a doctor's matter. `/privacidad` ¶ 3 ("Algunas preguntas de salud…
  las detecta antes nuestro propio código… no se guarda") stays true: a `banned` question is
  caught by code, reaches no model and is stored empty.

### 5.2 Advisable

- **A1 · P2. Questions that invite a person to say what they take.**
  - **The F5 test, applied.** F5 was code sending recorded health data to a new recipient. This is
    not that: the code sends nothing new, and the person writes it. So it is the 17(a) case
    ([`assistant-warning.md`](./assistant-warning.md) § 4), free text, **made more foreseeable**,
    because the product now invites the topic.
  - **The own-classification test, as in F5.** `/privacidad` calls "tus suplementos" specially
    protected. So, on NutrIA's own published word, «tomo creatina» typed into a chat is treated as
    health data too, whatever my narrower reading of C-21/23 in § 2. I do not rest the verdict on
    that narrower reading.
  - **The verdict: not blocking.** It rests on the 17(a) residue and its measures, the same
    footing that already covers a condition typed despite the warning:
    - nothing in the code asks for it or sends it anywhere new;
    - the warning asks the person not to write health data;
    - a supplement beside a condition, medication or pregnancy is `clinical` and is stored empty
      (F2);
    - deletion at will, six months, nobody else reads;
    - for the case most likely to reveal health («tomo hierro»), no amount is given and the
      person is sent to a professional.
    - Two cheap measures remain: prompt § 4.1 line 7 (never ask what they take) and the ¶ 9
      sentence in § 6.1 (you need not tell us). **Ship them with S1.**
  - Whether inviting the topic changes the 17(a) answer: **[lawyer]**, item 18(a).
  - **Status (2026-11-17): both measures are in** the working tree: § 4.1 line 7 is in the
    prompt, and ¶ 9's sentence is in both dictionaries. "Never asks" is a prompt rule, not code.
    The verdict stands; 18(a) stays open.
- **A2 · P2.** Prompt § 4.1 lines 2, 4, 5, 9, 10 and 11, as listed. None of them alone is a blocker:
  each is also held by the label or by the notice.
  - **Status (2026-11-17)**: all in (§ 4.1 table).
- **A3 · P2/P3.** `/privacidad` ¶ 1, ¶ 2 and ¶ 9 and `privacy.updated` (§ 6.1).
  - **Status (2026-11-17): done**, verbatim, both languages; `privacy.updated` 17 November 2026.
- **A4 · P2.** The DPIA and the record of processing gain a line (§ 7).
  - **Status: done** (§ 7); R-A7's measures corrected on 2026-11-17 to match the code.
- **A5 · P2, marketing.** If the landing or any page advertises the assistant's supplement
  answers, it must not use:
  - slimming or performance words (RD 1907/1996 art. 4.2 and 4.12);
  - a brand;
  - "te dice qué suplementos tomar", which promises personal advice.
  - "Pregúntale también por suplementos" is fine.
- **A6 · P3. The `supplement_amount` decline (`assistant.declines.supplement_amount`)**, in the
  words the lead proposed on 2026-11-16, which I accept:
  - es-ES: `He parado aquí porque iba a darte una cantidad de un suplemento que no me corresponde dar. La que vale es la de la etiqueta del producto, o la que te dé tu médico o un dietista-nutricionista.`
  - en-GB: `I stopped here because I was about to give you an amount of a supplement that is not mine to give. The one that counts is on the product’s label, or the one your doctor or a dietitian gives you.`
  - Why it is right:
    - it is in the first person, as the other declines are;
    - it names the two sources the notice names;
    - "no me corresponde" is true of every trigger;
    - it promises nothing about the label's figure being safe for this person, so it does not
      advise.
  - **One typographic note**: the en-GB string must use `’` in "product’s" to sit in
    single-quoted TypeScript, as `legal.test.ts` and the house style expect.
  - **Status (2026-11-17): in both dictionaries verbatim**, `’` included.
  - **Code comment**: `Assistant.ts`'s description of `supplement_amount` was corrected on
    2026-11-17 (a vitamin or a mineral, over a ceiling, or per kilo).
- **A7 · P3.** The `clinical` decline still reads "dosis" broadly (`0108`, consequences). It is
  true for what it is shown on, so it can stay.
- **A8 · P3 (2026-11-17).** `assistant.fieldHint` still reads "Sobre tu plan, una receta, un
  ingrediente o tus macros" / "About your plan, a recipe, an ingredient or your macros", where
  `intro` and `off_topic` now name supplements. Under-describing harms nobody; product copy.
  Left as it is by the lead's decision (2026-11-17).

## 6. `/privacidad` and `/condiciones`: the strings

Each change quotes the text **as published** (`git show HEAD`, `65417e56`). Nothing else changes.

**Status (2026-11-17).** Every replacement below (¶ 1, ¶ 2, ¶ 4, ¶ 9, T1, both languages), the
notice of § 3.1 and the decline of A6 were compared character by character with the working
tree's `es-ES.ts` and `en-GB.ts`: **no difference**. `off_topic` and `intro` carry the sweep's
suggestion ("…macros y suplementos" / "…macros and supplements"); `fieldHint` does not (A8, P3).
Both `updated` strings say 17 November 2026.

### 6.1 `/privacidad`, § «El asistente» (`id: 'asistente'`)

**P1 (S1, blocks). ¶ 4, one phrase.**

- es-ES current: `…, a darte una cifra que no sale de tu plan o a decir que ha cambiado tu plan.`
- es-ES replacement: `…, a darte una cifra de calorías, proteína, hidratos, grasa, fibra o azúcar que no sale de tu plan, a darte una cantidad de un suplemento que no nos corresponde dar, o a decir que ha cambiado tu plan.`
- en-GB current: `…, to give you a figure that does not come from your plan, or to say it has changed your plan.`
- en-GB replacement: `…, to give you a figure for calories, protein, carbohydrate, fat, fibre or sugar that does not come from your plan, to give you an amount of a supplement that is not ours to give, or to say it has changed your plan.`
- Why: S1. The kinds are `FIGURE_KINDS` in `FigureSet.ts`: energy, protein, carbs, fat, fibre,
  sugar and saturated fat; "grasa" covers saturated. The new clause is `supplement_amount`.
  As built (`withheldSupplementAmount`, read 2026-11-17), that decline fires on a creatine,
  caffeine or omega-3 amount over its ceiling or per kilo, on any amount in IU and on any amount
  of anything outside the four (a protein-powder amount is never withheld by it; S2 residual).
  So the clause says "una cantidad de un suplemento que no nos corresponde dar": it covers every
  trigger, and it does not list them, because the list will be tuned. That
  general wording is enough for art. 13.1.c and TRLGDCU art. 60.1, because the decline tells the
  person why at the moment it fires. GDPR arts. 5.1.a and 13.1.c.

**P2 (A3). ¶ 1, the subject.**

- es-ES current: `El asistente solo habla de nutrición —tu plan, recetas, ingredientes y macros—, no es un médico…`
- es-ES replacement: `El asistente solo habla de nutrición —tu plan, recetas, ingredientes, macros y, en general, suplementos alimenticios—, no es un médico…`
- en-GB current: `The assistant only talks about nutrition — your plan, recipes, ingredients and macros —, is not a doctor…`
- en-GB replacement: `The assistant only talks about nutrition — your plan, recipes, ingredients, macros and, in general terms, food supplements —, is not a doctor…`
- Why: a food supplement is a food (RD 1487 art. 2.1), so "solo habla de nutrición" stays true.
  The list in dashes now names what the assistant does. GDPR art. 13.1.c.

**P3 (A3). ¶ 2, the last sentence's last clause.**

- es-ES current: `…, ni tus enfermedades, tu medicación o tus suplementos.`
- es-ES replacement: `…, ni las enfermedades, la medicación o los suplementos que anotas en tu perfil; lo que escribas tú en una pregunta lo recibe con ella, salvo en las preguntas que nuestro código para antes.`
- en-GB current: `…, or your conditions, medications or supplements.`
- en-GB replacement: `…, or the conditions, medications or supplements you record on your profile; what you write in a question it receives with it, except in the questions our code stops first.`
- Why: next to a feature that invites supplement questions, "nunca recibe… tus suplementos" can
  be read as "what I type about my creatine is not sent". It was always about the profile, and
  now it says so. "salvo en las preguntas que nuestro código para antes" keeps ¶ 3's lexicon
  truth. GDPR arts. 5.1.a and 12.1. **Not a change to any consent**: the wall is untouched.

**P4 (A1). ¶ 9, one sentence added at the end.**

- es-ES: `…hasta que lo borres o se borre solo. Para preguntar por un suplemento no hace falta que digas si lo tomas ni por qué.`
- en-GB: `…until you delete it or it deletes itself. To ask about a supplement you do not need to say whether you take it or why.`
- Why: GDPR arts. 5.1.c and 25.2. It invites less data at the moment the topic invites more.

**¶ 3 stays.** "Algunas preguntas de salud —sobre… dosis…— las detecta antes nuestro propio código":
a dose of a medicine, a vitamin or a mineral is still cut by code. A dose of a sports supplement
is no longer a health question in the product's own terms. "Algunas" keeps it true.

**`privacy.updated`**: `Última actualización: 17 de noviembre de 2026` / `Last updated: 17 November 2026`,
the day this ships (in both dictionaries, 2026-11-17).

**The sweep.** Both dictionaries at `HEAD`, `docs/PRODUCT.md` and this folder were searched for
the claims themselves ("cifra" / "figure", "dosis" / "dose", "solo habl…" / "only talk",
"suplement…" / "supplement"), not only for the word "supplement". Besides ¶ 1, 2, 4 and 9 and T1:

- **`assistant.declines.invented_figure`** ("He parado aquí porque iba a darte una cifra que no
  sale de tu plan" / "…a figure that does not come from your plan"). **Stays.** It is shown only
  when `figuresAreAllSupplied` fires, which is only on a nutritional figure, so in its place it is
  true.
- **`assistant.declines.clinical`** ("…dosis, medicación…"). **Stays** (A7).
- **`assistant.declines.off_topic`** ("solo hablo de tu plan, recetas, ingredientes y macros" /
  "I only talk about your plan, recipes, ingredients and macros"). **P3.** It now under-describes
  the assistant, which harms nobody: under-promising is not a false promise. Suggested, with
  ¶ 1: "solo hablo de tu plan, recetas, ingredientes, macros y suplementos" / "I only talk about
  your plan, recipes, ingredients, macros and supplements". **Done** (2026-11-17), verbatim.
- **`assistant.intro`** ("Pregunta sobre tu plan, recetas, ingredientes y macros") and
  **`assistant.fieldHint`** ("Sobre tu plan, una receta, un ingrediente o tus macros"; the
  2026-11-16 text misquoted it as the intro's words). **P3**, product copy. Same suggestion.
  `intro` **done** (2026-11-17); `fieldHint` unchanged (A8).
- **«Cómo protegemos tus datos»** ("Tus enfermedades, tu medicación y tus suplementos viven en una
  parte del código que no puede hablar con la inteligencia artificial" / "Your conditions,
  medications and supplements live in a part of the code…"). **Stays.** "viven en una parte del
  código" is plainly about what is recorded, and the wall holds.
- **`profile.medicationsHint`** ("No pedimos dosis…"). **Stays**: it is about the health form.
- `docs/PRODUCT.md` and the other files in this folder: no other hit. The only ones are the
  strings in [`assistant-privacy.md`](./assistant-privacy.md), which this document supersedes.

### 6.2 `/condiciones`, «Contenido generado con inteligencia artificial», T1

**One string, three changes: S1 blocks, the other two describe the feature.**

- es-ES current: `El asistente contesta con inteligencia artificial a preguntas sobre tu plan, recetas, ingredientes y macros. Puede equivocarse, y lo que dice no es el consejo de un médico ni de un dietista-nutricionista. Nunca cambia tu plan: los cambios se hacen desde Plan. Puede no contestar una pregunta —si es de salud, si no es de nutrición, o si la respuesta iba a nombrar algo que nos has dicho que no puedes tomar o a darte una cifra que no sale de tu plan— y, si para una respuesta a medias, lo que ya has leído estaba revisado. No escribas en él…` (the rest unchanged)
- es-ES replacement: `El asistente contesta con inteligencia artificial a preguntas sobre tu plan, recetas, ingredientes, macros y, en general, suplementos alimenticios. Puede equivocarse, y lo que dice no es el consejo de un médico ni de un dietista-nutricionista. De un suplemento da información general, no un consejo para ti, y lo que diga su etiqueta va por delante de lo que diga el asistente. Nunca cambia tu plan: los cambios se hacen desde Plan. Puede no contestar una pregunta —si es de salud, si no es de nutrición, o si la respuesta iba a nombrar algo que nos has dicho que no puedes tomar, a darte una cifra de calorías, proteína, hidratos, grasa, fibra o azúcar que no sale de tu plan o a darte una cantidad de un suplemento que no nos corresponde dar— y, si para una respuesta a medias, lo que ya has leído estaba revisado. No escribas en él…` (the rest unchanged)
- en-GB current: `The assistant answers questions about your plan, recipes, ingredients and macros with artificial intelligence. It can get things wrong, and what it says is not the advice of a doctor or a dietitian-nutritionist. It never changes your plan: changes are made from Plan. It may not answer a question — if it is about health, if it is not about nutrition, or if the answer was about to name something you have told us you cannot have or to give you a figure that does not come from your plan — and, if it stops an answer part-way, what you have already read had been checked. Please do not write…` (the rest unchanged)
- en-GB replacement: `The assistant answers questions about your plan, recipes, ingredients, macros and, in general terms, food supplements with artificial intelligence. It can get things wrong, and what it says is not the advice of a doctor or a dietitian-nutritionist. About a supplement it gives general information, not advice for you, and what its label says comes before anything the assistant says. It never changes your plan: changes are made from Plan. It may not answer a question — if it is about health, if it is not about nutrition, or if the answer was about to name something you have told us you cannot have, to give you a figure for calories, protein, carbohydrate, fat, fibre or sugar that does not come from your plan, or to give you an amount of a supplement that is not ours to give — and, if it stops an answer part-way, what you have already read had been checked. Please do not write…` (the rest unchanged)
- Why:
  - TRLGDCU art. 60.1: the main characteristics before contracting.
  - Ley 7/1998 arts. 5.5 and 6.2: clarity, and the person's reading wins.
  - "lo que diga su etiqueta va por delante" is the notice's clause 1 in the contract's voice. It
    allocates nothing: it is an instruction.
  - The "Responsabilidad" clause already covers "una respuesta del asistente" and "los productos
    que compres". **It stays.**

**`TERMS_VERSION`: from `2.2.0` to `2.3.0`, with `terms.updated`, in the same commit.**

- The house rule is "any change of meaning in `terms`… raises `TERMS_VERSION`"
  ([`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) § 5.4).
- This changes meaning in two ways:
  - it narrows what the published words say is checked (any number becomes a nutritional figure);
  - it adds a reason the assistant may not answer.
- It is not the [`textos/03`](./textos/03-condiciones-uso.md) § I case. That one described a new
  feature and touched nothing already written.
- If only the subject were added, the version would stay. S1 is what moves it.
- **Status (2026-11-17): done.** T1 is the replacement above in both languages; `TERMS_VERSION`
  is `2.3.0` in `packages/core/src/entities/User/User.ts`, and `terms.updated` says 17 November
  2026. The changes are uncommitted; "the same commit" is still the lead's to keep.

### 6.3 What does not move

- **No consent version.**
  - `HEALTH_CONSENT_VERSION` stays: the declared supplements still reach no model (`0108` clause 7).
  - `PROFILE_CONSENT_VERSION` and `CARE_CONSENT_VERSION` stay: nothing more leaves under them.
  - The policy's "Si el cambio afecta a cómo tratamos tus datos de salud, te pediremos tu
    consentimiento de nuevo" is not triggered: recorded health data are treated exactly as before.
- **No mail.** Both pages promise a mail "Si cambiamos algo importante". The reasoning in
  [`assistant-privacy.md`](./assistant-privacy.md) § 6 was a new recipient, a new store and a
  new limit. Here there is none of the three.
  - The assistant answers a little more.
  - The terms describe the existing check more exactly.
  - Nothing is asked of the person and nothing new is collected by design.
  - Whether narrowing the described check is "importante": **[lawyer]**, 18(c). My reading is
    that it is not.
  - **The owner decides.** S1 corrects a sentence that would otherwise be false, which is a
    reason somebody could give for telling people. Sending one short mail costs little; not
    sending it rests on my reading above. On 2026-10-20 he chose not to send a notice in a
    comparable case.
- **No change to the warning** (§ 8).

## 7. The DPIA and the record of processing

*Added on 2026-11-16 at the lead's request:*

- [`dpia.md`](./dpia.md) § 8 has a new row, R-A7. Its measures describe the code the lead
  described; its wording differs slightly from the draft below. **Corrected 2026-11-17** against
  the code: "never asks" is a prompt rule; protein powder has no ceiling in code; the amount
  check and the notice are a net that reads spelling, not "every" answer.
- [`record-of-processing.md`](./record-of-processing.md) row 10 has the words below. **On 2026-11-17** its purpose gained "and food supplements in general" and its
  measures the `banned` category and `withheldSupplementAmount`.
- [`README.md`](./README.md) has an index line for this document.
- [`go-live-checklist.md`](./go-live-checklist.md) has a new § 0 duodecies.

The drafts, as first written:

- **[`dpia.md`](./dpia.md) § 8 (the assistant addendum), one risk row:**
  - *"Supplement questions (2026-11-16, `0108`): the topic invites a person to write what they
    take. A vitamin or mineral they take may reveal a deficiency (CJEU C-21/23). Measures: the
    assistant never asks; ¶ 9 says it need not be told; no amount for a vitamin or mineral, held
    by code; a supplement beside a condition, medication or pregnancy is `clinical` and not stored
    (F2); six-month cap; nobody else reads. Residual risk: acceptable. No prior consultation."*
  - GDPR art. 35.11: a change in the risk.
- **[`record-of-processing.md`](./record-of-processing.md) row 10, data categories:**
  - after the free-text entry, add *"including, if the person writes it, which supplements they
    take"*. The purpose, recipients, transfers and periods are unchanged.

## 8. The opening warning, re-read

"no escribas aquí enfermedades, medicación ni otros datos de tu salud" still holds.

- **Asking about a supplement does not require saying you take one.** The prompt's line 7 and
  ¶ 9's new sentence keep the two consistent.
- "no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado" is what the
  notice repeats under a supplement answer.
- The folded line and `composerNotice` are unaffected.

**Verdict: the warning stays as approved, and no constant moves.**

## 9. For the lawyer's hour (beside [`assistant-privacy.md`](./assistant-privacy.md) § 9)

18. **Supplements in the assistant** (2026-11-16, `0108`):
    - (a) Inviting supplement questions makes «tomo hierro» foreseeable, not incidental. Does
      17(a)'s answer still hold with the measures in A1? Or does free text about supplements
      taken need an art. 9.2 basis? **Five minutes.**
    - (b) Regulation 1924/2006 and RD 1907/1996: does an answer from a paid service that sells no
      food, names no product and links nowhere stay a "comunicación no comercial" (recital 4)?
      And would advertising the feature change that?
    - (c) Is narrowing what `/condiciones` T1 says is checked (S1) "algo importante" that the
      change clause says needs a mail before it applies?
    - (d) Ley 44/2003 art. 7.2.g and CP art. 403: is a usual amount for a healthy adult, said by
      software, outside the dietitian's acts, as § 2 reads it?
    - (e) Anthropic's Usage Policy: are sports-supplement amounts for healthy adults "education on…
      nutrition, or exercise", and not "Medical… including dose"?

## 10. Sources, and what I could not open

**Read 2026-11-16 in the primary source:**

- **BOE consolidated texts (read on the page itself):**
  - RD 1487/2009, BOE-A-2009-16109, to 27/03/2018: arts. 1, 2, 5 and the annex;
  - RD 1907/1996, BOE-A-1996-18085, unamended: arts. 1 and 4;
  - RDL 1/2015, BOE-A-2015-8343, to 31/07/2026: art. 2;
  - Ley 44/2003, BOE-A-2003-21340, to 05/06/2021: art. 7.2.g;
  - Código Penal, BOE-A-1995-25444, to 09/04/2026: arts. 362 quinquies and 403;
  - TRLGDCU, BOE-A-2007-20555, to 04/11/2026: arts. 147 and 148;
  - Ley 7/1998, BOE-A-1998-8789, to 16/03/2019: art. 6.
- **Resolución de 2/12/2025 (CSD)**, the 2026 list of prohibited substances, BOE-A-2025-25042: the
  PDF, every substance in § 4.2.
- **Official Journal texts, the BOE's copies (as published; no consolidated versions):**
  - Reg. 1924/2006, corrected text, OJ L 12, 18.1.2007: recital 4, arts. 1.2 and 2.2.6;
  - Reg. 432/2012, OJ L 136, 25.5.2012: the creatine, EPA/DHA, protein and melatonin entries;
  - Reg. 1169/2011, OJ L 304, 22.11.2011: arts. 1.3, 2.2.a and 7.3.
- **AEMPS** notice ICM (MI), 3/2021, 2 July 2021 (melatonin).
- **EFSA**'s caffeine topic page.
- **CJEU press release 159/24** (C-21/23).

**Read only second-hand, or not opened:**

- **EUR-Lex** refused automated reading. That is why no consolidated EU text was read:
  - a later amendment to 432/2012 (a caffeine claim, for instance) could exist and is not
    reflected here;
  - Reg. 2015/403 and 2019/650 were read on legislation.gov.uk's copy of the text as adopted. The
    ephedra entry ("Ephedra herb and its preparations originating from Ephedra species") and the
    yohimbe move to Part A (recital 4: "their use in food will be prohibited") are quoted from
    there, not from EUR-Lex or the BOE.
- **EFSA's 2015 opinion itself** was not opened. The figures are EFSA's topic page summarising it.
- **The C-21/23 judgment** was not opened. The press release is quoted, and paragraph numbers are
  not given.
- **The AI Act and the GDPR** were not re-read today. They are cited as read on 2026-11-10 in
  [`assistant-warning.md`](./assistant-warning.md) § 2.
- **LO 11/2021**: its text was not opened. It is cited only as the law the 2026 list rests on, in
  the list's own words.
- **The Consejo General de Dietistas-Nutricionistas' code of ethics** was not consulted for this
  note. It binds the professional, not NutrIA, and project 004's link is untouched.
