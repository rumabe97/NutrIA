# The cupboard (project 022): the picker, retention, the export and why a pantry entry is not a health datum

> **This is not legal advice.** It was written by an agent, not by a lawyer. Every claim cites
> the article and the version it rests on so that the owner — or the lawyer he shows it to —
> can check it. Where the answer turns on an interpretation, the text says so and marks it
> **[lawyer]**.
>
> **Purpose**: to answer, before the screen of phase 3b is built, the four questions PRD 022
> criterion 9 defers to `legal`: the picker against `/privacidad`, retention and the DSAR
> export of a spent draft, criterion 7's boundary, and criterion 8.
> Since **2026-11-04** it also answers what the two later phases brought: phase 5's `/admin`
> aggregate reads — what `/privacidad` has to say about them, when, and whether a count of one
> account may be shown (§ 0 points 11-12, § 6 **P2-6** and **P2-10**) — and **phase 4**, where the
> cupboard orders the library pick and therefore the prompt's list of dishes not to repeat: whether
> that communicates a cupboard to the model's processors, and what has to be published **before the
> owner turns the flag on** (§ 9, § 6 **P1-11**, **P2-12** and **P3-13**).
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
   model's input changes** — because **no cupboard datum reaches any model at all**, which is still
   true of the product in `main` and of phase 4 as it stands **unmerged** in the working tree
   (project 022, read 2026-11-04 — `main` is at `4a537739`, which is phase 3b, and neither
   `Rotation.ts` nor `PlanGeneration.service.ts` has the flag committed; **true once merged**): the
   cupboard is read at
   `PlanGeneration.service.ts:685`, *after* the shopping list is built at `:667`, and
   `health-boundary.spec.ts:295-334`'s allowed-keys list has no pantry key.
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
8. **Criterion 8 is enforced by the shape of the code** — with `pantryRank` off, which is how
   phase 4 shipped; § 9 is the whole of what changes when it is on — the cupboard is read after every pick,
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

**Added 2026-11-04, for phase 5** (the two `/admin` aggregate reads, which are not one of the four
questions above and so get their own lines rather than a renumbering):

11. **The owner reading counts off the cupboard is a *further purpose*, so the article is art.
    13.3 and it is about timing**: the policy sentence must be live **no later than** the day the
    two routes can be called in production, not with them and not after. **One new sentence** on the
    bullet phase 3b shipped — drafted in both languages in § 6, **P2-6**, where I also say why it
    does **not** go in *«Lo que nos escribes»* as that finding first said. **No new basis**
    (art. 6.4's factors are met and recital 50 says a compatible further purpose needs none), **no
    consent version**, no `TERMS_VERSION`, no `textos/05`, no `⟦marca⟧`. The record of processing
    and the DPIA each gain one line, and nothing is re-scored.
12. **One new finding, P2-10**: `uncooked` has no threshold, and I checked what a count of `1`
    would say rather than reasoning about it in the abstract — six of its rows are foods whose own
    name carries a clinical or belief qualifier (`leche-sin-lactosa`, `galletas-sin-gluten`,
    `cerveza-sin-alcohol`…), and in a friends-beta cohort the owner knows personally the line
    *«leche sin lactosa — 1 cuenta»* is a path to one person. **I do not agree that `uncooked` needs no floor**, on arts. 25.1 and 5.1.c rather
    than on art. 9 (decision (c) of § 7 stays shut): the fix is a floor in the `SELECT` and in the
    `ORDER BY` — never a `HAVING`, which would gut the list — and it costs the owner only the
    ability to tell a food one person holds from one nobody holds. **P2, accepted and built the same
    day**, so the text that ships is P2-6's **(e1)**.

**Added 2026-11-04, later, for phase 4** — **unmerged** at the time of writing (in the working
tree, with `main` at `4a537739`; **true once merged**) and shipping with its flag **off**. With it
off everything above still holds:

13. **With `pantryRank` on, what is in somebody's house reaches the model's processors as an
    *effect* and never as a datum, and that is not a communication of the cupboard** (art. 4.2):
    no slug and no word enters the prompt, but the dishes already chosen do, as the *do not repeat*
    list, and the pick is ordered by the cupboard. The product already runs **art. 9 data** through
    this exact channel under the policy's own published frame — *«le llega el efecto, nunca el
    dato»* (`0077`) — and the ordering cannot be inverted by a recipient who has neither the
    library nor the algorithm nor the history. **[lawyer]**, and being wrong costs a notice and not
    the feature (§ 9.2).
14. **Art. 13.3 does not come in — and the policy still has to change before the flag moves, for a
    worse reason.** No new purpose, recipient, category or transfer; but **two published sentences
    stop being true the instant it is on** (*«No cambia los platos que elegimos ni quita ninguno»*,
    in `/privacidad` and on the screen), and `pantryRank` is a database row the owner toggles from
    `/admin/ajustes` with no deploy in between. So the texts must be **true in both states and
    published before the click**, not swapped at it: § 9.5 drafts them (**P1-11**). The record of
    processing and the DPIA each state a measure the phase removes and are corrected here
    (**P2-12**); the art. 9 position survives but on one leg instead of two (§ 9.4).

---

## 1. What the product does (read in the code, not taken from the plan)

| What | Where | What it means here |
| --- | --- | --- |
| The table | `packages/database/src/schemas/pantry.schema.ts` | `userOwned`: `user_id` → `user.id` **cascade** (`packages/database/src/schemas/_utils.ts:41-43`). Columns: `grams` (nullable), `ingredientId` (nullable, cascade), `label`, `normalisedLabel`, `unit`. **No row is an empty cupboard**, so an account that said nothing stores nothing |
| What a row holds | `packages/core/src/entities/Pantry/Pantry.ts` | `label` ≤ 80 characters, `grams` ≥ 0.01, `unit` only with an amount, at most **60** rows (`MAX_PANTRY_ITEMS`), the same on both tiers |
| The routes | `apps/api/src/modules/profiles/controllers/Pantry.controller.ts:37,44,51,60` | `POST /pantry`, `DELETE /pantry`, `GET /pantry`, `DELETE /pantry/:id`. All session-scoped; one account's cupboard reaches no other's (an e2e case proves it) |
| When it is read | `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts:685` (with `pantryRank` **off**); `:209`, above the library pick, with it **on** | With the flag off: **after** `buildShoppingList` at `:667`, which is after scheduling, validation and the safety gate, so nothing it returns can reach the pool, the rotation, the scheduler or the prompt from there. With it on: the read moves and the rotation is ordered by it, while the prompt still receives no cupboard datum (§ 9.1) |
| What the plan records | `:665`, `:1062-1077` | `asked: [{ grams, slug }]`, `coveredRows`, `meals`, `rows`, `unresolved` (**a count, never the words**), `wholeMeals`; `null` when nobody said anything |
| When it is deleted | `:678`, `:701-706` | `PantryController.clear`, after the plan is saved, idempotent, and a failure to clear can never fail the generation. **Skipped when the job's deadline has passed** (that job is reported failed, so a retry finds the cupboard) and the draft also survives a clear that throws — in both the next generation spends it (§ 3.1) |
| What leaves the product | nothing | `PoolPrompt.ts:379`'s `pantry` is the *food category* of an ingredient (`grains, pasta, tins, oils…`), not the cupboard; `health-boundary.spec.ts:147`'s `category: 'pantry'` is the same thing in a fixture. The allowed-keys list at `:295-334` has **no** pantry key |
| What the screen will be | `PLAN.md` phase 3b | A picker over `GET /pantry/catalogue?q=<word>` (phase 3a, **being built now**), a sentence before committing, a per-entry *«Todavía no cocinamos nada con esto»*, and one measured sentence after the plan exists |

Two facts carry most of the analysis below, and both are properties of the code rather than
promises about it:

- **The cupboard is read after everything that chooses a dish has chosen** — **with the
  `pantryRank` flag off, which is how phase 4 shipped and the only state §§ 1-5 describe**
  (project 022 phase 4, **unmerged** on 2026-11-04 — true once merged; what changes with the flag
  on is § 9). That is why
  criterion 8 needs no test: there is no path from the read to a pick. It is also an art. 25.1
  measure (*data protection by design*) worth naming in the record, because it is what makes the
  art. 6.1.b basis in § 5.3 honest. **With the flag on this leg is gone** and the art. 9 position
  rests on the narrower ground in § 9.4; nothing else in this document moves.
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
- **No cupboard datum travels at all**, and this survives phase 4. The phase the owner struck on
  2026-10-23 — slugs in front of the model — is **not** the phase that was built on 2026-11-04:
  what shipped keeps every cupboard datum out of the prompt and instead moves the *read* above the
  pick, so `pool.build` is never handed the rotation and `promptPreferences` gains no key (§ 9.1).
  The paragraph enumerates *what the model receives*; the set does not change with the flag off or
  on, so **the paragraph does not change** and `PROFILE_CONSENT_VERSION` stays where it is
  (§ 2.3). What the flag does change is a sentence in a different bullet: § 9.3.

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

**Four edits, in both dictionaries and in [`textos/02`](./textos/02-politica-privacidad.md)** —
**all four shipped on 2026-11-04** with phase 3b. **A fifth, edit (e), came with phase 5 the same
day**: one more sentence on bullet (a), for the two aggregate reads the owner now has. It is
drafted in § 6, **P2-6**, where the finding that asked for it was opened, together with the article
that decides its timing (art. 13.3: before the further processing, not with it).

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
     se lee en PlanGeneration.service.ts:685, después de buildShoppingList (:667) — **con la
     bandera `pantryRank` apagada**; encendida esa frase deja de ser cierta y el texto es el de
     § 9.5 (f). La frase «no
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

1. **Phase 4 reopening — and the premise of this item failed on 2026-11-04, so read it as the
   answer for the next time rather than as a description of what happened.** The phase that was
   built puts **no** cupboard slug in `PoolPrompt`; it moves the read above the pick and lets the
   already-chosen dishes travel in `excludeSlugs`, which is § 9's whole subject. The entry stays
   because the day somebody does put a slug in the prompt, this is still the right answer.
   Cupboard slugs would enter `PoolPrompt`. They are catalogue keys, so
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
| **Art. 9** | **Not engaged**, on the condition that the product neither infers nor presents a restriction from an entry, and never joins the cupboard to the health tables or to `dietary_patterns`. With `pantryRank` **off** that condition holds **by construction** (`PlanGeneration.service.ts:685`, after every pick). **With it on the construction is gone and the condition is what is left** — no restriction inferred or presented, the rank reading ingredient slugs and nothing about meaning, an order and never a filter (§ 9.4). The position stands either way; it is more dependent on § 5.4 than it was |
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
7. **Any promise that the plan will avoid or exclude by the cupboard**: *«evitaremos lo que no
   tengas»*. False in **both** states of `pantryRank` — the rank is an order and never a filter, so
   no dish is ever excluded by a cupboard — and a false text is the worst thing on my severity
   scale. **Amended 2026-11-04 (§ 9.4), because the third verb has split off**: *prefer* was on this
   list on the ground that *«a cupboard changes no pick»*, and with the flag **on** that ground is
   gone. So *prefer* may be said — only with the flag on, only as a share, and only under the plan's
   own promise — while ***«solo con lo que tienes»* and *«adaptado a tu despensa»* stay forbidden
   whatever the flag says**, because at most five of the nineteen dishes offered per meal are
   ranked, the rank is repaired against the table's caps, and a missed macro band walks it to zero:
   neither phrase is true of a share that can end at nothing. The wording that is true with the
   flag on is drafted in § 9.5 (g2).
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
a dietitian), plus the three decisions in § 7.

