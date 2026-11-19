/**
 * A note from a control to the view that replaces it after `router.refresh()`
 * (PRD 025 phase 8; accessibility review). The page is read again in place, with
 * no route change, so nothing announces the new view and focus falls to the
 * page: the view that arrives takes focus on its heading when the note names it,
 * and only then — a person who simply arrives at the page keeps the page's own
 * focus.
 *
 * - `practice-opened`: the opening form → the agreement's heading;
 * - `agreement-accepted`: the agreement → the workspace's `h1`;
 * - `link-widened`: the re-consent card → the link card's heading, so what is
 *   read next is the card with its new list.
 *
 * Kept in `sessionStorage` for one hand-over; storage may be refused (a private
 * window), and then the focus simply stays where it was.
 */

export type FocusHandOver = 'agreement-accepted' | 'link-widened' | 'practice-opened';

const KEY = 'nutria-focus-after-refresh';

export function markFocusAfterRefresh(what: FocusHandOver): void {
  try {
    sessionStorage.setItem(KEY, what);
  } catch {
    // Storage refused: the hand-over is a nicety, not a requirement.
  }
}

/** Whether `what` was the hand-over waiting, forgetting it as it reads it. */
export function takeFocusAfterRefresh(what: FocusHandOver): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== what) {
      return false;
    }

    sessionStorage.removeItem(KEY);

    return true;
  } catch {
    return false;
  }
}
