import { grantProfessionalSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The collegiate number, and nothing else: the one body that makes an account a professional (`0059`). */
export const GrantProfessionalDto = zodDto('GrantProfessional', grantProfessionalSchema);
export type GrantProfessionalDto = InferDto<typeof GrantProfessionalDto>;
