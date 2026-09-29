import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminSystemService } from '../services/index.js';
import { PERIOD_PARAMETER, ZodQuery } from './ZodQuery.js';
import { PeriodQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';

import type { AdminSystemDto } from '../dto/out/index.js';

/**
 * Ajustes › Sistema (`0071`): what the service is running and whether each
 * thing it depends on is set up. A yes or a no, a version, a date or a hash —
 * never the value of a setting, which a spec proves.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminSystemController {
  constructor(private readonly system: AdminSystemService) {}

  @ApiOkResponse({
    description:
      'The commit, the prompt, steps and consent versions, the app’s caps, each integration as a boolean, each cron’s last run with a stale flag past 26 hours, and mail over the period: sent and failed per template as totals, and per day summed over every template. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'What the service is running, and mail over a period (0071)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('system')
  async read(@ZodQuery(PeriodQueryDto) query: PeriodQueryDto): Promise<AdminSystemDto> {
    return this.system.system(query);
  }
}
