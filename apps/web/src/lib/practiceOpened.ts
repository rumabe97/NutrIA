/**
 * A note from the opening form to the agreement that replaces it (PRD 025,
 * `PracticeOpen` → `PracticeAgreement`). The page is read again in place, with
 * no route change, so nothing announces the new view: the agreement takes focus
 * on its heading when this note is there, and only then — a practitioner who
 * simply arrives at `/consulta` to accept a new version keeps the page's own
 * focus. Kept in `sessionStorage` for one hand-over; storage may be refused (a
 * private window), and then the focus simply stays where it was.
 */

const KEY = 'nutria-practice-opened';

export function markPracticeOpened(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage refused: the hand-over is a nicety, not a requirement.
  }
}

/** Whether the opening form just handed over, forgetting the note as it reads it. */
export function takePracticeOpened(): boolean {
  try {
    const opened = sessionStorage.getItem(KEY) === '1';

    sessionStorage.removeItem(KEY);

    return opened;
  } catch {
    return false;
  }
}
