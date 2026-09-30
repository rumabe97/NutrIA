import { pictureAcceptanceSchema } from 'core/entities/DishPicture';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The owner's acceptance of a rejected picture (`0072`): what the console showed, repeated — the second confirmation step,
 * put on the server. `allergens`: the keys on its warning, the empty list when nothing was flagged, never absent.
 * `expiresAt`: the `pictureCandidate.expiresAt` the page was rendered with, which says which candidate was seen.
 */
export const AcceptPictureCandidateDto = zodDto('AcceptPictureCandidate', pictureAcceptanceSchema);
export type AcceptPictureCandidateDto = InferDto<typeof AcceptPictureCandidateDto>;
