import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminService } from '../services/index.js';
import { Roles } from '../../../shared/index.js';

import type { AdminAnalyticsDto, AdminJobDto, AdminOverviewDto, AiUsageDto } from '../dto/out/index.js';

/**
 * The owner's own window on the service. `@Roles('admin')` on the class, so a
 * route added here is guarded by default rather than by remembering — and a
 * request from anyone else is a 404, like every other denial.
 *
 * Every read here carries counts and never a person: no dish, no profile
 * (`0028`). The two that carry somebody — the account list and the feedback
 * inbox — are on their own controllers, so the exception is visible.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @ApiOkResponse({ description: 'Counts, plans by state, and the most recent generations.' })
  @ApiOperation({ summary: 'Counts and the most recent generations' })
  @Get('overview')
  async overview(): Promise<AdminOverviewDto> {
    return this.admin.overview();
  }

  @ApiOkResponse({ description: "Our count of requests that left this service, against the operator's configured limit." })
  @ApiOperation({ summary: "Today against the provider's allowance, counted here" })
  @Get('ai')
  async ai(): Promise<AiUsageDto> {
    return this.admin.aiUsage();
  }

  @ApiOkResponse({ description: 'The funnel, counted from state so it is right retroactively.' })
  @ApiOperation({ summary: 'Whether the product is working for the people using it' })
  @Get('analytics')
  async analytics(): Promise<AdminAnalyticsDto> {
    return this.admin.analytics();
  }

  @ApiOkResponse({ description: 'The generations that failed, with their codes.' })
  @ApiOperation({ summary: 'Only the generations that failed' })
  @Get('failures')
  async failures(): Promise<readonly AdminJobDto[]> {
    return this.admin.failures();
  }
}
