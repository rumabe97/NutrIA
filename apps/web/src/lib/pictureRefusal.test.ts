import { describe, expect, it } from 'vitest';

import { ACCEPT_STALE, pictureRefusal, REMOVE_STALE } from './pictureRefusal';
import { ApiError } from './api';

import type { ApiErrorCode } from './api';

function refused(code: ApiErrorCode, status = 409): ApiError {
  return new ApiError(code, 'machine text', status);
}

/*
 * The owner accepts a picture against the judge after seeing which allergens it flagged
 * (`0072`). A refusal that means "what you saw is not what is stored" must end in the page
 * being read again by the owner — never in a second request.
 */
describe('pictureRefusal', () => {
  it('takes a candidate that changed or went as a stale page, for an acceptance', () => {
    expect(pictureRefusal(refused('PICTURE_ALLERGENS_MISMATCH'), ACCEPT_STALE)).toBe('stale');
    expect(pictureRefusal(refused('PICTURE_NO_CANDIDATE'), ACCEPT_STALE)).toBe('stale');
  });

  it('takes a picture that is no longer accepted by hand as a stale page, for a removal', () => {
    expect(pictureRefusal(refused('PICTURE_NOT_REMOVABLE'), REMOVE_STALE)).toBe('stale');
  });

  it('keeps each action to its own codes', () => {
    expect(pictureRefusal(refused('PICTURE_NOT_REMOVABLE'), ACCEPT_STALE)).toBe('other');
    expect(pictureRefusal(refused('PICTURE_NO_CANDIDATE'), REMOVE_STALE)).toBe('other');
  });

  it('takes a recipe that is gone as a stale page', () => {
    expect(pictureRefusal(refused('NOT_FOUND', 404), ACCEPT_STALE)).toBe('stale');
    expect(pictureRefusal(refused('NOT_FOUND', 404), REMOVE_STALE)).toBe('stale');
  });

  it('says the hourly limit apart', () => {
    expect(pictureRefusal(refused('REQUEST_ERROR', 429), ACCEPT_STALE)).toBe('tooMany');
  });

  it('leaves every other refusal in the dialog: the switch off, a store missing, a file that cannot be accepted', () => {
    for (const code of ['PICTURE_FLAG_OFF', 'PICTURE_UNAVAILABLE', 'PICTURE_NOT_ACCEPTABLE', 'INVALID_INPUT', 'INTERNAL_ERROR', 'NETWORK'] as const) {
      expect(pictureRefusal(refused(code), ACCEPT_STALE)).toBe('other');
    }
  });

  it('takes anything that is not an API error as any other failure', () => {
    expect(pictureRefusal(new Error('boom'), ACCEPT_STALE)).toBe('other');
    expect(pictureRefusal(undefined, REMOVE_STALE)).toBe('other');
  });
});
