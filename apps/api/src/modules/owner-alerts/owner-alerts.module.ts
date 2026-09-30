import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module.js';
import { envProvider } from '../../config/index.js';
import { OwnerAlertsService } from './services/OwnerAlerts.service.js';

/**
 * What tells the owner by mail, unasked (`0071`): the morning digest and the
 * alerts that cannot wait for it. No routes — the cron controller, the plan
 * job runner and whoever schedules a dish's drawing call it.
 */
@Module({ exports: [OwnerAlertsService], imports: [EmailModule], providers: [envProvider, OwnerAlertsService] })
export class OwnerAlertsModule {}
