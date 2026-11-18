import { Module } from '@nestjs/common';

import { BadgeSweepService } from './services/BadgeSweep.service.js';
import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { OwnerAlertsService } from './services/OwnerAlerts.service.js';

/**
 * What tells the owner by mail, unasked (`0071`): the morning digest and the
 * alerts that cannot wait for it. No routes — the cron controller, the plan
 * job runner and whoever schedules a dish's drawing call it. And the badge's
 * daily sweep (project 025), whose owner's alert is one of these and whose
 * practitioners' mails go out in the same pass.
 */
@Module({ exports: [BadgeSweepService, OwnerAlertsService], imports: [EmailModule], providers: [BadgeSweepService, envProvider, OwnerAlertsService] })
export class OwnerAlertsModule {}
