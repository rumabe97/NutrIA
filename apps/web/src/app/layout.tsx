import 'ui/styles/motion';

import 'ui/styles/colors';
import 'ui/styles/variables';
import 'ui/styles/base';
import 'ui/styles/classnames';

import 'styles/globals.css';
import 'styles/variables.css';

import { activeLocale, dictionaryFor, getDictionary } from 'i18n/server';
import { font } from 'ui/fonts';
import { LocaleProvider } from 'i18n/LocaleProvider';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Generated rather than static: the description is the same sentence the hero
 * shows, and a search result or a shared link in the wrong language is the first
 * thing a reader sees.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return { description: dictionary.landing.lede, title: `NutrIA — ${dictionary.landing.title}` };
}

/**
 * `lang` is resolved rather than hardcoded, so assistive technology and the
 * browser's own translation offer both agree with what is on screen. The
 * dictionary is put on a context here, once, so a client island anywhere below
 * can read it without every parent passing it down.
 */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await activeLocale();

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
