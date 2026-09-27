# 0066 — Draw a photograph-like picture of a dish the first time it is viewed, keep it in Vercel Blob

- **Status**: accepted
- **Date**: 2026-09-27
- **Project**: docs/projects/006-realistic-dish-pictures
- **Supersedes**: [`0010`](./0010-illustrate-recipes-not-photograph-them.md)

## Context

`0010` illustrated recipes rather than photographing them, kept the bytes in Postgres and
drew every new dish after its plan. The illustrator was never switched on in production. Three
things changed.

- **The owner wants realistic pictures.** They must be true to the recipe, sharp, and not
  plastic.
- **The no-training rule** ([`0064`](./0064-generation-runs-on-paid-no-training-models-through-openrouter.md))
  now covers every model call. The illustrator's direct Google client cannot be restricted
  to endpoints that keep nothing.
- **Report [`0003`](../reference/architecture/0003-imagenes-de-platos-2026-09-26.md)
  measured the costs of the old design.**
  - Drawing every new dish per plan costs about 0.70–1.10 $, which is ~100× the plan's
    text.
  - Neon's free plan holds 0.5 GB and blocks writes when full.

Two pilots on 2026-09-27 (20 dishes × 3 models, then 8 dishes, 2.59 $ in total, owner
scoring blind on an iPhone) settled the model and the prompt. The `legal` review
([`docs/legal/imagenes-de-platos.md`](../legal/imagenes-de-platos.md)) settled the marking.

## Decision

- **Model.** Gemini 3.1 Flash Lite Image (`google/gemini-3.1-flash-lite-image`) through
  OpenRouter.
  - It is pinned to `google-vertex/global` with `data_collection: deny`, `zdr` and no
    fallbacks.
  - It is the only image model; on failure the dish waits and is tried again later.
  - It takes ~4.5 s a picture, 0.0337 $ a picture, and 1K is the only resolution Vertex
    accepts. It had 0 failures in 20, and the owner's mean was 4.0–4.5.
- **When.** A picture is drawn the first time anyone opens the dish's meal page, in the
  background, and deduplicated. It is stored once and shown to every later viewer. There
  is no drawing after a plan and no backfill.
- **Prompt v1 from the pilot.** It is built from recipe data only:
  - ingredients ordered by weight;
  - seasonings, oil and liquids are described as cooked in and never as visible items;
  - sharp focus across the plate, no blur, not a render;
  - one plate, centred with a margin, in a 4:3 frame.
- **Judge.** A vision judge on DeepInfra, with zero retention, names the foods it sees.
  - The picture is rejected only for a clearly visible extra food that the judge names
    specifically and that carries an allergen the dish lacks.
  - Allergens are mapped in code from the named food through the ingredient catalogue,
    never taken from the judge's own list.
  - Everything else is recorded as a note.
- **Storage.** The file Gemini returns is kept untouched in Vercel Blob (region fra1): a
  JPEG of about 170 KB carrying Google's signed C2PA manifest and IPTC
  `trainedAlgorithmicMedia`.
  - It is never re-encoded: any re-encode breaks the C2PA hash binding.
  - Crops are done in CSS.
  - Postgres keeps only the URL and the provenance.
- **Label.** A visible "IA" mark on every picture (dashboard card and meal page) with an
  accessible name, and the meal-page caption, in the strings `legal` set.
- **Budget.** A spend counter in the database stops image calls at 10 $ a calendar month.
  The picture's key is a separate OpenRouter key.
- **Rollout.** Behind a database flag, off by default.

## Alternatives considered

- **MAI-Image-2.6 as principal or fallback.** It had the owner's best mean when it
  answered, but 2 of 20 calls returned no image and it took ~24 s. Microsoft documents no
  C2PA or watermark for 2.6, so NutrIA would have to mark it itself.
- **Seedream 5.0 Pro.** It had the lowest score, was the slowest and was the most
  expensive.
- **A smaller or lighter file.** Vertex bills 1K only. A 512-, 768- or 1200-px copy looked
  the same to the owner, but re-encoding strips the C2PA marking that art. 50.2 asks for.
- **Prompt v2** (bigger plate, side light, sauce sheen). The owner scored it no better,
  and the card crop cuts the plate rim.
- **Drawing after every plan (`0010`).** It costs ~100× the plan's text, mostly for dishes
  nobody opens.
- **Keeping bytes in Postgres (`0010`).** Neon's 0.5 GB limit would block plan writes
  once full.

## Consequences

- `recipe_images` stops holding bytes. The old route and the post-plan and cron drawing
  paths go away.
- A dish's first viewer sees the placeholder for a few seconds.
- The product depends on Vercel Blob and on the owner's OpenRouter account allowing
  Google Vertex.
- The privacy policy and terms change before the flag goes on (`legal`).
