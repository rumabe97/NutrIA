import { describe, expect, it } from 'vitest';

import { candidateFlags, pictureAcceptanceSchema, pictureCandidateOf, repeatsExpiry, repeatsFlaggedAllergens } from './PictureCandidate';
import { pictureReasonOf } from './PictureReason';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';
const PATH = `dish-picture-candidates/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`;
const CANDIDATE = {
  extras: [{ foreignAllergens: ['crustaceans'], mappedTo: ['gambas'] }],
  model: 'google/gemini',
  path: PATH,
  promptVersion: '2.0.0'
};

/* 0072: the candidate is data inside `recipe_images.provenance` — read back through a schema, never trusted as it is. */
describe('pictureCandidateOf', () => {
  it('reads the candidate a failed row stored', () => {
    expect(pictureCandidateOf({ candidate: CANDIDATE, notes: [], reason: 'judge_allergen' })).toEqual(CANDIDATE);
  });

  it.each<[string, Record<string, unknown> | null | undefined]>([
    ['a row that stored nothing', null],
    ['no provenance', undefined],
    ['a failure with no candidate', { notes: ['1:failed:x'], reason: 'call_failed' }],
    ['a pointer with no path', { candidate: { ...CANDIDATE, path: undefined } }],
    ['a path in the public pictures’ folder', { candidate: { ...CANDIDATE, path: `dish-pictures/${RECIPE}/2.0.0-x.jpg` } }],
    ['a path that climbs out of the folder', { candidate: { ...CANDIDATE, path: `dish-picture-candidates/${RECIPE}/../../x.jpg` } }],
    ['an address instead of a path', { candidate: { ...CANDIDATE, path: 'https://store.example/dish-picture-candidates/x/y.jpg' } }],
    ['a file that is not a JPEG', { candidate: { ...CANDIDATE, path: PATH.replace('.jpg', '.png') } }],
    ['extras of the wrong shape', { candidate: { ...CANDIDATE, extras: [{ name: 'shrimp' }] } }],
    ['a candidate that is not an object', { candidate: PATH }]
  ])('answers nothing for %s', (_case, provenance) => {
    expect(pictureCandidateOf(provenance)).toBeNull();
  });

  it('drops anything else a row stored beside the closed fields — a judge’s word included', () => {
    const stored = { ...CANDIDATE, extras: [{ foreignAllergens: ['milk'], mappedTo: ['queso'], name: 'cheddar' }], url: 'https://x' };

    expect(JSON.stringify(pictureCandidateOf({ candidate: stored }))).not.toMatch(/cheddar|https/);
  });

  /* Phase 1's mail counts by `provenance.reason` and `provenance.released`: a candidate beside them changes neither. */
  it('leaves the row’s reason as it was written', () => {
    expect(pictureReasonOf({ candidate: CANDIDATE, notes: ['3:rejected:extra_allergen:x=crustaceans'], reason: 'judge_allergen' })).toBe(
      'judge_allergen'
    );
    expect(pictureReasonOf({ candidate: CANDIDATE, notes: ['3:failed:OpenRouter /images answered 503: x'] })).toBe('call_failed');
    expect(
      pictureReasonOf({
        diagnostic: { c2pa: false, contentType: 'image/png', jpeg: false, size: 10, trainedAlgorithmicMedia: false },
        reason: 'no_provenance'
      })
    ).toBe('no_provenance');
  });
});

describe('candidateFlags', () => {
  it('lists every allergen key and every catalogue slug once, sorted, so the same candidate always reads the same', () => {
    expect(
      candidateFlags({
        extras: [
          { foreignAllergens: ['milk', 'crustaceans'], mappedTo: ['queso-curado', 'gambas'] },
          { foreignAllergens: ['milk'], mappedTo: [] }
        ]
      })
    ).toEqual({ allergens: ['crustaceans', 'milk'], ingredients: ['gambas', 'queso-curado'] });
  });

  it('is empty for a candidate the judge flagged nothing on', () => {
    expect(candidateFlags({ extras: [] })).toEqual({ allergens: [], ingredients: [] });
  });
});

