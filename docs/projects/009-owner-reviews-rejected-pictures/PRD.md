# PRD — Project 009: The owner reviews the pictures the judge rejected

> **Purpose**: what this project delivers and why — the product half of the contract.
> The plan must cover everything in here; the intent gate checks it.
> **Audience**: humans and agents. **Committed**: yes. **Written by**: an agent via
> `/plan-project`, from the owner's request and decisions of 2026-09-30 and the architect's
> report [`0005`](../../reference/architecture/0005-imagenes-fallidas-aviso-y-revision-a-mano-2026-09-30.md) —
> approved by the owner before the plan is written.

- **Status**: done — closed 2026-10-08 (owner's request; audit in 000-workspace/closing-audit-2026-10-08.md)
- **Roadmap item**: [`docs/ROADMAP.md`](../../ROADMAP.md) — a follow-up to
  [`006-realistic-dish-pictures`](../006-realistic-dish-pictures/) and to the failure
  reasons and manual retry of 2026-09-30 (#168), asked for by the owner on 2026-09-30

## Problem

A dish picture that fails is lost, and nobody is told.

- **Nobody is told.** The owner learns that a picture failed only by opening the
  console. If the pictures' OpenRouter key runs out of money, pictures stop being drawn
  in silence.
- **The rejected picture is thrown away.** The vision judge rejects a picture for one
  reason only: it shows a food carrying an allergen the dish does not have. The judge is
  sometimes wrong; the pilot found two false rejections. Today the bytes are discarded,
  so the owner cannot look at what was rejected. His only option is to retry, which costs
  up to 0.11 USD and may end the same way.
- **A wrong picture cannot be taken back.** No route removes a published picture.

## Outcome

- **The owner gets a mail when pictures fail.**
  - The first failure mails at once. Failures in the following hour go together in the
    next mail, so there is at most one mail an hour.
  - The mail carries reasons and counts and a link to the failed pictures. It never
    carries a dish's name (owner's decision; the rule of `0071` holds).
  - A refused payment on the pictures' key is also mailed, at most once every 6 hours
    while it lasts (owner's decision).
- **A picture the judge rejected is kept for the owner to look at.**
  - One candidate is kept per dish: the last picture the judge rejected.
  - It lives in a separate, private Vercel Blob store in `fra1` (owner's decision). It
    has no public URL, and only an admin session can see it, through the API.
  - It is kept for 7 days, the same clock as the cool-off (owner's decision). The 03:30
    cron deletes it after that, and the dish can be drawn again.
  - A picture with no C2PA manifest is never kept, shown as acceptable, or accepted.
- **The owner can look at it and decide.** A review page shows the picture large, beside
  the dish's ingredients and the allergens the judge flagged, in the catalogue's own
  words. From there he can:
  - **accept** it, in two steps, after seeing the warning. The picture is published and
    the audit log records that he overrode the judge, and for which allergens (owner's
    decision);
  - **discard** it. The file is deleted and the dish keeps waiting out its cool-off;
  - **retry**, as today. The candidate is deleted.
- **A picture he accepted by hand can be removed** (owner's decision: only those). The
  dish goes back to having no picture, and the removal is in the audit log.

## Scope

**In**

- The mail: a new owner alert for picture failures, claimed hourly, with counts by the
  closed reasons of #168, and the 6-hourly alert for a refused payment. No new cron.
- The candidate:
  - a private store, with its own environment variable and an in-memory stub for tests;
  - keeping the last rejected picture and what the judge saw: catalogue ingredient slugs
    and allergen keys, never the vision model's own words;
  - the automatic claim leaving a dish with a candidate alone until it expires;
  - the cleanup, inside the 03:30 cron.
- The console:
  - the review page;
  - its link from Recetas;
  - accept, discard and remove;
  - a count of hand-accepted pictures on Imágenes.
- The audit actions `picture.accepted`, `picture.discarded` and `picture.removed`, each
  written in the same transaction as the change.
- The record:
  - a decision amending `0066`, since "a rejected picture is never stored" stops being
    true and is restated precisely;
  - `legal`'s notes in `docs/legal/imagenes-de-platos.md`, and its checklist line for the
    second store.
- No migration: the new data fits `recipe_images.provenance` (jsonb).

**Out**

- A picture the judge never got to see (the judge failed after the drawing): it is not
  kept as a candidate in this project. A retry costs 0.04 USD and the judge looks at it.
- Keeping more than one candidate per dish, or stopping a drawing at the first rejection.
- Removing a picture the judge accepted.
- The dish's name, or any text from a model, in a mail.
- Accepting a file without a C2PA manifest, by any route.
- A line about picture failures in the 08:00 digest.

## Acceptance criteria

1. **The mail.**
   - With the stub, a failed drawing sends one mail. Three failures within an hour send
     one mail, and the other two are counted in the next.
   - The mail names reasons and counts and links to the failed pictures.
   - The mail spec still refuses an `@`, a uuid and its sentinel strings, the dish-name
     sentinel included.
   - A refused payment mails at most once in 6 hours.
   - The alert is triggered from outside `modules/ai` (the health boundary spec stays
     green).
2. **The candidate is kept, privately.**
   - A drawing that ends failed with a judge rejection leaves exactly one private file
     and one pointer.
   - A drawing the judge accepts leaves none, and a file without C2PA is never uploaded.
   - No API answer carries a Blob path or URL of a candidate.
   - The route that serves the bytes answers 404 without an admin session and to an
     ordinary account, and sends `private, no-store`.
3. **The clock.** With an injected clock, the 03:30 cron deletes a candidate older than
   7 days and the dish becomes claimable again. Before that, a view does not claim a dish
   that has a candidate. The cron records how many it deleted.
4. **Discard and retry.** Discarding deletes the file and the pointer, leaves the cool-off
   as it was and writes `picture.discarded`. A retry deletes the candidate.
5. **Accept.**
   - It needs the two steps: a request that does not repeat the allergens the console
     showed is refused.
   - The bytes are checked again for their C2PA manifest, and bytes without one cannot be
     accepted by any route (a test).
   - The published file is byte for byte the candidate.
   - The row becomes `ready` with `acceptedBy: 'owner'`, and `picture.accepted`, carrying
     the overridden allergen keys, is written in the same transaction. A test makes the
     audit write fail and checks that the picture is not published.
   - With the `dishPictures` switch off it is refused.
6. **Remove.** Only a hand-accepted picture can be removed. The public file is deleted,
   the row goes back to failed with the closed reason `owner_removed`, and
   `picture.removed` is written.
7. **Without the private store's token**, nothing is kept and the product behaves exactly
   as today. The mail of criterion 1 works regardless.
8. **The invariant is written down.** A picture reaches a person only through the judge's
   acceptance, or through the owner's recorded override after seeing the warning, and in
   both cases with its C2PA manifest. No retry, cron or automatic code publishes a
   candidate. The decision record, `apps/api/AGENTS.md` and the code comments say so.
9. **Across the project.**
   - Every new route is `@Roles('admin')` and gives a 404 before validation.
   - Nothing about a person appears anywhere (`0028`).
   - `legal` has updated its notes.
   - `accessibility` passes the review page at 320, 390 and 1280 px in both themes.
   - `invariant-reviewer` finds no P0 or P1 on the accept phase, which runs at opus/high.
   - The workspace gate is green at every phase boundary.
   - The owner's cost stays under 0.01 USD a month, with no new cron and no migration.

## Open questions

- None for the owner. His decisions of 2026-09-30:
  - **Mail:** immediate and grouped, at most one an hour, and without the dish's name.
  - **Retention:** 7 days.
  - **Allergen rejections:** acceptable by hand, with a warning, two steps and an audit
    row.
  - **Storage:** a private store, which he creates when phase 2 starts.
  - **Removal:** hand-accepted pictures only.
  - **Refused payment:** mailed.
- For `legal`, inside the plan: whether the privacy policy's sentence about the judge
  checking the picture needs to mention the owner's review (report `0005` § 10).
