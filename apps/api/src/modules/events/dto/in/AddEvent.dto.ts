import { addEventSchema } from 'core/entities/Event';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A named day and the shape of the days before it (`0043`). The name is free;
 * the shape is one to three days and, per macro, up, down or same — never an
 * amount. Refused in `packages/core` for a load already begun or one that
 * overlaps another event's.
 */
export const AddEventDto = zodDto('AddEvent', addEventSchema);
export type AddEventDto = InferDto<typeof AddEventDto>;