/* PRD 009, criterion 5: an acceptance repeats the allergens the console showed. The list is never optional, and nothing else is read. */
describe('pictureAcceptanceSchema', () => {
  const SEEN = '2026-10-06T12:00:00.000Z';

  it('takes the allergen keys — the empty list said explicitly — and the expiry the candidate was shown with', () => {
    expect(pictureAcceptanceSchema.parse({ allergens: ['crustaceans', 'milk'], expiresAt: SEEN })).toEqual({
      allergens: ['crustaceans', 'milk'],
      expiresAt: SEEN
    });
    expect(pictureAcceptanceSchema.parse({ allergens: [], expiresAt: SEEN })).toEqual({ allergens: [], expiresAt: SEEN });
    expect(pictureAcceptanceSchema.safeParse({ allergens: [], expiresAt: '2026-10-06T14:00:00+02:00' }).success).toBe(true);
  });

  it.each<[string, unknown]>([
    ['no body', undefined],
    ['a null body', null],
    ['an empty body', {}],
    ['the allergens alone, which do not say which candidate was seen', { allergens: ['crustaceans'] }],
    ['the expiry alone', { expiresAt: SEEN }],
    ['a list that is a string', { allergens: 'crustaceans', expiresAt: SEEN }],
    ['a list of something else', { allergens: [1], expiresAt: SEEN }],
    ['an empty key', { allergens: [''], expiresAt: SEEN }],
    ['a null list', { allergens: null, expiresAt: SEEN }],
    ['a flag in the place of the list', { allergens: true, expiresAt: SEEN }],
    ['an expiry that is a day and no instant', { allergens: [], expiresAt: '2026-10-06' }],
    ['an expiry with no zone', { allergens: [], expiresAt: '2026-10-06T12:00:00' }],
    ['an expiry that is a number', { allergens: [], expiresAt: 1_791_288_000_000 }],
    ['an expiry that is words', { allergens: [], expiresAt: 'next week' }],
    ['a null expiry', { allergens: [], expiresAt: null }],
    ['a key nobody asked for beside them', { allergens: [], confirmed: true, expiresAt: SEEN }],
    ['a path beside them', { allergens: [], expiresAt: SEEN, path: PATH }]
  ])('refuses %s', (_case, body) => {
    expect(pictureAcceptanceSchema.safeParse(body).success).toBe(false);
  });
});

describe('repeatsExpiry', () => {
  const expiresAt = new Date('2026-10-06T12:00:00.000Z');

  it('compares instants, however the same moment was written', () => {
    expect(repeatsExpiry('2026-10-06T12:00:00.000Z', expiresAt)).toBe(true);
    expect(repeatsExpiry('2026-10-06T12:00:00Z', expiresAt)).toBe(true);
    expect(repeatsExpiry('2026-10-06T14:00:00+02:00', expiresAt)).toBe(true);
  });

  it.each(['2026-10-06T12:00:00.001Z', '2026-10-06T11:59:59.999Z', '2026-10-07T12:00:00.000Z', 'not a date', ''])('refuses %s', shown => {
    expect(repeatsExpiry(shown, expiresAt)).toBe(false);
  });
});

describe('repeatsFlaggedAllergens', () => {
  const flagged = {
    extras: [
      { foreignAllergens: ['milk', 'crustaceans'], mappedTo: ['queso-curado', 'gambas'] },
      { foreignAllergens: ['milk'], mappedTo: [] }
    ]
  };

  it('compares as sets: the order and a repetition do not matter', () => {
    expect(repeatsFlaggedAllergens(['crustaceans', 'milk'], flagged)).toBe(true);
    expect(repeatsFlaggedAllergens(['milk', 'crustaceans', 'milk'], flagged)).toBe(true);
  });

  it.each<[string, readonly string[]]>([
    ['nothing', []],
    ['one missing', ['milk']],
    ['one extra', ['crustaceans', 'milk', 'egg']],
    ['another one', ['crustaceans', 'egg']],
    ['the right keys in another case', ['Crustaceans', 'milk']],
    ['a catalogue slug in the place of a key', ['gambas', 'milk']]
  ])('refuses %s', (_case, shown) => {
    expect(repeatsFlaggedAllergens(shown, flagged)).toBe(false);
  });

  it('needs the empty list, and only the empty list, for a candidate nothing was flagged on', () => {
    expect(repeatsFlaggedAllergens([], { extras: [] })).toBe(true);
    expect(repeatsFlaggedAllergens(['milk'], { extras: [] })).toBe(false);
  });
});
