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
 * At most three (PLAN phase 7 step 1): the first is requested at once with its dimensions, the
 * others when they are near.
 */
export interface LandingPicture {
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
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/e03c398a-30a2-40f1-a8a8-e7f7fef6acaa/2.0.0-228b005e-eaa8-41f3-84cb-36c82dcfdc33.jpg',
    recipeId: 'e03c398a-30a2-40f1-a8a8-e7f7fef6acaa'
  },
  // Tortilla de patatas y pimientos del piquillo con ensalada verde (seed)
  {
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/e16f6175-0918-48fc-8af8-841115bc5c12/2.0.1-6299b5d4-f627-4527-a2f9-f51f04414c51.jpg',
    recipeId: 'e16f6175-0918-48fc-8af8-841115bc5c12'
  },
  // Copa de Yogur Proteico con Granada y Nueces (ai)
  {
    path: 'https://whugf3droedhum8f.public.blob.vercel-storage.com/dish-pictures/6e12e063-9bb2-4fec-be80-73b8944e7b9a/2.0.1-47eb61ad-287f-4051-8d3e-b3f2d1a629d0.jpg',
    recipeId: '6e12e063-9bb2-4fec-be80-73b8944e7b9a'
  }
];
