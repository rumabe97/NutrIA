/**
 * A console act's result carried to the page it lands on (project 025 phase 9,
 * accessibility review P1-2): lifting a close that was carried out leaves the
 * account with no practice and no restriction, so it leaves the professionals' list
 * and its own page — the result is said on the list instead, never lost in a 404.
 *
 * One hand-over in `sessionStorage`, read once by `CarriedResult`. Storage may be
 * refused (a private window): the list then simply shows no result, and the account
 * is gone from it, which says the same.
 */

const KEY = 'nutria-console-result';

export function carryResult(text: string): void {
  try {
    sessionStorage.setItem(KEY, text);
  } catch {
    // Storage refused: the list without the sentence still shows the account gone.
  }
}

export function takeCarriedResult(): string | null {
  try {
    const text = sessionStorage.getItem(KEY);

    sessionStorage.removeItem(KEY);

    return text;
  } catch {
    return null;
  }
}
