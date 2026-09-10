import { handleFeedbackSchema } from 'core/entities/Feedback';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Reversible on purpose: "handled" is a note the owner leaves themselves, and a
 * note you cannot take back is one people stop making (`0037`).
 */
export const HandleFeedbackDto = zodDto('HandleFeedback', handleFeedbackSchema);
export type HandleFeedbackDto = InferDto<typeof HandleFeedbackDto>;
