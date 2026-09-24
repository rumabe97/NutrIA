import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { CheckInsController } from './controllers/index.js';
import { CheckInsService } from './services/index.js';
import { NotificationsModule } from '../notifications/index.js';

@Module({ controllers: [CheckInsController], imports: [NotificationsModule], providers: [BackgroundTaskService, CheckInsService] })
export class CheckInsModule {}
