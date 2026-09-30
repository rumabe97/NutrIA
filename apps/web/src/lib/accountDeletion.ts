import { ApiError } from './api';

/**
 * Where "sign out and sign in again" sends somebody whose deletion was refused: the sign-in
 * page, told to come back to the profile. `SignInForm` and `SocialSignIn` both honour
 * `siguiente`, and the proxy moves an English reader to `/en/acceder` with the query intact.
 */
export const SIGN_IN_AGAIN_PATH = `/acceder?siguiente=${encodeURIComponent('/perfil')}`;

/**
 * How the profile answers a deletion the API turned down:
 *
 * - `signInAgain`: the session is too old to delete an account with (Better Auth wants one
 *   started within the last day). Nothing was deleted; signing in again is the way through,
 *   so the screen says why and offers exactly that.
 * - `other`: anything else — today's generic message, and the dialog stays as it was.
 *
 * Only the code decides, never the status or the message: the API keeps the code stable.
 */
export type DeletionRefusal = 'other' | 'signInAgain';

export function deletionRefusal(error: unknown): DeletionRefusal {
  return error instanceof ApiError && error.code === 'REAUTHENTICATION_REQUIRED' ? 'signInAgain' : 'other';
}
