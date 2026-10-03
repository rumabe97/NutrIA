import { deviceOf } from 'core/domain/Device';
import { webUrl } from 'core/domain/WebUrl';

import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { passkeyAddedEmail } from '../../email/templates/PasskeyAdded.js';

import type { EmailService } from '../../email/services/Email.service.js';

/** The page a person who did not do it goes to first: somebody was inside the account, so ask for a reset link. */
const RECOVER_PATH = '/recuperar';

/**
 * A passkey was added (PLAN 011 phase 5) — sent through `BackgroundTaskService`,
 * like the two-factor mail, so the route never waits for SMTP.
 *
 * The user agent goes no further than a browser and a system family
 * (`core/domain/Device`). With no mail configured, one line says so; neither
 * line carries the passkey, its name, the address or the agent.
 */
export async function sendPasskeyAddedMail(
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
    console.info(`[auth] passkey added (user ${userId}); no SMTP configured, mail not sent`);

    return;
  }

  const locale = await recipientLocale(userId, acceptLanguage);
  const sent = await mailer.send({
    ...passkeyAddedEmail({ at, device: deviceOf(userAgent), locale, recoverUrl: webUrl(appUrl, RECOVER_PATH, locale) }),
    to
  });

  console.info(`[auth] passkey added ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
