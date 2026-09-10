import { updateProfileSchema } from 'core/entities/Profile';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** Personal details. Every field optional; a `userId` in the body is stripped. */
export const UpdateProfileDto = zodDto('UpdateProfile', updateProfileSchema);
export type UpdateProfileDto = InferDto<typeof UpdateProfileDto>;
