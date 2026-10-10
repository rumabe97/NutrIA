import { describe, expect, it } from 'vitest';

import { PICTURE_REASONS, pictureReasonOf, reasonOfCall, reasonOfRejection } from './PictureReason';

describe('pictureReasonOf', () => {
  it('trusts the reason a row was written with', () => {
    for (const reason of PICTURE_REASONS) {
      expect(pictureReasonOf({ notes: ['1:failed:whatever'], reason })).toBe(reason);
    }
  });

  /* 0072: a picture the owner took back is a failed row with a reason of its own — never read as a drawing that broke. */
  it('names the owner’s removal, and keeps `other` last', () => {
    expect(PICTURE_REASONS).toContain('owner_removed');
    expect(PICTURE_REASONS.at(-1)).toBe('other');
    expect(pictureReasonOf({ reason: 'owner_removed' })).toBe('owner_removed');
  });

  it('ignores a stored reason outside the closed set, and reads the notes instead', () => {
    expect(pictureReasonOf({ notes: ['1:unkeepable:no C2PA manifest (image/png)'], reason: 'a provider’s words' })).toBe('no_provenance');
  });

  it.each<[string, Record<string, unknown> | null | undefined, string]>([
    ['a judge rejection for an allergen', { notes: ['1:rejected:extra_allergen:shrimp=crustaceans extra_food:shrimp'] }, 'judge_allergen'],
    ['a rejection for something else', { notes: ['1:rejected:blur'] }, 'judge_rejected'],
    ['the last attempt, not the first', { notes: ['1:rejected:extra_allergen:x=y', '2:unkeepable:no C2PA manifest (image/jpeg)'] }, 'no_provenance'],
    ['a file without its manifest', { notes: ['1:unkeepable:no C2PA manifest (image/jpeg)'] }, 'no_provenance'],
    ['a provider 5xx', { notes: ['1:failed:OpenRouter /images answered 503: overloaded'] }, 'call_failed'],
    ['a timeout', { notes: ['1:failed:OpenRouter /images failed: The operation was aborted due to timeout'] }, 'call_failed'],
    ['an unreadable answer', { notes: ['1:failed:judge: The judge answered with JSON of the wrong shape'] }, 'call_failed'],
    ['a provider 4xx', { notes: ['1:failed:OpenRouter /images answered 400: blocked'] }, 'model_refused'],
    ['a 402 in a failed note', { notes: ['1:failed:OpenRouter /images answered 402: no credits'] }, 'payment_refused'],
    ['an unexpected error', { notes: ['error:database down'] }, 'other'],
    ['an error that was a provider call', { notes: ['error:OpenRouter /chat answered 500: x'] }, 'call_failed'],
    ['a row that recorded nothing', {}, 'other'],
    ['a null provenance', null, 'other'],
    ['notes that are not notes', { notes: [42, null] }, 'other']
  ])('reads %s', (_case, provenance, expected) => {
    expect(pictureReasonOf(provenance)).toBe(expected);
  });

  it.each<[string, string]>([
    ['the month’s cap is reached', 'cap_reached'],
    ['the recipe is gone', 'other'],
    ['OpenRouter /images answered 402: Key limit exceeded', 'payment_refused'],
    ['judge: OpenRouter /chat/completions answered 402: Key limit exceeded', 'payment_refused'],
    ['RESOURCE_EXHAUSTED: quota exceeded', 'payment_refused'],
    ['OpenRouter /images answered 429: Too many requests', 'rate_limited'],
    // A 429 that names a spent key is the key, not the pace: the words are read first.
    ['OpenRouter /images answered 429: Key limit exceeded', 'payment_refused'],
    ['OpenRouter /images answered 403: policy', 'model_refused']
  ])('reads a released row that says “%s” as %s', (released, expected) => {
    expect(pictureReasonOf({ released })).toBe(expected);
  });
});

describe('reasonOfCall', () => {
  it('goes by the status when it has one, and by the words only for a spent budget', () => {
    expect(reasonOfCall({ message: 'x', status: 402 })).toBe('payment_refused');
    // A pace, not an empty account: the two used to be one reason and one mail (`0094`).
    expect(reasonOfCall({ message: 'x', status: 429 })).toBe('rate_limited');
    expect(reasonOfCall({ message: 'Key limit exceeded', status: 429 })).toBe('payment_refused');
    expect(reasonOfCall({ message: 'x', status: 403 })).toBe('model_refused');
    expect(reasonOfCall({ message: 'x', status: 500 })).toBe('call_failed');
    expect(reasonOfCall({ message: 'Key limit exceeded', status: null })).toBe('payment_refused');
    expect(reasonOfCall({ message: 'unheard of', status: null })).toBe('other');
  });
});

describe('reasonOfRejection', () => {
  it('names an allergen only when the notes say the judge saw one', () => {
    expect(reasonOfRejection('extra_allergen:shrimp=crustaceans')).toBe('judge_allergen');
    expect(reasonOfRejection('plastic_cgi')).toBe('judge_rejected');
  });
});
