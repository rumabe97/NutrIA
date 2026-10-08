import { BASE_ERROR_CODES } from 'better-auth';
import { APIError, isAPIError } from 'better-auth/api';

import { record } from './PasswordPolicy.js';

import type { Context } from './PasswordPolicy.js';

const SIGN_IN = '/sign-in/email';

/**
 * Better Auth's own answer to a wrong password, the one this one must be: built
 * the way its sign-in builds it, so its body is the same bytes.
 */
function invalidEmailOrPassword(): APIError {
  return APIError.from('UNAUTHORIZED', BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
}

/**
 * An unconfirmed account's right password answered as a wrong one (PLAN 011
 * phase 8, amended, `0074`). With `requireEmailVerification` on, Better Auth
 * answers that sign-in 403 `EMAIL_NOT_VERIFIED`, and a 403 is an account: a
 * stranger who signed up somebody's address with a password of their own, then
 * signed in with it, would read 403 where the address was new and 401 where it
 * already had an account. This makes it the 401 a wrong password gets, and a
 * fresh link goes to the address in the background (`sendOnSignIn`), which
 * only its owner reads.
 *
 * Better Auth keeps the status of the error the route threw, whatever an
 * after-hook puts in its place, when the call is an HTTP request: so over HTTP
 * the hook answers the finished `Response`, built the way better-call builds a
 * thrown error's — the status, its text, `Content-Type` and the JSON body. A
 * call through `auth.api` (no request) gets the error thrown, as Better Auth
 * throws its own. The state moves as for a wrong password: the attempt was
 * counted by the brake before the route ran, and only a 2xx clears it.
 */
export function unconfirmedAsInvalid(context: Context): Response | undefined {
  const returned: unknown = context.context.returned;

  if (context.path !== SIGN_IN || !isAPIError(returned) || record(returned.body).code !== BASE_ERROR_CODES.EMAIL_NOT_VERIFIED.code) {
    return undefined;
  }

  const refusal = invalidEmailOrPassword();

  if (!(context.request instanceof Request)) {
    throw refusal;
  }

  return new Response(JSON.stringify(refusal.body), {
    headers: { 'Content-Type': 'application/json' },
    status: refusal.statusCode,
    statusText: refusal.status.toString()
  });
}