**2026-11-04**: **P1-2** shipped — § 2.2's four edits are in both dictionaries and `privacy.updated`
reads *«4 de noviembre de 2026»*. **P2-6 fired and is answered**: phase 5 built the threshold on the
words, and the policy sentence it had left undrafted is in that finding, as **edit (e) of § 2.2**,
moved out of *«Lo que nos escribes»* for the reason written there. It brought one new finding with
it: **P2-10**, the count of `1` on `uncooked`. **P1-3** and **P2-7** are satisfied in the strings
3b shipped — the *«Esto no cambia lo que evitamos»* sentence is at `es-ES.ts:2430` and the measured
sentence says *«los aprovechamos»* with the 90–120 band and no count before generation
(`:2422`) — so what is left of them is the whole-screen check in § 8 and not a text.
**P2-10 was accepted and built the same day**, so the text that ships is **(e1)**, and
**what blocks phase 5 is P2-6's sentence alone**: art. 13.3 makes it a deadline and not only a duty,
so it must be live no later than the deploy that lets those routes be called. **P2-5** stays open
and blocks nothing: there is still no export route.

**2026-11-04, later: phase 4, in the working tree and unmerged, shipping with its flag off** — true
once merged — and it brought three findings of its own
(§ 9). **P1-11 is the only gate, and it is not a deploy gate**: two published sentences stop being
true the instant `pantryRank` is toggled from `/admin/ajustes`, so § 9.5's replacements must be live
**before** the owner clicks. **P2-12** — the record of processing and the DPIA state a measure the
phase removes — is **done in this change**. **P3-13** is pre-existing and rides along with the next
policy edit.

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

**Status: fired on 2026-11-04, and answered here.** Phase 5 is being built: two admin-only reads
exist (`packages/core/src/repositories/Admin/AdminCupboardRepository.ts`, read at
`4a537739` + the working tree, 2026-11-04) and a console page is being written against them. The
threshold half of this finding **was built**: `unresolved()` groups by `normalised_label` and keeps
only `count(distinct user_id) >= UNRESOLVED_WORD_THRESHOLD` (2) in its own `HAVING` (`:96`, the
constant at `:19`), selecting no `user_id`, no row id and no `label` as typed. What was left
undrafted is the policy sentence, and it is below.

**I am moving it out of the *«Lo que nos escribes»* bullet, and the lead should know why.** That
placement was written when the only imaginable shape of criterion 12 was the owner reading free
text, and before the cupboard had a bullet of its own. Both facts changed: (i) the cupboard now has
*«Lo que ya tienes en casa»*, which carries its purpose, its retention and the non-inference
sentence, so a reader looking for what happens to a cupboard reads one bullet and not two; and
(ii) **the larger of the two reads is not writing at all** — `uncooked()` counts accounts per
*catalogue slug*, and putting that under *«what you write to us»* would describe it wrongly.
*«Lo que nos escribes»* stays exactly as it is: it is the suggestions inbox, and the cupboard is
not the inbox. **The new sentence is the fifth edit to § 2.2, appended to that bullet.**

**The article is art. 13.3, not only art. 13.1.c, and that decides the timing.** The cupboard is
collected for one purpose (the shopping list). The owner reading counts to steer the library is a
**further purpose**, and art. 13.3 RGPD requires the information *«con anterioridad a dicho
tratamiento ulterior»* — before, not with. So the sentence must be live **no later than** the day
the two routes can be called in production. If backend's routes reach a deploy ahead of the
dictionaries, that is the duty missed; phase 5's page and this sentence in one change, as 3b's
were, satisfies it.

