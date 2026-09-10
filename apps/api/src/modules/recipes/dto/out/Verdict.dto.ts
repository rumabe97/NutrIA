import type { SetRecipeVerdict } from 'core/entities/Plan';

/**
 * The verdict as it now stands. It is the request echoed — `packages/core`
 * answers the write with nothing, and the screen that just set it should not
 * have to re-read the recipe to learn what it says.
 */
export type VerdictDto = SetRecipeVerdict;
