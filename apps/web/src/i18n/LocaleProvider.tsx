'use client';
import { createContext, useContext } from 'react';

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
 * There is no default dictionary, on purpose: importing one here put all of Spanish in a
 * script every visitor downloaded, beside the copy the provider is handed. Every root layout
 * mounts the provider (`app/_shared/RootShell`), so a component that finds none is a test that
 * forgot to wrap it — and says so.
 */
const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children, dictionary, locale }: { children: ReactNode; dictionary: Dictionary; locale: Locale }) {
  return <LocaleContext.Provider value={{ dictionary, locale }}>{children}</LocaleContext.Provider>;
}

function useLocaleValue(): LocaleValue {
  const value = useContext(LocaleContext);

  if (!value) {
    throw new Error('No LocaleProvider above this component: a root layout mounts one, and a test renders inside its own.');
  }

  return value;
}

export function useDictionary(): Dictionary {
  return useLocaleValue().dictionary;
}

export function useLocale(): Locale {
  return useLocaleValue().locale;
}
