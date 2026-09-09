import { Module } from '@nestjs/common';

import { envProvider } from '../../config/index.js';
import { IllustrateController } from './illustrate.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RecipesController } from './recipes.controller.js';

/**
 * `NotificationsModule` because the platform's cron routes live together in
 * `IllustrateController` — one place the scheduler calls — and one of them is
 * the daily reminder sweep. The unit spec provides the service by hand, so only
 * booting the real application catches its absence: that is what the end-to-end
 * suites are for, and they did.
 */
@Module({ controllers: [IllustrateController, RecipesController], imports: [NotificationsModule], providers: [envProvider] })
export class RecipesModule {}
