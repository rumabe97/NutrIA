import styles from './layout.module.css';

import { activeLocale } from 'i18n/server';

import { AppNav } from 'components/AppNav';

import { redirectUnlessReady } from 'lib/access';

import { rootMetadata, siteViewport } from '../_shared/metadata';
import { RootShell } from '../_shared/RootShell';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const viewport: Viewport = siteViewport;

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await activeLocale());
}

/**
 * The signed-in tree's own root layout, and the one place a locale still comes
 * from the cookie rather than the URL.
 *
 * These screens keep their Spanish addresses in every language: they sit behind
 * a session, no crawler ever sees them, and the durable preference is
 * `profiles.locale` — which the cookie caches. They are rendered per request
 * anyway, for the session, so reading a cookie here costs nothing that the
 * public pages could not afford.
 */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [locale] = await Promise.all([activeLocale(), redirectUnlessReady()]);

  return (
    <RootShell locale={locale}>
      <div className={styles.shell}>
        <AppNav />
        <main className={styles.content}>{children}</main>
      </div>
    </RootShell>
  );
}
