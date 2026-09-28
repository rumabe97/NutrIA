import { periodQuerySchema } from 'core/entities/Period';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * `?period=` on the console's reads (`0068`): `7`, `30` or `90`, 30 when absent,
 * anything else refused before a query runs. Arrives as a number.
 */
export const PeriodQueryDto = zodDto('PeriodQuery', periodQuerySchema);
export type PeriodQueryDto = InferDto<typeof PeriodQueryDto>;
