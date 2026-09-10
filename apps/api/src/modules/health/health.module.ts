import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './controllers/index.js';
import { HealthService } from './services/index.js';

@Module({ controllers: [HealthController], imports: [TerminusModule], providers: [HealthService] })
export class HealthModule {}
