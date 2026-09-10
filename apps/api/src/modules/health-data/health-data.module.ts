import { Module } from '@nestjs/common';

import { HealthDataController } from './controllers/index.js';
import { HealthDataService } from './services/index.js';

@Module({ controllers: [HealthDataController], providers: [HealthDataService] })
export class HealthDataModule {}
