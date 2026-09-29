import { Inject, Injectable } from '@nestjs/common';

import {
  AdminConsentController,
  AdminController,
  AdminLogController,
  AdminNotificationController,
  AdminSeriesController,
  AdminUsageController
} from 'core/controllers/Admin';

import { ENV } from '../../../config/index.js';

import type {
  AdminAiDto,
  AdminAnalyticsDto,
  AdminConsentsDto,
  AdminGenerationsDto,
  AdminGenerationStatsDto,
  AdminNotificationsDto,
  AdminPeopleDto,
  AdminPicturesPeriodDto,
  AdminPlansDto,
  AdminProductDto,
  AdminSummaryDto
} from '../dto/out/index.js';
import type { Env } from '../../../config/index.js';
import type { GenerationsQueryDto, PeriodQueryDto } from '../dto/in/index.js';

@Injectable()
export class AdminService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async ai(query: PeriodQueryDto): Promise<AdminAiDto> {
    return AdminUsageController.ai(query.period, new Date(), this.env.AI_TEXT_MONTHLY_CAP_USD);
  }

  async analytics(): Promise<AdminAnalyticsDto> {
    return AdminController.analytics();
  }

  async consents(): Promise<AdminConsentsDto> {
    return AdminConsentController.consents();
  }

  /** The query arrives validated (`GenerationsQueryDto`); what each filter means is `packages/core`'s. */
  async generationsPage(query: GenerationsQueryDto): Promise<AdminGenerationsDto> {
    return AdminLogController.page(query);
  }

  async generationStats(query: PeriodQueryDto): Promise<AdminGenerationStatsDto> {
    return AdminLogController.stats(query.period);
  }

  async notifications(query: PeriodQueryDto): Promise<AdminNotificationsDto> {
    return AdminNotificationController.notifications(query.period);
  }

  async people(query: PeriodQueryDto): Promise<AdminPeopleDto> {
    return AdminSeriesController.people(query.period);
  }

  /** The cap is configuration — `AI_IMAGE_MONTHLY_CAP_USD` — so the screen shows the same number drawing stops at. */
  async pictures(query: PeriodQueryDto): Promise<AdminPicturesPeriodDto> {
    return AdminUsageController.pictures(query.period, this.env.AI_IMAGE_MONTHLY_CAP_USD);
  }

  async plans(query: PeriodQueryDto): Promise<AdminPlansDto> {
    return AdminSeriesController.plans(query.period);
  }

  async product(query: PeriodQueryDto): Promise<AdminProductDto> {
    return AdminSeriesController.product(query.period);
  }

  /** Resumen's picture tile reads against the same cap drawing stops at, as `pictures` does. */
  async summary(query: PeriodQueryDto): Promise<AdminSummaryDto> {
    return AdminSeriesController.summary(query.period, this.env.AI_IMAGE_MONTHLY_CAP_USD, new Date(), this.env.AI_TEXT_MONTHLY_CAP_USD);
  }
}
