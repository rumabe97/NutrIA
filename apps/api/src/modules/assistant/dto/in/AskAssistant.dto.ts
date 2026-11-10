import { askAssistantSchema } from 'core/entities/Assistant';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** A question, and the conversation it continues. **No history**: the server owns the thread. */
export const AskAssistantDto = zodDto('AskAssistant', askAssistantSchema);
export type AskAssistantDto = InferDto<typeof AskAssistantDto>;
