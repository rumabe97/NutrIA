import { Injectable, Logger } from '@nestjs/common';

import { ProfessionalBadgeController } from 'core/controllers/Professional';

import { EmailService, recipientLocale } from '../../email/services/index.js';
import { OwnerAlertsService } from './OwnerAlerts.service.js';
import { professionalBadgeDueEmail } from '../../email/templates/ProfessionalBadgeDue.js';
import { professionalBadgeLapsedEmail } from '../../email/templates/ProfessionalBadgeLapsed.js';

/**
 * The badge's part of the daily `/cron/reminders` sweep (project 025 PLAN
 * phase 3, step 4), **only while the `professional` switch is on** — the core
 * sweep answers null otherwise, so nothing is written or mailed before the
 * owner opens the workspace (the badge itself still lapses by date: it is
 * derived, not swept):
 *
 * - each badge 30 days past its re-check gets its `lapsed` row and, once, its
 *   statement of reasons (`textos/06` § V);
 * - each practitioner whose re-check fell due in the last day gets their one
 *   reminder (§ U.2, C5);
 * - the owner gets one alert with counts and the console's link (§ U.1, C8).
 *
 * Here, beside the owner's alerts, because the cron controller already reaches
 * this module and the owner's alert is part of the same pass.
 *
 * **Never throws**: a broken sweep is logged and must not cost the reminders
 * beside it their run. Logs counts only — never an address, an account id, a
 * register or a number: nothing of the badge record reaches the log.
 */
@Injectable()
export class BadgeSweepService {
  private readonly logger = new Logger(BadgeSweepService.name);

  constructor(
    private readonly alerts: OwnerAlertsService,
    private readonly mailer: EmailService
  ) {}

  async run(now = new Date()): Promise<void> {
    try {
      const sweep = await ProfessionalBadgeController.sweep(now);

      if (sweep === null) {
        return;
      }

      let unmailed = 0;

      // The statements first: a lapse already written must reach its practitioner before anything less pressing.
      for (const lapsed of sweep.lapsed) {
        const locale = await recipientLocale(lapsed.userId);
        const sent = await this.mailer.send({
          ...professionalBadgeLapsedEmail({ detail: lapsed.detail, dueAt: lapsed.dueAt, locale }),
          to: lapsed.to
        });

        unmailed += sent ? 0 : 1;
      }

      for (const due of sweep.reminders) {
        const locale = await recipientLocale(due.userId);
        const sent = await this.mailer.send({ ...professionalBadgeDueEmail({ lapsesAt: due.lapsesAt, locale, register: due.register }), to: due.to });

        unmailed += sent ? 0 : 1;
      }

      await this.alerts.badgesDue(sweep.counts, now);

      if (sweep.lapsed.length + sweep.reminders.length > 0 || unmailed > 0) {
        this.logger.log(`badge sweep: lapsed ${sweep.lapsed.length}, reminded ${sweep.reminders.length}, not mailed ${unmailed}`);
      }
    } catch (error: unknown) {
      this.logger.error(`The badge sweep failed: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }
  }
}
