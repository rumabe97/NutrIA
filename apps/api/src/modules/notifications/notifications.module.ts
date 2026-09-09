import { Module } from '@nestjs/common';

import { CheckInReminderService } from './CheckInReminder.service.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { NotificationsController } from './notifications.controller.js';

@Module({ controllers: [NotificationsController], exports: [CheckInReminderService], imports: [EmailModule], providers: [CheckInReminderService, envProvider] })
export class NotificationsModule {}
