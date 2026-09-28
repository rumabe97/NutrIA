import { cache } from 'react';

import { activeLocale, dictionaryFor } from 'i18n/server';

import { serverApi } from 'lib/server-api';

import type { Metadata } from 'next';
import type { PagePath } from '../../_shared/pages';
import type { UserView } from 'core/controllers/User';

/**
 * Who is asking, read once per request: the gate (`layout.tsx`) and every page's
 * title ask the same question, and `cache` lets them share one call to the API.
 */
export const readConsoleUser = cache(() => serverApi<UserView>('/users/me'));

/**
 * A console page's title — for an admin only (`0028`).
 *
 * Next resolves a page's metadata even when the gate above it answers 404, and the
 * title is in the document: "Cuentas · NutrIA" on a 404 says the page exists. So
 * anybody but an admin gets the title every other 404 has, which names nothing.
 */
export async function consoleMetadata(path: PagePath): Promise<Metadata> {
  const [user, locale] = await Promise.all([readConsoleUser(), activeLocale()]);
  const dictionary = dictionaryFor(locale);

  return { title: user?.role === 'admin' ? dictionary.pages[path].title : dictionary.errors.notFoundTitle };
}
