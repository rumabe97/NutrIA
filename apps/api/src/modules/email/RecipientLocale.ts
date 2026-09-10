import { ProfileController } from 'core/controllers/Profile';

import { supportedLocale } from '../../shared/decorators/Locale.decorator.js';

import type { EmailLocale } from './templates/Layout.js';

const DEFAULT_LOCALE: EmailLocale = 'es-ES';

/**
 * The language one person's mail is written in — and, since the web app serves
 * each language on its own path, the language its links open in.
 *
 * The stored profile wins over the request that set the mail off. A reset asked
 * for from a borrowed laptop, or a sweep with no request at all, still has to
 * arrive in the language that person reads the product in; and the button has
 * to agree with the copy around it, because they are one message. The header is
 * the fallback for the one mail that goes out before a profile exists — the
 * confirmation at sign-up — and Spanish is the fallback for that.
 *
 * Never throws. Every caller here is a mail, and a mail that did not go out
 * because a locale lookup failed is a worse outcome than a mail in the wrong
 * language.
 */
export async function recipientLocale(userId: string, acceptLanguage?: string | null): Promise<EmailLocale> {
  return (await storedLocale(userId)) ?? supportedLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}

async function storedLocale(userId: string): Promise<EmailLocale | null> {
  try {
    return supportedLocale(await ProfileController.localeOf(userId));
  } catch (error) {
    console.info(`[email] locale lookup failed (user ${userId}): ${error instanceof Error ? error.message : 'unknown error'}`);

    return null;
  }
}
