import { describe, expect, it } from 'vitest';

import { BADGE_CHANNELS, BADGE_REMOVAL_REASONS, BADGE_REMOVAL_SOURCES, PROFILE_HIDE_REASONS, RESTRICTION_SOURCES } from 'core/entities/Professional';

import { enGB } from '../../../../../i18n/dictionaries/en-GB';
import { esES } from '../../../../../i18n/dictionaries/es-ES';
import { isKey } from './isKey';

/*
 * The trail's detail for the owner's acts on a practitioner (PRD 025): closed words read
 * through a dictionary map. A word the map does not know reads as nothing, never raw.
 */
describe('isKey', () => {
  it('reads a word the map names', () => {
    expect(isKey('post', esES.adminAudit.badgeChannel)).toBe(true);
  });

  it('reads nothing from an unknown word, an inherited key or a non-string', () => {
    expect(isKey('pigeon', esES.adminAudit.badgeChannel)).toBe(false);
    expect(isKey('toString', esES.adminAudit.badgeChannel)).toBe(false);
    expect(isKey(1, esES.adminAudit.badgeChannel)).toBe(false);
    expect(isKey(undefined, esES.adminAudit.badgeChannel)).toBe(false);
  });

  /* Every closed word core can write has its words in both languages, or the row would say nothing. */
  it.each([
    ['es-ES', esES.adminAudit],
    ['en-GB', enGB.adminAudit]
  ] as const)('names every closed word core writes, in %s', (_locale, words) => {
    const pairs: readonly [readonly string[], object][] = [
      [BADGE_CHANNELS, words.badgeChannel],
      [BADGE_REMOVAL_REASONS, words.badgeRemovedReason],
      [BADGE_REMOVAL_SOURCES, words.badgeRemovedSource],
      [PROFILE_HIDE_REASONS, words.profileHiddenReason],
      [RESTRICTION_SOURCES, words.restrictionSource]
    ];

    for (const [values, map] of pairs) {
      for (const value of values) {
        expect(isKey(value, map), value).toBe(true);
      }
    }
  });
});
