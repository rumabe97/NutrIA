import { enterBadgeCodeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The code as typed. Its shape is not judged here: a malformed code is the same 404 as a wrong one (PRD 025 criterion 3). */
export const EnterBadgeCodeDto = zodDto('EnterBadgeCode', enterBadgeCodeSchema);
export type EnterBadgeCodeDto = InferDto<typeof EnterBadgeCodeDto>;
