import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser, RateLimit, ZodBody } from '../../../shared/index.js';
import { InviteClientDto } from '../dto/in/index.js';
import { ProfessionalGuard } from '../../../shared/guards/Professional.guard.js';

import type { CareInvitationDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The professional's side of a link (`0059`): inviting.
 *
 * `ProfessionalGuard` on the class — the `professional` switch and the owner's
 * grant, read per request, anything else a 404 — so a route added here has the
 * door by default. Never `@RequiresOnboarding()`: its 409 would answer an
 * ordinary account before the guard's 404 does.
 *
 * The client's side lives in `CareAnswersController` (behind the switch
 * alone) and `CareLinksController` (no switch): a client is not a professional.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalGuard)
export class CareInvitationsController {
  constructor(private readonly care: CareService) {}

  /*
   * Rate limited because every call sends a mail to an address the caller
   * typed; well above a practice's day, well below a script's.
   */
  @ApiCreatedResponse({
    description:
      'The invitation is stored and its mail queued. The same status and the same body whether or not the address has an account — nothing behind it asks.'
  })
  @ApiOperation({ summary: 'Invite a client by email' })
  @Post('invitations')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async invite(@CurrentUser() professional: SessionUser, @ZodBody(InviteClientDto) body: InviteClientDto): Promise<CareInvitationDto> {
    return this.care.invite(professional, body);
  }
}
