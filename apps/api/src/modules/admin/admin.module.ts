import { Module } from '@nestjs/common';

import {
  AdminAccountsController,
  AdminAuditController,
  AdminCatalogueController,
  AdminController,
  AdminFeedbackController,
  AdminGenerationsController,
  AdminProfessionalsController,
  AdminPushTestController,
  AdminSettingsController,
  AdminSystemController
} from './controllers/index.js';
import {
  AdminAccountsService,
  AdminAuditService,
  AdminCatalogueService,
  AdminFeedbackService,
  AdminProfessionalsService,
  AdminPushTestService,
  AdminService,
  AdminSettingsService,
  AdminSystemService
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
    AdminAuditController,
    AdminCatalogueController,
    AdminFeedbackController,
    AdminGenerationsController,
    AdminProfessionalsController,
    AdminPushTestController,
    AdminSettingsController,
    AdminSystemController
  ],
  // `PushService`: the owner's test goes out through the one door every push does; `EmailService`: the grant's mail.
  imports: [EmailModule, NotificationsModule],
  providers: [
    AdminAccountsService,
    AdminAuditService,
    AdminCatalogueService,
    AdminFeedbackService,
    AdminProfessionalsService,
    AdminPushTestService,
    AdminService,
    AdminSettingsService,
    AdminSystemService,
    BackgroundTaskService,
    envProvider
  ]
})
export class AdminModule {}
