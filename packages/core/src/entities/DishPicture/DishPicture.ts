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
 */
export type PictureProvenance = Record<string, unknown>;

/** One paid call made for a dish's picture — an image drawn or a judgement of one. */
export const pictureCallSchema = z.object({
  costUsd: z.number().min(0),
  kind: z.enum(['image', 'judge']),
  model: z.string().min(1),
  outcome: z.string().nullable(),
  recipeId: z.uuid()
});

export type PictureCall = z.infer<typeof pictureCallSchema>;
