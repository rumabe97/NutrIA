import { updateGoalSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The active goal, which is what the calculator resolves targets against. */
export const UpdateGoalDto = zodDto('UpdateGoal', updateGoalSchema);
export type UpdateGoalDto = InferDto<typeof UpdateGoalDto>;
