import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { MealPlansController } from './meal-plans.controller.js';
import { PlanGenerationService } from './PlanGeneration.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

@Module({ controllers: [MealPlansController], exports: [PlanJobRunner], providers: [BackgroundTaskService, PlanGenerationService, PlanJobRunner] })
export class MealPlansModule {}
