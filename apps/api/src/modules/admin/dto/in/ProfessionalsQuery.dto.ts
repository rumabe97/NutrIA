import { professionalQuerySchema } from 'core/entities/AdminQuery';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The professionals list's query string (`0059`, `0068`): search by address and a sort from an allow-list. Unpaged. */
export const ProfessionalsQueryDto = zodDto('ProfessionalsQuery', professionalQuerySchema);
export type ProfessionalsQueryDto = InferDto<typeof ProfessionalsQueryDto>;
