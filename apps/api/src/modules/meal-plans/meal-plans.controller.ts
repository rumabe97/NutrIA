import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PlanController } from 'core/controllers/Plan';

import { CurrentUser, RateLimit } from '../../shared/decorators/index.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

import type { JobView, MealDetailView, PlanDayView, PlanSummaryView, PlanView } from 'core/controllers/Plan';
import type { SessionUser } from '../../shared/decorators/index.js';

const HISTORY_PAGE = { default: 20, max: 50 } as const;

/**
 * Every route scopes to `@CurrentUser().id`. None accepts a user id, and the
 * repository joins on it, so a plan or meal belonging to someone else is **not
 * found** rather than refused — the denial rule in `apps/api/AGENTS.md`.
 */
@ApiTags('meal-plans')
@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly runner: PlanJobRunner) {}

  @ApiOperation({ summary: 'Start generating a plan. Returns a job to poll; 409 if one is already running.' })
  @Post('generate')
  // Far tighter than the global limit: this is the one endpoint that costs money
  // and minutes. Three attempts an hour is generous for a fortnightly plan.
  @RateLimit({ limit: 3, ttlSeconds: 3600 })
  async generate(@CurrentUser() user: SessionUser): Promise<JobView> {
    return this.runner.start(user.id);
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
  async active(@CurrentUser() user: SessionUser): Promise<PlanView | null> {
    return PlanController.getActivePlan(user.id);
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
  async plan(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<PlanView> {
    return PlanController.getPlan(user.id, id);
  }

  @ApiOperation({ summary: 'One day of a plan.' })
  @Get(':id/days/:dayIndex')
  async day(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dayIndex', ParseIntPipe) dayIndex: number
  ): Promise<PlanDayView> {
    return PlanController.getDay(user.id, id, dayIndex);
  }

  @ApiOperation({ summary: "A meal, with ingredient quantities scaled to the portion planned — not the recipe's base." })
  @Get('meals/:id')
  async meal(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string): Promise<MealDetailView> {
    return PlanController.getMeal(user.id, id);
  }
}
