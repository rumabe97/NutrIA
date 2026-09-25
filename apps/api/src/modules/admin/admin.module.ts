import { Module } from '@nestjs/common';

import {
  AdminAccountsController,
  AdminController,
  AdminFeedbackController,
  AdminGenerationsController,
  AdminProfessionalsController,
  AdminPushTestController,
  AdminSettingsController
} from './controllers/index.js';
import {
  AdminAccountsService,
  AdminFeedbackService,
  AdminProfessionalsService,
  AdminPushTestService,
  AdminService,
  AdminSettingsService
} from './services/index.js';
import { BackgroundTaskService } from '../../shared/services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { NotificationsModule } from '../notifications/index.js';

/**
 * One controller per question the screen asks, so the reads that carry a
 * person — the account list, the feedback inbox and the generation log — are
 * visibly their own thing rather than three methods among ten.
 */
@Module({
  controllers: [
    AdminController,
    AdminAccountsController,
    AdminFeedbackController,
    AdminGenerationsController,
    AdminProfessionalsController,
    AdminPushTestController,
    AdminSettingsController
  ],
  // `PushService`: the owner's test goes out through the one door every push does; `EmailService`: the grant's mail.
  imports: [EmailModule, NotificationsModule],
  providers: [
    AdminAccountsService,
    AdminFeedbackService,
    AdminProfessionalsService,
    AdminPushTestService,
    AdminService,
    AdminSettingsService,
    BackgroundTaskService,
    envProvider
  ]
})
export class AdminModule {}
