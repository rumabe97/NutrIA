import { z } from 'zod';

import type { PictureProvenance } from './DishPicture';

/** Where a candidate's file is kept, in the private store: `<this>/<recipeId>/<promptVersion>-<random>.jpg`. */
export const PICTURE_CANDIDATE_FOLDER = 'dish-picture-candidates';

const CANDIDATE_PATH = new RegExp(`^${PICTURE_CANDIDATE_FOLDER}/[0-9a-f-]{36}/[A-Za-z0-9._-]+\\.jpg$`);

/** Whether a path is a candidate's: under the candidates' folder, a recipe's id, one file name. Nothing else is fetched or deleted. */
export function isPictureCandidatePath(path: string): boolean {
  return CANDIDATE_PATH.test(path);
}

/**
 * A food the judge saw that the dish does not have, in our own closed words:
 * the allergen keys the dish lacks and the catalogue slugs the name was mapped
 * to. Never the name the vision model wrote — that is a third party's text,
 * and it reaches no row the console reads.
 */
export const pictureCandidateExtraSchema = z.object({ foreignAllergens: z.array(z.string().min(1)), mappedTo: z.array(z.string().min(1)) });

export type PictureCandidateExtra = z.infer<typeof pictureCandidateExtraSchema>;

/**
 * The one picture a failed dish may hold for the owner to look at (`0072`):
 * the last one the judge rejected, which carried its C2PA manifest. It lives in
 * `recipe_images.provenance.candidate` — no state and no column of its own —
 * and only on a `failed` row that was not given back.
 *
 * `path` is the file's place in the private store. It is read by the API to
 * fetch or delete the file and **never leaves it**: no view, no answer and no
 * message carries it. A path that is not under the candidates' folder is not a
 * candidate's, whatever the row says.
 */
export const pictureCandidateSchema = z.object({
  extras: z.array(pictureCandidateExtraSchema),
  /** What drew it, for the day it is published by hand. */
  model: z.string().min(1),
  path: z.string().regex(CANDIDATE_PATH),
  /** The prompt it was drawn from — not the one current when somebody looks at it. */
  promptVersion: z.string().min(1)
});

export type PictureCandidate = z.infer<typeof pictureCandidateSchema>;

/**
 * What a file without its C2PA manifest was, since the file itself is never
 * kept (`0072`): a closed diagnostic, so a provider that stops signing can be
 * told from one that answers in another format.
 */
export type PictureDiagnostic = {
  readonly c2pa: boolean;
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly jpeg: boolean;
  readonly size: number;
  readonly trainedAlgorithmicMedia: boolean;
};

/** The candidate a row stored, or null: for a row with none, and for one whose pointer is not a candidate's. */
export function pictureCandidateOf(provenance: PictureProvenance | null | undefined): PictureCandidate | null {
  if (provenance === null || provenance === undefined || typeof provenance !== 'object') {
    return null;
  }

  const parsed = pictureCandidateSchema.safeParse(provenance.candidate);

  return parsed.success ? parsed.data : null;
}

function distinct(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

/**
 * What the owner is shown of a candidate, and what an acceptance must repeat:
 * every allergen key the judge flagged and every catalogue slug it mapped a
 * flagged food to, each once, sorted — so the same candidate always reads the same.
 */
export function candidateFlags(candidate: Pick<PictureCandidate, 'extras'>): {
  readonly allergens: readonly string[];
  readonly ingredients: readonly string[];
} {
  return {
    allergens: distinct(candidate.extras.flatMap(extra => extra.foreignAllergens)),
    ingredients: distinct(candidate.extras.flatMap(extra => extra.mappedTo))
  };
}
