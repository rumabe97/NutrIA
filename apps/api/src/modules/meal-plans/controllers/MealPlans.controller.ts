import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Locale, RateLimit, RequiresOnboarding, ZodBody } from '../../../shared/index.js';
import { HISTORY_PAGE, MealPlansService } from '../services/index.js';
import { SetMealStatusDto, SwapMealDto } from '../dto/in/index.js';

import type {
  AllowancesDto,
  JobDto,
  MealDetailDto,
  MealStatusDto,
  PlanDayDto,
  PlanDto,
  PlanSummaryDto
} from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

/**
 * Every route scopes to `@CurrentUser().id`. None accepts a user id, and the
 * repository joins on it, so a plan or meal belonging to someone else is **not
 * found** rather than refused — the denial rule in `apps/api/AGENTS.md`.
 *
 * `@RequiresOnboarding()` sits on the class, not on `generate` alone. The
 * generator did check completeness, but from *inside* the job, three stages in
 * — by then a job row exists, the user is watching a progress screen, and the
 * answer arrives as a generation failure instead of a precondition. Refusing at
 * the door means nothing is started that cannot finish, and the check inside
 * the pipeline becomes the second line of defence it should always have been.
 */
@ApiTags('meal-plans')
@Controller('meal-plans')
@RequiresOnboarding()
export class MealPlansController {
  constructor(private readonly plans: MealPlansService) {}

  @ApiCreatedResponse({ description: 'A job to poll. 409 when one is already running.' })
  @ApiOperation({ summary: 'Start generating a plan. Returns a job to poll; 409 if one is already running.' })
  @Post('generate')
  // Far tighter than the global limit: this is the one endpoint that costs money
  // and minutes. Three attempts an hour is generous for a fortnightly plan.
  @RateLimit({ limit: 3, ttlSeconds: 3600 })
  async generate(@CurrentUser() user: SessionUser): Promise<JobDto> {
    return this.plans.generate(user.id);
  }

  @ApiOkResponse({ description: 'What is left of the fortnight’s redo and swaps.' })
  @ApiOperation({ summary: 'What the person may still do this fortnight: redo the plan, swap meals.' })
  @Get('allowances')
  async allowances(@CurrentUser() user: SessionUser): Promise<AllowancesDto> {
    return this.plans.allowances(user.id);
  }

  @ApiCreatedResponse({ description: 'The meal that replaced it. 429 QUOTA_EXCEEDED when the allowance is spent.' })
  @ApiOperation({ summary: "Replace one meal of the active plan with a dish that fits — from the library, or new. Counts against the plan's swaps." })
  @Post('meals/:id/swap')
  // A swap may reach the model; this keeps a stuck retry loop from spending the
  // fortnight's allowance in a minute, and it sits well above the allowance itself.
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async swap(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Locale() locale: string | null,
    @ZodBody(SwapMealDto) body: SwapMealDto
  ): Promise<MealDetailDto> {
    return this.plans.swap(user.id, id, locale, body);
  }

  @ApiOkResponse({ description: 'The mark as it now stands.' })
  @ApiOperation({ summary: 'Mark a meal eaten or skipped, or take it back.' })
  @Patch('meals/:id/status')
  async setStatus(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(SetMealStatusDto) body: SetMealStatusDto
  ): Promise<MealStatusDto> {
    return this.plans.setMealStatus(user.id, id, body);
  }

  @ApiOkResponse({ description: 'The job, with the stage the pipeline actually reached.' })
  @ApiOperation({ summary: 'Progress of a generation. `step` is the stage the pipeline actually reached.' })
  @Get('jobs/:id')
  async job(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<JobDto> {
    return this.plans.job(user.id, id);
  }

  @ApiOkResponse({ description: 'The active plan, or null when there is none.' })
  @ApiOperation({ summary: 'The active plan with its days and meals, or null when there is none.' })
  // Declared before `:id`, or Nest matches "active" as a plan id and the route is
  // unreachable.
  @Get('active')
  async active(@CurrentUser() user: SessionUser, @Locale() locale: string | null): Promise<PlanDto | null> {
    return this.plans.activePlan(user.id, locale);
  }

  @ApiOkResponse({ description: 'Plan history, newest first.' })
  @ApiOperation({ summary: 'Plan history, newest first.' })
  @ApiQuery({ example: HISTORY_PAGE.default, name: 'limit', required: false, type: Number })
  @ApiQuery({ example: 0, name: 'offset', required: false, type: Number })
  @Get()
  async history(
    @CurrentUser() user: SessionUser,
    @Query('limit', new DefaultValuePipe(HISTORY_PAGE.default), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ): Promise<readonly PlanSummaryDto[]> {
    return this.plans.history(user.id, limit, offset);
  }

  @ApiOkResponse({ description: 'One plan of theirs, active or not — the past is readable (`0021`).' })
  @ApiOperation({ summary: 'One plan. A plan belonging to another account is not found.' })
  @Get(':id')
  async plan(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Locale() locale: string | null): Promise<PlanDto> {
    return this.plans.plan(user.id, id, locale);
  }

  @ApiOkResponse({ description: 'One day of a plan.' })
  @ApiOperation({ summary: 'One day of a plan.' })
  @Get(':id/days/:dayIndex')
  async day(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayIndex', ParseIntPipe) dayIndex: number,
    @Locale() locale: string | null
  ): Promise<PlanDayDto> {
    return this.plans.day(user.id, id, dayIndex, locale);
  }

  @ApiOkResponse({ description: 'The meal, scaled to the portion planned.' })
  @ApiOperation({ summary: "A meal, with ingredient quantities scaled to the portion planned — not the recipe's base." })
  @Get('meals/:id')
  async meal(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Locale() locale: string | null): Promise<MealDetailDto> {
    return this.plans.meal(user.id, id, locale);
  }
}
