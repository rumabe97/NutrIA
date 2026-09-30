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
 * Who let a picture reach a person, when it was not the judge (`0072`): the
 * owner, by hand, against the judge's rejection. Stored as
 * `provenance.acceptedBy` on the `ready` row, beside the allergen keys that
 * were overridden (`provenance.overriddenAllergens`). A picture `judgePicture`
 * accepted carries neither.
 */
export const ACCEPTED_BY_OWNER = 'owner';

/** One paid call made for a dish's picture — an image drawn or a judgement of one. */
export const pictureCallSchema = z.object({
  costUsd: z.number().min(0),
  kind: z.enum(['image', 'judge']),
  model: z.string().min(1),
  outcome: z.string().nullable(),
  recipeId: z.uuid()
});

export type PictureCall = z.infer<typeof pictureCallSchema>;
