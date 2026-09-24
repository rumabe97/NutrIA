import { Inject, Injectable, Logger } from '@nestjs/common';

import { NotificationController } from 'core/controllers/Notification';
import { webUrl } from 'core/domain/WebUrl';

import { checkInSubmittedEmail, checkInSubmittedPush, checkInSubmittedRecord } from '../../email/templates/CheckInSubmitted.js';
import { EmailService } from '../../email/services/Email.service.js';
import { ENV } from '../../../config/index.js';
import { ErrorReporter } from '../../../shared/observability/index.js';
import { PushService } from './Push.service.js';
import { recipientLocale } from '../../email/services/index.js';

import type { EmailLocale } from '../../email/templates/Layout.js';
import type { Env } from '../../../config/index.js';

/**
 * Tells a professional their client answered a check-in (`0059`, PRD 004
 * criterion 10) — by mail and by the phones they subscribed, following
 * `CheckInReminderService`'s shape. Called once per successful submission
 * (`CheckInsService.submit`), never from a sweep: `check_ins_one_per_plan`
 * means `CheckInController.submit` only ever reaches its caller once for a
 * given plan, so a retried request or a concurrent one never calls this
 * twice for the same check-in.
 *
 * Carries the client's name and a link to `/consulta`, and nothing else — no
 * answer, no weight, no rating, no comment. The suggested kcal a supervised
 * client's nudge would have set lives behind the professional's own, audited
 * read of the check-in (`CareController.overview`), never in this message.
 */
@Injectable()
export class CheckInSubmittedService {
  private readonly logger = new Logger(CheckInSubmittedService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly mailer: EmailService,
    private readonly push: PushService,
    private readonly reporter: ErrorReporter
  ) {}

  async notify(professional: { readonly id: string; readonly email: string }, clientName: string): Promise<void> {
    if (!this.mailer.configured && !this.push.configured) {
      return;
    }

    try {
      const locale = await recipientLocale(professional.id);
      const url = webUrl(this.env.APP_URL, '/consulta', locale);

      const [mailed, pushTargets] = await Promise.all([
        this.mail(professional.email, clientName, locale, url),
        NotificationController.pushTargets(professional.id)
      ]);
      const phones = await this.push.send(pushTargets, { ...checkInSubmittedPush(locale, clientName), url });

      if (!mailed && phones === 0) {
        return;
      }

      const record = checkInSubmittedRecord(locale, clientName);

      await NotificationController.recordCheckinSubmitted(professional.id, record.title, record.body, mailed ? 'email' : 'push');
    } catch (error: unknown) {
      this.logger.error(`Check-in notice to a professional failed: ${error instanceof Error ? error.message : 'unknown'}`);
      this.reporter.report(error, 'care:checkin-submitted');
    }
  }

  /** The mail, if there is a way to send it. A refusal or an error is `false`, never a throw. */
  private async mail(to: string, clientName: string, locale: EmailLocale, url: string): Promise<boolean> {
    if (!this.mailer.configured) {
      return false;
    }

    try {
      return await this.mailer.send({ ...checkInSubmittedEmail({ clientName, locale, url }), to });
    } catch (error: unknown) {
      this.logger.error(`Check-in notice mail failed: ${error instanceof Error ? error.message : 'unknown'}`);
      this.reporter.report(error, 'care:checkin-submitted');

      return false;
    }
  }
}
