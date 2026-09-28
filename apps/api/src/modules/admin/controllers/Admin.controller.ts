import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PERIODS } from 'core/entities/Period';

import { AdminService } from '../services/index.js';
import { PeriodQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';
import { ZodQuery } from './ZodQuery.js';

import type {
  AdminAiDto,
  AdminAnalyticsDto,
  AdminJobDto,
  AdminOverviewDto,
  AdminPeopleDto,
  AdminPicturesPeriodDto,
  AdminPlansDto,
  AdminProductDto,
  AdminSummaryDto
} from '../dto/out/index.js';

/**
 * `?period=` validated against the DTO's schema, bound to the query parameter
 * alone — never through `@UsePipes`, which would run it over every parameter
 * (`AGENTS.md` § Traps). A refused value is a 422 `INVALID_INPUT`, like a body.
 */
function PeriodQuery(): ParameterDecorator {
  return ZodQuery(PeriodQueryDto);
}

/** How `/api/docs` describes `?period=`. */
const PERIOD_PARAMETER = {
  description: 'Days, in Europe/Madrid calendar days. 30 when absent.',
  enum: PERIODS.map(String),
  name: 'period',
  required: false
} as const;

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

  @ApiOkResponse({
    description:
      "Today's count of requests that left this service against the operator's configured limit (until phase 9), and the period's: totals against the period before, calls and tokens per day, and calls by model and provider — all from `ai_call` events. 422 INVALID_INPUT for a period other than 7, 30 or 90."
  })
  @ApiOperation({ summary: 'Provider requests today and over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('ai')
  async ai(@PeriodQuery() query: PeriodQueryDto): Promise<AdminAiDto> {
    return this.admin.ai(query);
  }

  @ApiOkResponse({ description: 'The funnel, counted from state so it is right retroactively.' })
  @ApiOperation({ summary: 'Whether the product is working for the people using it' })
  @Get('analytics')
  async analytics(): Promise<AdminAnalyticsDto> {
    return this.admin.analytics();
  }

  @ApiOkResponse({
    description:
      'Spend since the month began, the cap, the flag, pictures ready, failed, released and being drawn, and spend per day over the period. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: "This month's dish pictures against the cap, and spend per day (0066, 0068)" })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('pictures')
  async pictures(@PeriodQuery() query: PeriodQueryDto): Promise<AdminPicturesPeriodDto> {
    return this.admin.pictures(query);
  }

  @ApiOkResponse({
    description:
      'Resumen: tiles against the previous period, sign-ups and generations per day, and what needs the owner. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'The console overview over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('summary')
  async summary(@PeriodQuery() query: PeriodQueryDto): Promise<AdminSummaryDto> {
    return this.admin.summary(query);
  }

  @ApiOkResponse({ description: 'The funnel counted from state, and active people and events per day over the period.' })
  @ApiOperation({ summary: 'Funnel and activity over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('product')
  async product(@PeriodQuery() query: PeriodQueryDto): Promise<AdminProductDto> {
    return this.admin.product(query);
  }

  @ApiOkResponse({ description: 'Every plan by state, and plans made per day over the period. Counts only.' })
  @ApiOperation({ summary: 'Plans by state and per day over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('plans')
  async plans(@PeriodQuery() query: PeriodQueryDto): Promise<AdminPlansDto> {
    return this.admin.plans(query);
  }

  @ApiOkResponse({
    description:
      'Accounts created and messages written per ISO week (Monday to Sunday, Europe/Madrid), each week named by its Monday. Counts only. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'Sign-ups and messages per week over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('people')
  async people(@PeriodQuery() query: PeriodQueryDto): Promise<AdminPeopleDto> {
    return this.admin.people(query);
  }

  @ApiOkResponse({ description: 'The generations that failed, with their codes.' })
  @ApiOperation({ summary: 'Only the generations that failed' })
  @Get('failures')
  async failures(): Promise<readonly AdminJobDto[]> {
    return this.admin.failures();
  }
}
