import { setTourSeenSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Both directions of one fact: the tour was seen, or it is wanted again (`0038`). */
export const SetTourSeenDto = zodDto('SetTourSeen', setTourSeenSchema);
export type SetTourSeenDto = InferDto<typeof SetTourSeenDto>;
