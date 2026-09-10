import { Module } from '@nestjs/common';

import { AdminAccountsController, AdminController, AdminFeedbackController, AdminSettingsController } from './controllers/index.js';
import { AdminAccountsService, AdminFeedbackService, AdminService, AdminSettingsService } from './services/index.js';
import { envProvider } from '../../config/index.js';

/**
 * One controller per question the screen asks, so the two reads that carry a
 * person — the account list and the feedback inbox — are visibly their own
 * thing rather than two methods among ten.
 */
@Module({
  controllers: [AdminController, AdminAccountsController, AdminFeedbackController, AdminSettingsController],
  providers: [AdminAccountsService, AdminFeedbackService, AdminService, AdminSettingsService, envProvider]
})
export class AdminModule {}
