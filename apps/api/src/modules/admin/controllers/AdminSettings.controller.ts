import { Controller, Get, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminSettingsDto } from '../dto/in/index.js';
import { AdminSettingsService } from '../services/index.js';
import { Roles, ZodBody } from '../../../shared/index.js';

import type { AdminSettingsViewDto } from '../dto/out/index.js';

/** The switches. `GET /settings` is the signed-in read; throwing one stays here. */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @ApiOkResponse({ description: 'The switches as they stand.' })
  @ApiOperation({ summary: 'The switches the owner can throw' })
  @Get('settings')
  async read(): Promise<AdminSettingsViewDto> {
    return this.settings.read();
  }

  @ApiOkResponse({ description: 'The switches as they now stand.' })
  @ApiOperation({ summary: 'Open or close registration' })
  @Patch('settings')
  async setSettings(@ZodBody(AdminSettingsDto) body: AdminSettingsDto): Promise<AdminSettingsViewDto> {
    return this.settings.setAutomaticActivation(body);
  }
}
