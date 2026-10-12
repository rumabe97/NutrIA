import { Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminSettingsService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { SetAllowanceDto, SetFlagDto } from '../dto/in/index.js';

import type { AdminAllowancesViewDto, AdminSettingsViewDto } from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/** The switches. `GET /settings` is the signed-in read; throwing one stays here. */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @ApiOkResponse({ description: 'Every switch, including the ones a signed-in reader is not shown.' })
  @ApiOperation({ summary: 'The switches the owner can throw' })
  @Get('settings')
  async read(): Promise<AdminSettingsViewDto> {
    return this.settings.read();
  }

  @ApiOkResponse({ description: 'Every switch as it now stands.' })
  @ApiOperation({ summary: 'Throw one switch' })
  @Patch('settings')
  async setFlag(@ZodBody(SetFlagDto) body: SetFlagDto, @CurrentUser() owner: SessionUser): Promise<AdminSettingsViewDto> {
    return this.settings.setFlag(body, owner.id);
  }

  @ApiOkResponse({ description: 'What each tier is allowed now, what it ships as, and the bounds the console may not leave.' })
  @ApiOperation({ summary: 'The limits each subscription allows' })
  @Get('settings/allowances')
  async allowances(): Promise<AdminAllowancesViewDto> {
    return this.settings.allowances();
  }

  @ApiOkResponse({ description: 'Every limit as it now stands.' })
  @ApiOperation({ summary: 'Move one limit for one tier' })
  @Patch('settings/allowances')
  async setAllowance(@ZodBody(SetAllowanceDto) body: SetAllowanceDto, @CurrentUser() owner: SessionUser): Promise<AdminAllowancesViewDto> {
    return this.settings.setAllowance(body, owner.id);
  }
}
