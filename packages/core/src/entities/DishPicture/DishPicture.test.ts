import { describe, expect, it } from 'vitest';

import {
  ACCEPTED_BY_OWNER,
  isAnotherRecipesPicture,
  isPublishedPicturePath,
  PICTURE_ACCEPTED_BY,
  PICTURE_FOLDER,
  pictureAcceptedByOf,
  publishedPicturePathOf
} from './DishPicture';

const RECIPE = '6b1f0c3e-6a1d-4c55-9f3a-1f2b3c4d5e6f';

/* 0072: the mark a hand-accepted picture carries. The admin reads spell it as a literal in SQL, so it may not drift. */
describe('ACCEPTED_BY_OWNER', () => {
  it('is the word the stored provenance carries', () => {
    expect(ACCEPTED_BY_OWNER).toBe('owner');
  });
});

/* Project 010, phase 4: a deletion made for one dish never touches another's file, whatever that dish's row says. */
describe('isAnotherRecipesPicture', () => {
  const OTHER = '0f0e0d0c-0b0a-4908-8706-050403020100';

  it('is true for a published path or URL under another recipe’s folder, encoded or not', () => {
    for (const address of [
      `dish-pictures/${OTHER}/2.0.0-x.jpg`,
      `https://store.example/dish-pictures/${OTHER}/2.0.0-x.jpg`,
      `https://store.example/dish-pictures%2F${OTHER}%2F2.0.0-x.jpg`
    ]) {
      expect(isAnotherRecipesPicture(address, RECIPE)).toBe(true);
    }
  });

  it('is false for the recipe’s own file, whatever the case of the id, and for what is not a published path at all', () => {
    expect(isAnotherRecipesPicture(`https://store.example/dish-pictures/${RECIPE}/2.0.0-x.jpg`, RECIPE.toUpperCase())).toBe(false);
    expect(isAnotherRecipesPicture(`dish-pictures/${RECIPE}/2.0.0-x.jpg`, RECIPE)).toBe(false);
    // Left to the store, which refuses anything that is not a dish's picture on its own.
    expect(isAnotherRecipesPicture('data:image/jpeg;base64,AAAA', RECIPE)).toBe(false);
    expect(publishedPicturePathOf('https://%zz')).toBeNull();
  });
});

/* Project 010, phase 4: what `picture.removed` says of the picture it took back — two closed words and nothing else. */
describe('pictureAcceptedByOf', () => {
  it('has two words, the owner’s being the stored mark', () => {
    expect(PICTURE_ACCEPTED_BY).toEqual(['judge', 'owner']);
  });

  it('is the owner only for the owner’s exact mark, and the judge for every other ready row', () => {
    expect(pictureAcceptedByOf({ acceptedBy: 'owner', overriddenAllergens: ['milk'] })).toBe('owner');

    for (const provenance of [null, undefined, {}, { c2pa: true, judge: [] }, { acceptedBy: 'OWNER' }, { acceptedBy: 'judge' }, { acceptedBy: 1 }]) {
      expect(pictureAcceptedByOf(provenance)).toBe('judge');
    }
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
