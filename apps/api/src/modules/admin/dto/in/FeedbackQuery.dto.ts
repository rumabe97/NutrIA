import { feedbackQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The inbox's query string (`0037`, `0068`): search the text or the sender, the state, the date's direction, the page. */
export const FeedbackQueryDto = zodDto('FeedbackQuery', feedbackQuerySchema);
export type FeedbackQueryDto = InferDto<typeof FeedbackQueryDto>;
