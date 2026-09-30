import { describe, expect, it } from 'vitest';

import { ApiError, messageFor } from './api';
import { deletionRefusal, SIGN_IN_AGAIN_PATH } from './accountDeletion';
import { enGB } from '../i18n/dictionaries/en-GB';
import { esES } from '../i18n/dictionaries/es-ES';
import { ownPath } from './ownPath';

import type { ApiErrorCode } from './api';

function refused(code: ApiErrorCode, status: number): ApiError {
  return new ApiError(code, 'machine text', status);
}

/*
 * Better Auth deletes an account only from a session started within the last day. The API
 * answers an older one with 409 `REAUTHENTICATION_REQUIRED` — nothing deleted — and the
 * profile must then say why and offer to sign in again, not "something went wrong".
 */
describe('deletionRefusal', () => {
  it('asks to sign in again when the session is too old to delete with', () => {
    expect(deletionRefusal(refused('REAUTHENTICATION_REQUIRED', 409))).toBe('signInAgain');
  });

  it('decides on the code, not the status', () => {
    expect(deletionRefusal(refused('REAUTHENTICATION_REQUIRED', 403))).toBe('signInAgain');
    expect(deletionRefusal(refused('CONFLICT', 409))).toBe('other');
  });

  it('leaves every other failure to the generic message, as before', () => {
    expect(deletionRefusal(refused('INTERNAL_ERROR', 500))).toBe('other');
    expect(deletionRefusal(refused('NOT_FOUND', 404))).toBe('other');
    expect(deletionRefusal(refused('NETWORK', 0))).toBe('other');
    expect(deletionRefusal(new Error('boom'))).toBe('other');
    expect(deletionRefusal(undefined)).toBe('other');
  });
});

describe('SIGN_IN_AGAIN_PATH', () => {
  it('goes to sign-in and names the profile as where to come back to', () => {
    const url = new URL(SIGN_IN_AGAIN_PATH, 'http://nutria.invalid');

    expect(url.pathname).toBe('/acceder');
    expect(url.searchParams.get('siguiente')).toBe('/perfil');
  });

  it('is a return path the sign-in form accepts', () => {
    const next = new URL(SIGN_IN_AGAIN_PATH, 'http://nutria.invalid').searchParams.get('siguiente') ?? undefined;

    expect(ownPath(next, '/inicio')).toBe('/perfil');
  });
});

describe('messageFor', () => {
  it('has copy for REAUTHENTICATION_REQUIRED in both languages', () => {
    const error = refused('REAUTHENTICATION_REQUIRED', 409);

    expect(messageFor(error, esES)).toBe(esES.errors.reauthenticationRequired);
    expect(messageFor(error, enGB)).toBe(enGB.errors.reauthenticationRequired);
  });

  it('keeps today’s copy for a server failure', () => {
    expect(messageFor(refused('INTERNAL_ERROR', 500), esES)).toBe(esES.errors.internal);
    expect(messageFor(new Error('boom'), esES)).toBe(esES.errors.internal);
  });

  it('still says something for a code this build does not know', () => {
    // The API now answers other Better Auth refusals as `AUTH_<CODE>`; an unknown code must not become an empty alert.
    const unknown = new ApiError('AUTH_SOMETHING_NEW' as ApiErrorCode, 'machine text', 400);

    expect(messageFor(unknown, esES)).toBe(esES.errors.request);
  });
});
