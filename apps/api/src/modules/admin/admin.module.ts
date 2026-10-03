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
  AdminSystemController,
  AdminTwoFactorController
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
  AdminSystemService,
  AdminTwoFactorService
} from './services/index.js';
import { BackgroundTaskService } from '../../shared/services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { OwnerAlertsModule } from '../owner-alerts/index.js';

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
    AdminSystemController,
    AdminTwoFactorController
  ],
  // `PushService`: the owner's test goes out through the one door every push does; `EmailService`: the grant's mail and
  // the two-factor removal's;
  // `OwnerAlertsService`: a retried picture that fails again is mailed like any other (project 009).
  imports: [EmailModule, NotificationsModule, OwnerAlertsModule],
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
    AdminTwoFactorService,
    BackgroundTaskService,
    envProvider
  ]
})
export class AdminModule {}
