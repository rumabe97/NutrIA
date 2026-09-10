import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { MealPlansController } from './controllers/index.js';
import { MealPlansService, MealSwapService, PlanGenerationService, PlanJobRunner } from './services/index.js';

@Module({
  controllers: [MealPlansController],
  exports: [PlanJobRunner],
  providers: [BackgroundTaskService, MealPlansService, MealSwapService, PlanGenerationService, PlanJobRunner]
})
export class MealPlansModule {}
