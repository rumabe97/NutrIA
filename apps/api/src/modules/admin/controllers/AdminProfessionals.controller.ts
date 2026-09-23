import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminProfessionalsService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { GrantProfessionalDto } from '../dto/in/index.js';

import type { ProfessionalAccountDto, ProfessionalsDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Who is a professional (`0059`): the owner's act, and the owner's list.
 *
 * `@Roles('admin')` on the class so a new route here is guarded by default —
 * this is the only door through which an account becomes a professional, and
 * a sign-up field, a profile body or a `PATCH /users/me` carrying the word
 * changes nothing. The list carries each professional's address, number, date
 * and link *counts*: never a client (`0028`).
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminProfessionalsController {
  constructor(private readonly professionals: AdminProfessionalsService) {}

  @ApiOkResponse({ description: 'Every professional, most recently granted first, with their links counted per status.' })
  @ApiOperation({ summary: 'Every professional the owner has granted' })
  @Get('professionals')
  async list(): Promise<ProfessionalsDto> {
    return this.professionals.list();
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
  async revoke(@Param('id') id: string): Promise<void> {
    await this.professionals.revoke(id);
  }
}
