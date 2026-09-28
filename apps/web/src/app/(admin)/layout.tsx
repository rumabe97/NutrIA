import { activeLocale } from 'i18n/server';

import { rootMetadata, siteViewport } from '../_shared/metadata';
import { RootShell } from '../_shared/RootShell';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const viewport: Viewport = siteViewport;

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await activeLocale());
}

/**
 * The console's own root layout (`0068`): the document and its language, and
 * nothing else.
 *
 * Its own root because a nested layout cannot take away what a root draws, and
 * the app's root draws its own navigation, the offline provider and the offline copy —
 * none of which belongs here: these pages hold email addresses and must never
 * be kept on a device for reading offline. No `ArrivalSync` and no
 * `redirectUnlessReady` either: the owner reaches the console already signed
 * in, and the gate below asks the API who they are.
 *
 * The locale comes from the cookie, as on every signed-in screen; the console
 * keeps its Spanish addresses in both languages.
 */
export default async function AdminRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RootShell locale={await activeLocale()}>{children}</RootShell>;
}
