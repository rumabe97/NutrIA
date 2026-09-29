import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { AdminService } from '../services/index.js';
import { PeriodQueryDto, RetentionQueryDto } from '../dto/in/index.js';
import { Roles } from '../../../shared/index.js';
import { PERIOD_PARAMETER, ZodQuery } from './ZodQuery.js';

import type {
  AdminAiDto,
  AdminAnalyticsDto,
  AdminConsentsDto,
  AdminNotificationsDto,
  AdminPeopleDto,
  AdminPicturesPeriodDto,
  AdminPlanQualityDto,
  AdminPlansDto,
  AdminProductDto,
  AdminRetentionDto,
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

/**
 * The owner's own window on the service. `@Roles('admin')` on the class, so a
 * route added here is guarded by default rather than by remembering — and a
 * request from anyone else is a 404, like every other denial.
 *
 * Every read here carries counts and never a person: no dish, no profile
 * (`0028`). The reads that carry somebody — the account list, the feedback
 * inbox, the professionals and the generation log — are on their own
 * controllers, so the exception is visible.
 */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @ApiOkResponse({
    description:
      "The period's provider requests: totals against the period before, calls and tokens per day, and calls by model and provider — all from `ai_call` events. 422 INVALID_INPUT for a period other than 7, 30 or 90."
  })
  @ApiOperation({ summary: 'Provider requests over a period (0068)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('ai')
  async ai(@PeriodQuery() query: PeriodQueryDto): Promise<AdminAiDto> {
    return this.admin.ai(query);
  }

  @ApiOkResponse({
    description:
      'For each versioned consent (profile, health data, care link, the professional’s agreement): the version in force, accounts holding it, accounts on an older one, and the versions held. The profile consent against onboarded accounts. Numbers only.'
  })
  @ApiOperation({ summary: 'Who holds which version of each consent (0071)' })
  @Get('consents')
  async consents(): Promise<AdminConsentsDto> {
    return this.admin.consents();
  }

  @ApiOkResponse({ description: 'The funnel, counted from state so it is right retroactively.' })
  @ApiOperation({ summary: 'Whether the product is working for the people using it' })
  @Get('analytics')
  async analytics(): Promise<AdminAnalyticsDto> {
    return this.admin.analytics();
  }

  @ApiOkResponse({
    description:
      'Push subscriptions and people with one, check-in reminders sent per Madrid week and channel, and people who checked in within 3 days of a reminder. Counts only. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'Push and reminders over a period (0071)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('notifications')
  async notifications(@PeriodQuery() query: PeriodQueryDto): Promise<AdminNotificationsDto> {
    return this.admin.notifications(query);
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
      'How the plans made in the period were delivered against the bar, summed over every plan and never per plan or per day: plans, days, days in band on all four macros, misses per macro, event days, advisories by kind, plans that fell back, loads refused, and the days the energy floor narrowed. `fewData` is true below `minPlans` scored plans (counts only, `shares` null). Plans before 2026-09-29 carry no quality and are counted apart. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'Plan quality over a period (0071)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('plans/quality')
  async planQuality(@PeriodQuery() query: PeriodQueryDto): Promise<AdminPlanQualityDto> {
    return this.admin.planQuality(query);
  }

  @ApiOkResponse({
    description:
      'Sign-up cohorts (the last six months) and how many distinct people were active 1, 2 and 4 weeks after their own sign-up day, in two readings: did something (a completion, swap, completed check-in or progress entry, from day one) and used the app (a sign-in or session use, from 2026-09-29). Counts of people only: `active` is null unless `eligible` is 20 or more (`enough`); no account id. 422 INVALID_INPUT for any query parameter.'
  })
  @ApiOperation({ summary: 'Retention by sign-up cohort (0071)' })
  @Get('retention')
  async retention(@ZodQuery(RetentionQueryDto) _query: RetentionQueryDto): Promise<AdminRetentionDto> {
    return this.admin.retention();
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
}
