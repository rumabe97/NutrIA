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

export const LANDING_PICTURES: readonly LandingPicture[] = [];
