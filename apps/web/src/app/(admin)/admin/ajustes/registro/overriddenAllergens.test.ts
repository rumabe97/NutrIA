import { describe, expect, it } from 'vitest';

import { overriddenAllergens } from './overriddenAllergens';

/*
 * The trail's detail for `picture.accepted` (`0072`): which allergens the judge had flagged
 * when the owner published the picture anyway. "None flagged" and "the row does not say"
 * are different things, and only the first may be written as words.
 */
describe('overriddenAllergens', () => {
  it('reads the keys the row stores', () => {
    expect(overriddenAllergens({ allergens: ['crustaceans', 'milk'] })).toEqual(['crustaceans', 'milk']);
  });

  it('reads an empty list as none flagged, not as a row that says nothing', () => {
    expect(overriddenAllergens({ allergens: [] })).toEqual([]);
  });

  it('reads nothing from a row without the list, or with anything else in its place', () => {
    expect(overriddenAllergens(null)).toBeNull();
    expect(overriddenAllergens({})).toBeNull();
    expect(overriddenAllergens({ allergens: 'milk' })).toBeNull();
    expect(overriddenAllergens({ allergens: ['milk', 3] })).toBeNull();
  });
});
