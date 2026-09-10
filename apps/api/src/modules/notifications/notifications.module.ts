import { Module } from '@nestjs/common';

import { CheckInReminderService, NotificationsService } from './services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { NotificationsController } from './controllers/index.js';

@Module({
  controllers: [NotificationsController],
  exports: [CheckInReminderService],
  imports: [EmailModule],
  providers: [CheckInReminderService, envProvider, NotificationsService]
})
export class NotificationsModule {}
