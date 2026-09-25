import { Injectable, Logger } from '@nestjs/common';

import { CareController } from 'core/controllers/Care';

/**
 * The daily sweep's care part: every invitation past its date is deleted, so no
 * address somebody typed outlives its invitation by more than a day, as the invitation mail promises (RGPD
 * art. 14, `docs/legal/textos/06` § A), even when nobody invites anybody for a
 * while. Called by `/cron/reminders`, the sweep that runs every day.
 */
@Injectable()
export class ExpiredInvitationsService {
  private readonly logger = new Logger(ExpiredInvitationsService.name);

  /** Never throws: a failed purge is logged and retried the next day, and must not stop the reminders beside it. */
  async forget(): Promise<void> {
    try {
      const count = await CareController.forgetExpiredInvitations();

      if (count > 0) {
        this.logger.log(`Expired invitations deleted: ${count}`);
      }
    } catch (error: unknown) {
      this.logger.warn(`Expired invitations not deleted: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }
}
