'use client';
import { createContext, useContext } from 'react';

import { esES } from './dictionaries/es-ES';

import type { Dictionary } from './dictionaries/es-ES';
import type { Locale } from './config';
import type { ReactNode } from 'react';

type LocaleValue = { dictionary: Dictionary; locale: Locale };

/**
 * The dictionary, handed to client components.
 *
 * Server components read it directly with `getDictionary()`; anything with
 * `'use client'` reads it here. One provider at the root, so a client island
 * deep in a tree never has to be given its strings by every parent between.
 *
 * The default is Spanish rather than an empty object: a provider that is
 * somehow missing renders the product's first language, not blank text.
 */
const LocaleContext = createContext<LocaleValue>({ dictionary: esES, locale: 'es-ES' });

export function LocaleProvider({ children, dictionary, locale }: { children: ReactNode; dictionary: Dictionary; locale: Locale }) {
  return <LocaleContext.Provider value={{ dictionary, locale }}>{children}</LocaleContext.Provider>;
}

export function useDictionary(): Dictionary {
  return useContext(LocaleContext).dictionary;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}
