import { adminSettingsSchema } from 'core/entities/Settings';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The one switch: whether confirming an address opens the account (`0031`). */
export const AdminSettingsDto = zodDto('AdminSettings', adminSettingsSchema);
export type AdminSettingsDto = InferDto<typeof AdminSettingsDto>;