**No separate legal basis, and `«Por qué podemos tratar estos datos»` does not move.** The further
purpose is compatible on art. 6.4's factors: (a) the link is direct — the same foods, for the
library that cooks them; (b) the context is the person's own cupboard in the product that keeps it;
(c) the nature — on § 5.3's conditional position, not an art. 9 category (**and (c) is exactly why
P2-10 below matters**); (d) no consequence for anybody, no decision about a person, nothing shown
back to them; (e) the safeguards are the aggregation itself and the floor. Art. 5.1.b adds that
further processing *«con fines estadísticos no se considerará incompatible con los fines
iniciales»* subject to art. 89.1, and **recital 50 settles the basis question in terms**: where the
further purpose is compatible, *«no se requiere una base jurídica aparte, distinta de la que
permitió la obtención de los datos personales»* (OJEU text in the BOE, `DOUE-L-2016-80807`, read
2026-11-04). The basis therefore stays the art. 6.1.b line the cupboard already sits on, and the
legitimate-interest paragraph is left alone — which has the side benefit of keeping its *«sin datos
de salud»* clause out of this question entirely.

**One line for the lawyer's hour, and it is this one. [lawyer]** Recital 50's sentence is text and
not my reading of it, but *whether data collected under art. 6.1.b can carry a statistical further
purpose on that basis alone, with no art. 6.1.f line of its own*, is a point on which a lawyer may
want the legitimate-interest paragraph to name it anyway. **If he does, the change is four words and
nothing else moves**: *«registrar el uso del producto y los errores técnicos para que funcione»* →
*«… para que funcione y para saber qué le falta a nuestra biblioteca de recetas»*
(`es-ES.ts:2864`, `en-GB.ts:2742`). I do not publish it, because naming a basis the processing does
not rest on is its own inaccuracy — but it is the cheapest finding in this document to reverse.

**The text — edit (e) of § 2.2, appended to the *«Lo que ya tienes en casa»* bullet** (`es-ES.ts`
in the list at § *Qué datos recogemos y para qué*; `en-GB.ts` the same bullet; and
[`textos/02`](./textos/02-politica-privacidad.md), where it is in place). **Two versions were drafted while P2-10 was open; it
was accepted and built the same day, so (e1) is the one that ships.** (e2) is kept only as what the
text would have to become if that floor were ever removed. They differ by one clause; do not paste a
blend of the two.

**(e1) — with the floor on both reads (recommended):**

```
Para saber qué alimentos les faltan a nuestras recetas miramos también esa lista, pero solo como un
recuento: cuántas cuentas tienen cada alimento, nunca la lista de nadie en particular, y solo a
partir de dos cuentas. Si alguna vez nos llega una palabra que nuestra lista no reconoce, entra en
ese recuento en minúsculas y sin acentos.
```

```
To know which foods our recipes are missing we also look at that list, but only as a count: how many
accounts have each food, never anybody's own list, and only from two accounts up. If a word our list
cannot answer ever reaches us, it goes into that count in lower case and without accents.
```

**(e2) — as the code stands today, the floor on words only:**

```
Para saber qué alimentos les faltan a nuestras recetas miramos también esa lista, pero solo como un
recuento: cuántas cuentas tienen cada alimento, nunca la lista de nadie en particular. Si alguna vez
nos llega una palabra que nuestra lista no reconoce, entra en ese recuento en minúsculas y sin
acentos, y solo si la tienen dos cuentas o más.
```

```
To know which foods our recipes are missing we also look at that list, but only as a count: how many
accounts have each food, never anybody's own list. If a word our list cannot answer ever reaches us,
it goes into that count in lower case and without accents, and only where two accounts or more have
it.
```

**The *«también»* / *«also»* is load-bearing and not a filler.** Without it a fast reader hears
*«de esa lista solo miramos un recuento»* against the sentence two lines above, which says the list
is kept so the shopping list comes back ticked — and takes the bullet to contradict itself. The word
marks this as the *second* use of the same datum, which is exactly what art. 13.3 is about.

<!-- Fuente: art. 13.3 RGPD (información sobre otro fin, con anterioridad al tratamiento ulterior);
     art. 5.1.b (limitación de la finalidad, y los fines estadísticos no incompatibles con el art.
     89.1); art. 6.4 a-e (los factores de compatibilidad) y considerando 50 («no se requiere una
     base jurídica aparte»), por los que la sección «Por qué podemos tratar estos datos» no cambia;
     art. 5.1.a (lealtad). Y art. 25.1 con el art. 5.1.c, que es donde vive el umbral.
     El código: AdminCupboardRepository.unresolved() agrupa por normalised_label y solo devuelve un
     grupo con dos cuentas o más (HAVING, :96; UNRESOLVED_WORD_THRESHOLD = 2, :19); uncooked()
     cuenta cuentas por ingrediente del catálogo que ninguna receta usa (:57-67). Ninguna de las dos
     selecciona user_id: por eso «nunca la lista de nadie en particular» describe la consulta y no
     una incapacidad del responsable, que sí puede consultar su propia base de datos — la frase que
     no se puede publicar es «nunca vemos de quién es», y no se publica.
     «En minúsculas y sin acentos» es normaliseForMatching (core/domain/Safety), lo que
     pantry.schema.ts guarda en normalisedLabel: se dice porque la palabra que se mira no es
     exactamente la que se escribió, y callarlo sería prometer más de lo que el producto hace.
     La condicional «si alguna vez nos llega una palabra que nuestra lista no reconoce» es
     deliberada: el selector de la fase 3b solo ofrece alimentos del catálogo (PRD 022, § Scope), así
     que de la pantalla no sale ningún slug nulo; el grupo existe para una entrada que llegue a la
     ruta por otra puerta. La frase no debe insinuar que la pantalla invita a escribir una palabra
     libre (§ 5.4).
     «Cuántas cuentas tienen cada alimento» va a propósito un peldaño por encima de la consulta, que
     hoy solo cuenta los ingredientes que ninguna receta usa: describe de más y nunca de menos, que
     es el lado seguro del art. 5.1.a, y no caduca si mañana el recuento abarca todo el catálogo.
     Precedente de redacción y de colocación: la viñeta de la fase 3b, § 2.2 (a). -->

**What else moves, each checked and not assumed:**

| Thing | Moves? |
| --- | --- |
| `privacy.updated` | **Yes, and it has moved: 2026-11-05.** It read *«4 de noviembre de 2026»* / *«4 November 2026»*, moved for 3b, which shipped that day. Phases 4 and 5 did not make it into that deploy, so the rule applied — the day the text goes live, not the day it was written — and it now reads *«5 de noviembre de 2026»* / *«5 November 2026»* (`es-ES.ts:2996`, `en-GB.ts:2847`). **If this commit does not reach production on 2026-11-05 either, it moves again**: the date on the page is a promise about the page, and the only thing that makes it true is the deploy |
| `PROFILE_CONSENT_VERSION` | **No.** Its `profileConsent.ai` text enumerates what the model receives; nothing of a cupboard reaches a model, and an `/admin` read is not a model (§ 2.1, § 2.3) |
| `HEALTH_CONSENT_VERSION` | **No.** No health table is touched and nothing is joined to one |
| `CARE_CONSENT_VERSION` | **No.** Nothing of this crosses to a professional: the two reads are behind `@Roles('admin')` and return no account |
| `TERMS_VERSION` | **No.** § 2.4's reasoning is untouched — no promise, allowance or tier changes |
| [`textos/05`](./textos/05-consentimientos-cliente.md) | **No.** It is the client's consent to a dietitian seeing their data; there is no dietitian in this flow |
| [`record-of-processing.md`](./record-of-processing.md) | **Yes** — and this is the one place where "nothing moves" would have been wrong. Art. 30.1.b asks for *the purposes of the processing*, and there is now a second one for the cupboard. Row 2's *Purposes* cell names the two reads and the floor. Done in this change |
| [`dpia.md`](./dpia.md) | **Yes, one line and no re-score.** § 1.3's *Use* step enumerated who reads what, and the owner reading an aggregate was not in it; the version row records the amendment. No new recipient, no new art. 9 datum, no new criterion from the AEPD's art. 35.4 list. Done in this change |
| [`textos/02`](./textos/02-politica-privacidad.md) | **Yes**: the bullet in both languages, and a dated line in the header block saying why it carries no `⟦⟧` mark. Done in this change. Its own date is the `{fecha de publicación}` placeholder (`:174`, `:382`), so no date to move there |
| A `⟦marca⟧` in `textos/02` | **No**, on 3b's precedent: the page and the sentence ship in the same change, so there is no day when the text runs ahead of the product. The asymmetry with 3b is worth one line, because it points the other way: with 3b, no account could *write* a cupboard before the screen existed, so the text could only ever have been early; here the routes could be deployed before the page, and then the text would be **late**, which is the art. 13.3 breach. That is why the requirement above is "no later than", and why the mark would be the wrong tool — a mark delays text, and this text may not be delayed |
| A notice mail | **No**, on the owner's standing decision of 2026-11-03 (§ 7, decision 1), re-applied and not re-opened: the datum this describes is one nobody holds yet, and the beta is friends |

