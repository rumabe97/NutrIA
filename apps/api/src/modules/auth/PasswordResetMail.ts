import { passwordResetEmail } from '../email/templates/PasswordReset.js';
import { localeFromHeader } from '../../shared/decorators/Locale.decorator.js';

import type { EmailService } from '../email/Email.service.js';
import type { EmailLocale } from '../email/templates/Layout.js';

const DEFAULT_LOCALE: EmailLocale = 'es-ES';

/**
 * Better Auth's `sendResetPassword` hook, as a function that can be exercised
 * without standing up Better Auth.
 *
 * It never throws. The web form always answers "if that account exists, we
 * have sent a link" — and Better Auth only calls this hook when the account
 * *does* exist, so an error escaping here would turn into a response that
 * differs between registered and unregistered addresses. A failure is logged
 * for the owner, not surfaced to the requester.
 *
 * With no mail configured the link goes to the log, as it always did: that is
 * what makes password reset work in local development.
 */
export async function sendPasswordResetMail(
  mailer: Pick<EmailService, 'configured' | 'send'>,
  { acceptLanguage, to, url, userId }: { acceptLanguage: string | null; to: string; url: string; userId: string }
): Promise<void> {
  const locale = (localeFromHeader(acceptLanguage ?? undefined) ?? DEFAULT_LOCALE) as EmailLocale;

  if (!mailer.configured) {
    console.info(`[auth] password reset requested (user ${userId}); no SMTP configured, url: ${url}`);

    return;
  }

  const sent = await mailer.send({ ...passwordResetEmail({ locale, url }), to });

  console.info(`[auth] password reset ${sent ? 'mail sent' : 'mail NOT sent'} (user ${userId})`);
}
