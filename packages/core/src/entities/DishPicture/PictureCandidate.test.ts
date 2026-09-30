import { describe, expect, it } from 'vitest';

import { candidateFlags, pictureCandidateOf } from './PictureCandidate';
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
