import { retentionQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Personas › Retención (`0071`) takes no query parameter (monthly cohorts only); any key is refused before a query runs. */
export const RetentionQueryDto = zodDto('RetentionQuery', retentionQuerySchema);
export type RetentionQueryDto = InferDto<typeof RetentionQueryDto>;
