import { setClientReviewSchema } from 'core/entities/Care';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Review before publishing, on or off, for one link (`0060`). */
export const SetClientReviewDto = zodDto('SetClientReview', setClientReviewSchema);
export type SetClientReviewDto = InferDto<typeof SetClientReviewDto>;
