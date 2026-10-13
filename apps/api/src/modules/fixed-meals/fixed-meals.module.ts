import { Module } from '@nestjs/common';

import { AiModule } from '../ai/index.js';
import { FixedMealsController } from './controllers/index.js';
import { FixedMealsService } from './services/index.js';

@Module({ controllers: [FixedMealsController], imports: [AiModule], providers: [FixedMealsService] })
export class FixedMealsModule {}
