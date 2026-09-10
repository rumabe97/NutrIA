import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

import { ENV } from '../../../config/index.js';

import type { Env } from '../../../config/index.js';
import type { Transporter } from 'nodemailer';

const DEFAULT_SMTP_PORT = 587;
const SMTPS_PORT = 465;
const SENDER_NAME = 'NutrIA';

export interface OutgoingEmail {
  html: string;
  subject: string;
  text: string;
  to: string;
}

/**
 * The one door mail leaves through.
 *
 * SMTP rather than a provider's SDK: every provider worth using speaks it —
 * Gmail with an app password today, a transactional service on the product's
 * own domain tomorrow — so moving is four environment variables and no code.
 *
 * With no `SMTP_HOST` it is *unconfigured* and says so once at boot; `send`
 * then returns false and the caller decides what that means (the auth hooks
 * log the link instead, so local development still works end to end).
 *
 * Addresses never reach the log. A recipient is an account identifier, and the
 * log stream is the most widely read output a service has.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | null;

  constructor(@Inject(ENV) env: Env) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM) {
      this.transporter = null;
      this.from = null;
      this.logger.warn('SMTP is not configured; mail is not sent and links go to the log');

      return;
    }

    const port = env.SMTP_PORT ?? DEFAULT_SMTP_PORT;

    this.transporter = createTransport({
      auth: { pass: env.SMTP_PASS, user: env.SMTP_USER },
      host: env.SMTP_HOST,
      port,
      // 465 is implicit TLS; everything else upgrades with STARTTLS.
      secure: port === SMTPS_PORT
    });
    this.from = `"${SENDER_NAME}" <${env.EMAIL_FROM}>`;
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  /** True when the provider accepted the message. Never throws: a mail failure is the caller's to interpret. */
  async send(message: OutgoingEmail): Promise<boolean> {
    if (!this.transporter || !this.from) {
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.from, html: message.html, subject: message.subject, text: message.text, to: message.to });

      return true;
    } catch (error) {
      this.logger.error(`mail not sent (${message.subject}): ${error instanceof Error ? error.message : 'unknown error'}`);

      return false;
    }
  }
}
