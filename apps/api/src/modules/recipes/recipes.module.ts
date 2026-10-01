import { Module } from '@nestjs/common';

import { CronController, RecipesController } from './controllers/index.js';
import { envProvider } from '../../config/index.js';
import { ExpiredInvitationsService } from '../care/services/ExpiredInvitations.service.js';
import { EmailModule } from '../email/email.module.js';
import { ExpiredVerificationsService } from '../auth/services/ExpiredVerifications.service.js';
import { NotificationsModule } from '../notifications/index.js';
import { OwnerAlertsModule } from '../owner-alerts/index.js';
import { CronRunService, RecipesService } from './services/index.js';
import { TwoFactorRemovalsService } from '../auth/services/TwoFactorRemovals.service.js';

/**
 * `NotificationsModule` because the platform's cron routes live together in
 * `CronController` — one place the scheduler calls — and one of them is the
 * daily reminder sweep. The unit spec provides the service by hand, so only
 * booting the real application catches its absence: that is what the end-to-end
 * suites are for, and they did.
 */
@Module({
  controllers: [CronController, RecipesController],
  // `EmailModule`: the removal of a second factor is mailed to the account (PLAN 011 phase 4).
  imports: [EmailModule, NotificationsModule, OwnerAlertsModule],
  providers: [CronRunService, envProvider, ExpiredInvitationsService, ExpiredVerificationsService, RecipesService, TwoFactorRemovalsService]
})
export class RecipesModule {}
