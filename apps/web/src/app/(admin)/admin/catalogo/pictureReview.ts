import type { CatalogueRecipeView } from 'core/controllers/Admin';

/**
 * What a dish's picture review page (`/admin/catalogo/[id]/imagen`) has to show, and so
 * whether Recetas links to it:
 *
 * - `candidate`: a picture the judge rejected, waiting for the owner (`0072`): accept,
 *   discard or retry.
 * - `byHand` / `byJudge`: a published picture, accepted by the owner against the judge or by
 *   the judge itself. Either can be removed ("Retirar", project 010).
 * - `null`: nothing to look at. The page says so and Recetas draws no link.
 *
 * A candidate is read first, as the page always has: it only exists on a dish whose picture
 * failed, so it never hides a published one.
 */
export type PictureReview = 'byHand' | 'byJudge' | 'candidate';

export function pictureReview(recipe: Pick<CatalogueRecipeView, 'picture' | 'pictureAcceptedByHand' | 'pictureCandidate'>): PictureReview | null {
  if (recipe.pictureCandidate !== null) {
    return 'candidate';
  }

  if (recipe.picture === 'ready') {
    return recipe.pictureAcceptedByHand ? 'byHand' : 'byJudge';
  }

  return null;
}
