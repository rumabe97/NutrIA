import type { ProfessionalAccountView } from 'core/controllers/Professional';

/** One word of a practice's state on its row: `closing` carries the day it closes. */
export type PracticeStateWord = { readonly closesAt: string; readonly kind: 'closing' } | { readonly kind: 'closed' | 'open' | 'suspended' };

/**
 * What stands on a practice, in the words its row shows (PRD 025 scope 16), so
 * the owner can see a suspension or a close before phase 9 gives him the acts:
 * suspended, closing on a day, closed — both of the first two when both stand —
 * or open when nothing does. A closed practice is one with no practice left
 * (`practising: false`) or whose close was carried out.
 */
export function practiceState(row: Pick<ProfessionalAccountView, 'practising' | 'restriction'>): readonly PracticeStateWord[] {
  const { closing, suspended } = row.restriction ?? { closing: null, suspended: null };
  const words: PracticeStateWord[] = [];

  if (suspended) {
    words.push({ kind: 'suspended' });
  }

  if (!row.practising || closing?.closed) {
    words.push({ kind: 'closed' });
  } else if (closing) {
    words.push({ closesAt: closing.closesAt, kind: 'closing' });
  }

  return words.length > 0 ? words : [{ kind: 'open' }];
}
