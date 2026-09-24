import { updateTargetOverrideSchema } from 'core/entities/Nutrition';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * A professional's targets for a client (PRD 004, criterion 7): the client's
 * own `UpdateTargetOverride`, the same schema, so a professional may send
 * exactly what the client may. The bounds are checked in `packages/core`, by
 * the same `targetViolations`, not here.
 */
export const SetClientTargetsDto = zodDto('UpdateTargetOverride', updateTargetOverrideSchema);
export type SetClientTargetsDto = InferDto<typeof SetClientTargetsDto>;
