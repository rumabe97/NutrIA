import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';

import { ENV } from '../../../config/index.js';

import type { EmailKind } from '../templates/Layout.js';
import type { Env } from '../../../config/index.js';
import type { Transporter } from 'nodemailer';

const DEFAULT_SMTP_PORT = 587;
const SMTPS_PORT = 465;
const SENDER_NAME = 'NutrIA';

export interface OutgoingEmail {
  html: string;
  /** What the log calls this message when it fails — never its subject. */
  kind: EmailKind;
  subject: string;
  text: string;
  to: string;
}

/**
 * What a failure may say: nodemailer's error code (`EAUTH`, `EENVELOPE`, …)
 * and the server's numeric reply, never the error's message — SMTP servers
 * quote the rejected recipient in it.
 */
function failureOf(error: unknown): string {
  const { code, responseCode } = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; responseCode?: unknown };
  const parts = [
    typeof code === 'string' && /^[A-Z_]+$/.test(code) ? code : 'unknown',
    typeof responseCode === 'number' ? String(responseCode) : null
  ];

  return parts.filter(part => part !== null).join(' ');
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
 * log stream is the most widely read output a service has. Nor does a subject
 * (an invitation's names the professional) or a provider's error message (it
 * quotes the rejected recipient): a failure is logged as the message's `kind`
 * and the error's code.
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
    const secure = port === SMTPS_PORT;

    this.transporter = createTransport({
      auth: { pass: env.SMTP_PASS, user: env.SMTP_USER },
      host: env.SMTP_HOST,
      port,
      // 465 is implicit TLS; everything else upgrades with STARTTLS — required,
      // never opportunistic. An on-path attacker who strips the server's
      // STARTTLS line would otherwise get the password and the reset link in
      // cleartext; this refuses to send instead.
      requireTLS: !secure,
      secure
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
      this.logger.error(`mail not sent (${message.kind}): ${failureOf(error)}`);

      return false;
    }
  }
}
