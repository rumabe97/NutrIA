import { generatePlanSchema } from 'core/entities/Plan';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The day the plan starts, optionally — the person's today when it is left out
 * (project 015). A malformed day is refused here; a day outside their today to
 * a week ahead is refused where their today is known, `PlanJobController.start`.
 * Both are 422 `INVALID_INPUT`.
 */
export const GeneratePlanDto = zodDto('GeneratePlan', generatePlanSchema);
export type GeneratePlanDto = InferDto<typeof GeneratePlanDto>;
