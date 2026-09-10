import { setRecipeVerdictSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Liked, disliked, or taken back. The verdict is on the recipe, never on the meal (`0014`). */
export const SetRecipeVerdictDto = zodDto('SetRecipeVerdict', setRecipeVerdictSchema);
export type SetRecipeVerdictDto = InferDto<typeof SetRecipeVerdictDto>;
