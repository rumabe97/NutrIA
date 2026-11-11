import 'ui/styles/motion';

import 'ui/styles/colors';
import 'ui/styles/variables';
import 'ui/styles/base';
import 'ui/styles/classnames';

import 'styles/globals.css';
import 'styles/variables.css';
import 'styles/themes.css';

import { dictionaryFor } from 'i18n/server';
import { font } from 'ui/fonts';
import { LocaleProvider } from 'i18n/LocaleProvider';
import { THEME_SCRIPT } from 'ui/utils/themeScript';

import { RouteAnnouncer } from './RouteAnnouncer';
import { ServiceWorker } from './ServiceWorker';
import { SkipLink } from './SkipLink';

import type { Locale } from 'i18n/config';
import type { ReactNode } from 'react';

/**
 * The document every root layout renders, given the language it serves.
 *
 * There are four root layouts — Spanish, English, the signed-in app and the
 * admin console —
 * because `<html lang>` can only be set by a root layout, and a page cannot
 * declare its language without one. Everything they share lives here, including
 * the stylesheet order, which is a cascade: a second copy of that import list
 * would eventually disagree with this one and quietly break the token overrides.
 *
 * The dictionary is put on a context here, once, so a client island anywhere
 * below can read it without every parent passing it down.
 *
 * The skip link is the document's first focusable node, which is the only
 * position it can occupy and still be a skip link, and the announcer is the one
 * client island every tree needs — both here so no root can be built without
 * them. The offline worker is registered from here for the same reason
 * (`0053`): whichever root somebody arrives at, it is running by the time a
 * signed-in screen opens.
 *
 * The theme (`0106`) is applied here too, by the one script in `<head>`: it runs before
 * the first paint, so a chosen theme is never preceded by Automático's colours. It is a
 * static string, the same on every page, so nothing here reads a cookie or a header and
 * the public pages stay prerendered. It sets `data-theme` and `color-scheme` on `<html>`
 * before React hydrates, which is why `<html>` suppresses the hydration warning — for its
 * own attributes only, not for anything below it. `styles/themes.css` comes after the
 * app's other token files: it holds every colour value.
 */
export function RootShell({ children, locale }: Readonly<{ children: ReactNode; locale: Locale }>) {
  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <head>
        {/* A static string from ui/utils/themeScript, never data. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={font.variable}>
        <SkipLink locale={locale} />
        <LocaleProvider dictionary={dictionaryFor(locale)} locale={locale}>
          <RouteAnnouncer />
          <ServiceWorker />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
