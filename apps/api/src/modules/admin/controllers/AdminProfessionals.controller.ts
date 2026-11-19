import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PROFESSIONAL_SORTS, SORT_DIRECTIONS } from 'core/entities/AdminQuery';

import { AdminProfessionalsService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import {
  HideProfessionalProfileDto,
  IssueBadgeCodeDto,
  LiftRestrictionDto,
  ProfessionalsQueryDto,
  RemoveBadgeDto,
  RestrictPracticeDto
} from '../dto/in/index.js';
import { ZodQuery } from './ZodQuery.js';

import type {
  BadgeCodeIssuedDto,
  BadgeQueueDto,
  BadgeRecordDto,
  PracticeRestrictionAnswerDto,
  ProfessionalsDto,
  ProfileQueueDto,
  QueuedProfileDto
} from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * The owner's acts on practitioners (`0059`, project 025), and the owner's list.
 *
 * `@Roles('admin')` on the class so a new route here is guarded by default.
 * **No route here makes anybody a practitioner** (PRD 025 criterion 2): an
 * account opens its own practice (`POST /care/practice`), and the 004 grant
 * (`POST /admin/accounts/:id/professional`) is retired — what the owner gives
 * is the badge, by the check below. The list carries each practitioner's
 * address, number, date, link *counts* and what stands against them: never a
 * client (`0028`).
 *
 * **The first look** (PRD 025 criterion 18): the profiles' queue, seen, or
 * hidden with a statement of reasons — one act for refusing and hiding.
 *
 * **Suspension, close and lift** (PRD 025 scope 16): `practice_restrictions`,
 * each with its statement of reasons mailed. The close replaces the 004 revoke
 * (`DELETE /admin/accounts/:id/professional`, retired): it carries 30 days'
 * notice, and the daily sweep closes the practice on its day.
 *
 * **The badge** (project 025 phase 3, `0111` §§ 2–3): the owner's list of
 * applications and re-checks, one practitioner's record, sending a code
 * through a channel the public register allows, confirming, and refusing or
 * withdrawing with a reason. `:userId` is the account the owner acts on — the
 * console's own door, as `accounts/:id` is. Practitioner data only.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminProfessionalsController {
  constructor(private readonly professionals: AdminProfessionalsService) {}

  @ApiOkResponse({
    description:
      'Every professional matching the search, most recently granted first unless sorted, with their links counted per status. Unpaged. 422 INVALID_INPUT for an unknown sort.'
  })
  @ApiOperation({ summary: 'Every professional the owner has granted, searched and sorted (0068)' })
  @ApiQuery({ description: 'Address contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ description: '`links` is active links, then every link.', enum: PROFESSIONAL_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @Get('professionals')
  async list(@ZodQuery(ProfessionalsQueryDto) query: ProfessionalsQueryDto): Promise<ProfessionalsDto> {
    return this.professionals.list(query);
  }

  @ApiOkResponse({ description: 'Applications waiting for the owner’s check, and badges due for their yearly re-check. Never a client.' })
  @ApiOperation({ summary: 'The badge’s work list (project 025)' })
  @Get('professionals/badges')
  async badges(): Promise<BadgeQueueDto> {
    return this.professionals.badges();
  }

  @ApiOkResponse({ description: 'One practitioner’s badge record. 404 for an unknown account.' })
  @ApiOperation({ summary: 'One practitioner’s badge, application and checks' })
  @Get('professionals/:userId/badge')
  async badge(@Param('userId') userId: string): Promise<BadgeRecordDto> {
    return this.professionals.badge(userId);
  }

  @ApiCreatedResponse({
    description:
      'A code for the application waiting, or for a standing badge’s re-check. By letter or phone the code comes back here, once; by e-mail it is mailed to the register’s address and `mailed` says whether it left. 404 when there is nothing to prove.'
  })
  @ApiOperation({ summary: 'Send a badge code through a channel the public register lists' })
  @Post('professionals/:userId/badge/code')
  async issueBadgeCode(@Param('userId') userId: string, @ZodBody(IssueBadgeCodeDto) body: IssueBadgeCodeDto): Promise<BadgeCodeIssuedDto> {
    return this.professionals.issueBadgeCode(userId, body);
  }

  @ApiOkResponse({ description: 'A pass, due in twelve months. 404 unless a code was entered for the application, or a badge stands to renew.' })
  @ApiOperation({ summary: 'Confirm the badge' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/badge/confirm')
  async confirmBadge(@Param('userId') userId: string, @CurrentUser() owner: SessionUser): Promise<BadgeRecordDto> {
    return this.professionals.confirmBadge(userId, owner.id);
  }

  @ApiOkResponse({
    description: 'Refused (`fail`) or withdrawn, with the statement of reasons mailed. 404 when there is nothing of that kind to decide.'
  })
  @ApiOperation({ summary: 'Refuse an application or withdraw a badge, with a reason' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/badge/removal')
  async removeBadge(
    @Param('userId') userId: string,
    @ZodBody(RemoveBadgeDto) body: RemoveBadgeDto,
    @CurrentUser() owner: SessionUser
  ): Promise<BadgeRecordDto> {
    return this.professionals.removeBadge(userId, body, owner.id);
  }

  @ApiOkResponse({
    description:
      'Profiles created or edited since the owner last looked, oldest first: the account, the profile, the badge as it stands and the words it may not show. Never a client.'
  })
  @ApiOperation({ summary: 'The profiles’ first-look queue (project 025)' })
  @Get('professionals/queue')
  async profileQueue(): Promise<ProfileQueueDto> {
    return this.professionals.profiles();
  }

  @ApiOkResponse({ description: 'Seen, off the queue, and no longer hidden if it was. 404 unless the profile is on the queue. Nothing is mailed.' })
  @ApiOperation({ summary: 'Mark a queued profile seen' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/profile/seen')
  async markProfileSeen(@Param('userId') userId: string, @CurrentUser() owner: SessionUser): Promise<QueuedProfileDto> {
    return this.professionals.markProfileSeen(userId, owner.id);
  }

  @ApiOkResponse({
    description:
      'Hidden at once, off the queue, with the statement of reasons mailed — refusing a profile is this same act. 404 for an account with no profile.'
  })
  @ApiOperation({ summary: 'Hide a profile, with a reason' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/profile/hide')
  async hideProfile(
    @Param('userId') userId: string,
    @ZodBody(HideProfessionalProfileDto) body: HideProfessionalProfileDto
  ): Promise<QueuedProfileDto> {
    return this.professionals.hideProfile(userId, body);
  }

  @ApiOkResponse({
    description:
      'Suspended at once: from the next request no client route, invitation or new practice. The statement of reasons is mailed. 404 for an account with no practice, or one already suspended.'
  })
  @ApiOperation({ summary: 'Suspend an account as a practitioner, with a statement of reasons' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/suspension')
  async suspend(
    @Param('userId') userId: string,
    @ZodBody(RestrictPracticeDto) body: RestrictPracticeDto,
    @CurrentUser() owner: SessionUser
  ): Promise<PracticeRestrictionAnswerDto> {
    return this.professionals.suspend(userId, body, owner.id);
  }

  @ApiOkResponse({
    description:
      'A close in 30 days, its notice and reasons mailed now. The practice works until then; on the day the daily sweep closes it, and the account cannot open one again until lifted. 404 for an account with no practice, or one already closing.'
  })
  @ApiOperation({ summary: 'Close a practice for good, with 30 days’ notice (replaces the 004 revoke)' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/close')
  async close(
    @Param('userId') userId: string,
    @ZodBody(RestrictPracticeDto) body: RestrictPracticeDto,
    @CurrentUser() owner: SessionUser
  ): Promise<PracticeRestrictionAnswerDto> {
    return this.professionals.close(userId, body, owner.id);
  }

  @ApiOkResponse({ description: 'Whatever stood — a suspension, a close — is lifted; a suspension lifted is mailed. 404 when nothing stands.' })
  @ApiOperation({ summary: 'Lift a suspension or a close' })
  @HttpCode(HttpStatus.OK)
  @Post('professionals/:userId/lift')
  async lift(
    @Param('userId') userId: string,
    @ZodBody(LiftRestrictionDto) body: LiftRestrictionDto,
    @CurrentUser() owner: SessionUser
  ): Promise<PracticeRestrictionAnswerDto> {
    return this.professionals.lift(userId, body, owner.id);
  }
}
