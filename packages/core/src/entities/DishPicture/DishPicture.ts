import { z } from 'zod';

/**
 * Where a dish's picture stands (0066). `none` is a dish nobody has claimed a
 * drawing for; the other three are the stored row's `status`.
 */
export const pictureStatusSchema = z.enum(['none', 'drawing', 'ready', 'failed']);

export type PictureStatus = z.infer<typeof pictureStatusSchema>;

/** A dish's picture as the database holds it: the file's address once ready, never the file. */
export const pictureStateSchema = z.object({
  attempts: z.number().int().min(0),
  /** A `failed` row holding a rejected picture for the owner to look at (`0072`): not claimed for drawing while it does. */
  candidate: z.boolean().optional(),
  lastAttemptAt: z.date().nullable(),
  /** A `failed` row whose drawing was given back — the cap, a refused key — and may be claimed again at once. */
  released: z.boolean().optional(),
  status: pictureStatusSchema,
  url: z.string().nullable()
});

export type PictureState = z.infer<typeof pictureStateSchema>;

/**
 * What was checked on a picture's file: the C2PA manifest found or not, the judge's notes — and, on a
 * failed row, why it failed (`reason`, `released`), the candidate it holds (`candidate`,
 * `PictureCandidate`) or what a file without its manifest was (`diagnostic`, `PictureDiagnostic`).
 * On any row, what the judge answered on the dish's last drawings (`drawings`, `PictureJudgedDrawing`),
 * which every write keeps and no view reads.
 */
export type PictureProvenance = Record<string, unknown>;

/** Where a published picture is kept, in the public store: `<this>/<recipeId>/<promptVersion>-<random>.jpg`. Never a person's id. */
export const PICTURE_FOLDER = 'dish-pictures';

const PUBLISHED_PATH = new RegExp(`^${PICTURE_FOLDER}/[0-9a-f-]{36}/[A-Za-z0-9._-]+\\.jpg$`);

/** Whether a path is a published picture's: under the pictures' folder, a recipe's id, one file name. Nothing else is written or deleted there. */
export function isPublishedPicturePath(path: string): boolean {
  return PUBLISHED_PATH.test(path);
}

/**
 * The published picture's path an address names — a store URL, decoded, or
 * the path itself — or null when it is not a published picture's path at all.
 */
export function publishedPicturePathOf(address: string): string | null {
  let path = address;

  if (/^https?:\/\//i.test(address)) {
    try {
      path = decodeURIComponent(new URL(address).pathname.slice(1));
    } catch {
      return null;
    }
  }

  return isPublishedPicturePath(path) ? path : null;
}

/**
 * Whether an address is a published picture that belongs to **another**
 * recipe: a path under the pictures' folder whose recipe folder is not
 * `recipeId`. What a deletion made for one dish must never touch, whatever
 * that dish's row says its address is (invariant review of project 010,
 * phase 4). An address that is not a published picture's path at all is
 * not answered here: the store refuses it on its own.
 */
export function isAnotherRecipesPicture(address: string, recipeId: string): boolean {
  const path = publishedPicturePathOf(address);

  return path !== null && !path.startsWith(`${PICTURE_FOLDER}/${recipeId.toLowerCase()}/`);
}

/**
 * Who let a picture reach a person, when it was not the judge (`0072`): the
 * owner, by hand, against the judge's rejection. Stored as
 * `provenance.acceptedBy` on the `ready` row, beside the allergen keys that
 * were overridden (`provenance.overriddenAllergens`). A picture `judgePicture`
 * accepted carries neither.
 */
export const ACCEPTED_BY_OWNER = 'owner';

/**
 * Which of the two doors a published picture came through (`0072`), in a
 * closed word: `judge` — `judgePicture` accepted it inside a drawing — or
 * `owner` — accepted by hand against the judge. What `picture.removed` says of
 * the picture it took back (project 010, phase 4); never a name, never a path.
 */
export const PICTURE_ACCEPTED_BY = ['judge', ACCEPTED_BY_OWNER] as const;

export type PictureAcceptedBy = (typeof PICTURE_ACCEPTED_BY)[number];

/**
 * Who accepted a `ready` picture, read from the `provenance` it holds: `owner`
 * only when `provenance.acceptedBy` is `ACCEPTED_BY_OWNER` — the one mark the
 * hand's door writes — and `judge` for every other `ready` row, which is what
 * the judge's door (`completePicture`) leaves. Meaningless for a row that is
 * not `ready`; its caller asks only of one.
 */
export function pictureAcceptedByOf(provenance: PictureProvenance | null | undefined): PictureAcceptedBy {
  return provenance?.acceptedBy === ACCEPTED_BY_OWNER ? ACCEPTED_BY_OWNER : 'judge';
}

/** One paid call made for a dish's picture — an image drawn or a judgement of one. */
export const pictureCallSchema = z.object({
  costUsd: z.number().min(0),
  kind: z.enum(['image', 'judge']),
  model: z.string().min(1),
  outcome: z.string().nullable(),
  recipeId: z.uuid()
});

export type PictureCall = z.infer<typeof pictureCallSchema>;
