import { openPracticeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * Opening one's own practice (PRD 025 scope 1): a birth date, for an account
 * that has none on record, and nothing else — any other key is dropped, so no
 * body can set a badge, `practiceOpen` or `includedClients` (criterion 2).
 */
export const OpenPracticeDto = zodDto('OpenPractice', openPracticeSchema);
export type OpenPracticeDto = InferDto<typeof OpenPracticeDto>;
