import { Module } from '@nestjs/common';

import { EventsController } from './controllers/index.js';
import { EventsService } from './services/index.js';

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
