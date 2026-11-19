import { Injectable, Logger } from '@nestjs/common';

import { ProfessionalController } from 'core/controllers/Professional';

/**
 * The close of a practice on its day (PRD 025 scope 16, criterion 24), in the
 * daily `/cron/reminders` sweep before the badge's own pass and the illness
 * rule's: every practice whose `closing` row has come ends its open links as
 * its practitioner ending them (each client may then accept somebody else), has
 * a standing badge withdrawn and its profile requeued, and loses its
 * `professionals` row and its invitations — one transaction each
 * (`ProfessionalController.closeDue`). The `closing` row stays, so the account
 * cannot open a practice again until the owner lifts it.
 *
 * Whatever the `professional` switch says: the owner decided the close and its
 * day. **Nobody is mailed**: the statement of reasons went with the notice, 30
 * days before (`textos/06` § W bis.3), and a link its practitioner ends is mailed
 * to nobody — so the clients are told exactly what they are told when a
 * practitioner ends a link themselves.
 *
 * **Never throws**: a broken sweep is logged and must not cost the reminders
 * beside it their run; tomorrow's finds what today's did not reach. Logs the
 * counts, and a practice whose close failed by its account id alone.
 */
@Injectable()
export class PracticeCloseSweepService {
  private readonly logger = new Logger(PracticeCloseSweepService.name);

  async run(now = new Date()): Promise<void> {
    try {
      const { closed, failed } = await ProfessionalController.closeDue(now);

      // By the account's id alone, as `two_factor_removal_failed`: never an address or the close's reasons.
      for (const userId of failed) {
        this.logger.error(`practice_close_failed ${JSON.stringify({ userId })}`);
      }

      if (closed.length + failed.length > 0) {
        this.logger.log(`practice close sweep: closed ${closed.length}, failed ${failed.length}`);
      }
    } catch (error: unknown) {
      this.logger.error(`The practice close sweep failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }
}
