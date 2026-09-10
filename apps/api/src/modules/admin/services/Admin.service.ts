import { Inject, Injectable } from '@nestjs/common';

import { AdminController } from 'core/controllers/Admin';

import { ENV } from '../../../config/index.js';

import type { AdminAnalyticsDto, AdminJobDto, AdminOverviewDto, AiUsageDto } from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';

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

  async overview(): Promise<AdminOverviewDto> {
    return AdminController.overview();
  }
}
