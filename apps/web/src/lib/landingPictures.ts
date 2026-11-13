/**
 * The dish pictures the landing page's hero shows — none until the owner has chosen them
 * (project 024 phase 7, `docs/legal/2026-11-11-redesign.md` § 2.8).
 *
 * Each one must be, before it is written here:
 *
 * - a dish's current, **published** picture, accepted by the judge — never one accepted by hand
 *   (§ 2.8 P1);
 * - of a `seed` or `ai` dish, never a `user` one (P2);
 * - looked at by the owner **beside its ingredient list**: no food the list lacks, no person,
 *   hand, face, brand, logo or legible text (P3);
 * - recorded by its recipe id in the project's `LOG.md` (P5), so a withdrawal in the console can
 *   find it and remove it here in the next deploy (P6).
 *
 * `path` is the address the API stores, used untouched: the file is served exactly as it was
 * made, so its C2PA record survives (B1–B3). The tiles carry no name, so the same three serve
 * both languages (P4).
 *
 * `light` is the one exception to "served as made" (`docs/legal/2026-11-13-lighter-landing-pictures.md`,
 * conditions M1–M9; decision `0066`, exception of 2026-11-13): a copy of the same picture for a
 * phone, where the original made the page's largest paint arrive in five seconds. It is the
 * original scaled to 720 px wide and re-encoded (JPEG quality 72, mozjpeg, progressive) — no
 * other edit — carrying the IPTC `trainedAlgorithmicMedia` field in its XMP and no C2PA
 * segment, since Google's manifest does not describe these bytes. The owner checked each copy
 * for SynthID in the Gemini app on 2026-11-13: detected in all three. Each entry records both
 * files' SHA-256 (`landingPictures.test.ts` checks the copy's); a copy is referenced from here
 * and nowhere else, and a withdrawal removes the entry **and** the file in `public/landing/`.
 *
 * At most three (PLAN phase 7 step 1): the first is requested at once with its dimensions, the
 * others when they are near.
 */
export interface LandingPicture {
  /** The lighter copy a phone is given: its path on this site, its hash, and the original's. */
  readonly light: { readonly originalSha256: string; readonly path: string; readonly sha256: string };
  /** The picture's address as the API stores it: an absolute Blob URL. */
  readonly path: string;
  /** The recipe the picture belongs to, for the record and for a withdrawal. Never shown. */
  readonly recipeId: string;
}

export const LANDING_PICTURES_MAX = 3;

/*
 * Chosen on 2026-11-13 (LOG.md, project 024): each accepted by the judge with no note and no
 * extra food, 5/5 for realism and sharpness, one dish, nothing that is not food; looked at
 * beside its ingredient list.
 */
export const LANDING_PICTURES: readonly LandingPicture[] = [
  // Salteado de gambas y edamame al jengibre con arroz basmati (seed)
  {
    light: {
      originalSha256: 'dafebf17ca1e6ca93de3ec3406189aa9b6b76973f579bd5b5fbe4f2505d6a999',
      path: '/landing/e03c398a-30a2-40f1-a8a8-e7f7fef6acaa.jpg',
      sha256: '6647c4657f29e47447262cf77a6226ba0304a4234eba602b248b0e75c0566730'
    },
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/e03c398a-30a2-40f1-a8a8-e7f7fef6acaa/2.0.0-228b005e-eaa8-41f3-84cb-36c82dcfdc33.jpg',
    recipeId: 'e03c398a-30a2-40f1-a8a8-e7f7fef6acaa'
  },
  // Tortilla de patatas y pimientos del piquillo con ensalada verde (seed)
  {
    light: {
      originalSha256: 'e3c5320f03c998213ec970987f17da581d31dfe6d4abf3940c7e2e8f5ca0afc7',
      path: '/landing/e16f6175-0918-48fc-8af8-841115bc5c12.jpg',
      sha256: '64e3e84dc07e92b2838c23d7371a94d6ddb03967592623d971472dac89e47c09'
    },
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/e16f6175-0918-48fc-8af8-841115bc5c12/2.0.1-6299b5d4-f627-4527-a2f9-f51f04414c51.jpg',
    recipeId: 'e16f6175-0918-48fc-8af8-841115bc5c12'
  },
  // Copa de Yogur Proteico con Granada y Nueces (ai)
  {
    light: {
      originalSha256: '387fbcec71a7c5f29fafdc8f29f79c942be230044639bb7df8188a47aa7c2a36',
      path: '/landing/6e12e063-9bb2-4fec-be80-73b8944e7b9a.jpg',
      sha256: '1a41b107d1f278c3f1563561cba9b295cf4d22d9a3c7efb1ac3cdf93533bb2c3'
    },
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/6e12e063-9bb2-4fec-be80-73b8944e7b9a/2.0.1-47eb61ad-287f-4051-8d3e-b3f2d1a629d0.jpg',
    recipeId: '6e12e063-9bb2-4fec-be80-73b8944e7b9a'
  }
];
