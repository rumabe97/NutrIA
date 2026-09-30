/**
 * The id of the review page's one polite region. It exists before any press and outlives the
 * buttons, which leave the page with the picture they acted on.
 */
export const REVIEW_STATUS_ID = 'revision-estado';

/** The id of the link back to Recetas: what is left to do once the picture is gone, so where focus goes. */
export const REVIEW_BACK_ID = 'revision-volver';

/** Says `message` in the review region. */
export function sayReview(message: string): void {
  const region = document.getElementById(REVIEW_STATUS_ID);

  if (region) {
    region.textContent = message;
  }
}

/** Sends focus to the link back to Recetas. */
export function focusReviewBack(): void {
  document.getElementById(REVIEW_BACK_ID)?.focus();
}
