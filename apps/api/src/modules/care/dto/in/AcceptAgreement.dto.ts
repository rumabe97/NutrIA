import { acceptAgreementSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The agreement's version the professional read and accepts (`docs/legal/textos/01`): the current one only. */
export const AcceptAgreementDto = zodDto('AcceptAgreement', acceptAgreementSchema);
export type AcceptAgreementDto = InferDto<typeof AcceptAgreementDto>;
