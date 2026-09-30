import { describe, expect, it } from 'vitest';

import { removedAcceptedBy } from './removedAcceptedBy';

/*
 * The trail's detail for `picture.removed` (project 010): any published picture can be
 * removed now, and the row says who had accepted it. Rows written before it said so are
 * `{}`, and those say nothing.
 */
describe('removedAcceptedBy', () => {
  it('reads the two closed words', () => {
    expect(removedAcceptedBy({ acceptedBy: 'judge' })).toBe('judge');
    expect(removedAcceptedBy({ acceptedBy: 'owner' })).toBe('owner');
  });

  it('reads nothing from an older row, or from anything else in its place', () => {
    expect(removedAcceptedBy(null)).toBeNull();
    expect(removedAcceptedBy({})).toBeNull();
    expect(removedAcceptedBy({ acceptedBy: 'hand' })).toBeNull();
    expect(removedAcceptedBy({ acceptedBy: 1 })).toBeNull();
  });
});
