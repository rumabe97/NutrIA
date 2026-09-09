import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationController } from 'core/controllers/Notification';

import { checkInReminderEmail, checkInReminderRecord } from '../email/templates/CheckInReminder.js';
import { EmailService } from '../email/Email.service.js';
import { ENV } from '../../config/index.js';
import { ErrorReporter } from '../../shared/observability/index.js';

import type { EmailLocale } from '../email/templates/Layout.js';
import type { Env } from '../../config/index.js';

/**
 * How many reminders one sweep may send.
 *
 * The sweep runs daily and each account is due at most once a fortnight, so
 * this is a ceiling on a burst, not a throughput target. It also keeps the
 * function well inside its time budget and the sender well inside a free
 * provider's daily allowance.
 */
const PER_SWEEP = 40;

const FALLBACK_LOCALE: EmailLocale = 'es-ES';

export type ReminderRun = { readonly considered: number; readonly failed: number; readonly sent: number };

/**
 * Tells people their fortnight has closed, once.
 *
 * The record of having sent is a `notifications` row written *after* the
 * provider accepted the mail, and the query that finds recipients excludes
 * anyone with such a row since their plan began. So a failed send is retried
 * tomorrow and a successful one is never repeated — the two cannot disagree,
 * because there is only one fact.
 */
@Injectable()
export class CheckInReminderService {
  private readonly logger = new Logger(CheckInReminderService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailer: EmailService,
    private readonly reporter: ErrorReporter
  ) {}

  async sweep(today = new Date().toISOString().slice(0, 10)): Promise<ReminderRun> {
    if (!this.mailer.configured) {
      this.logger.warn('Check-in reminders skipped: no SMTP configured');

      return { considered: 0, failed: 0, sent: 0 };
    }

    const due = await NotificationController.checkInDue(today, PER_SWEEP);
    let sent = 0;
    let failed = 0;

    for (const recipient of due) {
      const locale: EmailLocale = recipient.locale === 'en-GB' ? 'en-GB' : FALLBACK_LOCALE;
      const url = `${this.env.APP_URL}/check-in`;

      try {
        const accepted = await this.mailer.send({ ...checkInReminderEmail({ locale, url }), to: recipient.email });

        if (!accepted) {
          failed += 1;
          continue;
        }

        const record = checkInReminderRecord(locale);

        await NotificationController.recordCheckInReminder(recipient.userId, record.title, record.body);
        sent += 1;
      } catch (error: unknown) {
        // One recipient's failure is not the sweep's: the rest still get theirs,
        // and this one is tried again tomorrow because nothing was recorded.
        failed += 1;
        this.logger.error(`Check-in reminder failed for one recipient: ${error instanceof Error ? error.message : 'unknown'}`);
        this.reporter.report(error, 'reminders:checkin');
      }
    }

    if (sent > 0 || failed > 0) {this.logger.log(`Check-in reminders: ${sent} sent, ${failed} failed, ${due.length} due`);}

    return { considered: due.length, failed, sent };
  }
}
