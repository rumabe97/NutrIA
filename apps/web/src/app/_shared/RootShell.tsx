import 'ui/styles/motion';

import 'ui/styles/colors';
import 'ui/styles/variables';
import 'ui/styles/base';
import 'ui/styles/classnames';

import 'styles/globals.css';
import 'styles/variables.css';
import 'styles/themes.css';

import { dictionaryFor, publicDictionaryFor } from 'i18n/server';
import { displayFont, font } from 'ui/fonts';
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
 * How much of it is the root's to say (`strings`): a public tree's client components read a
 * dozen of its sections and are sent those (`i18n/publicSections`), because what the provider
 * is handed travels inside the HTML of every page; the signed-in app and the console read
 * nearly all of it and are sent all. Leaving one root for another is a full page load, so a
 * part never follows anybody into a tree that needs the whole.
 *
 * The skip link is the document's first focusable node, which is the only
 * position it can occupy and still be a skip link, and the announcer is the one
 * client island every tree needs — both here so no root can be built without
 * them. The offline worker is registered from here for the same reason
 * (`0053`): whichever root somebody arrives at, it is running by the time a
 * signed-in screen opens.
 *
 * Both faces are mounted on `<body>`: Figtree for text, Bricolage Grotesque for headings
 * (`ui/fonts`), each preloaded, the same two files on every page and in every theme.
 *
 * The theme (`0106`) is applied here too, by the one script in `<head>`: it runs before
 * the first paint, so a chosen theme is never preceded by Automático's colours. It is a
 * static string, the same on every page, so nothing here reads a cookie or a header and
 * the public pages stay prerendered. It sets `data-theme` and `color-scheme` on `<html>`
 * before React hydrates, which is why `<html>` suppresses the hydration warning — for its
 * own attributes only, not for anything below it. `styles/themes.css` comes after the
 * app's other token files: it holds every colour value.
 */
export function RootShell({ children, locale, strings }: Readonly<{ children: ReactNode; locale: Locale; strings: 'all' | 'public' }>) {
  return (
    <html lang={locale} suppressHydrationWarning={true}>
      <head>
        {/* A static string from ui/utils/themeScript, never data. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${font.variable} ${displayFont.variable}`}>
        <SkipLink locale={locale} />
        <LocaleProvider dictionary={strings === 'public' ? publicDictionaryFor(locale) : dictionaryFor(locale)} locale={locale}>
          <RouteAnnouncer />
          <ServiceWorker />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
