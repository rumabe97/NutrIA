import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The locales this API can resolve content into. Must match the dictionaries and
 * the seeded `ingredient_names` — a locale here with no names behind it resolves
 * to the fallback and logs a gap.
 */
const SUPPORTED = ['es-ES', 'en-GB'] as const;

export type SupportedLocale = (typeof SUPPORTED)[number];

/** The tag back, if this API speaks it — the one place a language name is admitted. */
export function supportedLocale(tag: string | null | undefined): SupportedLocale | null {
  return SUPPORTED.find(locale => locale === tag) ?? null;
}

/**
 * The language this *request* wants, or null.
 *
 * Null is a real answer and the common one: a background job has no request to
 * read, and a caller that sends nothing gets the profile's stored preference.
 * The caller decides the fallback, not this.
 *
 * Why a header rather than only `profiles.locale`: the web app's language switch
 * writes a cookie (which the next render reads) *and* the profile column (which
 * persists). Those are two sources of truth, and they disagree for exactly as
 * long as it takes the second write to land — or for ever, if the switch was used
 * signed out, when there is no profile to write to. The symptom is an English
 * interface full of Spanish ingredient names. Letting the request carry the
 * answer collapses the two into one for anything a request can reach.
 */
export function localeFromHeader(header: string | string[] | undefined): SupportedLocale | null {
  if (typeof header !== 'string') {return null;}

  // Not full RFC 4647 negotiation: the web app sends one exact tag, and anything
  // else is a browser's own preference list, which should not override a
  // preference the user actually set on their profile.
  return supportedLocale(header.split(',')[0]?.trim());
}

export const Locale = createParamDecorator((_data: unknown, context: ExecutionContext): string | null =>
  localeFromHeader(context.switchToHttp().getRequest<Request>().headers['accept-language'])
);
