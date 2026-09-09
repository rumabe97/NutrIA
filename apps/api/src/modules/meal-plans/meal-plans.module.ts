import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { MealPlansController } from './meal-plans.controller.js';
import { MealSwapService } from './MealSwap.service.js';
import { PlanGenerationService } from './PlanGeneration.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

@Module({ controllers: [MealPlansController], exports: [PlanJobRunner], providers: [BackgroundTaskService, MealSwapService, PlanGenerationService, PlanJobRunner] })
export class MealPlansModule {}
