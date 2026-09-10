import { Module } from '@nestjs/common';

import { EventsController } from './controllers/index.js';
import { EventsService, PlanLoadRebuildService } from './services/index.js';

@Module({ controllers: [EventsController], providers: [EventsService, PlanLoadRebuildService] })
export class EventsModule {}
