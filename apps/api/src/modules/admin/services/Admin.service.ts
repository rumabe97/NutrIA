import { Inject, Injectable } from '@nestjs/common';

import { AdminController, AdminSeriesController } from 'core/controllers/Admin';

import { ENV } from '../../../config/index.js';

import type {
  AdminAnalyticsDto,
  AdminGenerationDto,
  AdminJobDto,
  AdminOverviewDto,
  AdminPeopleDto,
  AdminPicturesDto,
  AdminPlansDto,
  AdminProductDto,
  AdminSummaryDto,
  AiUsageDto
} from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { PeriodQueryDto } from '../dto/in/index.js';

@Injectable()
export class AdminService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * The bars come from configuration because they belong to an account and a
   * model — one Gemini model is given twenty requests a day and another five
   * hundred. Unset means a count with no bar: a limit nobody stated is not a
   * limit this product may invent (`0035`).
   */
  async aiUsage(): Promise<AiUsageDto> {
    return AdminController.aiUsage({ requestsPerDay: this.env.AI_REQUESTS_PER_DAY, tokensPerMinute: this.env.AI_TOKENS_PER_MINUTE });
  }

  async analytics(): Promise<AdminAnalyticsDto> {
    return AdminController.analytics();
  }

  async failures(): Promise<readonly AdminJobDto[]> {
    return AdminController.failures();
  }

  async generations(): Promise<readonly AdminGenerationDto[]> {
    return AdminController.generations();
  }

  async overview(): Promise<AdminOverviewDto> {
    return AdminController.overview();
  }

  async people(query: PeriodQueryDto): Promise<AdminPeopleDto> {
    return AdminSeriesController.people(query.period);
  }

  /** The cap is configuration — `AI_IMAGE_MONTHLY_CAP_USD` — so the screen shows the same number drawing stops at. */
  async pictures(): Promise<AdminPicturesDto> {
    return AdminController.pictures(this.env.AI_IMAGE_MONTHLY_CAP_USD);
  }

  async plans(query: PeriodQueryDto): Promise<AdminPlansDto> {
    return AdminSeriesController.plans(query.period);
  }

  async product(query: PeriodQueryDto): Promise<AdminProductDto> {
    return AdminSeriesController.product(query.period);
  }

  /** Resumen's picture tile reads against the same cap drawing stops at, as `pictures` does. */
  async summary(query: PeriodQueryDto): Promise<AdminSummaryDto> {
    return AdminSeriesController.summary(query.period, this.env.AI_IMAGE_MONTHLY_CAP_USD);
  }
}
