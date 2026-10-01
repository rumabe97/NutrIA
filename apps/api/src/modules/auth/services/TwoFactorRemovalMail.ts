import { webUrl } from 'core/domain/WebUrl';

import { recipientLocale } from '../../email/services/RecipientLocale.js';
import { twoFactorRemovalEmail } from '../../email/templates/TwoFactorRemoval.js';

import type { EmailService } from '../../email/services/Email.service.js';
import type { TwoFactorRemovalEvent } from '../../email/templates/TwoFactorRemoval.js';

/** Where a person who did not ask goes: signing in with a code cancels the request. */
const SIGN_IN_PATH = '/acceder';

/**
 * The owner's removal of a lost second factor, told to the account's own
 * address (PLAN 011 phase 4): requested, cancelled, removed. Always in the
 * account's stored language — the request comes from the owner's console and
 * the removal from a cron, so no header is the account's.
 *
 * With no mail configured, one line says so; neither line carries the
 * address, a date or anything of the request.
 */
export async function sendTwoFactorRemovalMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  { appUrl, event, to, userId }: { appUrl: string; event: TwoFactorRemovalEvent; to: string; userId: string }
): Promise<void> {
  if (!mailer.configured) {
    console.info(`[auth] two-factor removal ${event.kind} (user ${userId}); no SMTP configured, mail not sent`);

    return;
  }

  const locale = await recipientLocale(userId);
  const sent = await mailer.send({ ...twoFactorRemovalEmail({ event, locale, signInUrl: webUrl(appUrl, SIGN_IN_PATH, locale) }), to });

  console.info(`[auth] two-factor removal ${event.kind} ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
