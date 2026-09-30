import { ApiError } from './api';

import type { ApiErrorCode } from './api';

/**
 * How the console answers an acceptance or a removal of a dish's picture that the API
 * turned down (`0072`):
 *
 * - `stale`: the page is out of date — the picture changed, went, or is no longer what the
 *   page took it for. Nothing was done; the page says so and reads itself again. It never
 *   asks again with what it reads then: the owner looks first.
 * - `tooMany`: the hourly limit.
 * - `other`: anything else, said in the dialog, which stays as it was.
 */
export type PictureRefusal = 'other' | 'stale' | 'tooMany';

/** The codes that mean the review page no longer shows what is stored, for an acceptance. */
export const ACCEPT_STALE: readonly ApiErrorCode[] = ['PICTURE_ALLERGENS_MISMATCH', 'PICTURE_NO_CANDIDATE'];

/** The same for a removal: the picture is not one accepted by hand any more. */
export const REMOVE_STALE: readonly ApiErrorCode[] = ['PICTURE_NOT_REMOVABLE'];

/** Which answer `error` gets. A recipe that is gone (404) is a stale page too. */
export function pictureRefusal(error: unknown, stale: readonly ApiErrorCode[]): PictureRefusal {
  if (!(error instanceof ApiError)) {
    return 'other';
  }

  if (error.status === 429) {
    return 'tooMany';
  }

  return error.status === 404 || stale.includes(error.code) ? 'stale' : 'other';
}
