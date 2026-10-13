import { Module } from '@nestjs/common';

import { FixedMealsController } from './controllers/index.js';
import { FixedMealsService } from './services/index.js';

@Module({ controllers: [FixedMealsController], providers: [FixedMealsService] })
export class FixedMealsModule {}
