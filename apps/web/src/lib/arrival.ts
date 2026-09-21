const KEY = 'nutria:arriving';

/**
 * A note left in this tab before it goes to a provider and comes back signed in.
 *
 * The password form runs its after-sign-in steps itself, because it is still on
 * the page when the session starts. A tab that left for Google comes back to a
 * different screen with nothing to say it has just arrived — except this.
 * `sessionStorage` because it belongs to the tab and outlives the round trip,
 * and nothing else does both. Without it nothing breaks: the steps are skipped.
 */
export function markArrival(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Private mode, or storage switched off.
  }
}

/** True once per arrival: reading the note removes it. */
export function takeArrival(): boolean {
  try {
    const arriving = sessionStorage.getItem(KEY) !== null;

    sessionStorage.removeItem(KEY);

    return arriving;
  } catch {
    return false;
  }
}
