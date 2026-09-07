import { Module } from '@nestjs/common';

import { MealPlansController } from './meal-plans.controller.js';
import { PlanGenerationService } from './PlanGeneration.service.js';
import { PlanJobRunner } from './PlanJobRunner.service.js';

@Module({ controllers: [MealPlansController], exports: [PlanJobRunner], providers: [PlanGenerationService, PlanJobRunner] })
export class MealPlansModule {}
