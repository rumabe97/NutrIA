import { issueBadgeCodeSchema } from 'core/entities/Professional';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/**
 * The channel the public register allows, and — by e-mail only — the address
 * and the name as that register shows them, used for the one mail and never
 * stored (PRD 025 scope 6).
 */
export const IssueBadgeCodeDto = zodDto('IssueBadgeCode', issueBadgeCodeSchema);
export type IssueBadgeCodeDto = InferDto<typeof IssueBadgeCodeDto>;
