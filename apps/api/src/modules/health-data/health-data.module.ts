import { Module } from '@nestjs/common';

import { HealthDataController } from './health-data.controller.js';

@Module({ controllers: [HealthDataController] })
export class HealthDataModule {}
