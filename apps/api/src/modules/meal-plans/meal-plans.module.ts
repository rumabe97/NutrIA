import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { MealPlansController } from './controllers/index.js';
import { OwnerAlertsModule } from '../owner-alerts/index.js';
import { MealPlansService, MealSwapService, PlanGenerationService, PlanJobRunner } from './services/index.js';

@Module({
  controllers: [MealPlansController],
  exports: [MealSwapService, PlanJobRunner],
  imports: [OwnerAlertsModule],
  providers: [BackgroundTaskService, MealPlansService, MealSwapService, PlanGenerationService, PlanJobRunner]
})
export class MealPlansModule {}
