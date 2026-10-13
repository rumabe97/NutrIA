# 0005 — Failed pictures: a mail alert, a kept candidate and manual acceptance

> **Purpose**: the `architect` agent's answer to the owner's request of 2026-09-30, the same day
> the manual retry shipped (#168): (1) a mail when a dish's picture fails, (2) being able to see
> in the console the picture that failed and accept it by hand, including against the allergen
> judge, and (3) keeping rejected images for seven days in Vercel Blob. For each one it says
> whether it can be done, what it really costs, what it breaks, how the judge's invariant ends up
> written, and in what order to do it.
> **Audience**: the owner and the agents. **Committed**: yes. **Maintained by**: the `architect`
> agent; once merged it is not edited — a later review is a new report.
>
> Base: `main` at `4aa4796` (the picture code is #168's, `530ba29`), read in a checkout that was
> on branch `sentry-11`; its uncommitted changes touch neither pictures, alerts, the console,
> `core`, `database` nor `docs/legal` (checked with `git diff`). Every number carries its label:
> **measured** (where), **estimated** (with the hypothesis) or **unknown**. For this report the
> code and Vercel Blob's documentation were read (pages of 2026-09-15 and 2026-09-23). **No model
> call was made, production was not read, nothing was written to any database and nothing was
> spent.** The development database is over its Neon quota (a note in #168), so there is no new
> measurement: the measured numbers are those of the pilots and of project 006's `LOG.md`.

---

## 1. Verdict

They are three questions, and each has its own answer.

| # | Question | Verdict | What constrains it |
| --- | --- | --- | --- |
| 1 | Mail to the owner when a picture fails | **Yes, on conditions** | "Immediate, grouped and at most one an hour" with no new cron means: the first goes out at once, the rest of that hour wait for the next mail. And the mail carries **reasons and counts, not dish names** (a recommendation; § 4.1) |
| 2 | See the picture that failed and accept it by hand | **Yes, on conditions** | Only a file with C2PA may be accepted, checked again over the bytes at acceptance. Every acceptance is an override of the allergen judge (there is no other judge rejection). It is not delivered without a way to **withdraw** what was accepted |
| 3 | Keep the rejected ones for 7 days in Blob | **Yes, on conditions** | In a **separate private store** (an owner action in Vercel), never with a public URL. Images without C2PA are **not** kept. The cleanup goes by the paths stored in the database, inside the 03:30 cron |

None of this costs any appreciable money (< $0.01 a month, **estimated**, § 8), needs no
migration and does not touch `0004`: a dish's allergens still come from the recipe, in code. What
does change is a sentence that is true today in four places — "a rejected image is never stored" —
and it has to be rewritten precisely (§ 5).

**The lead's constraint is confirmed**: a file with no C2PA manifest can never be accepted, not
even by hand (§ 2, P3).

---

## 2. Premises checked

| # | Premise | Status | Evidence |
| --- | --- | --- | --- |
| P1 | Today only an accepted image is stored | **confirmed** | `apps/api/src/modules/ai/services/DishPicture.service.ts:154-155` and `:251-259`: the only `store.put` is in `keep()`. A rejected attempt's bytes are lost on returning from `attempt()` (`:219-225`: only a note and a reason come out) |
| P2 | The images with a candidate are those of `judge_allergen`, `judge_rejected` and `no_provenance` | **wrong**, on three counts | (a) **`judge_rejected` cannot happen**: `judgePicture` rejects only when `rejecting` is not empty, and then it always writes `extra_allergen:` (`packages/core/src/domain/DishPicture/judge.ts:496`, `:502`, `:511`); `reasonOfRejection` reads it as `judge_allergen` (`packages/core/src/entities/DishPicture/PictureReason.ts:66-68`). **Every image the judge rejects is rejected for an allergen.** (b) There is a fourth case with a drawn image: the judge fails (timeout, 5xx) after the drawing (`DishPicture.service.ts:213-217`, `:243-247`): an image with C2PA that nobody judged. (c) The row's reason is the **last** attempt's (`:159`): a `call_failed` row can hold an image the judge rejected on attempt 1 |
| P3 | An image with no C2PA must never be acceptable | **confirmed** | Code: `DishPicture.service.ts:207-211` ("a file without its C2PA manifest is never kept"). Legal: the signed C2PA is the metadata layer of art. 50.2 and of measure 1.1.1 of the Code (`docs/legal/dish-pictures.md` § 1.5, § 2.3.2), and the live policy says "the files also carry an invisible, machine-readable mark" (§ 4.2 b, "no variants […] so the last sentence is true"). Accepting a file with no manifest makes that sentence false. The "without C2PA" path legal contemplates (§ 2.3.3) requires writing IPTC, different wording and a lawyer: it is not a button |
| P4 | Vercel Blob allows storing something non-public | **confirmed, with a nuance that decides the design** | Access is a property of the **store**, not of the file: "Private storage requires a private Blob store" (Vercel docs, *Private Storage*, 2026-09-15). The current store is public (`apps/api/src/modules/ai/clients/VercelBlobPictureStore.ts:35`). Private = a second store. The installed SDK (`@vercel/blob` 2.8.0) already brings `get()` with `access: 'private'`. Stores are unlimited on every plan (*Blob Pricing*, 2026-09-23) |
| P5 | The cleanup fits in the 03:30 cron | **confirmed** | `apps/api/src/modules/recipes/controllers/Cron.controller.ts:72-90`: there is already a step before the sweep with its own budget (`WATCH_BUDGET_MS`, `:19`, `:76-79`). `del()` is free; `list()` is an advanced operation and is not needed (§ 4.2) |
| P6 | The mail fits in `owner-alerts` with its claim | **confirmed** | `apps/api/src/modules/owner-alerts/services/OwnerAlerts.service.ts:163-183` (`deliver(kind, since, mail)`) and `packages/core/src/repositories/Analytics/AnalyticsRepository.ts:42-80` (an advisory lock + a check + an insert). A `picture-failed` claim from "an hour ago" gives "at most one an hour" with no new deduplication code |
| P7 | "Immediate but grouped" | **a hypothesis that does not hold as stated** | Without an hourly cron (rejected in `0071`: +15 CU-h of Neon a month) there is nobody to send "at the end of the hour". The first failure sends; the rest of that hour cannot. § 4.1 says where they go |
| P8 | A dish's name is catalogue data and can go in the mail | **confirmed today, and I still do not recommend it** | Recipes are reference data naming nobody (`AdminCatalogue.controller.ts:25-29`) and the console already lists their names. But: `recipe_source` allows `user` (`packages/database/src/schemas/_enums.ts:52`) with `recipes.createdBy` (`recipe.schema.ts:23`) — no code writes it today, but the day it exists, a name will be a person's text; and the mail rule is mechanical and forbids the dish **by name**: "There is no field for an address, a name, a message or a dish, so the mail cannot carry one" (`packages/core/src/controllers/Admin/AdminAlertController.ts:50-55`), with its sentinel in the spec (`apps/api/src/modules/email/templates/OwnerMail.spec.ts:22`, `SENTINEL-DISH-NAME`) |
| P9 | A migration is needed | **wrong** | `recipe_images.provenance` is `jsonb` (`packages/database/src/schemas/recipe.schema.ts:136`), the `check` on `status` does not change (`:145`) and `audit_logs.action` is `text` with no `check` (`platform.schema.ts:85`). It is how `provenance.reason` went in with #168 |
| P10 | A retry coexists with a candidate | **wrong today** | `retryPicture` sets `provenance: null` (`packages/core/src/repositories/Recipe/RecipeRepository.ts:809`) and `completePicture`/`failPicture`/`releasePicture` overwrite it whole (`:230`, `:254`, `:775-782`). Any of the four, over a row with a candidate, loses the file's path for good |
| P11 | What is accepted can be undone | **wrong** | There is no route that removes a `ready` image: a retry refuses it (`packages/core/src/controllers/Recipe/RecipeController.ts:480-482`, `not_retryable`). Undoing today would be a reviewed data migration |
| P12 | The alert fires from `DishPictureService` | **with a nuance** | `modules/ai` cannot import `core/controllers/Admin` (`apps/api/src/modules/ai/health-boundary.spec.ts:52`), which is where `OwnerAlertsService` reads from. The hook goes **outside** `modules/ai` (§ 6) |
| P13 | None of this brushes `0028` | **confirmed** | An image, a recipe, its ingredients and its allergens name nobody. The Blob path carries the recipe's id and a random value (`DishPicture.service.ts:257-258`). No new read touches `created_by` |
| P14 | Seven days, the same as the wait | **confirmed, and it must be the same constant** | `PICTURE_COOL_OFF_DAYS = 7` (`RecipeController.ts:59`). With one clock (`lastAttemptAt`), "the candidate expires" and "the dish may be redrawn" are the same instant (§ 4.2) |

---

## 3. What is there today

**The drawing.** A view claims the drawing (`RecipeController.requestPicture`,
`RecipeController.ts:417-438`; a single statement in `RecipeRepository.claimPicture`,
`RecipeRepository.ts:99-126`) and `DishPictureService.draw` runs after the response. It makes up
to `PICTURE_ATTEMPTS = 3` attempts (`RecipeController.ts:62`). Each attempt: the month's cap →
the image → **C2PA** (`:207-211`; with no manifest the dish fails there and then, with no further
attempts, `:166-168`) → two judge calls → `judgePicture`. Only `keep()` stores, in the public
store, with a year of cache (`VercelBlobPictureStore.ts:9`, `:34-41`). If nothing is accepted,
`failPicture` leaves the row `failed` with `provenance: { notes, reason }` (`:176`) and the dish
waits 7 days. The cap, or the account being unable to pay (402, 429; `isRefusal`, `:60-66`),
**give back** the claim (`release`, `:287-291`): the row stays `failed` with `provenance.released`
and any view claims it immediately.

**The judge.** It rejects only for an extra food, named, more than a trace, carrying an allergen
the dish does not have; the allergens come from the catalogue, in code (`judge.ts:1-24`, `:496`).
What the judge saw stays in `verdict.extras` — with the **catalogue slugs** each name was mapped
to (`mappedTo`) and the **allergen keys** (`foreignAllergens`) — but today only the notes are
stored, as text (`DishPicture.service.ts:223`).

**The console.** Recipes shows the closed reason and the "Retry" button
(`AdminCatalogue.controller.ts:63-77`; `POST /admin/catalogue/recipes/:id/picture/retry`, 30 an
hour, a `picture.retried` audit row in the claim's transaction, `RecipeController.ts:488-490`).
`provenance` never comes out as it is
(`packages/core/src/repositories/Admin/AdminCatalogueRepository.ts:39`).

**The alerts.** `OwnerAlertsService` sends the 08:00 digest and three immediate alerts (three
failed generations, spend at 80%/100%, a silent cron), each claimed before sending
(`OwnerAlerts.service.ts:19-43`). The digest does **not** carry picture failures: `OwnerDigest`
has no field for them (`packages/core/src/controllers/Admin/AdminAlertController.ts:56-65`). The
mails carry numbers, closed codes and links; their spec rejects an `@`, a uuid and six sentinels.

**Production, the only thing measured**: on 2026-09-28, 6 pictures ready, 0 failed, $0.24
(**measured**, `docs/projects/006-realistic-dish-pictures/LOG.md`, "`/admin` the same day"). The
judge, replayed over the pilot's 57 responses: 57 of 57 accepted, 3 of 3 wrong-recipe controls
rejected, and **2 false rejections found and fixed** (**measured**, the same `LOG.md`, phase 2).
How many images the judge rejects in production: **unknown**.

---

## 4. Proposal

### 4.1 The mail

**Shape.** A new `OwnerAlert` kind, `picture-failures`, with counts by closed reason
(`PICTURE_REASONS`) and a link to `/admin/catalogo?picture=failed` (it already exists:
`apps/web/src/app/(admin)/admin/catalogo/imagenes/page.tsx:154`). A `picture-failed` claim from
"an hour ago".

**What it counts.** The `failed` rows **not given back** whose `lastAttemptAt` is later than the
last `picture-failed` alert (`AnalyticsRepository.lastOwnerAlert`, `:83-87`), or than 24 h ago if
there was none. That way each mail carries **everything that failed since the previous mail** and
nothing is lost to the hour's claim.

**When sending is attempted** (always the same method, which claims or stays silent):

1. when any drawing ends, however it ends — the database is already awake;
2. in the two daily crons (03:30 and 08:00 UTC), which already call `owner-alerts`.

**What that gives, said plainly.** The first failure of a streak arrives at once. Those that fall
inside that hour go out with the next drawing that finishes past the hour or, if nobody opens a
dish, with the next cron: **up to ~19 h later** in the worst case (**estimated**: mail at 08:00, a
failure at 08:30, the next cron at 03:30). They are always in the console immediately. Ceiling:
24 mails a day by construction.

**Give-backs do not alert.** The cap already has its 100% spend alert. A 402 on the pictures key
is alerted by nobody today; it is one more line in this same mail with its own 6 h claim, if the
owner wants it (§ 11, Q5).

**The dish's name.** It can go without touching anybody's privacy — today. I do not recommend it,
for three reasons: `0071`'s rule ("a number or a closed label, or it does not go in") is held up
by a spec that forbids exactly that; `source = 'user'` exists in the schema and one day a name
will be somebody's text; and the name does not change what the owner does next, which is open the
console, where the name is. The recipe's id does not go either, not even in the link: the spec
rejects any uuid. **This departs from what the owner asked for ("with the dish and the reason")**:
if he wants the name, it can be done on three conditions — `seed`/`ai` recipes only, a name
sanitised and shortened in `core` (like `safeCode`), and a written amendment to `0071` and its
spec — and it is his decision (Q2).

Alternatives rejected:

| Alternative | Why it lost |
| --- | --- |
| An hourly cron that groups | `0071` already rejected it: it wakes Neon 24 times a day |
| One mail per failure | The owner asked for grouping; a streak (the provider stops signing) would be dozens |
| Only adding it to the 08:00 digest | It is not immediate; as a complement it does work and is cheap |
| Delaying the send a few minutes with `waitUntil` to group | The function dies at 300 s (`apps/api/vercel.json`); it would group minutes, not an hour |

### 4.2 The candidate: where it lives, how it is seen, when it is deleted

**What is kept.** One candidate per dish: **the last image with C2PA that the judge rejected** in
a drawing that ended `failed`. It is held in memory during the drawing (≤ 227 KB, **measured** in
the pilot, `docs/legal/dish-pictures.md` § 2.1) and uploaded **only if the drawing ends
failed**: a drawing that ends accepted or given back leaves nothing. If the upload fails, the dish
fails as it does today, with no candidate: it never changes the outcome.

**What is not kept.**

- **`no_provenance`**: there is nothing to decide about it (P3) and an AI file with no mark is
  exactly what is best not to hold. Instead, the row stores a closed diagnosis: content type, size
  and `pictureMarks`'s three marks (`jpeg`, `c2pa`, `trainedAlgorithmicMedia`). If the provider
  stops signing, every dish fails on the first attempt and the mail says so by the count.
- **The image the judge never saw** (P2 b): out of the first version (Q3).
- **Those from a given-back drawing** (the cap, a 402): the row is claimed immediately; there is
  no "failed" one to review.

**Where.** A **second Vercel Blob store, private, in `fra1`**, with its own token. The path
follows the public one's shape:
`dish-picture-candidates/<recipeId>/<version>-<random>.jpg`.

| Option | Who can read the file | Verdict |
| --- | --- | --- |
| **A separate private store** | Only whoever has the store's token: the API | **Recommended.** "No public URL" is literal. The same cost (*Blob Pricing*: "priced the same for storage, operations, and uploads"). It needs an owner action in Vercel |
| A random prefix in the current public store | Anybody with the link (`dish-pictures.md` § 4.1: "accessible to anyone with the link") | Lost: that is obscurity, not privacy; a URL leaking into a log or a DTO publishes an image the judge rejected |
| A short-lived signed URL (`presignUrl`) | Anybody with the link, until it expires | Lost: it adds the surface of signed tokens to save a function hop that costs nothing here |
| Bytes in Postgres | Only the API | Lost: `0066` took the bytes out of Neon over the quota |

**How the console sees it.** An API route that serves the bytes:
`GET /admin/catalogue/recipes/:id/picture/candidate`, `@Roles('admin')` (404 for anybody else, as
every denial is), which reads with `get()` from the private store and answers with
`Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff` and `Cache-Control: private,
no-store`. The web already forwards `/api/v1/*` to the API with the session cookie as its own
cookie (`apps/web/next.config.js`), so an `<img>` pointing at that route works with nothing new.
**The Blob path never leaves the API**: the recipe row gains a `pictureCandidate` field with the
allergen keys, the catalogue ingredients what the judge saw was mapped to, and when it expires —
never the path.

**What is shown of the judge.** The **allergen keys** and the **catalogue ingredients** of
`verdict.extras` (`foreignAllergens`, `mappedTo`), which are closed sets of ours. **Not** the word
the vision model wrote: that is a third party's text, and #168's rule is that such text does not
reach a screen (`PictureReason.ts:3-7`). For that, `extras` has to be stored on rejection, not
just the notes.

**One clock.** The candidate can be reviewed while `now < lastAttemptAt + 7 days`: the same
constant and the same instant as the wait. The console's read applies that rule itself, so an
expired candidate the cron has not yet deleted is neither seen nor acceptable.

**Cleanup, in the 03:30 cron, before the sweep and with its own budget.** It reads the rows with a
candidate that is no longer reviewable (expired, or the row is no longer `failed`), `del()`s their
paths (free) and clears the pointer. **No `list()`**: the database says what exists. Its count
goes into `rewrite`'s `cron_run`. A candidate lives in the store for 7 days and up to 24 h more;
**reviewable**, exactly 7 days.

**The rule that avoids orphan files.** A row with a candidate pointer **is not claimed for
drawing**: `claimPicture` and `unclaimable` exclude it. The pointer is only cleared after the file
is deleted. Consequence: **the automatic retry waits for the cleanup** — the dish becomes drawable
again after the first 03:30 pass following day 7, not at the exact second. If the cron goes
silent, those dishes wait, and the 08:00 digest already warns about a silent cron at 26 h.

**"Reject for good"** = delete the file and clear the pointer. It does **not** touch `status`,
`attempts` or `lastAttemptAt`: the dish stays failed until its wait is over, and "Retry" remains
the separate verb that spends. A button that says "discard" should not cost $0.04–0.11.

**"Retry" with a candidate pending** discards it: the interface says so beforehand. The order:
checks → claim (which clears `provenance`, as today) → `del()`. If the function dies between the
last two steps, a private file of ≤ 227 KB is left with no pointer: a known and accepted P3, like
`keep()`'s (`DishPicture.service.ts:275-277`).

### 4.3 States and transitions

The row gains no states (`drawing`, `ready`, `failed`; `none` is having no row). It gains an
orthogonal fact: **a candidate** (0 or 1), only on a `failed` row that was not given back.

| From | What happens | To | Candidate | Who · trace |
| --- | --- | --- | --- | --- |
| `none`, a cooled-off `failed` **without** a candidate, or a given-back one | a view opens the dish | `drawing` | — | the view |
| `drawing` | the judge accepts | `ready` | the one held in memory is thrown away | automatic |
| `drawing` | nothing accepted after 3 attempts, with some judge rejection | `failed`, a 7 d wait | **the last rejected one is uploaded** | automatic · mail |
| `drawing` | no C2PA | `failed`, a 7 d wait | none; a closed diagnosis | automatic · mail |
| `drawing` | the cap or a 402 | `failed`, given back | none | automatic |
| `failed` + a candidate | the owner **accepts** (two steps, C2PA rechecked) | `ready`, `acceptedBy: 'owner'` | copied to the public store; the private one deleted | the owner · `picture.accepted` |
| `failed` + a candidate | the owner **discards** | `failed`, the same wait | deleted | the owner · `picture.discarded` |
| `failed` (with or without a candidate) | the owner **retries** | `drawing` | deleted | the owner · `picture.retried` |
| `failed` + a candidate | 7 days pass | `failed`, claimable after the cleanup | deleted by the 03:30 cron | the cron · `cron_run` |
| `ready`, accepted by hand | the owner **withdraws** | `failed`, a 7 d wait from now | — (the public file is deleted) | the owner · `picture.removed` |

### 4.4 Accepting

`POST /admin/catalogue/recipes/:id/picture/candidate/accept`, `@Roles('admin')`, with an hourly
limit like the retry's. In order:

1. The row is `failed`, has a candidate and it has not expired; otherwise 409.
2. **The body repeats the allergen keys the console showed**, and they must be the stored ones. It
   is the second confirmation step placed on the server: it cannot be accepted without having
   received the warning, nor can a different candidate from the one seen be accepted.
3. The API reads the bytes from the private store and **runs `pictureMarks` again**: without
   `jpeg` and `c2pa`, a 409 `PICTURE_NOT_ACCEPTABLE`. The mark stored on the row is not enough.
4. `put()` of those same bytes into the public store, at the usual path
   (`dish-pictures/<recipeId>/<version>-<random>.jpg`), with **the candidate's** prompt version.
   Without touching a byte: the C2PA still validates.
5. One transaction: a guarded `UPDATE` (`status = 'failed'` and the same `lastAttemptAt` that was
   read) to `ready`, with `provenance` saying `acceptedBy: 'owner'` and which allergens were
   overridden, **and** the `picture.accepted` row in `audit_logs` with those same keys. If it
   updates nothing (another tab, a retry), a 409 and the public file just uploaded is deleted.
6. `del()` of the private candidate (and the cleanup picks it up if this fails).

Accepting calls no model: **the month's cap does not stop it**. With the `dishPictures` switch
off it is refused, like the retry.

There is no `copy()` between stores (the SDK limits it to the token's store,
`@vercel/blob/dist/index.d.ts:351`); reading and rewriting is also what makes step 3 possible.

**Withdrawing.** `POST …/picture/remove`, only for an image with `acceptedBy: 'owner'`: the row to
`failed` with a new closed reason (`owner_removed`), the public file deleted, a `picture.removed`
audit row. Without this, a mistaken acceptance stays in front of everybody who sees that dish
until somebody writes a migration (P11).

Alternatives rejected:

| Alternative | Why it lost |
| --- | --- |
| Keeping all three images of a failed drawing | Three files, three decisions and an array on the row for a rare case; the last rejected one is enough and the design allows extending it |
| Stopping the drawing at the first judge rejection (saving up to 2 attempts, ~$0.07) | It turns every rejection into work for the owner; today a second attempt can fix it on its own. How often it does: **unknown** (a measurement question, § 11) |
| A new `recipe_image_candidates` table | A migration (`migration-reviewer`'s floor, and the development database is over its quota) for hundreds of rows and a transient fact that fits in the `jsonb` |
| Showing the judge's word ("prawns") | A foreign model's text on a screen; the catalogue slug says the same thing in our words |
| Making acceptance require the judge to look again | The judge already said no: asking it again adds nothing to the owner's decision |

---

## 5. The invariant, and the real risk

### How it ends up written

Today it is said, in four places, that a rejected image is "never stored"
(`DishPicture.service.ts:98-99`; `apps/api/AGENTS.md:255-256`, "is never stored";
`apps/api/src/modules/ai/clients/PictureStore.ts:5`; PRD 006, criterion 6, "never stored or
shown"). That stops being true. The wording I propose, for the decision record amending `0066`:

> **An image reaches a person through one of two doors only.** (a) `judgePicture` accepted it.
> (b) The owner, with an admin session, accepted it by hand after seeing the allergen the judge
> pointed at, and that acceptance is a `picture.accepted` row in `audit_logs` written in the same
> transaction that sets the image `ready`. **In both, the file that is published carries its C2PA
> manifest, checked over those same bytes.** There is no door (c): no retry, cron or automatic
> code publishes a candidate. A rejected image is kept for at most 7 days, in a private store only
> the API reads, and has no public URL.

`0004` does not move: no safety decision passes to a prompt, and what somebody may eat is still
decided by `findSafetyViolations` against the recipe. The vision judge was never that guarantee
(`dish-pictures.md`, the comment in § 3.3: "it reduces the risk, but it is not the
guarantee").

### What risk accepting against the judge adds

| Direction | What it is | Does this feature touch it |
| --- | --- | --- |
| The image does **not** show an allergen the dish **does** have (IMG-1, P1) | The dangerous one: somebody trusts the photo. The judge **never** checked it; it is covered by the ingredient list, the caption "the ingredient list rules" and the terms | **No.** The same before and after |
| The image shows an allergen the dish does **not** have (IMG-2, P2) | The one the judge does look at. Legal scores it "confusion, mistrust, non-exposure" | **Yes**: the owner can publish one |

The real IMG-2 case: somebody allergic to crustaceans sees prawns in the photo of a dish the app
gives them as safe. The dish **is** safe — the recipe does not carry them and neither does the
shopping list. What happens is that they mistrust it, or skip the meal. Physical harm would
require somebody to cook "from the photo" and add a food that is in neither the recipe nor the
shopping list; for the person with the allergy that is implausible, and for somebody cooking for
another it is unlikely and the caption covers it. **Low probability, P2 severity, and permanent**
while the image is published: which is why "withdraw" is a condition.

The feature exists for the opposite case: the judge is wrong (a sauce read as milk; two false
rejections in the pilot's replay) and today that costs a dish with no picture or another
$0.04–0.11 in retries that may end the same way.

---

## 6. Requirements

**Code** (who: `backend`, except where stated):

- `packages/core`: `candidate` in what `pictureState` reads; `claimPicture` and `unclaimable`
  exclude rows with a candidate; new guarded methods in `RecipeRepository` (accept, discard,
  withdraw, candidates to clean) with the audit row in their transaction, like `retryPicture`;
  `AUDIT_ACTIONS` and `AuditMetadataByAction` gain `picture.accepted` (allergen keys),
  `picture.discarded`, `picture.removed`; `PICTURE_REASONS` gains `owner_removed`; the reader of
  failure counts for the mail.
- `apps/api` `modules/ai`: `DishPictureService` holds the last rejected one, stores
  `verdict.extras` and uploads the candidate on failure; a `PictureCandidateStore` (put, get, del)
  with its private Blob implementation and its in-memory stub. With no token it is unavailable and
  drawing behaves exactly as it does today.
- `apps/api` `modules/admin`: the routes to view, accept, discard and withdraw; the
  `pictureCandidate` field on recipe rows. **The view route is the API's first binary response**:
  no route serves bytes today (the only two `@Res()` are redirects), so it must write its own body
  and headers (`StreamableFile` or `@Res()`) and declare in `dto/out` what it answers (`0039`).
  Its 404 will still be `AllExceptionsFilter`'s JSON, which for an `<img>` is simply a broken
  image.
- `owner_removed` enters `PICTURE_REASONS`, the closed set the web picks a label from: one more
  key in both dictionaries.
- `apps/api` `modules/owner-alerts` and the `OwnerAlert` template: the `picture-failures` kind.
  **The hook goes outside `modules/ai`** (P12): either `schedule(claim)` accepts an "on finish",
  or the two places that schedule a drawing
  (`apps/api/src/modules/meal-plans/services/MealPlans.service.ts:72`,
  `apps/api/src/modules/admin/services/AdminCatalogue.service.ts:34`) go through a small service
  that draws and alerts. `backend` chooses; what is not allowed is importing `OwnerAlertsService`
  inside `modules/ai`.
- The 03:30 cron: the cleanup step and the mail flush; the 08:00 one, the mail flush.
- `frontend`: a review page (the large image beside the dish's ingredient list, the warning with
  the allergens, the two steps, discard, retry), the link from Recipes, and "Withdraw" on an image
  accepted by hand. Every new screen goes through `accessibility` and the design skill.
- `tests`: end-to-end suites for the four routes and the cleanup, with the stub.

**Floors.** Accepting against the judge is model-output and allergy validation: whoever implements
it and `invariant-reviewer` go on `opus` at `high` (`docs/reference/agent-team.md`, "Two floors
never move").

**Data.** No migration (P9).

**Infrastructure — owner actions.** Create the private store in `fra1` and connect it to the API's
project with a variable name of its own (for example `BLOB_CANDIDATES_READ_WRITE_TOKEN`), which
goes into `Env.validation.ts`, `turbo.json` and the names list. The exact name Vercel gives a
second store's variable is confirmed by `backend` on connecting it.

**Documents — the lead.** A decision record amending `0066` (§ 5's invariant, the seven days, the
private store) and, if the owner chooses names in the mail, `0071`. The pictures note in
`apps/api/AGENTS.md` and the comments in `DishPicture.service.ts` and `PictureStore.ts` change in
the same PR as the code.

**Legal.** § 10.

---

## 7. Risks

| # | What can break | To whom | Likelihood | How it would show | How to undo it |
| --- | --- | --- | --- | --- | --- |
| R1 | The owner accepts an image that really does show an allergen the dish does not have | Whoever sees that dish (confusion, IMG-2) | Low | `picture.accepted` in the Log; a count of "accepted by hand" under Images | "Withdraw" |
| R2 | A file with no C2PA is accepted | Everybody: a false legal text, art. 50.2 | Very low: it is not stored, and it is rechecked over the bytes | A test that tries to accept bytes with no manifest | "Withdraw"; tell `legal` |
| R3 | A rejected candidate stays reachable from outside | Nobody in particular; an image the judge rejected, with NutrIA's mark | Very low with a private store | A test: the route answers 404 with no admin session; the DTO carries no path | Delete the file |
| R4 | The cleanup does not run and candidates pile up | The owner (dishes that are not redrawn) | Low | The digest warns about a silent cron at 26 h; `cron_run` with the count | Run the cron by hand |
| R5 | An orphan file with no pointer | Nobody | Low | It is not visible; ≤ 227 KB, private | A manual `list()` of the store, once |
| R6 | The mail becomes noise | The owner | Medium if the provider fails in a streak | More than a couple a day | Widen the claim's window; a switch |
| R7 | The alert hook breaks `modules/ai`'s boundary | The health invariant | Low if § 6 is followed | `health-boundary.spec.ts` | — |
| R8 | Uploading the candidate lengthens a drawing that was already tight | Nobody: the drawing has 240 s of 300 | Very low | Old `drawing` rows | The upload has its own limit and its `catch` |
| R9 | The automatic retry is delayed up to 24 h past day 7 | Whoever opens that dish that day: they see the fallback plate | Certain, and small | — | It is the price of leaving no orphans |

---

## 8. Cost and effort

**Money.** All **estimated**, assuming the $10 monthly cap (`Env.validation.ts:232`) at $0.0337 an
image (`DishPicture.service.ts:23`) gives at most ~296 images drawn a month:

| Item | Ceiling | Cost |
| --- | --- | --- |
| Candidate storage | 296 × 227 KB ≈ 67 MB, and only 7 days each | < $0.002/month at $0.023/GB |
| Advanced operations (uploading a candidate; uploading on acceptance; creating the store, once) | < 600 a month | < $0.003 at $5 per million |
| `del()` | — | free |
| Viewing a candidate (a read + a function + ~0.2 MB of transfer) | dozens a month | fractions of a cent |
| Model calls | **none new** | 0 |
| **Total** | | **< $0.01 a month** |

It comes out of Vercel's Pro monthly credit (report `0003`, P5); on Hobby it would fit in what is
included (1 GB, 2,000 advanced operations). **No spend decision is needed.** Accepting by hand
**saves**: every accepted candidate avoids a retry of up to ~$0.11 (three attempts).

**Neon.** The mail's checks run at the end of a drawing or inside a cron, with the database
already awake: they add no compute hours. The cleanup is one small read and one small write a day.

**Effort**, in team-phase sizes (what moves it: how many new screens and the `opus` floor in phase
3):

| Phase | Size | The owner's time |
| --- | --- | --- |
| 1. The mail | S | 5 min: force a failure and look at the mail |
| 2. The candidate, viewing and discarding | M | ~15 min: create the store; look at the page on the iPhone |
| 3. Accepting and withdrawing | M (`opus`/`high` floor) | ~15 min: accept one, see it on the dish, withdraw it |

---

## 9. Plan

Each phase ships on its own and leaves `main` green. Order: first what needs nothing from the
owner.

**Phase 1 — The failures mail.** The `picture-failures` kind, an hourly claim, counts by reason
since the last alert, a link to the filtered list; attempted at the end of every drawing and in
both crons. No web, no Blob.
*Success*: with the stub, a failed drawing sends a mail; three in an hour send one, and the other
two go out with the next; the mail spec still has no `@`, no uuid and no sentinels. *Stop if*: the
hook cannot live outside `modules/ai` without contortions.

**Phase 2 — The candidate: store, view, discard, clean.** The private store and its stub;
`DishPictureService` uploads the last rejected one with its `extras`; `claimPicture` respects it;
the route that serves the bytes; the review page **without** an accept button; discarding
(`picture.discarded`); the retry deletes it; the cleanup in the cron. With no token, it is all off
and the product is today's.
*Success*: a judge rejection leaves exactly one private file and one pointer; the page shows it
only to an admin (404 with no session, 404 to an ordinary user); the DTO carries no Blob path; at
7 days (an injected clock) the cron deletes it and the dish becomes claimable again; an accepted
drawing leaves no candidate. *Stop if*: Vercel does not allow connecting a second store to the
project with its own variable, or the private one requires something paid.

**Phase 3 — Accepting against the judge, and withdrawing.** The accept route with its six steps,
the warning with the allergens and the catalogue ingredients, the two-step confirmation,
`picture.accepted`; "Withdraw" and `picture.removed`; "accepted by hand" under Images; `legal`'s
wording; the decision record.
*Success*: bytes with no C2PA cannot be accepted by any route (test); an acceptance that does not
repeat the allergens is refused; every `ready` with `acceptedBy: 'owner'` has its audit row (the
same transaction: a test that makes the audit fail and checks the image is not published); the
published file is byte for byte what Gemini returned; `invariant-reviewer` with no P0 or P1.
*Stop if*: `legal` concludes the override requires changing a published text the owner does not
want to change.

**Afterwards, if the owner wants it**: the image the judge never saw (Q3); the pictures key's 402
in the mail (Q5); a picture-failures line in the 08:00 digest.

---

## 10. Notes for `legal`

What `docs/legal/dish-pictures.md` needs, in `legal`'s judgement:

1. **§ 4.2 b, the live policy**: "a model running on DeepInfra checks that the image does not show
   foods the recipe does not carry". It still describes what is done, but after phase 3 a
   published image may be one that check rejected. Does it need to say that a person can review
   it? If it changes, `privacy.updated` changes.
2. **§ 5, IMG-2**: "what prevents it: the vision judge" becomes "the judge, or the owner's review
   with a warning, double confirmation and a record". Two new risks: a rejected candidate
   reachable from outside (prevented by the private store) and a file with no C2PA accepted by
   hand (prevented by the code, over the bytes).
3. **§ 4.1, the flows table**: a row for the candidates — no personal data, a private Vercel Blob
   store in `fra1`, 7 days. And the box in `go-live-checklist.md` § 0 ter: **the second store
   in `fra1` too**, or "in the European Union" stops being true for what is stored.
4. **AI Act**: a candidate only the owner sees inside the console — is that an "exposure" under
   art. 50.4-50.5? My reading is no — it is made available to nobody — but the review page titles
   it as an AI-generated image anyway. **[lawyer]** if `legal` finds it doubtful.
5. **Confirm P3**: that a file with no C2PA can never be accepted by hand under any circumstance
   is a compliance rule, not a technical preference.
6. The `picture.accepted` row carries the owner as the actor and catalogue allergen keys: no
   personal data of a third party.

---

## 11. What I do not know

**Only a measurement settles it:**

- How many images the judge rejects in production, and how many of those a second or third attempt
  fixes on its own: **unknown**. It is in the owner's console (Images, failures by reason) and in
  `recipe_image_calls`. It decides whether stopping at the first rejection is worth it (§ 4.4) and
  how much all of this will be used.
- How many judge rejections are false: **unknown** outside the pilot. Phase 2 measures it by
  itself: every candidate the owner looks at is a data point.
- Whether a second connected store's variable name is free: **a hypothesis**; checked on
  connecting it.

**Only the owner decides:**

- **Q1. The private store.** Will he create a second Blob store, private, in `fra1`? It is a write
  in Vercel and needs his explicit yes. Without it, phases 2 and 3 do not start; the alternative (a
  random prefix in the public one) I do not recommend.
- **Q2. The dish's name in the mail.** I recommend not: reasons, counts and a link. If he wants
  it, `0071`'s rule is amended with § 4.1's three conditions.
- **Q3. The image the judge never saw.** Does it become a candidate? Accepting it means deciding
  with no verdict at all, for or against. I recommend leaving it out of the first version: a retry
  costs $0.04 and the judge looks at it.
- **Q4. Withdrawing.** Is withdrawing what was accepted by hand enough (what I propose), or does
  he want to withdraw any published image, including those the judge accepted?
- **Q5. The pictures key's 402.** Does he want it in the mail, with a 6 h claim? Nobody alerts it
  today.

---

## Sources

- The code of `main` at `4aa4796`, at the paths cited.
- `docs/decisions/0004`, `0028`, `0066`, `0068`, `0071`; `docs/decisions/LOG.md` (2026-09-27,
  2026-09-29, 2026-09-30).
- `docs/legal/dish-pictures.md` §§ 1.5, 2.1, 2.3, 3.3, 4.1, 4.2, 5;
  `docs/legal/go-live-checklist.md` § 0 ter.
- `docs/projects/006-realistic-dish-pictures/PRD.md` (criteria 5 and 6) and `LOG.md` (phases 2
  and 5).
- `docs/reference/architecture/0003-dish-pictures-2026-09-26.md` (P5, § 7.1).
- Vercel, *Private Storage* (updated 2026-09-15) and *Vercel Blob Pricing* (updated 2026-09-23);
  the `@vercel/blob` 2.8.0 types installed in the repository.
