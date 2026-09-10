import { updateTargetOverrideSchema } from 'core/entities/Nutrition';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A null clears a target rather than setting it to nothing. The bounds are
 * checked in `packages/core`, not here: a limit enforced at the HTTP edge would
 * be a limit generation does not share.
 */
export const UpdateTargetOverrideDto = zodDto('UpdateTargetOverride', updateTargetOverrideSchema);
export type UpdateTargetOverrideDto = InferDto<typeof UpdateTargetOverrideDto>;
