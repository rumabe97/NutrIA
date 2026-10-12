import { setAllowanceSchema } from 'core/entities/Settings';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Which limit to move, for which tier, to what. The names are the registry's (`core/domain/Allowance`). */
export const SetAllowanceDto = zodDto('SetAllowance', setAllowanceSchema);
export type SetAllowanceDto = InferDto<typeof SetAllowanceDto>;
