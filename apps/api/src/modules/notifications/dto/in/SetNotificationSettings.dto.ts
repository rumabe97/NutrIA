import { setNotificationSettingsSchema } from 'core/entities/Notification';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The switch that stops the fortnightly mail (`0027`). */
export const SetNotificationSettingsDto = zodDto('SetNotificationSettings', setNotificationSettingsSchema);
export type SetNotificationSettingsDto = InferDto<typeof SetNotificationSettingsDto>;
