import { Injectable } from '@nestjs/common';

import { AnalyticsController } from 'core/controllers/Analytics';
import { PlanController } from 'core/controllers/Plan';

import { MealSwapService } from './MealSwap.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

import type {
  AllowancesDto,
  JobDto,
  MealDetailDto,
  MealStatusDto,
  PlanDayDto,
  PlanDto,
  PlanSummaryDto
} from '../dto/out/index.js';
import type { SetMealStatusDto, SwapMealDto } from '../dto/in/index.js';

/**
 * A page of history, and the ceiling on one. Clamped here rather than at the
 * route: what this API is willing to serve in one read is a rule, and a rule
 * enforced in a handler is a rule the next handler does not have.
 */
export const HISTORY_PAGE = { default: 20, max: 50 } as const;

@Injectable()
export class MealPlansService {
  constructor(
    private readonly runner: PlanJobRunner,
    private readonly swaps: MealSwapService
  ) {}

  async activePlan(userId: string, locale: string | null): Promise<PlanDto | null> {
    return PlanController.getActivePlan(userId, locale);
  }

  async allowances(userId: string): Promise<AllowancesDto> {
    return PlanController.allowances(userId);
  }

  async day(userId: string, planId: string, dayIndex: number, locale: string | null): Promise<PlanDayDto> {
    return PlanController.getDay(userId, planId, dayIndex, locale);
  }

  async generate(userId: string): Promise<JobDto> {
    return this.runner.start(userId);
  }

  async history(userId: string, limit: number, offset: number): Promise<readonly PlanSummaryDto[]> {
    return PlanController.listPlans(userId, Math.min(limit, HISTORY_PAGE.max), Math.max(offset, 0));
  }

  async job(userId: string, jobId: string): Promise<JobDto> {
    return PlanController.getJob(userId, jobId);
  }

  async meal(userId: string, mealId: string, locale: string | null): Promise<MealDetailDto> {
    return PlanController.getMeal(userId, mealId, locale);
  }

  async plan(userId: string, planId: string, locale: string | null): Promise<PlanDto> {
    return PlanController.getPlan(userId, planId, locale);
  }

  async setMealStatus(userId: string, mealId: string, body: SetMealStatusDto): Promise<MealStatusDto> {
    await PlanController.setMealStatus(userId, mealId, body.status);

    return body;
  }

  async swap(userId: string, mealId: string, locale: string | null, body: SwapMealDto): Promise<MealDetailDto> {
    const swapped = await this.swaps.swap(userId, mealId, locale, body.axis);

    // What was asked for, never what came back (`0033`). Awaited because the
    // repository swallows its own failures; nothing here can fail the swap.
    await AnalyticsController.record('swap_requested', userId, { axis: body.axis ?? 'none' });

    return swapped;
  }
}
