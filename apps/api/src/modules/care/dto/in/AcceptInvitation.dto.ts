import { acceptInvitationSchema } from 'core/entities/Care';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** The consent version the client read, and their own yes or no to the health line (`0059`). */
export const AcceptInvitationDto = zodDto('AcceptInvitation', acceptInvitationSchema);
export type AcceptInvitationDto = InferDto<typeof AcceptInvitationDto>;
