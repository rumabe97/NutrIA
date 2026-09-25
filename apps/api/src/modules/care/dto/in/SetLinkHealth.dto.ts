import { setLinkHealthSchema } from 'core/entities/Care';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The client's own yes or no to the health line on their link, without ending it. */
export const SetLinkHealthDto = zodDto('SetLinkHealth', setLinkHealthSchema);
export type SetLinkHealthDto = InferDto<typeof SetLinkHealthDto>;
