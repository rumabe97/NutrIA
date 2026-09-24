import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CareService } from '../services/index.js';
import { CurrentUser, RateLimit, ZodBody } from '../../../shared/index.js';
import { AcceptInvitationDto } from '../dto/in/index.js';
import { ProfessionalSwitchGuard } from '../../../shared/guards/ProfessionalSwitch.guard.js';

import type { CareInvitationDetailDto, CareLinkDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The invited client's side of an invitation (`0059`): reading it, accepting,
 * declining.
 *
 * `ProfessionalSwitchGuard` on the class: while the `professional` switch is
 * off these routes answer 404 before any pipe runs, so a malformed body or
 * token cannot draw a 422 that says they are there. No `ProfessionalGuard`:
 * the caller is whoever was invited, not a professional. Every answer is
 * scoped to an invitation to the session's own confirmed address, and every
 * "no" is the same 404.
 *
 * The token is in the path because the plan put it there; it never reaches a
 * log line — `shared/logging` rewrites it out of the URL and the referrer.
 * Rate limited per account, because a token is a thing one might try to guess.
 */
@ApiTags('care')
@Controller('care')
@UseGuards(ProfessionalSwitchGuard)
export class CareAnswersController {
  constructor(private readonly care: CareService) {}

  @ApiOkResponse({ description: 'Who invites, the consent version and what would be shared. 404 for any invitation this account cannot answer.' })
  @ApiOperation({ summary: 'Read an invitation addressed to the signed-in account' })
  @Get('invitations/:token')
  @RateLimit({ limit: 30, ttlSeconds: 600 })
  async invitation(@CurrentUser() user: SessionUser, @Param('token') token: string): Promise<CareInvitationDetailDto> {
    return this.care.invitation(user, token);
  }

  @ApiOkResponse({ description: 'The link, now active. 409 CARE_LINK_EXISTS names a link the account already has.' })
  @ApiOperation({ summary: 'Accept an invitation, at the current consent version' })
  @HttpCode(HttpStatus.OK)
  @Post('invitations/:token/accept')
  @RateLimit({ limit: 30, ttlSeconds: 600 })
  async accept(
    @CurrentUser() user: SessionUser,
    @Param('token') token: string,
    @ZodBody(AcceptInvitationDto) body: AcceptInvitationDto
  ): Promise<CareLinkDto> {
    return this.care.accept(user, token, body);
  }

  @ApiNoContentResponse({ description: 'Declined. Nothing is shared and no link exists.' })
  @ApiOperation({ summary: 'Decline an invitation' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('invitations/:token/decline')
  @RateLimit({ limit: 30, ttlSeconds: 600 })
  async decline(@CurrentUser() user: SessionUser, @Param('token') token: string): Promise<void> {
    await this.care.decline(user, token);
  }
}
