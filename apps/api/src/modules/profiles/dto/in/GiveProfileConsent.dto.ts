import { giveProfileConsentSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The notice's version, and only the current one: an older string is consent to a different text. */
export const GiveProfileConsentDto = zodDto('GiveProfileConsent', giveProfileConsentSchema);
export type GiveProfileConsentDto = InferDto<typeof GiveProfileConsentDto>;
