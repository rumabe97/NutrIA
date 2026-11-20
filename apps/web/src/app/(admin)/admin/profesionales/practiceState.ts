import type { ProfessionalAccountView } from 'core/controllers/Professional';

/**
 * One word of a practice's state on its row. `closing` and `closeDue` carry the day:
 * the first is a close still to come; the second a close whose day has passed and
 * which the daily sweep has not carried out yet — the practice no longer opens, but it
 * is not closed until the sweep deletes it (`docs/legal/textos/06` § W bis.4).
 */
export type PracticeStateWord =
  { readonly closesAt: string; readonly kind: 'closeDue' | 'closing' } | { readonly kind: 'closed' | 'open' | 'suspended' };

/**
 * What stands on a practice, in the words its row shows (PRD 025 scope 16): suspended,
 * closing on a day, a close due and waiting for today's sweep, closed — the first with
 * either of the next two when both stand — or open when nothing does. **Closed** is
 * only an account with no practice left (`practising: false`): the API decides the
 * lift's mail on the same fact, so the word and the mail never disagree.
 */
export function practiceState(row: Pick<ProfessionalAccountView, 'practising' | 'restriction'>): readonly PracticeStateWord[] {
  const { closing, suspended } = row.restriction ?? { closing: null, suspended: null };

  if (!row.practising) {
    return [{ kind: 'closed' }];
  }

  const words: PracticeStateWord[] = [];

  if (suspended) {
    words.push({ kind: 'suspended' });
  }

  if (closing) {
    words.push({ closesAt: closing.closesAt, kind: closing.closed ? 'closeDue' : 'closing' });
  }

  return words.length > 0 ? words : [{ kind: 'open' }];
}
