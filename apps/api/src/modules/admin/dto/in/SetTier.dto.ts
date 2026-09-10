import { setTierSchema } from 'core/entities/Settings';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Which tier this account moves to. Granting one while the `premium` switch is off is allowed and deliberate. */
export const SetTierDto = zodDto('SetTier', setTierSchema);
export type SetTierDto = InferDto<typeof SetTierDto>;
