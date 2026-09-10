import { submitFeedbackSchema } from 'core/entities/Feedback';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** A kind, a message, and nothing else — see `0037` for why the taxonomy is three wide. */
export const SubmitFeedbackDto = zodDto('SubmitFeedback', submitFeedbackSchema);
export type SubmitFeedbackDto = InferDto<typeof SubmitFeedbackDto>;
