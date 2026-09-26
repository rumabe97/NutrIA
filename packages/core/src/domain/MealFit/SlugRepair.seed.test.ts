import { describe, expect, it } from 'vitest';

// The seed is not one of `database`'s exports; its source is read directly, for this check only.
import { INGREDIENT_SEED } from '../../../../database/src/seed/ingredients';

import { collidingSlugs, repairSlug } from './SlugRepair';

/*
 * Two seed slugs the repair reads as one food in one state would make every
 * near miss of either a guess, and one of them unreachable by name.
 */
describe('the seed catalogue under the slug repair', () => {
  const slugs = INGREDIENT_SEED.map(ingredient => ingredient.slug);

  it('has no two slugs that read the same', () => {
    expect(collidingSlugs(slugs)).toEqual([]);
  });

  it('repairs every seed slug written back as itself to itself, or to nothing', () => {
    for (const slug of slugs) {
      expect([slug, null]).toContain(repairSlug(slug, slugs));
    }
  });
});
