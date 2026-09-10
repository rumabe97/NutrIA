import { planVacationSchema } from 'core/entities/Vacation';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A stretch of days. Refused in `packages/core` for a trip in the past, one
 * that overlaps another, or one longer than ninety days (`0032`).
 */
export const PlanVacationDto = zodDto('PlanVacation', planVacationSchema);
export type PlanVacationDto = InferDto<typeof PlanVacationDto>;
