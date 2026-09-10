import { Module } from '@nestjs/common';

import { CronController, RecipesController } from './controllers/index.js';
import { envProvider } from '../../config/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { RecipesService } from './services/index.js';

/**
 * `NotificationsModule` because the platform's cron routes live together in
 * `CronController` — one place the scheduler calls — and one of them is the
 * daily reminder sweep. The unit spec provides the service by hand, so only
 * booting the real application catches its absence: that is what the end-to-end
 * suites are for, and they did.
 */
@Module({ controllers: [CronController, RecipesController], imports: [NotificationsModule], providers: [envProvider, RecipesService] })
export class RecipesModule {}
