import { deviceOf } from 'core/domain/Device';
import { webUrl } from 'core/domain/WebUrl';

import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { twoFactorChangedEmail } from '../../email/templates/TwoFactorChanged.js';

import type { EmailService } from '../../email/services/Email.service.js';
import type { TwoFactorEvent } from '../../email/templates/TwoFactorChanged.js';

/** The page a person who did not do it goes to: somebody knows the password, so ask for a reset link. */
const RECOVER_PATH = '/recuperar';

/**
 * The second factor went on, went off, or a backup code was spent (PLAN 011
 * phase 3) — sent through `BackgroundTaskService`, like the password mail, so
 * the route never waits for SMTP.
 *
 * The user agent goes no further than a browser and a system family
 * (`core/domain/Device`). With no mail configured, one line says so; neither
 * line carries the secret, a code, the address or the agent.
 */
export async function sendTwoFactorMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  {
    acceptLanguage,
    appUrl,
    at = new Date(),
    event,
    to,
    userAgent,
    userId
  }: { acceptLanguage: string | null; appUrl: string; at?: Date; event: TwoFactorEvent; to: string; userAgent: string | null; userId: string }
): Promise<void> {
  if (!mailer.configured) {
    console.info(`[auth] two-factor ${event.kind} (user ${userId}); no SMTP configured, mail not sent`);

    return;
  }

  const locale = await recipientLocale(userId, acceptLanguage);
  const sent = await mailer.send({
    ...twoFactorChangedEmail({ at, device: deviceOf(userAgent), event, locale, recoverUrl: webUrl(appUrl, RECOVER_PATH, locale) }),
    to
  });

  console.info(`[auth] two-factor ${event.kind} ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
