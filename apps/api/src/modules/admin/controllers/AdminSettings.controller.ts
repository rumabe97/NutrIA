import { Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminSettingsService } from '../services/index.js';
import { CurrentUser, Roles, ZodBody } from '../../../shared/index.js';
import { SetFlagDto } from '../dto/in/index.js';

import type { AdminSettingsViewDto } from '../dto/out/index.js';
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
}
