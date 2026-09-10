import 'ui/styles/motion';

import 'ui/styles/colors';
import 'ui/styles/variables';
import 'ui/styles/base';
import 'ui/styles/classnames';

import 'styles/globals.css';
import 'styles/variables.css';

import { dictionaryFor } from 'i18n/server';
import { font } from 'ui/fonts';
import { LocaleProvider } from 'i18n/LocaleProvider';

import type { Locale } from 'i18n/config';
import type { ReactNode } from 'react';

/**
 * The document every root layout renders, given the language it serves.
 *
 * There are three root layouts — Spanish, English, and the signed-in app —
 * because `<html lang>` can only be set by a root layout, and a page cannot
 * declare its language without one. Everything they share lives here, including
 * the stylesheet order, which is a cascade: a second copy of that import list
 * would eventually disagree with this one and quietly break the token overrides.
 *
 * The dictionary is put on a context here, once, so a client island anywhere
 * below can read it without every parent passing it down.
 */
export function RootShell({ children, locale }: Readonly<{ children: ReactNode; locale: Locale }>) {
  return (
    <html lang={locale}>
      <body className={font.variable}>
        <LocaleProvider dictionary={dictionaryFor(locale)} locale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
