import { deviceOf } from 'core/domain/Device';
import { webUrl } from 'core/domain/WebUrl';

import { passwordChangedEmail } from '../../email/templates/PasswordChanged.js';
import { recipientLocale } from '../../email/services/RecipientLocale.js';

import type { EmailService } from '../../email/services/Email.service.js';

/** The page a person who did not change their password goes to: ask for a reset link. */
const RECOVER_PATH = '/recuperar';

/**
 * "Your password has changed" (PLAN 011 phase 2), after a change from a session
 * and after a reset — sent through `BackgroundTaskService`, like the reset mail,
 * so the route never waits for SMTP.
 *
 * The user agent is read down to a browser and a system family
 * (`core/domain/Device`) and goes no further: never the string itself, never
 * an address. With no mail configured, one line says so and the mail is not
 * sent; it carries no link worth logging, so nothing else is written.
 */
export async function sendPasswordChangedMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  {
    acceptLanguage,
    appUrl,
    at = new Date(),
    to,
    userAgent,
    userId
  }: { acceptLanguage: string | null; appUrl: string; at?: Date; to: string; userAgent: string | null; userId: string }
): Promise<void> {
  if (!mailer.configured) {
    console.info(`[auth] password changed (user ${userId}); no SMTP configured, mail not sent`);

    return;
  }

  const locale = await recipientLocale(userId, acceptLanguage);
  const sent = await mailer.send({
    ...passwordChangedEmail({ at, device: deviceOf(userAgent), locale, recoverUrl: webUrl(appUrl, RECOVER_PATH, locale) }),
    to
  });

  console.info(`[auth] password changed ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
