import { Module } from '@nestjs/common';

import {
  AdminAccountsController,
  AdminController,
  AdminFeedbackController,
  AdminGenerationsController,
  AdminPushTestController,
  AdminSettingsController
} from './controllers/index.js';
import { AdminAccountsService, AdminFeedbackService, AdminPushTestService, AdminService, AdminSettingsService } from './services/index.js';
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
    AdminPushTestController,
    AdminSettingsController
  ],
  // For `PushService`: the owner's test goes out through the one door every push does.
  imports: [NotificationsModule],
  providers: [AdminAccountsService, AdminFeedbackService, AdminPushTestService, AdminService, AdminSettingsService, envProvider]
})
export class AdminModule {}
