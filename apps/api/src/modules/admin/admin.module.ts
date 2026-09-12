import { Module } from '@nestjs/common';

import {
  AdminAccountsController,
  AdminController,
  AdminFeedbackController,
  AdminGenerationsController,
  AdminSettingsController
} from './controllers/index.js';
import { AdminAccountsService, AdminFeedbackService, AdminService, AdminSettingsService } from './services/index.js';
import { envProvider } from '../../config/index.js';

/**
 * One controller per question the screen asks, so the reads that carry a
 * person — the account list, the feedback inbox and the generation log — are
 * visibly their own thing rather than three methods among ten.
 */
@Module({
  controllers: [AdminController, AdminAccountsController, AdminFeedbackController, AdminGenerationsController, AdminSettingsController],
  providers: [AdminAccountsService, AdminFeedbackService, AdminService, AdminSettingsService, envProvider]
})
export class AdminModule {}