### P2-10 — `uncooked` shows `accounts: 1`, and nine of those rows are foods with a clinical qualifier in their name

- **Where**: `packages/core/src/repositories/Admin/AdminCupboardRepository.ts`, `uncooked()`
  (`:57-67`) — `countDistinct(pantryItems.userId)` with **no threshold**, ordered by that count
  descending; surfaced by `GET /admin/catalogue/cupboard/uncooked`
  (`apps/api/src/modules/admin/controllers/AdminCatalogue.controller.ts:220-227`, whose own
  description says *"No threshold"*).
- **The lead's reasoning, and where I part from it.** He is right about 504 of the 513 rows: the
  row itself is catalogue reference data that `/admin/catalogo/ingredientes` already lists whole,
  the only thing added is an aggregate, and a `1` beside *«harina integral»* says nothing about
  anybody. **The nine where it does not hold I checked rather than argued**: against the dev
  database (`127.0.0.1:54329/nutria_local`, 1,638 recipes, `default_transaction_read_only=on`,
  2026-11-04), the uncooked set contains `leche-sin-lactosa`, `galletas-sin-gluten`,
  `pan-rallado-sin-gluten`, `pesto-vegano`, `cerveza-sin-alcohol`, `vino-sin-alcohol`,
  `harina-integral`, `pan-de-hamburguesa-integral` and `cereales-integrales`. The first six are
  foods whose **own name carries a clinical or belief qualifier**, and they are in the uncooked set
  for a structural reason that will not go away: a recipe library is written against *«leche»* and
  *«pasta»*, so the free-from variant is precisely the kind of catalogue row no recipe uses.
- **So the row to test the design on is `leche sin lactosa — 1 cuenta`, beside `arroz — 12`.** On a
  cohort of friends the owner knows personally — the beta's own size is on the `/admin` screen and I
  have not read it — that line is a path to singling somebody out, and it is the one inference § 5.3 says this product never makes. I am **not** calling it art. 9
  data — decision (c) of § 7 stays as it is, conditional and `[lawyer]`-marked, and I am not
  re-opening it. The point is narrower and does not need that label: **art. 6.4(c) makes the nature
  of the data a factor in whether the further processing is compatible at all**, and art. 25.1 with
  art. 5.1.c asks for the least data the purpose needs. A count of 1 is not data the purpose needs
  — **you do not write a recipe for one person's jar** — so it is the cheapest thing in this
  feature to give up.
- **What to change** (smallest version, and the SQL matters): **not** a `HAVING`. A
  `HAVING count(distinct user_id) >= 2` on `uncooked()` would drop the 0-rows and the 1-rows and
  gut a list whose whole point is the 513 ingredients nobody cooks. The floor goes **in the
  `SELECT`**: `case when count(distinct user_id) >= UNRESOLVED_WORD_THRESHOLD then
  count(distinct user_id) else 0 end as accounts`, reusing the constant that already exists
  (`:19`) so the number is written once. **And it has to go in the `ORDER BY` too**: `desc(accounts)`
  on the raw count sorts the 1-rows above the 0-rows, which hands the distinction straight back —
  order by the floored expression. The page then says what it already means to say: *«cuentas que
  lo tienen, a partir de dos»*, and `0` reads *«menos de dos»*.
- **What this costs, said plainly**: the owner stops being able to tell a food one person holds
  from a food nobody holds. That is the whole loss, and it falls on the half of the signal that
  cannot justify a recipe anyway.
- **Severity: P2.** No text is false, no new recipient, nothing leaves the owner's own console, and
  what does the identifying work is his out-of-band knowledge of who the beta's accounts are, rather
  than anything the screen prints. It is P2 and not P3 because it is `0028`'s standard — *"a screen that
  cannot read anyone"* — meeting the one row where the console stops meeting it, and because the
  fix is two expressions on the day the code is being written.
- **If the owner declines it**, nothing breaks and the position is defensible — he is the
  controller, the access is lawful, and the console adds no recipient. Two things then follow and
  the second is the one I would not leave implicit: the policy text is **(e2)** and not (e1); and
  this entry stays open as the thing to revisit the day the beta stops being friends, because what
  makes it tolerable today is the cohort and not the design.
- **Status: accepted and built the same day, 2026-11-04**, by `backend-5` at the lead's direction
  (the owner approves this finding as he does the rest). `AdminCupboardRepository.uncooked()` now
  floors the count — `case when count(distinct user_id) >= UNRESOLVED_WORD_THRESHOLD then … else 0
  end`, **the same expression in the `SELECT` and in the `ORDER BY`**, so neither a figure nor a
  row's position says that one account holds `leche-sin-lactosa`, and the 513 rows all stay.
  **So the policy text is (e1)**, and `0` must read *«menos de dos»* and never *«ninguna»* wherever
  it is shown — the one way this change could introduce an untruth, and the reason it is a line of
  § 8.

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

### P1-11 — Two published sentences stop being true the instant the owner clicks a toggle

- **Where**: `/privacidad`'s cupboard bullet (`apps/web/src/i18n/dictionaries/es-ES.ts:2840`,
  `en-GB.ts:2718`, [`textos/02`](./textos/02-politica-privacidad.md)'s *«Lo que ya tienes en casa»* bullet, both languages) and the pantry
  screen's `pantry.intro` (`es-ES.ts:2427` and its `en-GB` twin), both of which say **«No cambia
  los platos que elegimos ni quita ninguno»**. With `pantryRank` on, the first half is false: that
  is what the phase is for (§ 9.1).
- **What to change**: § 9.5's **(f)** for the policy and **(g1)** or **(g2)** for the screen, both
  drafted to be true whichever way the flag sits, plus the stale comment at `es-ES.ts:2422`.
- **Why it is a gate and not a backlog item**: `pantryRank` is a row in `app_settings` read per
  generation and flipped from `/admin/ajustes` (`AdminSettings.controller.ts:28`). **There is no
  deploy between the click and the next plan**, so the usual *"ship the text in the same change"*
  is not available: what makes those two sentences true today is that nobody has pressed the
  button. The texts have to be live **before** it is pressed.
- **Risk if not**: a published privacy policy that contradicts what the product does (arts. 5.1.a
  and 13.1.c) and, on the screen, a product claim that is false in the direction that matters least
  — it understates — but false about the one thing a person might rely on when deciding what to
  type into a list (TRLGDCU art. 20, Ley 3/1991 art. 5).
- **Severity: P1 as the flag sits, and P0 the moment it moves.** A false text is the top of my
  scale and I am not softening it; what keeps this at P1 today is only that the sentence is
  currently true. It is the first thing on the list because it is also the cheapest: two strings.

### P2-12 — The record of processing and the DPIA state a measure phase 4 removes

