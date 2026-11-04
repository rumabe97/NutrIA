import { cupboardGapQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The cupboard gap lists' query string (project 022 phase 5): `offset` and `size`, and an unknown key is a 422. */
export const CupboardGapQueryDto = zodDto('CupboardGapQuery', cupboardGapQuerySchema);
export type CupboardGapQueryDto = InferDto<typeof CupboardGapQueryDto>;
