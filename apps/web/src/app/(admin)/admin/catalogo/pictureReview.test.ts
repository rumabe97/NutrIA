import { describe, expect, it } from 'vitest';

import { pictureReview } from './pictureReview';

import type { CatalogueRecipeView } from 'core/controllers/Admin';

const CANDIDATE = { allergens: ['gluten'], expiresAt: '2026-10-07T12:00:00.000Z', ingredients: [{ name: 'Pan', slug: 'bread' }] };

function recipe(overrides: Partial<Pick<CatalogueRecipeView, 'picture' | 'pictureAcceptedByHand' | 'pictureCandidate'>>) {
  return { picture: 'none' as const, pictureAcceptedByHand: false, pictureCandidate: null, ...overrides };
}

/*
 * Which dishes have a review page with something on it (project 010, phase 4): the rejected
 * picture waiting for the owner, and — now — every published picture, whoever accepted it,
 * because any of them can be removed.
 */
describe('pictureReview', () => {
  it('opens a picture the judge accepted, which can now be removed', () => {
    expect(pictureReview(recipe({ picture: 'ready' }))).toBe('byJudge');
  });

  it('opens a picture the owner accepted by hand, as before', () => {
    expect(pictureReview(recipe({ picture: 'ready', pictureAcceptedByHand: true }))).toBe('byHand');
  });

  it('opens a rejected picture waiting for the owner, as before', () => {
    expect(pictureReview(recipe({ picture: 'failed', pictureCandidate: CANDIDATE }))).toBe('candidate');
  });

  it('has nothing for a dish with no published picture and nothing waiting', () => {
    expect(pictureReview(recipe({ picture: 'none' }))).toBeNull();
    expect(pictureReview(recipe({ picture: 'drawing' }))).toBeNull();
    expect(pictureReview(recipe({ picture: 'failed' }))).toBeNull();
  });

  it('never reads the hand-accepted flag without a published picture', () => {
    expect(pictureReview(recipe({ picture: 'none', pictureAcceptedByHand: true }))).toBeNull();
    expect(pictureReview(recipe({ picture: 'failed', pictureAcceptedByHand: true }))).toBeNull();
  });
});
