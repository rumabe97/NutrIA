import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminController } from 'core/controllers/Admin';

import { Roles } from '../../shared/decorators/index.js';

import type { AdminJobView, AdminOverviewView } from 'core/controllers/Admin';

/**
 * The owner's own window on the service. `@Roles('admin')` on the class, so a
 * route added here is guarded by default rather than by remembering — and a
 * request from anyone else is a 404, like every other denial.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminRestController {
  @ApiOperation({ summary: 'Counts and the most recent generations' })
  @Get('overview')
  async overview(): Promise<AdminOverviewView> {
    return AdminController.overview();
  }

  @ApiOperation({ summary: 'Only the generations that failed' })
  @Get('failures')
  async failures(): Promise<readonly AdminJobView[]> {
    return AdminController.failures();
  }
}
