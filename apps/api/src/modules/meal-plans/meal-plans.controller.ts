import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AnalyticsController } from 'core/controllers/Analytics';
import { PlanController } from 'core/controllers/Plan';
import { setMealStatusSchema, swapMealSchema } from 'core/entities/Plan';

import { CurrentUser, Locale, RateLimit, RequiresOnboarding } from '../../shared/decorators/index.js';
import { ZodValidationPipe } from '../../shared/pipes/index.js';
import { MealSwapService } from './MealSwap.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

import type { AllowancesView, JobView, MealDetailView, PlanDayView, PlanSummaryView, PlanView } from 'core/controllers/Plan';
import type { SessionUser } from '../../shared/decorators/index.js';
import type { SetMealStatus, SwapMeal } from 'core/entities/Plan';

const HISTORY_PAGE = { default: 20, max: 50 } as const;

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
  constructor(
    private readonly runner: PlanJobRunner,
    private readonly swaps: MealSwapService
  ) {}

  @ApiOperation({ summary: 'Start generating a plan. Returns a job to poll; 409 if one is already running.' })
  @Post('generate')
  // Far tighter than the global limit: this is the one endpoint that costs money
  // and minutes. Three attempts an hour is generous for a fortnightly plan.
  @RateLimit({ limit: 3, ttlSeconds: 3600 })
  async generate(@CurrentUser() user: SessionUser): Promise<JobView> {
    return this.runner.start(user.id);
  }

  @ApiOperation({ summary: 'What the person may still do this fortnight: redo the plan, swap meals.' })
  @Get('allowances')
  async allowances(@CurrentUser() user: SessionUser): Promise<AllowancesView> {
    return PlanController.allowances(user.id);
  }

  @ApiOperation({ summary: 'Replace one meal of the active plan with a dish that fits — from the library, or new. Counts against the plan\'s swaps.' })
  @Post('meals/:id/swap')
  // A swap may reach the model; this keeps a stuck retry loop from spending the
  // fortnight's allowance in a minute, and it sits well above the allowance itself.
  @RateLimit({ limit: 10, ttlSeconds: 3600 })
  async swap(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Locale() locale: string | null,
    @Body(new ZodValidationPipe(swapMealSchema)) body: SwapMeal
  ): Promise<MealDetailView> {
    const swapped = await this.swaps.swap(user.id, id, locale, body.axis);

    // What was asked for, never what came back (`0033`). Awaited because the
    // repository swallows its own failures; nothing here can fail the swap.
    await AnalyticsController.record('swap_requested', user.id, { axis: body.axis ?? 'none' });

    return swapped;
  }

  @ApiOperation({ summary: 'Mark a meal eaten or skipped, or take it back.' })
  @Patch('meals/:id/status')
  async setStatus(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(setMealStatusSchema)) body: SetMealStatus): Promise<SetMealStatus> {
    await PlanController.setMealStatus(user.id, id, body.status);

    return body;
  }

  @ApiOperation({ summary: 'Progress of a generation. `step` is the stage the pipeline actually reached.' })
  @Get('jobs/:id')
  async job(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<JobView> {
    return PlanController.getJob(user.id, id);
  }

  @ApiOperation({ summary: 'The active plan with its days and meals, or null when there is none.' })
  // Declared before `:id`, or Nest matches "active" as a plan id and the route is
  // unreachable.
  @Get('active')
  async active(@CurrentUser() user: SessionUser, @Locale() locale: string | null): Promise<PlanView | null> {
    return PlanController.getActivePlan(user.id, locale);
  }

  @ApiOperation({ summary: 'Plan history, newest first.' })
  @Get()
  async history(
    @CurrentUser() user: SessionUser,
    @Query('limit', new DefaultValuePipe(HISTORY_PAGE.default), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number
  ): Promise<readonly PlanSummaryView[]> {
    return PlanController.listPlans(user.id, Math.min(limit, HISTORY_PAGE.max), Math.max(offset, 0));
  }

  @ApiOperation({ summary: 'One plan. A plan belonging to another account is not found.' })
  @Get(':id')
  async plan(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Locale() locale: string | null): Promise<PlanView> {
    return PlanController.getPlan(user.id, id, locale);
  }

  @ApiOperation({ summary: 'One day of a plan.' })
  @Get(':id/days/:dayIndex')
  async day(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayIndex', ParseIntPipe) dayIndex: number,
    @Locale() locale: string | null
  ): Promise<PlanDayView> {
    return PlanController.getDay(user.id, id, dayIndex, locale);
  }

  @ApiOperation({ summary: "A meal, with ingredient quantities scaled to the portion planned — not the recipe's base." })
  @Get('meals/:id')
  async meal(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string, @Locale() locale: string | null): Promise<MealDetailView> {
    return PlanController.getMeal(user.id, id, locale);
  }
}
