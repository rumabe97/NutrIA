import { inviteClientSchema } from 'core/entities/Care';

import { zodDto } from '../../../../shared/index.js';

import type { InferDto } from '../../../../shared/index.js';

/** An address, and nothing else: who the professional invites (`0059`). */
export const InviteClientDto = zodDto('InviteClient', inviteClientSchema);
export type InviteClientDto = InferDto<typeof InviteClientDto>;
