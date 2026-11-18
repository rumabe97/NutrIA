import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { PROFESSIONAL_SORTS, SORT_DIRECTIONS } from 'core/entities/AdminQuery';

import { AdminProfessionalsService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { GrantProfessionalDto, IssueBadgeCodeDto, ProfessionalsQueryDto, RemoveBadgeDto } from '../dto/in/index.js';
import { ZodQuery } from './ZodQuery.js';

import type { BadgeCodeIssuedDto, BadgeQueueDto, BadgeRecordDto, ProfessionalAccountDto, ProfessionalsDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Who is a professional (`0059`): the owner's act, and the owner's list.
 *
 * `@Roles('admin')` on the class so a new route here is guarded by default —
 * this is the only door through which an account becomes a professional, and
 * a sign-up field, a profile body or a `PATCH /users/me` carrying the word
 * changes nothing. The list carries each professional's address, number, date
 * and link *counts*: never a client (`0028`).
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

  @ApiCreatedResponse({ description: 'The account, now a professional.' })
  @ApiOperation({ summary: 'Make one account a professional, with its collegiate number' })
  @Post('accounts/:id/professional')
  async grant(
    @Param('id') id: string,
    @ZodBody(GrantProfessionalDto) body: GrantProfessionalDto,
    @CurrentUser() owner: SessionUser
  ): Promise<ProfessionalAccountDto> {
    return this.professionals.grant(id, body, owner.id);
  }

  @ApiNoContentResponse({ description: 'The grant is gone; the account is an ordinary one on its next request.' })
  @ApiOperation({ summary: 'Take the grant back' })
  @Delete('accounts/:id/professional')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<void> {
    await this.professionals.revoke(id, owner.id);
  }
}
