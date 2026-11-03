# The cupboard (project 022): the picker, retention, the export and why a pantry entry is not a health datum

> **This is not legal advice.** It was written by an agent, not by a lawyer. Every claim cites
> the article and the version it rests on so that the owner — or the lawyer he shows it to —
> can check it. Where the answer turns on an interpretation, the text says so and marks it
> **[lawyer]**.
>
> **Purpose**: to answer, before the screen of phase 3b is built, the four questions PRD 022
> criterion 9 defers to `legal`: the picker against `/privacidad`, retention and the DSAR
> export of a spent draft, criterion 7's boundary, and criterion 8.
> **Audience**: the owner (who approves the findings), the lawyer, and `frontend`, `backend`
> and `tests`, who build what § 6 asks for. **The owner's three decisions of 2026-11-03 are in
> § 7**, and § 6 carries the status of every finding answered since. **Committed**: yes — the repository is **public**:
> there is no name, address or email here; the identity lives only in
> `apps/web/src/i18n/legalIdentity.ts` and the texts below use its `{name}` and `{email}`
> placeholders. **Maintained by**: the `legal` agent.
>
> **A note on language.** The analysis is in English, like the rest of the repository, with the
> Spanish legal term in brackets the first time it appears. The **texts in § 2.2 and § 5.4 are
> in the language they are published in** — Spanish for `/privacidad`, and English for the
> `en-GB` dictionary, which is what a reader of the English product sees.

---

## 0. The answer in ten lines

1. **The picker stays inside `/privacidad`'s promise about the model, and nothing about the
   model's input changes** — because **no cupboard datum reaches any model at all**. Phase 4 is
   struck, the cupboard is read at `PlanGeneration.service.ts:635`, *after* the shopping list is
   built at `:626`, and `health-boundary.spec.ts:295-334`'s allowed-keys list has no pantry key.
   **No new exception, and no consent version moves** (§ 2.1, § 2.3, § 4).
2. **But `/privacidad` has to change for a cupboard to exist at all**, and that is independent of
   the model: the *«Qué datos recogemos y para qué»* list is a closed enumeration of categories
   and the cupboard is a new one (art. 13.1.c RGPD, art. 5.1.a). One bullet, one retention
   sentence, the deletion enumeration and the date (**P1-2**, with the text drafted in § 2.2).
   `/condiciones` needs no change (§ 2.4).
3. **Retention is defensible as it stands** and is better than the policy's general promise: no
   row for an empty cupboard, the draft spent by the generation that reads it
   (`PlanGeneration.service.ts:678`, `:701-706`), slugs and counts on the plan dying with the
   plan, and `user_id` cascading on account deletion (`_utils.ts:41-43`). Two branches leave the
   draft standing after a generation and the drafted text is written to both (§ 3.1); the one gap
   is **the draft nobody ever spends**, which today has no end (**P2-4**, § 3.2).
