import { setFlagSchema } from 'core/entities/Settings';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Which switch to throw, and which way. The names are the registry's (`core/domain/Flag`). */
export const SetFlagDto = zodDto('SetFlag', setFlagSchema);
export type SetFlagDto = InferDto<typeof SetFlagDto>;
