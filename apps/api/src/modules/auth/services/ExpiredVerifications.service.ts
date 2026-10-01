import { Injectable, Logger } from '@nestjs/common';

import { UserController } from 'core/controllers/User';

/**
 * The daily prune of Better Auth's `verification` table (PLAN 011). Better
 * Auth used to delete expired rows on every lookup, inside the request; that
 * cleanup is off (`auth.config.ts`, `verification.disableCleanup`) because it
 * ran only on the unknown-address branch of a reset, and the extra round trip
 * told a stranger which addresses have accounts. Called by
 * `/cron/sweep-verifications`, on its own: no AI, no mail, no switch.
 */
@Injectable()
export class ExpiredVerificationsService {
  private readonly logger = new Logger(ExpiredVerificationsService.name);

  /** Throws on failure, so the cron run shows as failed; tomorrow's run deletes what today's did not. */
  async forget(): Promise<number> {
    const count = await UserController.forgetExpiredVerifications();

    this.logger.log(`Expired verification rows deleted: ${count}`);

    return count;
  }
}
