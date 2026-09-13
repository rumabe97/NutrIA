import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationController } from 'core/controllers/Notification';
import { SettingsController } from 'core/controllers/Settings';
import { webUrl } from 'core/domain/WebUrl';

import { checkInReminderEmail, checkInReminderPush, checkInReminderRecord } from '../../email/templates/CheckInReminder.js';
import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { ErrorReporter } from '../../../shared/observability/index.js';
import { PushService } from './Push.service.js';

import type { EmailLocale } from '../../email/templates/Layout.js';
import type { Env } from '../../../config/index.js';
import type { Recipient } from 'core/controllers/Notification';

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

export type ReminderRun = {
  readonly considered: number;
  readonly failed: number;
  /** Of those told, how many were told on at least one phone as well. */
  readonly pushed: number;
  readonly sent: number;
};

const NOTHING: ReminderRun = { considered: 0, failed: 0, pushed: 0, sent: 0 };

/**
 * Tells people their fortnight has closed, once — by mail, and on the phones
 * they asked to be told on (`0027`, `0054`).
 *
 * Nothing at all unless the owner has switched it on at `/admin`
 * (`checkInReminders`), and nothing unless there is a way to send.
 *
 * The record of having told them is a `notifications` row written *after* a
 * channel accepted, and the query that finds recipients excludes anyone with
 * such a row since their plan began. So a reminder nothing accepted is tried
 * again tomorrow and one that reached them is never repeated — the two cannot
 * disagree, because there is only one fact.
 */
@Injectable()
export class CheckInReminderService {
  private readonly logger = new Logger(CheckInReminderService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailer: EmailService,
    private readonly push: PushService,
    private readonly reporter: ErrorReporter
  ) {}

  async sweep(today = new Date().toISOString().slice(0, 10)): Promise<ReminderRun> {
    if (!(await SettingsController.checkInReminders())) {
      this.logger.log('Check-in reminders skipped: switched off on /admin');

      return NOTHING;
    }

    if (!this.mailer.configured && !this.push.configured) {
      this.logger.warn('Check-in reminders skipped: neither SMTP nor push is configured');

      return NOTHING;
    }

    const due = await NotificationController.checkInDue(today, PER_SWEEP);
    let sent = 0;
    let pushed = 0;
    let failed = 0;

    for (const recipient of due) {
      const locale: EmailLocale = recipient.locale === 'en-GB' ? 'en-GB' : FALLBACK_LOCALE;
      // The same path is a different page in each language, so the link follows
      // the copy rather than the product's default (`webUrl`).
      const url = webUrl(this.env.APP_URL, '/check-in', locale);

      try {
        // Each channel on its own: a mail the provider refused must not cost the
        // phone its reminder, nor the other way round.
        const mailed = await this.mail(recipient, locale, url);
        const phones = await this.push.send(recipient.pushTargets, { ...checkInReminderPush(locale), url });

        if (!mailed && phones === 0) {
          failed += 1;
          continue;
        }

        const record = checkInReminderRecord(locale);

        await NotificationController.recordCheckInReminder(recipient.userId, record.title, record.body, mailed ? 'email' : 'push');
        sent += 1;
        pushed += phones > 0 ? 1 : 0;
      } catch (error: unknown) {
        // One recipient's failure is not the sweep's: the rest still get theirs,
        // and this one is tried again tomorrow because nothing was recorded.
        failed += 1;
        this.logger.error(`Check-in reminder failed for one recipient: ${error instanceof Error ? error.message : 'unknown'}`);
        this.reporter.report(error, 'reminders:checkin');
      }
    }

    if (sent > 0 || failed > 0) {
      this.logger.log(`Check-in reminders: ${sent} sent (${pushed} on a phone too), ${failed} failed, ${due.length} due`);
    }

    return { considered: due.length, failed, pushed, sent };
  }

  /** The mail, if they still want it and there is a way to send it. A refusal or an error is `false`, never a throw. */
  private async mail(recipient: Recipient, locale: EmailLocale, url: string): Promise<boolean> {
    if (!recipient.wantsEmail || !this.mailer.configured) {
      return false;
    }

    try {
      return await this.mailer.send({ ...checkInReminderEmail({ locale, url }), to: recipient.email });
    } catch (error: unknown) {
      this.logger.error(`Check-in reminder mail failed for one recipient: ${error instanceof Error ? error.message : 'unknown'}`);
      this.reporter.report(error, 'reminders:checkin');

      return false;
    }
  }
}