4. **The export**: the route I checked is that **there is none** — `GET /users/me/export` is
   recommended and unbuilt ([`analysis.md` § 9, P2-9](./analysis.md#p2)), and `/privacidad` sends
   access and portability to `{email}`. A copy answered today must carry any **live**
   `pantry_items` rows and each plan's `generationMetadata.pantry.asked` (slugs and grams); a
   **spent** draft is not in the copy because it no longer exists. Portability (art. 20) reaches
   `asked`, not the derived counts (§ 3.3, **P2-5**).
5. **Criterion 7's boundary is intact and I checked it rather than assumed it** (§ 4). Six things
   would break it, and the one being built this week is in the list: the picker's query string.
6. **`GET /pantry/catalogue?q=<word>` puts what somebody types into Vercel's request log**, which
   is the design `0100` refused for the dish name for this exact reason, and it strains a sentence
   of the live policy. Raised before the route existed and **accepted**: it is a `POST` with the
   word in the body since 2026-11-03 (**P1-1**).
7. **A cupboard entry is not a health datum — because of what the product does *not* do with
   it**, and that is the whole of the reasoning. *«Tengo leche sin lactosa»* is *capable* of
   revealing a state of health by the CJEU's "comparison or deduction" test; it is lawful under
   art. 6.1.b with no art. 9 exception **only** while nothing infers a restriction from it
   (§ 5.1-5.3). **[lawyer]**
8. **Criterion 8 is enforced by the shape of the code** — the cupboard is read after every pick,
   so it cannot reach the pool, the rotation or the safety profile — **and the screen is the only
   place left where it can be broken.** § 5.4 gives the constraint as rules: what wording turns
   the cupboard into a declaration about health, and what the screen must say to stop the inverse
   misreading (that a food *not* in the cupboard is one to avoid).
9. **The measured sentence is a commercial claim before it is a product figure** (Ley 3/1991
   art. 5, TRLGDCU art. 20): the one number must be read off the plan, after the plan, and the
   *«una fila de cada cuatro»* the PRD has already marked superseded may not be said (**P2-7**).
10. **Nothing new under the AI Act**, no DPIA re-scoring, **no new recipient**, no new transfer and
    no new processor — the one recipient question there was, the plan's counts reaching a dietitian
    through a shared DTO type, was settled on 2026-11-03 by keeping them off the care path
    (**P2-9**). The record of processing and the DPIA carry a review line in this same change, and
    § 7 records the owner's three decisions of that date.

---

## 1. What the product does (read in the code, not taken from the plan)

| What | Where | What it means here |
| --- | --- | --- |
| The table | `packages/database/src/schemas/pantry.schema.ts` | `userOwned`: `user_id` → `user.id` **cascade** (`packages/database/src/schemas/_utils.ts:41-43`). Columns: `grams` (nullable), `ingredientId` (nullable, cascade), `label`, `normalisedLabel`, `unit`. **No row is an empty cupboard**, so an account that said nothing stores nothing |
| What a row holds | `packages/core/src/entities/Pantry/Pantry.ts` | `label` ≤ 80 characters, `grams` ≥ 0.01, `unit` only with an amount, at most **60** rows (`MAX_PANTRY_ITEMS`), the same on both tiers |
| The routes | `apps/api/src/modules/profiles/controllers/Pantry.controller.ts:37,44,51,60` | `POST /pantry`, `DELETE /pantry`, `GET /pantry`, `DELETE /pantry/:id`. All session-scoped; one account's cupboard reaches no other's (an e2e case proves it) |
| When it is read | `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts:635` | **After** `buildShoppingList` at `:626`, which is after scheduling, validation and the safety gate. Nothing it returns can reach the pool, the rotation, the scheduler or the prompt from there |
| What the plan records | `:665`, `:1062-1077` | `asked: [{ grams, slug }]`, `coveredRows`, `meals`, `rows`, `unresolved` (**a count, never the words**), `wholeMeals`; `null` when nobody said anything |
| When it is deleted | `:678`, `:701-706` | `PantryController.clear`, after the plan is saved, idempotent, and a failure to clear can never fail the generation. **Skipped when the job's deadline has passed** (that job is reported failed, so a retry finds the cupboard) and the draft also survives a clear that throws — in both the next generation spends it (§ 3.1) |
| What leaves the product | nothing | `PoolPrompt.ts:379`'s `pantry` is the *food category* of an ingredient (`grains, pasta, tins, oils…`), not the cupboard; `health-boundary.spec.ts:147`'s `category: 'pantry'` is the same thing in a fixture. The allowed-keys list at `:295-334` has **no** pantry key |
| What the screen will be | `PLAN.md` phase 3b | A picker over `GET /pantry/catalogue?q=<word>` (phase 3a, **being built now**), a sentence before committing, a per-entry *«Todavía no cocinamos nada con esto»*, and one measured sentence after the plan exists |

Two facts carry most of the analysis below, and both are properties of the code rather than
promises about it:

- **The cupboard is read after everything that chooses a dish has chosen.** That is why
  criterion 8 needs no test: there is no path from the read to a pick. It is also an art. 25.1
  measure (*data protection by design*) worth naming in the record, because it is what makes the
  art. 6.1.b basis in § 5.3 honest.
- **The label never leaves.** Only `slug` is in `PantryEntryView` for anything but display, only
  slugs and counts go on the plan, nothing is logged (phase 1 verified no `Logger`, `logger` or
  `console.` in any file it added) and Zod's message is deliberately kept out of
  `DatabaseOperationError` so that an error cannot quote a word.

---

## 2. Question 1 — the picker against `/privacidad`

### 2.1 The promise about the model is not even engaged

The sentence the question is about is in the live policy, § *La inteligencia artificial*
(`apps/web/src/i18n/dictionaries/es-ES.ts:2789`, and the same paragraph in
[`textos/02`](./textos/02-politica-privacidad.md):232):

> *«Lo que recibe el modelo … Siempre con los nombres de nuestras listas. Nunca recibe … nada
> que hayas escrito a mano —salvo el nombre de un plato, si tú se lo pides—…»*

Two things follow, and the second is the one that matters:

- **A catalogue slug would be a name from our lists**, so if a cupboard slug ever did travel it
  would need no second hand-written exception beside `0100`'s dish name. The PRD's § *Scope*
  (*Out*, "A typed pantry") is right about that.
- **Today no cupboard datum travels at all.** Phase 4 — the only step that would have put slugs
  in front of the model — was struck by the owner on 2026-10-23, and the read sits below the
  shopping list. The paragraph enumerates *what the model receives*; the set does not change, so
  **the paragraph does not change** and `PROFILE_CONSENT_VERSION` stays where it is (§ 2.3).

So the answer to the question as asked is **yes, with no new exception and no consent version
moving** — on the condition in § 4 that the typed word never leaves the product, and the
condition in § 5.4 that the screen does not turn the list into something else.

### 2.2 What does have to change, and it is not about the AI (P1-2)

Art. 13.1.c RGPD requires the purposes and the legal basis; art. 13.2.a the retention period;
art. 5.1.a that the whole be fair and transparent. A policy may describe categories at a
sensible altitude — but **this one enumerates them**, bullet by bullet, and gave the kitchen its
own bullet when `0102` shipped. A reader of that list who finds no cupboard in it is entitled to
conclude the product does not keep one. That is the gap, and it is the thing an AEPD complaint
reaches first, because it needs no technical examination at all.

**Four edits, in both dictionaries and in [`textos/02`](./textos/02-politica-privacidad.md).**

**(a) A new bullet in § *Qué datos recogemos y para qué***, after *«Tu cocina»*
(`es-ES.ts:2738`, the list; `en-GB.ts:2643`):

```
Lo que ya tienes en casa: si antes de generar un plan nos dices qué alimentos de nuestra lista
tienes en casa, y cuánto si lo sabes, guardamos esa lista mientras la escribes. Para que la lista
de la compra de ese plan venga con lo que ya tienes marcado como comprado. No cambia los platos
que elegimos ni quita ninguno, y no la leemos como una alergia, una intolerancia ni una forma de
comer: lo que tienes en casa no es lo que puedes comer. Al generarse el plan la borramos y, si un
fallo lo impidiera, la gasta el siguiente plan que generes.
```

<!-- Fuente: arts. 13.1.c y 13.2.a RGPD (fines, base y plazo) y art. 5.1.a (transparencia). La
     frase «no cambia los platos que elegimos ni quita ninguno» describe el código: la despensa
     se lee en PlanGeneration.service.ts:635, después de buildShoppingList (:626). La frase «no
     la leemos como…» es la que sostiene la base del art. 6.1.b sin excepción del art. 9 (§ 5.3
     de este documento): es una declaración de no inferencia, y es verdad porque no hay camino
     desde esa lectura hasta una elección. Precedente de redacción: la viñeta «Tu cocina»
     (`0102`, P2-16 de analysis.md). -->

English, for `en-GB.ts`:

```
What you already have at home: if, before generating a plan, you tell us which foods from our
list you already have, and how much where you know it, we keep that list while you are writing
it. So that the plan's shopping list comes back with what you already have ticked as bought. It
changes none of the dishes we choose and removes none of them, and we never read it as an
allergy, an intolerance or a way of eating: what you have at home is not what you can eat. We
delete it when the plan is generated and, if a failure ever prevented that, the next plan you
generate spends it.
```

**(b) A sentence in § *Cuánto tiempo guardamos tus datos*** (`es-ES.ts:2817`; `en-GB.ts:2722`),
as a new paragraph after the first:

```
Lo que nos dices que tienes en casa vive hasta que se genera el plan que lo aprovecha, que lo
borra. Si no generas ninguno —o si un fallo impidió borrarlo—, se queda ahí hasta que lo gaste el
siguiente plan que generes, lo borres tú o borres la cuenta. De ese plan queda anotado con qué
alimentos y cantidades se pidió, y eso se borra con el plan.
```

```
What you tell us you already have at home lives until the plan that uses it is generated, which
deletes it. If you never generate one — or if a failure prevented that deletion — it stays there
until the next plan you generate spends it, until you delete it, or until you delete your account.
The plan itself records which foods and amounts it was asked with, and that is deleted with the
plan.
```

<!-- Fuente: art. 13.2.a RGPD (plazo o criterio para determinarlo) y art. 5.1.e (limitación del
     plazo de conservación). Las tres vidas son las del código: PlanGeneration.service.ts:678 y
     :701-706 (se gasta con la generación), :665 y :1062-1077 (lo anotado en el plan),
     schemas/_utils.ts:41-43 (cascada al borrar la cuenta). La segunda frase es la que cierra
     P2-4: un borrador que nadie gasta no tiene fin, así que el plazo se enuncia en vez de
     inventarse un barrido. -->

**(c) The deletion enumeration**, first paragraph of the same section: *«… planes, listas de la
compra, progreso y consentimientos»* → *«… planes, listas de la compra, lo que dijiste que tenías
en casa, progreso y consentimientos»* (English: *«… plans, shopping lists, what you told us you
already had at home, progress and consents»*).

<!-- Fuente: art. 13.2.a y art. 17 RGPD. Es una enumeración, y una enumeración que no nombra una
     categoría se lee como que esa categoría sobrevive. La cascada existe
     (schemas/_utils.ts:41-43): lo que falta es decirlo. -->

**(d) The date.** `privacy.updated` in both dictionaries moves to the day the bullet ships
(today it reads *«13 de octubre de 2026»* / *«13 October 2026»*). A policy whose text changed and
whose date did not is the one defect in this area that is visible from outside without any access
at all.

**What does *not* change**, and I checked each rather than leaving it implied:

- § *Cuáles de estos datos son especialmente protegidos* (`es-ES.ts:2759`) — **no**, on the
  position in § 5.3; it would have to, on the other reading, and that is the stake of § 5.4.
- § *Por qué podemos tratar estos datos* — the cupboard falls inside the existing *«Para darte el
  servicio que pides (contrato)»* line, like the kitchen. Adding a clause is optional
  (**P3**), and I would add *«tus planes»* → *«tus planes y lo que nos digas que tienes en casa»*
  only if the owner prefers the explicit form.
- § *Con quién compartimos tus datos*, § *Transferencias* — **no new recipient and no new
  transfer**: the only recipients are Vercel and Neon, both already there.
- § *La inteligencia artificial* — no (§ 2.1).
- § *Cookies y almacenamiento en tu dispositivo* — only if the screen keeps a draft of the
  cupboard in the browser. If `frontend` stores one (localStorage, IndexedDB, a service-worker
  cache), that paragraph gains a clause, because it is also an enumeration (**P2**, and it is a
  question for `frontend`, not a finding against anybody yet).

### 2.3 No consent version moves, and why that is a statement about three constants

| Constant | Where | Moves? |
| --- | --- | --- |
| `PROFILE_CONSENT_VERSION` (1.1.0) | the profile consent, whose `profileConsent.ai` text enumerates what the model receives (`es-ES.ts:2971`) | **No.** That set does not change (§ 2.1). It moved for `0100` because one field started reaching the model; nothing here does |
| `HEALTH_CONSENT_VERSION` | conditions, medication, supplements | **No.** The cupboard is not health data on the position in § 5.3, and it is never joined to those tables |
| `CARE_CONSENT_VERSION` | what a dietitian sees (`0059`) | **No**, and since 2026-11-03 for the simplest possible reason: **nothing of the cupboard crosses to a professional at all** — no row, no slug, no label and, by the decision in **P2-9**, not the plan's counts either. The hazard that produced that finding is still there for the next field, because `PlanDto` and `CareClientPlanDto` are the same type (`apps/api/src/modules/meal-plans/dto/out/Plan.dto.ts:4`, `apps/api/src/modules/care/dto/out/Care.dto.ts:45`, both `PlanView`) |

The policy, by contrast, is **given and not accepted** (decision D5,
[`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md)), so the
edits in § 2.2 need no acceptance from anybody — only the mail in § 7, which is the owner's call.

### 2.4 `/condiciones`

Checked: the terms describe the service as *«planes de comidas de catorce días, con recetas,
cantidades y lista de la compra»* (`es-ES.ts:3172` ff.). A cupboard makes no sentence of that
false, adds no paid promise, changes no allowance and no tier (PRD § *Scope*: no
`tier_allowances` row, 60 on both tiers), and creates no new withdrawal or renewal question. **No
change required, and `TERMS_VERSION` does not move.** What *is* a consumer-law question is the
sentence the screen says about what the feature achieves: § 6, P2-7.

---

## 3. Question 2 — retention, and the export of a spent draft

### 3.1 The three lifetimes, against arts. 5.1.c and 5.1.e

| Datum | Lives | Dies |
| --- | --- | --- |
| The draft (`pantry_items`) | from the first `POST /pantry` | the generation that reads it (`:678`); or `DELETE /pantry`, `DELETE /pantry/:id`; or the account (cascade) |
| What the plan was asked with (`generationMetadata.pantry.asked`: slugs + grams) | from the plan's creation | with the plan, and with the account |
| The counts on the plan (`coveredRows`, `meals`, `rows`, `unresolved`, `wholeMeals`) | the same | the same |

**Minimisation (art. 5.1.c)**: the stored row is a food, an optional amount and an optional unit;
`unresolved` is a count and not the words; no date, no expiry, no freshness, nothing that could
age into a claim about the person. The design decision that there is **no standing larder** is a
minimisation decision before it is a product one, and it is worth saying in those words to a
regulator: the product declined to keep an inventory of somebody's house.

**Storage limitation (art. 5.1.e)**: the draft is deleted by the processing that needed it, which
is the strongest form this principle takes — the purpose ends and the datum goes with it, without
anybody asking. `asked` outliving the draft is also fine: its purpose is a different one (the
record of what a plan was built with, which is what lets a re-roll pre-fill), it is bounded by the
plan's own life, and it is the minimum that purpose needs (slugs, no labels).

**Two branches where the draft survives a generation, and the text in § 2.2 is written to both**
(`PlanGeneration.service.ts:701-706`):

- **The deadline passed.** The job is reported failed and the clear is skipped on purpose, so
  somebody told to retry finds their cupboard where they left it. No plan exists, so *«hasta que se
  genera el plan»* is still true of this case.
- **The clear itself failed.** The plan is committed by then, so the failure is logged as a warning
  (with the reason and never a label) and the draft stays. It is spent by the next generation,
  which is why `PantryController.clear` is idempotent — but **the next plan's shopping list is
  seeded from a cupboard somebody typed for an earlier one**, which is the reason the text may not
  say *«en cuanto se genera el plan, la borramos»* flatly. `/privacidad` has to carry the
  exception, and § 2.2 (a) and (b) do.

**The debt recorded in phase 2** — `spendPantry` runs after `persist` rather than after
`markSucceeded` — errs towards **less** retention, not more: in the rare failure the cupboard is
already gone. It is not a data protection defect.

### 3.2 The one gap: a draft nobody ever spends (P2-4)

Somebody types eleven foods, never generates, and closes the tab. Nothing deletes those rows. The
purpose that justified them (the next generation) never arrives, and art. 5.1.e asks for a period
or a criterion to determine one.

I would **not** build a sweep. The data are trivial, they are the person's own, they sit in their
own account behind `DELETE /pantry`, and they go with the account. What art. 13.2.a requires is
that the criterion be **stated**, and § 2.2 (b) states it: *until the plan uses it, or until you
delete it, or with your account.* A written criterion that matches the code is compliance; an
unwritten one is the finding.

**Decided by the owner on 2026-11-03** (§ 7, decision 2): the criterion goes in the policy and
**no sweep is built**. So § 2.2 (b) is not a convenience — it is the only place the end of an
unspent draft is written, and a later change that softens it leaves this datum with no stated
period at all. The three ends it has to keep naming: a generation spends it, the person empties it
(`DELETE /pantry`, `DELETE /pantry/:id`), or the account goes and the cascade takes it.

If that is ever revisited — many accounts, drafts sitting for months — the honest shape is the one
`0075` and `0092` already use: a daily task, not a read-time check.

### 3.3 The copy a person asks for: which route, and what must be in it (P2-5)

**The route I checked is that there is none.** `/privacidad` § *Tus derechos* (`es-ES.ts:2827`)
says *«Acceso: ver qué datos tenemos, desde tu perfil o pidiéndolos por correo»* and
*«Portabilidad: … pídenoslo por correo»*; there is no export endpoint anywhere in `apps/api`, and
[`analysis.md` § 9, P2-9](./analysis.md#p2) records `GET /users/me/export` as recommended and
unbuilt. The cupboard has no screen on `/perfil` either — it lives on the generation path and is
spent — so for this datum the *«desde tu perfil»* half of that sentence does not apply and the
mail route is the only one. That is lawful (art. 15 is a right to the data, not to a screen) and
it is the reading [`analysis.md` § 10](./analysis.md#10-to-confirm-with-a-lawyer) already took.

**What a reply must contain, from today:**

| Item | Art. 15 (access) | Art. 20 (portability) |
| --- | --- | --- |
| Live `pantry_items` rows: label, resolved food, amount, unit | **Yes** — they are personal data being processed | **Yes** — provided by the data subject, processed on art. 6.1.b, by automated means (art. 20.1) |
| `generationMetadata.pantry.asked` on each plan the account still has: slug + grams | **Yes** | **Yes** — it is the record of what they provided |
| `coveredRows`, `wholeMeals`, `rows`, `meals`, `unresolved` | **Yes**, as information about the processing | **No**, on the usual reading — derived data are not data "provided by" the data subject. The authority for that distinction is the WP29/EDPB guidelines on the right to data portability (WP242 rev.01), which I did **not** fetch in this session: treat the citation as the reading I rely on rather than as a quotation, and if it matters to a reply, give the counts anyway — nothing is lost by being generous here |
| A **spent** draft | **No. There is nothing to give** — art. 15.1 reaches personal data *"being processed"*, and a deleted row is not. Art. 15 carries no duty to reconstruct what retention has correctly removed | — |

**Three things to say in the reply rather than leave to inference**, because art. 12.1 asks for
intelligible answers and this is the datum most likely to be misunderstood:

1. that the cupboard a plan was asked with is kept **on that plan** and is deleted with it;
2. that the draft is deleted by the generation, so an earlier cupboard cannot be produced;
3. that the amounts in `asked` are what the person typed, not a measurement of anything.

**For whoever eventually builds `GET /users/me/export`**: it must include both rows above, with
the label (it is theirs), and must not include the counts in a "portability" file while silently
omitting them from an "access" one — one file with everything, labelled, is simpler and is what
art. 15.3 asks for.

Deadlines, for the owner's own use: one month, extendable by two with reasons (art. 12.3), free
(art. 12.5) — which `/privacidad` already promises in those words.

---

## 4. Question 3 — criterion 7's boundary, and the six things that would break it

**Confirmed, by reading rather than by assertion:**

- `health-boundary.spec.ts:295-334` — the allowed-keys list is `avoidNames`, `checkIn`,
  `cookingTimeMinutes`, `dishRequest`, `cuisines`, `dietaryPatterns`, `dislikedNames`,
  `excludeSlugs`, `goal`, `kitchen`, `language`, `likedFoods`, `loadedTargets`, `lovedNames`,
  `month`, `needBySlot`, `slotShares`, `swapWish`, `targets`. **No pantry key**, and the test
  fails if `promptPreferences` grows one.
- The two `pantry` strings inside the AI module are the *food category* of an ingredient
  (`PoolPrompt.ts:379`, `health-boundary.spec.ts:147`), not the cupboard.
- Phase 3a step 3 surfaces `pantry: { coveredRows, meals, rows, wholeMeals } | null` on the DTO —
  **counts, no slug and no label** — and since 2026-11-03 not on the care path at all (**P2-9**).
- **The round trip is a catalogue name in both languages, so there is no hand-written word at any
  point even for an English reader** (`tests`, 2026-11-03, over HTTP): all 930 catalogue foods
  carry an `en-GB` name as well as an `es-ES` one, the two are different words, the picker answers
  an English reader in English, and each of those names sent back unmodified resolves to the food
  it was offered as. It matters because *«siempre con los nombres de nuestras listas»* is a promise
  about **our vocabulary** and not about Spanish: a picker that had to fall back to the Spanish
  name, or to the person's own word, for one locale would have put a word nobody chose from a list
  into the one field of this feature that is text.

So `0100`'s boundary stands exactly as that decision left it: **the dish name is still the only
field in the product whose content a person writes and a model reads.**

**What would break it**, each with what it would then require:

1. **Phase 4 reopening.** Cupboard slugs would enter `PoolPrompt`. They are catalogue keys, so
   *«siempre con los nombres de nuestras listas»* and *«nada que hayas escrito a mano»* both
   survive — but `profileConsent.ai` and `/privacidad`'s *«Lo que recibe el modelo»* enumerate
   what travels, so **both gain a clause and `PROFILE_CONSENT_VERSION` moves**, exactly as the
   kitchen's two lines did at prompt 4.9.0. That is a question to answer when the phase is
   un-struck, and the answer is not "no change".
2. **A `label` anywhere but the screen it came from**: a prompt, a log line, an error message, an
   `ai_calls` row, a Sentry report, a mail to the owner. The label is the one free text this
   feature holds, and nothing in the product has a reason to read it except the person who typed
   it.
3. **The `/admin` aggregation of unresolved entries** (PRD 12, phase 5). It is not a model, but it
   is the controller reading words people typed, which is a disclosure of a different kind and the
   policy's *«Lo que nos escribes»* bullet would have to cover it. The constraint belongs in
   writing now: see **P2-6**.
4. **A typed word in a URL** — the picker's own `?q=` was this, and it is **closed**: the route is
   a `POST` since 2026-11-03 (**P1-1**). It stays on the list as the rule it became: no field a
   person types travels in a query string in this product, because the host's log records search
   parameters and that log is not ours to redact — **and because this framework's route-miss 404
   echoes the query string back in its own body**, so a `GET` would put a mistyped word in two
   places at once (P1-1's second bullet, where the one rule it leaves for the web side is written).
5. **A dish-request field pre-filled from the cupboard.** `0100`'s field is *allowed* to carry
   typed words; a screen that pre-fills it from a pantry label would launder a label past the
   boundary and into a **shared** library and a picture prompt. Nothing proposes this; it is
   written down because it is the cheap mistake.
6. **A free-text box on the pantry screen.** PRD § *Scope* forbids it and `apps/api/AGENTS.md`
   already says a second free-text field inherits all of `0100`'s conditions. It is on this list
   so the list is complete.

---

## 5. Question 4 — *«Tengo leche sin lactosa»*: a food, or a datum about health?

### 5.1 The test, and why it does not settle this on its own

"Data concerning health" are those that *"reveal information about his or her health status"*
(art. 4.15 RGPD). The CJEU reads it broadly: it is enough that the datum allows a state of health
to be deduced *"by an intellectual operation involving comparison or deduction"* (C-184/20 *OT*,
1/8/2022, as quoted in [`analysis.md` § 1.2](./analysis.md#12-which-data-are-health-or-a-special-category));
and in C-21/23 *Lindenapotheke* (4/10/2024) the data entered when ordering **non-prescription**
pharmacy medicines were held to be health data, so the breadth is not theoretical.

> **Honest about my sources here.** I relied on this repository's own verified citations of both
> judgments (`analysis.md`, sources list, read 2026-09-25 and 2026-09-26). I tried to re-fetch the
> text of C-21/23 today from EUR-Lex and from curia.europa.eu and got nothing readable from either,
> so **no paragraph number of that judgment is quoted here**, and the position below does not
> depend on one. A lawyer checking § 5.3 should read the *Lindenapotheke* reasoning on how
> probable the inference must be: it is the hinge.

Applied naively, the test swallows the cupboard: `leche-sin-lactosa`, `pan-sin-gluten` and
`bebida-de-soja` are catalogue foods whose own names carry a clinical qualifier, and *«this person
has lactose-free milk at home»* is one short deduction away from *«this person avoids lactose»*,
which the live policy itself lists as specially protected (`es-ES.ts:2759`: *«una forma de comer
como "sin gluten" o "sin lactosa"»*).

### 5.2 Where the line actually is

The naive reading is not the law's, and the reason is in the two judgments themselves: both turn
on what the data **allow to be concluded about the person**, with *OT*'s deduction and
*Lindenapotheke*'s order of a medicine for the person placing it. A food in a house is a weaker
premise than a medicine in a basket, in three ways that matter:

- **A cupboard is shared.** Lactose-free milk in a flat of four says nothing about any one of
  them, and nothing in this feature claims it does.
- **The qualifier is a product category, not a diagnosis.** Lactose-free milk is bought for taste,
  for digestion, for a guest, because it was on offer, because it keeps longer.
- **The purpose is a shopping list.** The deduction is one *nobody in this product makes* — not
  the scheduler, which never sees the row; not the safety gate, which reads
  `allergies`/`intolerances`/`dietary_patterns` and nothing else; not the model, which receives
  nothing of it.

So the line is not drawn around the *word* in the entry. **It is drawn around what is done with
it**, and that is the same line [`analysis.md` § 3](./analysis.md#3-legal-bases-and-the-art-9-exception)
drew for the kitchen — *"not art. 9: an appliance reveals no health … **and nothing here is used
to infer one**"*. For an appliance the first clause carries the row on its own. **For a cupboard
only the second clause carries it**, which is why criterion 8 is not a nicety: it is the condition
on which the legal basis rests.

### 5.3 The position I take

| | |
| --- | --- |
| **Basis** | **Art. 6.1.b** — processing necessary to perform the service the person asked for: the shopping list of the plan they are generating comes back with what they already have ticked. Nothing else needs it |
| **Art. 9** | **Not engaged**, on the condition that the product neither infers nor presents a restriction from an entry, and never joins the cupboard to the health tables or to `dietary_patterns`. Today that condition holds **by construction** (`PlanGeneration.service.ts:635`, after every pick) |
| **If the condition fails** | The cupboard becomes a declaration about health and the only available exception is **art. 9.2.a explicit consent** ([`analysis.md` § 3](./analysis.md#3-legal-bases-and-the-art-9-exception): 9.2.h is unavailable to a consumer service that is not a health professional and has no art. 9.3 contract). In practice: a new checkbox, `PROFILE_CONSENT_VERSION` raised, every existing account asked again on its next visit, and *«Cuáles de estos datos son especialmente protegidos»* gaining a line |
| **Marked** | **[lawyer]**, and **deliberately left open by the owner on 2026-11-03** (§ 7, decision 3), which also means it **does not block the screen**: *does an entry whose catalogue name carries a clinical qualifier (`leche-sin-lactosa`) stay outside art. 9 where the controller makes no inference from it?* My reading is yes; a cautious reading of *Lindenapotheke* could go the other way, and the cost of being wrong is a consent version, not a prohibition. What keeps it answerable later rather than urgent now is that the condition above holds by construction and § 5.4 is what keeps it holding |
| **Art. 9 LOPDGDD** | Not engaged: it governs consent as the sole basis for special categories, and this is not one |

A note the owner may find reassuring: **being wrong here is recoverable and cheap** — it costs a
checkbox and an interstitial. Being wrong in the other direction, where the screen's words make
people believe the cupboard restricts their plan, is not: it is a person who thinks the product is
avoiding something and it is not.

### 5.4 The constraint on the screen's words (the answer to "where would it cross?")

The words are not written yet, so this is a rule set and not a verdict. Each line says what it
would cost.

**Forbidden — any of these makes the cupboard a declaration about health, and § 5.3's last column
becomes the consequence:**

1. **Any verb of capacity, permission or tolerance** in a heading, a label, a placeholder or the
   helper text: *puedo / no puedo, tolero, me sienta, evito, soy intolerante, soy alérgico, sin
   lactosa, sin gluten* used as a **category of the list** rather than as part of a food's own
   catalogue name.
2. **Any framing of the list as what the person eats or avoids** rather than as what is in the
   house: *mi dieta, lo que como, lo que no como, lo que no quiero, mis alimentos*. The PRD's own
   verb — *«Aprovecha lo que ya tienes en casa»* — is the register to stay in.
3. **Asking why.** A field, a chip or a question that invites a reason for an entry ("¿por qué lo
   tienes?", "¿es por una intolerancia?") collects a health datum directly.
4. **Grouping or filtering the picker by a clinical qualifier** — a *«sin lactosa»* or *«sin
   gluten»* facet, tab or quick filter. Choosing that facet *is* the declaration, and it is
   recorded by the request that fetches it.
5. **Echoing an entry back as a trait of the person**: *«Como tomas leche sin lactosa…»*, *«Para
   ti, que no tomas gluten…»*. The entry is about a carton; the sentence is about a body.
6. **Any bridge towards the restriction screens from here**: *«¿Es una intolerancia? Dínoslo»*, a
   link that pre-fills *Intolerancias* from an entry, a suggestion that one list feeds the other.
   (The one-way clarification in the next block is the opposite of this and is required.)
7. **Any promise that the plan will avoid, exclude or prefer by the cupboard**: *«solo con lo que
   tienes»*, *«evitaremos lo que no tengas»*, *«adaptado a tu despensa»*. All three are false
   today — a cupboard changes no pick — and a false text is the worst thing on my severity scale.
8. **A free-text box**, for § 4's reasons as much as this one: a typed sentence can carry a
   diagnosis, and this product has exactly one field allowed to carry typed words.
9. **Styling `cookedWith: false` as a warning or an error.** *«Todavía no cocinamos nada con
   esto»* is a fact about **our library** and the wording is already right ("we"); it must not
   become a judgement about the person's choice, and the entry must stay in the list.

**Required, and the second one is the finding I care most about (P1-3):**

- **The honest sentence before committing**, with the ~100-ingredient fact, the verb *aprovechar*,
  **no count promised** (PRD 10) — and no implication that eating from the cupboard is better for
  the person's health. A claim about health would reach [`analysis.md` § 7](./analysis.md#7-the-ai-act-regulation-20241689-amended-by-20261744)'s
  territory and the *«no es un servicio médico»* line in the policy's own intro.
- **One sentence that stops the inverse misreading.** The dangerous misunderstanding is not that
  somebody thinks we infer an intolerance; it is that somebody thinks **a food left out of the
  cupboard is one the plan will avoid** — and then reads a plan as having respected something it
  never knew. The screen must say, once, near the list:

```
Esto no cambia lo que evitamos. Tus alergias, tus intolerancias y tu forma de comer se dicen en tu
perfil, y son esas, y no esta lista, las que dejan un plato fuera de tu plan.
```

```
This changes nothing about what we avoid. Your allergies, your intolerances and how you eat are
set in your profile, and those — not this list — are what keep a dish out of your plan.
```

<!-- Fuente: art. 5.1.a RGPD (lealtad: no dejar que una pantalla se lea como lo que no es) y, en
     cuanto a la seguridad del plan, la misma razón por la que /condiciones explica que la
     comprobación de alérgenos se hace en nuestro código (es-ES.ts, terms, § de alergias). Es una
     referencia **en un solo sentido**: nombra dónde se declaran las restricciones y no invita a
     declararlas aquí, que es lo que prohíbe el punto 6 de la lista anterior. -->

- **The measured sentence only after the plan exists**, read from `pantry` on the plan and never
  recomputed, with `null` meaning it is not said at all — which the plan's own notes already
  require and which § 6, P2-7 makes a legal requirement too.

---

## 6. Findings, in order of severity

The owner approves these before the screen ships. Each says what to change, where, and what the
risk is if he does not — and, where one has been answered, a **Status** line with the date, so the
list stays readable as the record of what was done rather than a list that goes stale.

**The numbers are this document's own series.** `analysis.md` has its own `P1-*`/`P2-*` list and
its P2-9 is the data export; where that one is meant, it is cited as *`analysis.md` § 9, P2-9*.

**Answered so far, 2026-11-03**: **P1-1** (accepted, the route is a `POST`), **P2-4** (the
criterion goes in the policy, no sweep) and **P2-9** (settled strictly: the counts do not cross to
a dietitian), plus the three decisions in § 7. **Open and blocking the screen: P1-2, P1-3,
P2-7**, with P2-5 and P2-6 open and not blocking.

### P1-1 — The picker's search word travels in a URL, into a log we do not own

- **Where**: `PLAN.md` phase 3a, step 1 — `GET /pantry/catalogue?q=<word>`. The route does not
  exist yet (the `backend` worktree is still at `71fa1d4a`), which is why this was sent to
  `backend` before anything else.
- **What to change**: take the word in a **POST body** (`POST /pantry/catalogue` with `{ q }`),
  everything else about the route unchanged. The alternative that satisfies the same duty is no
  `q` at all — serve the catalogue once and filter in the browser.
- **Why**: Vercel records *Search Params* — *"Search parameters of the request path"* — as a field
  of every runtime log entry, beside Request Path and Request User Agent
  (`vercel.com/docs/logs/runtime`, page last updated 2026-08-28, read 2026-11-03; retention 1 hour
  on Hobby, 1 day on Pro). `0100` chose a POST for `/fixed-meals/not-offered` for exactly this
  reason, in those words. And the live policy promises *«Los registros del servidor y de errores
  no guardan lo que escribes»* (`es-ES.ts:2841`).
- **Risk if not**: a published sentence of the privacy policy becomes doubtful at best (arts. 5.1.a
  and 13), and a word that may reveal a health condition sits in a processor's log with no basis of
  its own and no mention in the policy. And the exposure is one entry per request the screen fires
  — however often it turns out to fire, which is phase 3b's choice and not yet made — so it can
  include words somebody typed and then deleted.
- **Severity**: P1 rather than P0 because the recipient is an already-named processor in the EU
  under an existing basis and the retention is an hour — the false-text test bites on a sentence
  about our own logs, not on a disclosure to a stranger. It is P1 and not P2 because the fix is one
  line today.
- **Status: accepted and closed in the plan, 2026-11-03.** `PLAN.md` phase 3a step 1 now reads
  **`POST /pantry/catalogue`** with the word in the body, and the implementer has been told. It
  stays written here because the reason is the reusable part: **no field a person types goes in a
  URL in this product**, and the next route that wants one should find this entry and `0100`
  together. What still has to be true at the surface is in § 8: the word must not reach a log, an
  error or an `ai_calls` row by any other door either.
- **A second reason the `POST` has to hold, found by `tests` on 2026-11-03 while proving the `GET`
  was gone.** Nest's route-miss 404 echoes the query string in its own body:
  `GET /api/v1/pantry/catalogue?q=arroz` answers
  `{"code":"NOT_FOUND","message":"Cannot GET /api/v1/pantry/catalogue?q=arroz",…}`. **It is not a
  finding of its own and I would not give it a severity**: there is no handler, nothing of ours
  reads the word, nothing stores it, and the only recipient of that body is the person who sent it
  — the word dies with the response. What it is, is the cost of ever going back: as a `GET` the
  typed word would reach the platform's log **and** the body of every refusal, so a word somebody
  mistyped or deleted would be echoed twice over. One rule for whoever wires error reporting on the
  web side: **a client-side reporter that sends a failed response's body would carry that echo to
  Sentry**, which `/privacidad` promises receives *«nunca tus datos ni lo que escribiste»*. The
  API's own reporter is safe by design — the route and no query
  (`apps/api/src/shared/observability/ErrorReporter.ts`) — and this is the web's equivalent of that
  line.

### P1-2 — `/privacidad` does not name the cupboard

- **Where**: `apps/web/src/i18n/dictionaries/es-ES.ts` § *Qué datos recogemos y para qué* (`:2738`),
  § *Cuánto tiempo guardamos tus datos* (`:2817`), `privacy.updated` (`:2867`); the same four in
  `en-GB.ts` (`:2643`, `:2722`, `:2772`); and
  [`textos/02-politica-privacidad.md`](./textos/02-politica-privacidad.md).
- **What to change**: the four edits in § 2.2, as written there. `frontend` pastes them;
  `TERMS_VERSION` and every consent version stay where they are.
- **Risk if not**: the product stores a category of personal data its own notice enumerates around
  (arts. 13.1.c, 13.2.a, 5.1.a). It is the finding that needs no technical access to make, and the
  one an AEPD complaint reaches first.

### P1-3 — The screen can turn a cupboard into a declaration about health, and can be misread as a restriction

- **Where**: phase 3b, every string it adds — `apps/web/src/i18n/dictionaries/*`.
- **What to change**: hold the nine prohibitions in § 5.4 and ship the two required sentences,
  including the *«Esto no cambia lo que evitamos»* clarification drafted there.
- **Risk if not**: two different ones. (a) Wording of the first kind makes the entries art. 9 data,
  and then the basis in § 5.3 fails until there is an explicit consent: a new checkbox,
  `PROFILE_CONSENT_VERSION` raised and every account asked again. (b) Wording of the restriction
  kind leaves somebody believing the plan avoids what they did not put in the cupboard — a false
  text about something a person could act on, which is the P0 line on my own scale if it ever
  reaches production.

### P2-4 — A draft nobody spends has no stated end

- **Where**: `pantry_items`; `/privacidad` § *Cuánto tiempo guardamos tus datos*.
- **What to change**: § 2.2 (b)'s sentence, which states the criterion the code actually follows.
- **Risk if not**: art. 5.1.e and art. 13.2.a ask for a period or the criterion to determine it,
  and for this datum there is neither.
- **Status: answered by the owner on 2026-11-03** (§ 7, decision 2) — the criterion in the policy,
  no sweep. The finding therefore closes **with** § 2.2 (b) and not before it: until that paragraph
  is in the dictionaries, this datum still has no stated period.

### P2-5 — Nothing says what a subject-access reply must contain, and there are now two more items

- **Where**: there is no DSAR procedure document in `docs/legal/`; `GET /users/me/export` is
  unbuilt ([`analysis.md` § 9, P2-9](./analysis.md#p2)).
- **What to change**: § 3.3's table is the list for the pantry; the owner (or a later `legal` run)
  should have the same list for the whole account in one place, and whoever builds the export must
  include live `pantry_items` and every plan's `generationMetadata.pantry.asked`.
- **Risk if not**: an incomplete copy (art. 15.3) answered in good faith — the most common
  avoidable breach of this right.

### P2-6 — Phase 5's `/admin` aggregation would be the owner reading words people typed

- **Where**: PRD 022 criterion 12, phase 5; and a tension the lead should see: **with a strict
  picker, `slug: null` cannot arise from the screen at all**, so the *unresolved* half of
  criterion 12 is fed by nothing unless something later sends the no-match word.
- **What to change**: write the constraint now, before phase 5 is dispatched. If anything ever
  stores a word the catalogue could not answer: aggregate over `normalised_label` with a **count
  threshold** (two or more accounts) before it is shown, never show a single account's word
  verbatim, and treat it as the `/admin` console's rule — `0028`'s *"a screen that cannot read
  anyone"* is the standard to hold. Then `/privacidad`'s *«Lo que nos escribes»* bullet gains it.
- **Risk if not**: a free-text field the policy does not mention, read by the controller, in a
  console designed on the premise that it reads nobody.

### P2-7 — The measured sentence is a commercial claim before it is a product figure

- **Where**: phase 3b, step 4.
- **What to change**: the one number read from `generationMetadata.pantry`, after the plan exists,
  with `null` meaning nothing is said; no count before generation; `aprovechar` and never *«a
  partir de»*; and nothing derived from the PRD's superseded *«una fila de cada cuatro»* (the
  measured figure is ≈19 of ≈105 real-food rows at thirty items, `LOG.md` phase 0 § 4 and § 7).
- **Risk if not**: Ley 3/1991 art. 5 (misleading acts) and TRLGDCU art. 20 (misleading omissions
  in a commercial communication) reach a product claim as readily as an advertisement, and the
  figures to contradict it are in this repository, measured, in public.

### P2-9 — The plan's pantry counts reach the dietitian, because the two DTOs are one type

- **Where**: phase 3a, step 3. `PlanDto` (`apps/api/src/modules/meal-plans/dto/out/Plan.dto.ts:4`)
  and `CareClientPlanDto` (`apps/api/src/modules/care/dto/out/Care.dto.ts:45`) are both `PlanView`,
  so a `pantry` field added for `/meal-plans/active` is also served by the care read path
  (`CareClients.controller.ts:109,163`, inside `CareController.withClient`).
- **What to change**: either (a) decide, and write down, that a professional seeing *«9 de 42
  comidas usan solo lo que tenías»* about their client is intended — it is covered by *«tus
  planes»*, and a count reveals nothing the plan itself does not — or (b) keep `pantry` off the
  care path. I recommended (a) with the decision written down; it must be one or the other and not
  a side effect of a type alias, because `0059`'s whole design is that what crosses to a
  professional is enumerated.
- **Risk if not**: a datum crosses to a third party (an independent controller) by accident, and
  `/privacidad` § *Tu dietista en NutrIA* enumerates what they see, so the enumeration drifts from
  the code — the same defect as P1-2, one list over.
- **Status: settled (b), the strict way, 2026-11-03** — the counts **do not cross to a dietitian at
  all**, rather than crossing with a decision behind them. That is the stronger answer and it
  closes the finding outright: there is nothing to enumerate, `/privacidad` § *Tu dietista en
  NutrIA* does not change, and `CARE_CONSENT_VERSION` does not move for a reason that no longer
  needs the *«tus planes»* reading to hold. **What it leaves is a maintenance rule**: `PlanDto` and
  `CareClientPlanDto` are the same type, so a field added to `PlanView` crosses to a professional
  unless something stops it. The next field on that type has the same question, and whoever adds
  one should find this entry.
- **Verified rather than declared** (`tests`, 2026-11-03, over HTTP): the key is **absent, not
  null**, on all three care reads — the overview's plan, the pending plan and the published plan.
  Absent is the right shape: a `null` would have told a professional that a figure exists and was
  withheld, which is a fact about their client they were not given either.

### P3-8 — Two wording points

- `/privacidad` § *Por qué podemos tratar estos datos*: *«tus planes»* → *«tus planes y lo que nos
  digas que tienes en casa»*, if the owner prefers the explicit contract line (§ 2.2).
- The per-entry sentence stays about **us** (*«Todavía no cocinamos nada con esto»*) and the entry
  stays in the list — already right in the plan, recorded here so a later reword cannot lose it.

---

## 7. What this change also touches, and the owner's three decisions

**Touched in this same change** (the convention both files set for themselves):

- [`record-of-processing.md`](./record-of-processing.md) — row 2 gains the cupboard: a new category
  (a catalogue food, an optional amount and unit, plus the person's own word, kept for them alone),
  its erasure deadline, and the art. 32/25 measure that the read happens after every pick. **No
  new purpose, data subject, recipient or transfer.**
- [`dpia.md`](./dpia.md) — § 1.2's table and § 1.3's life cycle, version 0.6, in the kitchen's
  precedent (`0102`, version 0.5): no new art. 9 datum on the position in § 5.3, no new recipient,
  no new criterion from the AEPD's art. 35.4 list, **nothing re-scored**.

**The three decisions, taken by the owner on 2026-11-03** (each is also one dated line in
[`docs/decisions/LOG.md`](../decisions/LOG.md), *who decided: owner*). This section no longer asks
anything; it records.

1. **No mail and no in-app notice for the `/privacidad` edit. It goes out on its date alone.**
   § *Cambios en esta política* promises a mail *«si cambiamos algo importante»*, and **the test he
   applied is the one to reuse**: the change adds a category of data **nobody holds yet** — no
   account can type a cupboard until phase 3b ships — and the beta is friends. The same question
   was answered the same way on 2026-10-20 about the notice the terms promise. **If the feature
   ever reaches strangers, that promise is read again**, and it is read again for any later change
   that touches data people already gave. (Art. 12.1 and art. 13.3 RGPD are satisfied by the policy
   carrying the information and its date before anybody can give the datum; the mail is a promise
   the product made to itself, not a duty of the Regulation, which is the whole reason this is his
   call and not mine.)
2. **The retention criterion goes in the policy; no sweep is built.** § 2.2 (b) is the only place
   the end of an unspent draft is written, so it says the three ends plainly: a generation spends
   it, the person empties it, or the account is deleted and the cascade takes it. **P2-4's
   correction stands**: nothing may say *«en cuanto se genera el plan, la borramos»* flatly,
   because the clear is skipped past the job's deadline and survives a clear that throws (§ 3.1).
3. **The art. 9 position stays conditional and `[lawyer]`-marked, and does not block the screen.**
   The condition holds today by construction and § 5.4 is what keeps it holding. The question stays
   open in § 5.3 for the day there is a lawyer: *does a catalogue food whose own name carries a
   clinical qualifier stay outside art. 9 where the controller makes no inference from it?*
   **The alternative he considered and rejected was dropping clinically-named foods from the
   picker**, and it is worth writing down as the obvious wrong fix: a picker that hides
   `leche-sin-lactosa` lies about what the library cooks, makes the shopping list wrong for the
   person who has that carton, and buys nothing in law — the datum would be no less revealing in
   the entry somebody types instead, and the thing that keeps it outside art. 9 was never the
   vocabulary (§ 5.2). The same reasoning refuses a *«sin lactosa»* facet in § 5.4, from the other
   direction.

---

## 8. Before the screen ships

- [x] **P1-1** answered: the catalogue search is a `POST` and the typed word is not in a URL
      (`PLAN.md` phase 3a step 1, 2026-11-03). Still to verify at the surface: the word reaches no
      log, error or `ai_calls` row by any other door.
- [ ] **P1-2** pasted into `es-ES.ts`, `en-GB.ts` and `textos/02`, with `privacy.updated` moved.
- [ ] **P1-3**: every new string checked against § 5.4's nine prohibitions, and the *«Esto no
      cambia lo que evitamos»* sentence on the screen in both languages.
- [ ] **P2-7**: one number, after the plan, read and not recomputed; no count before; `aprovechar`.
- [ ] No `label` in any log, error, prompt or DTO that leaves the pantry's own module
      (`health-boundary.spec.ts` untouched and green is the check).
- [ ] The picker is not filtered by anything from the safety profile — a catalogue that silently
      hides somebody's declared allergen performs the inference criterion 8 forbids.
- [ ] If the screen keeps a draft in the browser, § *Cookies y almacenamiento en tu dispositivo*
      gains a clause (§ 2.2).
- [x] **P2-9** decided, the strict way (2026-11-03): the plan's pantry counts do not reach a
      dietitian. The check that it stays true is that no `pantry` field is on the care read path.
- [ ] `accessibility` has reviewed the picker: a combobox is the control people most often cannot
      use (Ley 11/2023, [`analysis.md` § 8](./analysis.md#8-accessibility)) — already in phase 3b's
      dispatch, listed here because it is a legal duty and not only a review.
- [ ] `sh scripts/check-leaks.sh` clean.

---

## Sources (the version consulted)

- **RGPD** — Regulation (EU) 2016/679: arts. 4.15, 5.1.a/c/e, 6.1.b, 9.1, 9.2.a, 9.3, 12.1/12.3/12.5,
  13.1.c, 13.2.a, 15.1/15.3, 17, 20.1, 24, 25.1, 28, 30, 32, 35. The OJEU text in the BOE
  (`DOUE-L-2016-80807`), as used throughout [`analysis.md`](./analysis.md).
- **LOPDGDD** — LO 3/2018, art. 9 (BOE-A-2018-16673, consolidated to 27/12/2025).
- **TRLGDCU** — RDLeg. 1/2007, art. 20 (BOE-A-2007-20555, consolidated to 28/02/2026); **Ley
  3/1991** on unfair competition, art. 5 (BOE-A-1991-628, consolidated to 27/12/2025).
- **Ley 11/2023** on the accessibility of products and services (BOE-A-2023-11022).
- **CJEU** — C-184/20 *OT* (1/8/2022) and C-21/23 *Lindenapotheke* (4/10/2024), through this
  repository's verified citations of 2026-09-25 and 2026-09-26 (see the caveat in § 5.1: neither
  text could be re-fetched on 2026-11-03, so no paragraph of C-21/23 is quoted).
- **EDPB/WP29** — Guidelines on the right to data portability, WP242 rev.01, for the
  provided/derived line in § 3.3: **not fetched in this session**, and § 3.3 says so where it
  relies on it.
- **Vercel** — *Runtime Logs* (`vercel.com/docs/logs/runtime`), page last updated 2026-08-28, read
  2026-11-03: the *Log details* table (Search Params, Request Path, Request User Agent) and the
  retention table (Hobby 1 hour, Pro 1 day).
- **The product, read on 2026-11-03** at `71fa1d4a`: `pantry.schema.ts`, `_utils.ts:23-48`,
  `entities/Pantry/Pantry.ts`, `controllers/Pantry/PantryController.ts`,
  `apps/api/src/modules/profiles/controllers/Pantry.controller.ts`,
  `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts:626-706,1044-1077`,
  `apps/api/src/modules/ai/health-boundary.spec.ts:120-334`,
  `apps/api/src/modules/ai/prompts/PoolPrompt.ts:379`, and the live dictionaries
  `apps/web/src/i18n/dictionaries/es-ES.ts:2724-2867` and `en-GB.ts:2630-2772`.
- **In this repository**: [`analysis.md`](./analysis.md) §§ 1.2, 3, 4.1, 5, 8, 9 (P2-9, P2-16),
  [`textos/02`](./textos/02-politica-privacidad.md),
  [`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) (D5),
  `docs/decisions/0100`, `0102`, `0091`, `0075`, `0092`, `0028`, and project 022's `PRD.md`,
  `PLAN.md` and `LOG.md` (phases 0, 1, 2, 3a).