- **Where**: [`record-of-processing.md`](./record-of-processing.md), the 2026-11-03 review line
  (*«the cupboard is read after the shopping list is built and after every pick … so nothing in it
  can reach the pool, the rotation, the scheduler, the safety profile or the prompt»*) and
  [`dpia.md`](./dpia.md) § 1.2's art. 9 cell for the cupboard (*«The read happens after every pick,
  so there is no path from it to a dish»*). Both sentences are mine; with the flag on both are
  wrong.
- **What to change**: both to two-state text, which is what art. 30.1.g is for — a record that
  describes a safeguard the processing no longer has is worse than one that describes none.
- **Risk if not**: the record and the DPIA are the two documents produced to a supervisory
  authority (arts. 30.4 and 36), and an inaccuracy there is found by the regulator rather than
  reported to it.
- **Status: done in this change, 2026-11-04**, together with § 1.3's *Use* step and the DPIA's
  version row. **Nothing re-scored** — no new recipient, transfer, category, period or criterion
  from the AEPD's art. 35.4 list.

### P3-13 — The model receives a list of dishes the policy's enumeration does not name

- **Where**: `/privacidad` § *La inteligencia artificial*, *«Lo que recibe el modelo»*
  (`es-ES.ts:2889`), which enumerates — and the enumeration is the style of this whole policy
  (P1-2's argument) — ending at *«los nombres de los platos que te gustaron, que no te gustaron o
  que comiste la quincena anterior»*. The prompt also carries **the dishes already chosen for this
  plan**, as `excludeSlugs` → *DO NOT REPEAT THESE ALREADY-PROPOSED DISHES* (`PoolPrompt.ts:1024`).
  That is a fourth thing and it is not one of the three named.
- **This is pre-existing and has nothing to do with phase 4** — `excludeSlugs` is in production
  today with the flag off — and I am keeping it separate so it is not read as a cost of that phase.
  What phase 4 adds is only that this is the channel its effect travels on (§ 9.2).
- **What to change**: name it, in the same breath as the three — *«… que comiste la quincena
  anterior, y los platos que ya hemos elegido para este plan, para que no los repita»* / *«… and
  the dishes we have already chosen for this plan, so it does not repeat them»*.
- **Risk if not**: small and of one kind only — a closed enumeration that omits an item invites
  the reader to conclude the item does not exist (arts. 5.1.a, 13.1.c). The dish names are the
  shared library's own and say nothing about the person beyond *«these were offered to you»*.
- **Severity: P3**, and it ships with whatever edits the policy next receives rather than on its
  own.

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
  new purpose, data subject, recipient or transfer.** **Amended on 2026-11-04 for phase 5**: there
  *is* now a second purpose for the same datum — the two aggregate reads — and art. 30.1.b asks for
  the purposes, so row 2's *Purposes* cell names them and the floor that keeps them aggregate.
- [`dpia.md`](./dpia.md) — § 1.2's table and § 1.3's life cycle, version 0.6, in the kitchen's
  precedent (`0102`, version 0.5): no new art. 9 datum on the position in § 5.3, no new recipient,
  no new criterion from the AEPD's art. 35.4 list, **nothing re-scored**. **Amended on 2026-11-04
  for phase 5**: § 1.3's *Use* step named who reads the cupboard and the owner was not among them;
  one line there and one in the version row, and still nothing re-scored.

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
- [x] **P1-2** pasted into `es-ES.ts`, `en-GB.ts` and `textos/02`, with `privacy.updated` moved
      (2026-11-04: the bullet at `es-ES.ts:2840` / `en-GB.ts:2718`, the retention paragraph at
      `es-ES.ts:2924`, the deletion enumeration, and the date at `es-ES.ts:2939` /
      `en-GB.ts:2811`).
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

**Before phase 5's console page ships** (added 2026-11-04):

- [ ] **P2-6's edit (e)** in `es-ES.ts`, `en-GB.ts` and `textos/02`, **in the same deploy as the two
      routes or an earlier one** — art. 13.3 asks for the information *before* the further
      processing, so a deploy that carries `GET /admin/catalogue/cupboard/*` without the sentence is
      the duty missed, and the order matters in a way it did not for 3b.
- [x] **P2-10** accepted and built (2026-11-04): the floor is in `uncooked()`'s `SELECT` and
      `ORDER BY`. **So the draft that ships is (e1)**, and a blend of (e1) and (e2) is the one
      outcome that would be false.
- [ ] `privacy.updated` checked against the day it goes live: it stays at 4 November if this ships
      with 3b, and moves to 5 November if it ships tomorrow.
- [ ] The page shows **no `label` as typed, no account and no row id** — the two reads select none
      of them (`AdminCupboardRepository.ts`), and the check is that the page adds no fourth column
      from anywhere else.
- [ ] The page says what the floor means where the floor applies — a count that reads *«a partir de
      dos cuentas»*, and `0` as *«menos de dos»* and not as *«ninguna»*, which would be false under
      (e1).

---

## 9. Question 5 — phase 4: the pick leans on the cupboard, and the prompt leans on the pick

> Asked by the lead on 2026-11-04, *before* the owner turns `pantryRank` on. Phase 4 is merged
> with the flag **off**. Everything in §§ 1-5 was written about the product with it off, and with
> it off all of it still holds.

### 9.1 What I read, and the one correction it forces on this document

Verified in the code and not taken from the question (`4a537739` and the working tree, 2026-11-04):

| | |
| --- | --- |
| The read moves | With the flag on, `PantryController.forGeneration(userId)` is called **before** the library pick (`PlanGeneration.service.ts:209`) instead of after it (`:685`), and the same read is reused for the shopping list, so one cupboard feeds both |
| What it carries | `{ grams, ingredientId, slug }` and a count of the unresolved — **no `normalised_label` and no `label`** (`PantryController.ts:269-286`). The label does not leave the repository on this path |
| What it does | `rotation.pantrySlugs` → `pantryRank` (`Rotation.ts:454-480`), which sorts a slot's candidates by how few items would have to be bought. It reads `CandidateDish.ingredients` and nothing else. **An order, never a filter**: the whole tail stays in `ordered` (`:638`), so no dish leaves the library |
| How much | Up to `PANTRY_DISHES_PER_SLOT` = **5** of the `DISHES_NEEDED_PER_SLOT` = **19** offered per slot, repaired against the table's caps by `kindsOf`, and walked to half and then to zero by `narrowerShares` when a plan misses a macro band. So the share is a ceiling and can end at nothing |
| What reaches the model | **No cupboard slug and no word.** `pool.build` is never handed the rotation; `promptPreferences` gains no key. But `reusable = RecipeController.reusablePool(slots, context, rotation)` (`:229`) seeds `accepted` (`PoolBuilder.service.ts:182`), and `excludeSlugs = [...accepted.keys()]` (`:345`) is the prompt's *DO NOT REPEAT THESE ALREADY-PROPOSED DISHES* line (`PoolPrompt.ts:1024`). **So the text sent to the provider is a function of what is in the house** |
| What the plan records | `pantryRanked: boolean` beside the four counts, in `generationMetadata`. It reaches **no view**: `pantryFigures` reads only `metadata['pantry']` (`PlanController.ts:1273`), and the care path strips that whole key (`SharedPlanView = Omit<PlanView, 'pantry'>`, `:177`). **P2-9 holds unchanged** |

**The correction.** §§ 1, 4 and 5 of this document lean twice on a sentence phase 4 falsifies —
*«the cupboard is read after everything that chooses a dish has chosen»*, which § 1 calls one of
the two facts carrying the analysis and § 5.3 calls the construction that holds the art. 9
position. **With the flag on that is no longer true**, and I have made every such sentence
conditional rather than deleting it (§ 1, § 2.1, § 4 item 1, § 5.3's table).

And § 4 item 1 **predicted the wrong phase 4**: it expected cupboard slugs in `PoolPrompt`, and
therefore a clause in `profileConsent.ai` and `/privacidad`'s *«Lo que recibe el modelo»* plus a
raised `PROFILE_CONSENT_VERSION`. The phase that was built does none of that. The prediction is
left standing in § 4 with its premise marked failed, because the day somebody does put a slug in
the prompt it is still the right answer.

### 9.2 Answer 1 — is this a communication of the cupboard to OpenRouter and the company behind it?

**My reading: no.** Not because the inference is weak — a weak inference is still an inference,
which is the whole of **P2-10** — but because of *what is in the transmission*.

- Art. 4.2 RGPD counts as processing *«la comunicación por transmisión, difusión o cualquier otra
  forma de habilitación de acceso»*. For a **communication of the cupboard** there has to be a
  cupboard datum made available. What is transmitted is a set of **shared-library dish slugs**.
  The cupboard is a *cause* of that set's composition and is not in it.
- **The product already does this, published and with art. 9 data, and the policy already has a
  name for it.** A dietary pattern — *halal*, *sin gluten*, *sin lactosa*, traditional Spanish —
  leans the library pick and is deliberately kept out of the prompt's list of liked foods
  (`0077`, `docs/ARCHITECTURE.md:339-340`), and the daily targets that *do* travel are computed
  from a weight and a height the model never receives. `/privacidad` frames exactly that:
  *«Lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, del catálogo de
  alimentos que ve: **le llega el efecto, nunca el dato**»* (`es-ES.ts:2889`). If the causal
  history of a lawful transmission were a disclosure of its inputs, that published sentence would
  already be a lie and every derived value in the product would be a disclosure of everything
  behind it. The cupboard travels the same channel carrying **less** — and, on § 5.3's position,
  carrying data that is not a special category at all. It is an *a fortiori* case, not a new one.
- **Why this comes out the other way from P2-10, since it is the same family of reasoning.** There
  the output *was* the information — a count over one named food — and the complementary knowledge
  (who the beta's accounts are) was already in the reader's hands: one step, by a party holding the
  other half. Here a recipient would need the whole library, the rank's algorithm and its seed, the
  person's `avoidSlugs`, likes and dislikes, the food-group reserves and the caps — and the map
  from *«these nineteen dishes were offered»* back to *«these foods are in that house»* is
  many-to-one and lossy by construction: five of nineteen, repaired against caps, sometimes zero,
  the rest seed-shuffled. None of that complementary knowledge is in a processor's hands, the call
  is stateless with zero retention, and recital 26's test is the means *reasonably likely to be
  used*. It fails that test.
- **[lawyer]**, one line for the hour: *does a transmission whose content was ordered by a datum
  the recipient never receives amount to a communication of that datum (art. 4.2), where the
  recipient cannot invert the ordering?* My reading is no, and `0077` means the answer is already
  load-bearing for art. 9 data elsewhere in this product — which is the reason to ask it once
  properly rather than to re-ask it per feature. **Being wrong is cheap**: the recipients are the
  same processors under the same art. 28 contract, the same purpose and the same transfer basis, so
  a stricter reading changes the *notice* and not the lawfulness.

### 9.3 Answer 2 — must the policy say it before the flag goes on? Yes, and art. 13.3 is not why

**Art. 13.3 does not come in.** It bites on a purpose other than the one the data were collected
for. Phase 4 serves *the same* purpose — making this person's plan — more directly than before: no
new recipient, no new category, no new transfer, no new field in the prompt. That is the difference
from phase 5, where the owner reading counts for the library genuinely was a second purpose.

**The policy has to change anyway, and for the thing that is worse than a missing notice: two
published sentences stop being true the moment the flag is on.**

1. `/privacidad`, the cupboard bullet: *«**No cambia los platos que elegimos ni quita ninguno**»*
   (`es-ES.ts:2840`, `en-GB.ts:2718`, [`textos/02`](./textos/02-politica-privacidad.md)'s own
   *«Lo que ya tienes en casa»* bullet, both languages). The second half survives — an order is not a filter, nothing is removed. **The first half
   is simply false**: changing which dishes are chosen is precisely what `pantryRank` is for.
2. The screen, `pantry.intro` (`es-ES.ts:2427`, `en-GB`'s twin): the same clause, with a comment
   beside it that says *"it says the cupboard changes no dish, because that is what is true
   today"*.
3. The bullet's purpose clause is also **incomplete** under art. 13.1.c with the flag on: it gives
   one purpose (*«Para que la lista de la compra… venga marcado como comprado»*) and the ranking is
   a second use of the same datum, whether or not one calls it a second *purpose*.

Arts. 5.1.a and 13.1.c do this work; on the screen, TRLGDCU art. 20 and Ley 3/1991 art. 5 do it
again, because that sentence is a product claim. Whether the gate is art. 13.3 or only 5.1.a does
not change what has to happen, so that question goes on the `[lawyer]` line and not in front of
the work. **[lawyer]**

**And the gate cannot be a deploy, which is the part that changes the shape of the answer.**
`pantryRank` is a row in `app_settings` read per generation (`SettingsController.pantryRank()` →
`SettingsRepository.isEnabled`, `Flag.ts:111`), flipped from `/admin/ajustes` through
`POST /admin/settings/flag` (`AdminSettings.controller.ts:28`). There is no build between the
owner's click and the next generation. So *«swap the texts in the same change as the flip»* — phase
5's gate — **is not available here**: what keeps those two sentences true today is that nobody has
pressed the button. The texts must therefore be **true in both states and live before the toggle is
ever touched** (§ 9.5).

### 9.4 Answer 3 — the record of processing and the DPIA

Same purpose, so the *Purposes* cell does not move. What does move is a **measure both documents
state as a fact**, and in both it is a sentence I wrote:

- [`record-of-processing.md`](./record-of-processing.md), the 2026-11-03 line: *«the cupboard is
  read **after** the shopping list is built and after every pick … so nothing in it can reach the
  pool, the rotation, the scheduler, the safety profile or the prompt»*. With the flag on it
  reaches the rotation **by design**. Amended in this change to both states, in the file's own
  convention, with what actually survives the flip.
- [`dpia.md`](./dpia.md) § 1.2, the cupboard's art. 9 cell: *«The read happens after every pick, so
  there is no path from it to a dish»*. Same problem, same fix; § 1.3's *Use* step gains the
  ranking. **Nothing re-scored**: no new recipient, transfer, category, period or criterion from
  the AEPD's art. 35.4 list.

**The art. 9 position survives phase 4, and I am not re-opening decision (c) — but it lost one of
its two legs and the owner should know which.** What is gone is the structural guarantee (*the read
happens after the pick*). What survives, and is now carrying the whole weight: **no restriction is
inferred or presented**; the rank reads ingredient slugs and nothing about meaning — a dish ranks
high because fewer items need buying, not because a food means anything; it is an **order and never
a filter**, so nothing is excluded; and the cupboard is still never joined to the health tables or
to `dietary_patterns`. Preferring a dish whose ingredients are already in the house is not deducing
that anybody must avoid anything. The practical consequence is that § 5.4's wording discipline
matters **more** than it did, because the screen is now the only thing standing between *«we
offered these first»* and *«we think you can't eat the others»* — and the `keeps` sentence at
`es-ES.ts:2430` is what stops that, unchanged and now load-bearing.

**One amendment to § 5.4, prohibition 7.** It forbids *«any promise that the plan will avoid,
exclude or **prefer** by the cupboard»* on the ground that *«all three are false today — a cupboard
changes no pick»*. With the flag on, **prefer** is no longer false. *Avoid* and *exclude* stay
forbidden in both states, because they are false in both. *Prefer* becomes a claim that may be made
only with the flag on, only as a share, and only under the plan's own promise — so *«solo con lo que
tienes»*, *«adaptado a tu despensa»* and *«evitaremos lo que no tengas»* stay forbidden whatever the
flag says, because five of nineteen, repairable to zero, is not any of those.

### 9.5 The texts, drafted to be true in both states (P1-11)

**(f) `/privacidad`, the cupboard bullet** — two sentences replaced, the rest of the bullet
(including phase 5's counting sentences) untouched. A privacy notice may describe a capability: over-
describing processing is the side that costs the reader nothing, which is the same choice § 6, P2-6
made for *«cuántas cuentas tienen cada alimento»*.

Replace *«Para que la lista de la compra de ese plan venga con lo que ya tienes marcado como
comprado. No cambia los platos que elegimos ni quita ninguno, y no la leemos como…»* with:

```
Para que la lista de la compra de ese plan venga con lo que ya tienes marcado como comprado y, si
lo tenemos activado, para que al elegir los platos vayan delante algunos de los que se hacen con lo
que ya tienes. Tu lista puede entonces cambiar qué platos acaban en tu plan, pero no quita ningún
plato ni decide lo que evitas, y no la leemos como una alergia, una intolerancia ni una forma de
comer: lo que tienes en casa no es lo que puedes comer.
```

```
So that the plan's shopping list comes back with what you already have ticked as bought and, if we
have it switched on, so that when we choose the dishes some of those made with what you already have
come first. Your list can then change which dishes end up in your plan, but it removes no dish and
decides nothing about what you avoid, and we never read it as an allergy, an intolerance or a way of
eating: what you have at home is not what you can eat.
```

<!-- Fuente: art. 13.1.c RGPD (los fines: con la bandera encendida hay un segundo uso del mismo
     dato y la viñeta solo nombraba el primero) y art. 5.1.a (lealtad). «Si lo tenemos activado»
     es lo que hace la frase verdadera en los dos estados, y hace falta porque `pantryRank` es una
     fila de `app_settings` que el propietario conmuta desde `/admin/ajustes` sin despliegue: no
     existe el cambio de código en el que se podría canjear un texto por otro.
     «No quita ningún plato» describe el código y se conserva: `pantryRank` ordena y no filtra, la
     cola entera sigue en `ordered` (Rotation.ts:638). «Ni decide lo que evitas» es la frase que
     sostiene la posición del art. 9 ahora que la lectura ya no va después de la elección
     (§ 9.4): lo que queda es que no se infiere ninguna restricción, y esta es la frase que lo
     dice. «Algunos de los platos» y no «los platos»: son como máximo 5 de los 19 que se ofrecen
     por comida (PANTRY_DISHES_PER_SLOT), reparados contra los topes de la tabla y rebajados a cero
     cuando un plan no cumple una banda de macros (narrowerShares), así que «los platos» sería una
     promesa que el código no puede cumplir.
     Lo que **no** cambia y lo verifiqué: § «La inteligencia artificial» —el modelo no recibe
     ningún dato de la despensa, `promptPreferences` no gana ninguna clave—, `profileConsent.ai`,
     y por tanto `PROFILE_CONSENT_VERSION`, `HEALTH_CONSENT_VERSION`, `CARE_CONSENT_VERSION` y
     `TERMS_VERSION`. Precedente del canal: `0077` y ARCHITECTURE § Invariants. -->

**(g) The screen, `pantry.intro`** — and here the answer is the opposite of the policy's, which is
the one thing in this section that is easy to get backwards. **A privacy notice may describe a
capability; a commercial claim may not promise one that is switched off.** A person reading
*«pueden ir delante»* while the flag is off has been told their cupboard may do something it cannot
do for anybody, and that is TRLGDCU art. 20's territory (*«omisiones engañosas»*) and Ley 3/1991
art. 5's. So:

- **(g1), the recommended minimum**: **delete the last clause** — the intro ends at *«…cubrirá una
  parte de la compra, nunca toda.»* and says nothing about whether dishes change. True in both
  states, needs no flag on the client, and § 5.4's two required sentences are untouched: the
  avoidance clarification (`keeps`, `:2430`) and the measured sentence after the plan both stay as
  they are. What is lost is a reassurance the law never asked for.
- **(g2), better product and `frontend`'s call, not mine**: two strings chosen by the flag. With it
  off, today's sentence stands word for word. With it on:

```
Al elegir los platos, algunos de los que se hacen con lo que ya tienes van delante — siempre por
debajo de lo que tu plan tiene que cumplir, así que puede que en tu plan no se note. No quita ningún
plato: lo que evitas se dice en tu perfil.
```

```
When we choose the dishes, some of those made with what you already have come first — always below
what your plan has to meet, so you may not see it in your plan. It removes no dish: what you avoid
is set in your profile.
```

<!-- Fuente: TRLGDCU art. 20 y Ley 3/1991 art. 5 (la frase de la pantalla es una alegación
     comercial antes que una descripción: no puede prometer lo que la bandera apagada no hace, ni
     prometer de más lo que encendida solo hace en una parte); § 5.4, prohibición 7 tal como queda
     enmendada en § 9.4; y el § 6, P2-7 de este documento, cuya regla es la misma: la cifra se dice
     después del plan y nunca antes. «Siempre por debajo de lo que tu plan tiene que cumplir» es
     narrowerShares: la despensa es lo primero que se rebaja cuando falla una banda. (g1) y (g2)
     son alternativas; publicar las dos a la vez diría dos cosas distintas en la misma pantalla. -->

**Where each one goes.** (f): `es-ES.ts:2840`, `en-GB.ts:2718`,
[`textos/02`](./textos/02-politica-privacidad.md)'s bullet in both languages — in place there, since it
is true today as well. (g): `pantry.intro`, `es-ES.ts:2427` and the `en-GB` twin, plus the comment
above it, which says the opposite of what will be true. `privacy.updated` moves to the day (f) goes
live. **No consent version, no `TERMS_VERSION`, no `textos/05`, no `⟦marca⟧`** — a mark publishes
text when a thing goes live, and the whole point here is that the text must be live *first*.

### 9.6 Before the owner touches the toggle

**The toggle was turned on by the owner on 2026-11-05**, by his own account, and the boxes below
were not all ticked when he did it. They are ticked here as each one was actually answered, with
the three that were answered *after* the click marked as such — because a checklist that cannot say
it was finished late is a checklist nobody can trust afterwards.

- [x] **(f) live in `es-ES.ts`, `en-GB.ts` and `textos/02`**, with `privacy.updated` moved. This is
      the gate: not a deploy to align with, a sentence that must already be published when the
      click happens. **Done before the click**, in `a142e8ad` (#321), and verified in what
      production serves: both `/privacidad` and `/en/privacidad` carry «si lo tenemos activado» /
      "if we have it switched on" and the 5 November date.
- [x] **(g1) or (g2) live** on the pantry screen, and the stale comment at `es-ES.ts:2422` with it.
      **(g1)**, before the click: `pantry.intro` ends at «nunca toda.» / "never all of it." and no
      longer claims the cupboard changes no dish. **One thing this leaves open, and it is now a
      choice and not a gap**: with the flag on, (g1) is true but silent about the steering, and
      (g2) — § 9.5's drafted wording, which names it as a share — is the text that says what is
      actually happening. Prohibition 7 forbids a false promise and not a silence, and the duty to
      describe the capability is discharged by the policy, so this is the owner's copy decision
      rather than a correction owed.
- [x] § 5.4 re-read against every string the screen shows with the flag **on**, under prohibition 7
      as § 9.4 amends it. The `keeps` sentence is load-bearing now and must still be on the screen.
      **Done 2026-11-05, after the click. No prohibition is broken**, and the re-read is cheap to
      repeat because **no screen reads the flag** (`pantryRank` is `audience: 'owner'`, and a grep
      of `apps/web/src` outside the console finds nothing), so the strings are the same in both
      positions — which is why the rule in `apps/web/AGENTS.md` is *«true with the flag on and
      off»*. Checked one by one: no verb of capacity or tolerance as a category (1); the register is
      «lo que ya tienes en casa» throughout and never «mi dieta» (2); nothing asks why (3); the
      picker offers a search over our catalogue and no clinical facet, tab or filter (4); every
      sentence is about the list or the shop and none about a body (5); `keeps` says where
      restrictions are declared and links nowhere (6); nothing promises an avoidance, and neither
      «solo con lo que tienes» nor «adaptado a tu despensa» appears (7); the screen has no
      free-text box — a word our list does not hold cannot be added, it answers «No encontramos ese
      alimento en nuestra lista» (8); and `notCooked` renders at `tone="tertiary"`, the quietest
      tone there is, with the entry still in the list (9). Both required sentences are present in
      both languages.
- [x] `health-boundary.spec.ts` green with the flag **on**, which is the only mechanical proof that
      no cupboard slug reached the prompt by this new route; and `PlanGeneration.spec.ts`'s pin that
      `pool.build` is never handed the rotation. **Done 2026-11-05, after the click**, and written
      stronger than this line asked for. `health-boundary.spec.ts` now forbids the **import**:
      `core/controllers/Pantry`, `core/entities/Pantry`, `#repositories/Pantry`, `Pantry.controller`
      and `Pantry.service` are unreachable from the AI module, which fails on the import rather than
      on the prompt — 37 of 37. `PlanGeneration.spec.ts` carries five pins: the request handed to
      `pool.build` is deep-equal with the cupboard steering and without it; a slug that exists
      **only** in the cupboard appears in no field of it; the cupboard is on the rotation only with
      the switch on, and never on the whole-library read beside it; `forGeneration` is asked for the
      generating account and no other; and `pantryRanked` tells the asking from an empty cupboard
      and from a switch that is off — 55 of 55. **And the gap none of those could close**: every one
      of them mocks the library read, so until `generation.e2e-spec.ts` got its three cases the
      switched-on path had never executed against a real catalogue, a real cupboard and a real
      generation. It does now, 28 of 28: the fortnight builds, the plan records the steering, and
      phase 2's seeding of the shopping list still happens with the switch on.
- [x] The measured sentence still reads from `generationMetadata.pantry` after the plan and is never
      recomputed (P2-7), and `pantryRanked` still reaches no view — the care path strips it (P2-9).
      `CareAccess.test.ts` pins what may cross to a professional as the four pantry counts and
      nothing else, and the new `pantryRanked` pin reads the column rather than a view, because no
      route carries it.
- [ ] This section's `[lawyer]` lines (§ 9.2 and § 9.3) on the owner's list. Neither blocks the
      flip: being wrong on either costs a notice, not the feature. **Still open, and still the
      owner's.**

**What the flip does not close.** The residual measured at share 5 — a small loss the repair does
not remove, half of which the code explains (the repair is neutral per slot while the caps count a
fortnight) and the rest of which is unexplained — was accepted *while the flag was off*
([`../decisions/LOG.md`](../decisions/LOG.md), 2026-11-05). With the flag on it is live behaviour in
real fortnights. It is small, it is measured over 112 of them and every day stayed in band, so it is
not an alarm; but the sentence that made it survivable has changed, and whoever reads this next
should know that it was accepted under the other one.

---

## Sources (the version consulted)

- **RGPD** — Regulation (EU) 2016/679: arts. 4.15, 5.1.a/b/c/e, 6.1.b, 6.4, 9.1, 9.2.a, 9.3,
  12.1/12.3/12.5, 13.1.c, 13.2.a, 13.3, 15.1/15.3, 17, 20.1, 24, 25.1, 28, 30.1.b, 32, 35, 89.1,
  and **recital 50**. The OJEU text in the BOE (`DOUE-L-2016-80807`), as used throughout
  [`analysis.md`](./analysis.md); arts. 5.1.b, 6.4 and 13.3 and recital 50 **re-read there on
  2026-11-04** for P2-6, which is where they are quoted (recital 50: *«no se requiere una base
  jurídica aparte, distinta de la que permitió la obtención de los datos personales»*).
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
- **The product, read on 2026-11-04** for P2-6 and P2-10, at `4a537739` plus the working tree
  phase 5 is being built in: `packages/core/src/repositories/Admin/AdminCupboardRepository.ts`,
  `packages/core/src/controllers/Admin/AdminCupboardController.ts`,
  `apps/api/src/modules/admin/controllers/AdminCatalogue.controller.ts:214-240`,
  `apps/api/src/modules/admin/services/AdminCatalogue.service.ts:66-81`,
  `apps/api/src/modules/admin/dto/in/CupboardGapQuery.dto.ts`,
  `packages/database/src/schemas/pantry.schema.ts`, and the live dictionaries
  `apps/web/src/i18n/dictionaries/es-ES.ts:2777-2941` and `en-GB.ts:2664-2813`. **One read-only
  query** against the dev database for P2-10's nine slugs
  (`postgres://…@127.0.0.1:54329/nutria_local`, 1,638 recipes and 930 ingredients,
  `default_transaction_read_only=on`, 2026-11-04): the catalogue ingredients with no
  `recipe_ingredients` row whose slug carries a qualifier. The six that matter are in the seed
  whichever database is asked — `packages/database/src/seed/ingredients/dairy.ts:343`
  (`leche-sin-lactosa`), `pantry.ts:257` (`pan-rallado-sin-gluten`), `:1878`
  (`galletas-sin-gluten`), `:2356` (`pesto-vegano`), `beverages.ts:118` (`cerveza-sin-alcohol`) and
  `:241` (`vino-sin-alcohol`) — which is why the finding does not rest on one database's recipe
  count. (`pan-sin-gluten`, `bakery.ts:114`, **is** cooked by something and is not on the list.)
- **The product, read on 2026-11-04** for § 9 (project 022 phase 4, flag off):
  `apps/api/src/modules/meal-plans/services/PlanGeneration.service.ts:195-240,646-700`,
  `apps/api/src/modules/ai/services/PoolBuilder.service.ts:95-115,182,320-360`,
  `apps/api/src/modules/ai/prompts/PoolPrompt.ts:1024`,
  `packages/core/src/domain/Variety/Rotation.ts:28,81,160,182-188,240-262,440-480,595-650`,
  `packages/core/src/controllers/Pantry/PantryController.ts:269-286`,
  `packages/core/src/controllers/Plan/PlanController.ts:177,1273`,
  `packages/core/src/domain/Flag/Flag.ts:109-111`,
  `packages/core/src/controllers/Settings/SettingsController.ts:84-86`,
  `packages/core/src/repositories/Settings/SettingsRepository.ts:53-61`,
  `apps/api/src/modules/admin/controllers/AdminSettings.controller.ts:28`,
  `apps/api/src/modules/care/dto/out/Care.dto.ts:40-52`, and the live dictionaries
  `es-ES.ts:33-45,2410-2440,2874-2895` with their `en-GB` twins.
- **In this repository**: [`analysis.md`](./analysis.md) §§ 1.2, 3, 4.1, 5, 8, 9 (P2-9, P2-16),
  [`textos/02`](./textos/02-politica-privacidad.md),
  [`2026-09-29-accepting-the-legal-texts.md`](./2026-09-29-accepting-the-legal-texts.md) (D5),
  `docs/ARCHITECTURE.md:330-348` (§ *Invariants*: a dietary pattern's lean orders the library pick
  and is kept out of the prompt's liked foods — the channel § 9.2 relies on),
  `docs/decisions/0100`, `0102`, `0091`, `0075`, `0092`, `0077`, `0028`, and project 022's `PRD.md`,
  `PLAN.md` and `LOG.md` (phases 0, 1, 2, 3a).
