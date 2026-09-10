import { Module } from '@nestjs/common';

import { SafetyController } from './controllers/index.js';
import { SafetyService } from './services/index.js';

@Module({ controllers: [SafetyController], providers: [SafetyService] })
export class SafetyModule {}
