import { describe, expect, it } from 'vitest';

import { ACCEPTED_BY_OWNER, isPublishedPicturePath, PICTURE_FOLDER } from './DishPicture';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';

/* 0072: the mark a hand-accepted picture carries. The admin reads spell it as a literal in SQL, so it may not drift. */
describe('ACCEPTED_BY_OWNER', () => {
  it('is the word the stored provenance carries', () => {
    expect(ACCEPTED_BY_OWNER).toBe('owner');
  });
});

describe('isPublishedPicturePath', () => {
  it('takes a recipe’s folder under the pictures’ and one file name', () => {
    expect(PICTURE_FOLDER).toBe('dish-pictures');
    expect(isPublishedPicturePath(`dish-pictures/${RECIPE}/2.0.0-0b7e3f2a-5c1d-4e8f-9a6b-7c8d9e0f1a2b.jpg`)).toBe(true);
  });

  it.each([
    `dish-picture-candidates/${RECIPE}/2.0.0-x.jpg`,
    `dish-pictures/${RECIPE}/../other/2.0.0-x.jpg`,
    `dish-pictures/${RECIPE}/nested/2.0.0-x.jpg`,
    `dish-pictures/not-a-recipe/2.0.0-x.jpg`,
    `dish-pictures/${RECIPE}/2.0.0-x.png`,
    `https://store.example/dish-pictures/${RECIPE}/2.0.0-x.jpg`,
    ''
  ])('refuses %s', path => {
    expect(isPublishedPicturePath(path)).toBe(false);
  });
});
