import { Module } from '@nestjs/common';

import { BackgroundTaskService } from '../../shared/services/index.js';
import { CareAnswersController, CareInvitationsController, CareLinksController } from './controllers/index.js';
import { CareService } from './services/index.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';

/**
 * A professional and a client (`0059`). Three controllers because the doors
 * differ: inviting is a professional's, behind `ProfessionalGuard`; answering
 * an invitation is the invited client's, behind the switch alone
 * (`ProfessionalSwitchGuard`); seeing and ending a link that exists has no
 * switch, because consent stays revocable — and ending is also the
 * professional's, which `CareController.end` checks for itself.
 */
@Module({
  controllers: [CareAnswersController, CareInvitationsController, CareLinksController],
  imports: [EmailModule],
  providers: [BackgroundTaskService, CareService, envProvider]
})
export class CareModule {}
