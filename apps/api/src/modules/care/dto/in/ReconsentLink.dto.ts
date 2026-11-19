import { reconsentLinkSchema } from 'core/entities/Care';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The client widens their own open link to the badged list, at the current version (`docs/legal/textos/05` § F.4). */
export const ReconsentLinkDto = zodDto('ReconsentLink', reconsentLinkSchema);
export type ReconsentLinkDto = InferDto<typeof ReconsentLinkDto>;
