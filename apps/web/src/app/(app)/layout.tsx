import styles from './layout.module.css';

import { activeLocale } from 'i18n/server';

import { AppNav } from 'components/AppNav';
import { ArrivalSync } from 'components/ArrivalSync';
import { OfflineCopy } from 'components/OfflineCopy';
import { OfflineProvider } from 'components/OfflineProvider';

import { redirectUnlessReady } from 'lib/access';

import { MAIN_ID } from '../_shared/mainId';
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
  // When this screen was made. A server component runs once per request, so
  // this is the request's moment, not a value that drifts between renders.
  const renderedAt = new Date().getTime();

  return (
    <RootShell locale={locale}>
      {/* Somebody back from Google or Apple has the after-sign-in step still to run (`0058`). */}
      <ArrivalSync />
      {/* Stamped with the moment this screen was made, so a stored copy can say how old it is (`0053`). */}
      <OfflineProvider renderedAt={renderedAt}>
        <div className={styles.shell}>
          <AppNav />
          <main className={styles.content} id={MAIN_ID}>
            <OfflineCopy />
            {children}
          </main>
        </div>
      </OfflineProvider>
    </RootShell>
  );
}
