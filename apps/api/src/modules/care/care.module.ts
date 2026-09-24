import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { CareAnswersController, CareClientsController, CareInvitationsController, CareLinksController } from './controllers/index.js';
import { CareService } from './services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';

/**
 * A professional and a client (`0059`). The controllers split by door:
 * inviting and reading clients are a professional's, behind
 * `ProfessionalGuard` (`CareInvitationsController`, `CareClientsController`);
 * answering an invitation is the invited client's, behind the switch alone
 * (`ProfessionalSwitchGuard`); seeing a link that exists, its trail, and
 * ending it have no switch, because consent stays revocable and visible — and
 * ending is also the professional's, which `CareController.end` checks for
 * itself.
 */
@Module({
  controllers: [CareAnswersController, CareClientsController, CareInvitationsController, CareLinksController],
  imports: [EmailModule],
  providers: [BackgroundTaskService, CareService, envProvider]
})
export class CareModule {}
