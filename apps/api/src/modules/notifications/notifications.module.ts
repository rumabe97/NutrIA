import { Module } from '@nestjs/common';

import { CheckInReminderService, CheckInSubmittedService, NotificationsService, PushService } from './services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { NotificationsController } from './controllers/index.js';

@Module({
  controllers: [NotificationsController],
  exports: [CheckInReminderService, CheckInSubmittedService, PushService],
  imports: [EmailModule],
  providers: [CheckInReminderService, CheckInSubmittedService, envProvider, NotificationsService, PushService]
})
export class NotificationsModule {}
