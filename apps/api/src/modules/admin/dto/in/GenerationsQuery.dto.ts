import { generationQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The generation log's query string (`0050`, `0068`): outcome, failure code,
 * the address search `q`, `since`, a range of Madrid days, and the page.
 * Anything else is a 422 before a query runs.
 */
export const GenerationsQueryDto = zodDto('GenerationsQuery', generationQuerySchema);
export type GenerationsQueryDto = InferDto<typeof GenerationsQueryDto>;
