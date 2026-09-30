/**
 * The id of the page's one polite region for picture retries. It sits outside the table and
 * exists before any click, so a screen reader hears what is written into it; a region that
 * appears already holding its text, inside a row that may vanish, is skipped or lost.
 */
export const RETRY_STATUS_ID = 'reintento-estado';

/** Says `message` in the retry region, or empties it. */
export function sayRetry(message: string): void {
  const region = document.getElementById(RETRY_STATUS_ID);

  if (region) {
    region.textContent = message;
  }
}
